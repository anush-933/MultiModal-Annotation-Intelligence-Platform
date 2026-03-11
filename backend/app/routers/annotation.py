import random
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Annotation, Sample, Dataset, IAARecord
from app.schemas import AnnotationRequest, AnnotationResponse, IAAResponse
from app.services.iaa_calculator import calculate_iaa

router = APIRouter()

# Labels per task type (used to inject simulated annotator)
_TASK_LABELS: dict[str, list[str]] = {
    "intent_classification": [
        "play_music", "set_alarm", "get_weather", "control_device",
        "send_message", "search_web", "navigate", "set_reminder",
        "schedule_meeting", "summarize",
    ],
    "sentiment_analysis": ["positive", "negative", "neutral", "mixed"],
    "question_answering": ["correct", "incorrect", "partial"],
    "text_classification": ["category_a", "category_b", "category_c", "other"],
}


# ── Queue ─────────────────────────────────────────────────────────────────────

@router.get("/queue")
def get_global_queue(db: Session = Depends(get_db)):
    """Return all pending/flagged samples across all datasets."""
    samples = (
        db.query(Sample)
        .filter(Sample.annotation_status.in_(["pending", "flagged"]))
        .order_by(Sample.created_at)
        .limit(50)
        .all()
    )
    return samples


@router.get("/queue/{dataset_id}")
def get_dataset_queue(dataset_id: int, db: Session = Depends(get_db)):
    """Return pending samples for a specific dataset."""
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(404, "Dataset not found")
    samples = (
        db.query(Sample)
        .filter(
            Sample.dataset_id == dataset_id,
            Sample.annotation_status.in_(["pending", "flagged"]),
        )
        .order_by(Sample.id)
        .all()
    )
    return samples


# ── Submit Annotation ─────────────────────────────────────────────────────────

@router.post("/submit", response_model=AnnotationResponse, status_code=201)
def submit_annotation(request: AnnotationRequest, db: Session = Depends(get_db)):
    """
    Submit a human annotation.
    Automatically injects a simulated second annotator (80 % agreement)
    so IAA is always computable.
    """
    sample = db.query(Sample).filter(Sample.id == request.sample_id).first()
    if not sample:
        raise HTTPException(404, "Sample not found")

    # Idempotency: skip if this annotator already labeled this sample
    existing = (
        db.query(Annotation)
        .filter(
            Annotation.sample_id == request.sample_id,
            Annotation.annotator_id == request.annotator_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(409, "Annotation already submitted by this annotator")

    ann = Annotation(
        sample_id=request.sample_id,
        annotator_id=request.annotator_id,
        label=request.label,
        confidence=request.confidence,
        notes=request.notes,
    )
    db.add(ann)

    # Inject simulated second annotator if not already present
    sim_exists = (
        db.query(Annotation)
        .filter(
            Annotation.sample_id == request.sample_id,
            Annotation.annotator_id == "annotator_sim",
        )
        .first()
    )
    if not sim_exists:
        dataset = db.query(Dataset).filter(Dataset.id == sample.dataset_id).first()
        sim_label = request.label
        if random.random() < 0.18 and dataset:  # ~18 % disagreement rate
            candidates = _TASK_LABELS.get(dataset.task_type, [])
            others = [l for l in candidates if l != request.label]
            if others:
                sim_label = random.choice(others)
        db.add(
            Annotation(
                sample_id=request.sample_id,
                annotator_id="annotator_sim",
                label=sim_label,
                confidence=0.85,
            )
        )

    # Mark sample as completed
    sample.annotation_status = "completed"
    db.commit()
    db.refresh(ann)
    return ann


# ── IAA ───────────────────────────────────────────────────────────────────────

@router.get("/iaa/{dataset_id}", response_model=IAAResponse)
def get_iaa(dataset_id: int, db: Session = Depends(get_db)):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(404, "Dataset not found")

    result = calculate_iaa(db, dataset_id)

    # Persist the latest IAA snapshot
    record = IAARecord(
        dataset_id=dataset_id,
        kappa_score=result["kappa_score"],
        agreement_pct=result["agreement_pct"],
        num_samples_evaluated=result["num_samples_evaluated"],
    )
    db.add(record)
    db.commit()

    return result


# ── History ───────────────────────────────────────────────────────────────────

@router.get("/history/{dataset_id}", response_model=list[AnnotationResponse])
def annotation_history(dataset_id: int, db: Session = Depends(get_db)):
    samples = db.query(Sample).filter(Sample.dataset_id == dataset_id).all()
    sample_ids = [s.id for s in samples]
    return (
        db.query(Annotation)
        .filter(
            Annotation.sample_id.in_(sample_ids),
            Annotation.annotator_id != "annotator_sim",
        )
        .order_by(Annotation.created_at.desc())
        .all()
    )
