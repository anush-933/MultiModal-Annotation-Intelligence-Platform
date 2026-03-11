from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# ── Synthetic Data ────────────────────────────────────────────
class GenerateRequest(BaseModel):
    name: str
    task_schema: str
    task_type: str
    num_samples: int = 10
    persona_types: List[str] = ["formal", "casual", "technical", "regional"]


class SampleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    dataset_id: int
    content: str
    persona: Optional[str] = None
    speech_register: Optional[str] = Field(None, alias="register", serialization_alias="register")
    label: Optional[str] = None
    meta_info: Optional[Dict[str, Any]] = {}
    annotation_status: str
    created_at: datetime


class DatasetResponse(BaseModel):
    id: int
    name: str
    task_schema: str
    task_type: str
    num_samples_requested: int
    status: str
    evaluation_status: str
    created_at: datetime
    sample_count: Optional[int] = 0

    class Config:
        from_attributes = True


# ── Annotation ────────────────────────────────────────────────
class AnnotationRequest(BaseModel):
    sample_id: int
    annotator_id: str
    label: str
    confidence: float = 1.0
    notes: Optional[str] = None


class AnnotationResponse(BaseModel):
    id: int
    sample_id: int
    annotator_id: str
    label: str
    confidence: float
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class IAAResponse(BaseModel):
    dataset_id: int
    kappa_score: float
    agreement_pct: float
    interpretation: str
    num_samples_evaluated: int
    flagged_samples: List[int]


# ── Evaluation ────────────────────────────────────────────────
class EvaluationRequest(BaseModel):
    dataset_id: int
    sample_ids: Optional[List[int]] = None


class EvaluationResponse(BaseModel):
    id: int
    sample_id: int
    coherence_score: float
    diversity_score: float
    coverage_score: float
    accuracy_score: float
    overall_score: float
    reasoning: str
    flagged: bool
    created_at: datetime

    class Config:
        from_attributes = True


class EvaluationSummary(BaseModel):
    dataset_id: int
    avg_coherence: float
    avg_diversity: float
    avg_coverage: float
    avg_accuracy: float
    avg_overall: float
    total_evaluated: int
    flagged_count: int
    pass_rate: float


# ── Dashboard ─────────────────────────────────────────────────
class DashboardStats(BaseModel):
    total_datasets: int
    total_samples: int
    total_annotations: int
    avg_quality_score: float
    avg_kappa_score: float
    flagged_samples: int
    annotation_completion_rate: float


class QualityTrendPoint(BaseModel):
    date: str
    avg_score: float
    coherence: float
    diversity: float
    coverage: float
    accuracy: float
    num_samples: int


class ActivityItem(BaseModel):
    type: str
    message: str
    timestamp: datetime
    dataset_name: Optional[str] = None
