from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.models import Dataset, Sample, Evaluation
from app.schemas import EvaluationRequest, EvaluationResponse, EvaluationSummary
from app.services.claude_service import evaluate_sample_quality

router = APIRouter()


# ── Run Evaluation (async background) ────────────────────────────────────────

@router.post("/run", status_code=202)
def run_evaluation(
    request: EvaluationRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Kick off LLM-as-Judge evaluation for a dataset.
    Returns immediately; frontend polls /status/{dataset_id}.
    """
    ds = db.query(Dataset).filter(Dataset.id == request.dataset_id).first()
    if not ds:
        raise HTTPException(404, "Dataset not found")
    if ds.evaluation_status == "running":
        return {"dataset_id": ds.id, "status": "running", "message": "Evaluation already in progress"}

    # Clear old evaluations for fresh run
    sample_ids = [s.id for s in db.query(Sample).filter(Sample.dataset_id == request.dataset_id).all()]
    db.query(Evaluation).filter(Evaluation.sample_id.in_(sample_ids)).delete(synchronize_session=False)

    ds.evaluation_status = "running"
    db.commit()

    background_tasks.add_task(
        _evaluate_dataset_bg,
        dataset_id=request.dataset_id,
        sample_ids=request.sample_ids,
    )
    return {"dataset_id": ds.id, "status": "running", "message": "Evaluation started"}


def _evaluate_dataset_bg(dataset_id: int, sample_ids: Optional[List[int]]):
    """Background worker: calls Claude for each sample and stores scores."""
    db = SessionLocal()
    try:
        ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        query = db.query(Sample).filter(Sample.dataset_id == dataset_id)
        if sample_ids:
            query = query.filter(Sample.id.in_(sample_ids))
        samples = query.all()

        for sample in samples:
            scores = evaluate_sample_quality(
                content=sample.content,
                task_type=ds.task_type,
                label=sample.label or "",
                task_schema=ds.task_schema,
            )
            ev = Evaluation(
                sample_id=sample.id,
                coherence_score=scores.get("coherence_score", 0),
                diversity_score=scores.get("diversity_score", 0),
                coverage_score=scores.get("coverage_score", 0),
                accuracy_score=scores.get("accuracy_score", 0),
                overall_score=scores.get("overall_score", 0),
                reasoning=scores.get("reasoning", ""),
                flagged=scores.get("flagged", False),
            )
            db.add(ev)
            db.commit()

        ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        ds.evaluation_status = "completed"
        db.commit()
    except Exception as exc:
        db2 = SessionLocal()
        try:
            ds2 = db2.query(Dataset).filter(Dataset.id == dataset_id).first()
            if ds2:
                ds2.evaluation_status = "error"
            db2.commit()
        finally:
            db2.close()
        print(f"[Evaluation] background error: {exc}")
    finally:
        db.close()


# ── Status ────────────────────────────────────────────────────────────────────

@router.get("/status/{dataset_id}")
def evaluation_status(dataset_id: int, db: Session = Depends(get_db)):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(404, "Dataset not found")
    total = db.query(Sample).filter(Sample.dataset_id == dataset_id).count()
    evaluated = (
        db.query(Evaluation)
        .filter(Evaluation.sample_id.in_(
            [s.id for s in db.query(Sample).filter(Sample.dataset_id == dataset_id).all()]
        ))
        .count()
    )
    return {
        "dataset_id": dataset_id,
        "evaluation_status": ds.evaluation_status,
        "total_samples": total,
        "evaluated_samples": evaluated,
        "progress_pct": round(evaluated / total * 100, 1) if total else 0,
    }


# ── Results ───────────────────────────────────────────────────────────────────

@router.get("/results/{dataset_id}", response_model=list[EvaluationResponse])
def get_results(dataset_id: int, db: Session = Depends(get_db)):
    sample_ids = [
        s.id
        for s in db.query(Sample).filter(Sample.dataset_id == dataset_id).all()
    ]
    return (
        db.query(Evaluation)
        .filter(Evaluation.sample_id.in_(sample_ids))
        .order_by(Evaluation.id)
        .all()
    )


@router.get("/summary/{dataset_id}", response_model=EvaluationSummary)
def get_summary(dataset_id: int, db: Session = Depends(get_db)):
    sample_ids = [
        s.id
        for s in db.query(Sample).filter(Sample.dataset_id == dataset_id).all()
    ]
    evals = (
        db.query(Evaluation)
        .filter(Evaluation.sample_id.in_(sample_ids))
        .all()
    )
    if not evals:
        raise HTTPException(404, "No evaluations found for this dataset")

    n = len(evals)
    flagged = sum(1 for e in evals if e.flagged)
    return EvaluationSummary(
        dataset_id=dataset_id,
        avg_coherence=round(sum(e.coherence_score for e in evals) / n, 2),
        avg_diversity=round(sum(e.diversity_score for e in evals) / n, 2),
        avg_coverage=round(sum(e.coverage_score for e in evals) / n, 2),
        avg_accuracy=round(sum(e.accuracy_score for e in evals) / n, 2),
        avg_overall=round(sum(e.overall_score for e in evals) / n, 2),
        total_evaluated=n,
        flagged_count=flagged,
        pass_rate=round((n - flagged) / n * 100, 1),
    )
