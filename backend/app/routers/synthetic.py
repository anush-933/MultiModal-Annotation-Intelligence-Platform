import io
import json
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Dataset, Sample
from app.schemas import GenerateRequest, DatasetResponse, SampleResponse
from app.services.claude_service import generate_synthetic_samples

router = APIRouter()


# ── Generate ──────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=DatasetResponse, status_code=201)
def generate_dataset(request: GenerateRequest, db: Session = Depends(get_db)):
    """
    Generate a new synthetic dataset using Claude.
    The call is synchronous; the frontend shows a spinner while it waits.
    """
    dataset = Dataset(
        name=request.name,
        task_schema=request.task_schema,
        task_type=request.task_type,
        num_samples_requested=request.num_samples,
        status="generating",
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)

    try:
        samples_data = generate_synthetic_samples(
            task_schema=request.task_schema,
            task_type=request.task_type,
            num_samples=request.num_samples,
            persona_types=request.persona_types,
        )
        for s in samples_data:
            sample = Sample(
                dataset_id=dataset.id,
                content=s.get("content", ""),
                persona=s.get("persona", ""),
                speech_register=s.get("register", ""),
                label=s.get("label", ""),
                meta_info=s.get("meta_info", {}),
            )
            db.add(sample)

        dataset.status = "ready"
        db.commit()
        db.refresh(dataset)
    except Exception as exc:
        dataset.status = "error"
        db.commit()
        raise HTTPException(status_code=500, detail=str(exc))

    sample_count = db.query(Sample).filter(Sample.dataset_id == dataset.id).count()
    result = DatasetResponse.model_validate(dataset)
    result.sample_count = sample_count
    return result


# ── List / Get ────────────────────────────────────────────────────────────────

@router.get("/datasets", response_model=list[DatasetResponse])
def list_datasets(db: Session = Depends(get_db)):
    datasets = db.query(Dataset).order_by(Dataset.created_at.desc()).all()
    result = []
    for ds in datasets:
        count = db.query(Sample).filter(Sample.dataset_id == ds.id).count()
        r = DatasetResponse.model_validate(ds)
        r.sample_count = count
        result.append(r)
    return result


@router.get("/datasets/{dataset_id}", response_model=DatasetResponse)
def get_dataset(dataset_id: int, db: Session = Depends(get_db)):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(404, "Dataset not found")
    count = db.query(Sample).filter(Sample.dataset_id == dataset_id).count()
    r = DatasetResponse.model_validate(ds)
    r.sample_count = count
    return r


@router.get("/datasets/{dataset_id}/samples", response_model=list[SampleResponse])
def get_samples(dataset_id: int, db: Session = Depends(get_db)):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(404, "Dataset not found")
    return db.query(Sample).filter(Sample.dataset_id == dataset_id).all()


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete("/datasets/{dataset_id}", status_code=204)
def delete_dataset(dataset_id: int, db: Session = Depends(get_db)):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(404, "Dataset not found")
    db.delete(ds)
    db.commit()


# ── Export JSONL ──────────────────────────────────────────────────────────────

@router.get("/datasets/{dataset_id}/export")
def export_dataset(dataset_id: int, db: Session = Depends(get_db)):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(404, "Dataset not found")
    samples = db.query(Sample).filter(Sample.dataset_id == dataset_id).all()

    lines = []
    for s in samples:
        lines.append(
            json.dumps(
                {
                    "id": s.id,
                    "content": s.content,
                    "label": s.label,
                    "persona": s.persona,
                    "register": s.register,
                    "meta_info": s.meta_info,
                    "dataset": ds.name,
                    "task_type": ds.task_type,
                }
            )
        )

    content = "\n".join(lines)
    filename = f"{ds.name.replace(' ', '_').lower()}.jsonl"
    return StreamingResponse(
        io.BytesIO(content.encode()),
        media_type="application/x-ndjson",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
