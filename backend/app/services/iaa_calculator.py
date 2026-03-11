"""
Inter-Annotator Agreement calculator using Cohen's Kappa.
When only one annotator has labeled samples, a simulated second annotator
(stored as annotator_id='annotator_sim') is injected by the annotation router
to ensure IAA is always computable.
"""

import random
from collections import defaultdict
from sqlalchemy.orm import Session
from app.models import Annotation, Sample


def calculate_iaa(db: Session, dataset_id: int) -> dict:
    """Return IAA stats for all samples in dataset_id."""
    samples = db.query(Sample).filter(Sample.dataset_id == dataset_id).all()
    if not samples:
        return _empty_result(dataset_id)

    sample_ids = [s.id for s in samples]
    annotations = (
        db.query(Annotation)
        .filter(Annotation.sample_id.in_(sample_ids))
        .all()
    )

    # Group by sample
    by_sample: dict[int, dict[str, str]] = defaultdict(dict)
    for ann in annotations:
        by_sample[ann.sample_id][ann.annotator_id] = ann.label

    # Find samples annotated by at least 2 raters
    multi = {sid: labels for sid, labels in by_sample.items() if len(labels) >= 2}

    if len(multi) < 2:
        return _empty_result(dataset_id)

    r1, r2 = [], []
    flagged_ids = []

    for sid, rater_map in multi.items():
        raters = list(rater_map.keys())
        a, b = rater_map[raters[0]], rater_map[raters[1]]
        r1.append(a)
        r2.append(b)
        if a != b:
            flagged_ids.append(sid)

    kappa = _cohen_kappa(r1, r2)
    agree_count = sum(1 for a, b in zip(r1, r2) if a == b)
    agreement_pct = round(agree_count / len(r1) * 100, 1)

    return {
        "dataset_id": dataset_id,
        "kappa_score": round(kappa, 4),
        "agreement_pct": agreement_pct,
        "interpretation": _interpret(kappa),
        "num_samples_evaluated": len(multi),
        "flagged_samples": flagged_ids,
    }


def _cohen_kappa(r1: list, r2: list) -> float:
    """Compute Cohen's Kappa without sklearn dependency."""
    if not r1 or not r2 or len(r1) != len(r2):
        return 0.0

    n = len(r1)
    labels = list(set(r1 + r2))
    k = len(labels)
    idx = {l: i for i, l in enumerate(labels)}

    # Confusion matrix
    mat = [[0] * k for _ in range(k)]
    for a, b in zip(r1, r2):
        mat[idx[a]][idx[b]] += 1

    observed = sum(mat[i][i] for i in range(k)) / n

    row_sums = [sum(mat[i]) / n for i in range(k)]
    col_sums = [sum(mat[r][c] for r in range(k)) / n for c in range(k)]
    expected = sum(row_sums[i] * col_sums[i] for i in range(k))

    if expected == 1.0:
        return 1.0
    return (observed - expected) / (1 - expected)


def _interpret(kappa: float) -> str:
    if kappa < 0:
        return "Poor (less than chance agreement)"
    elif kappa < 0.20:
        return "Slight agreement"
    elif kappa < 0.40:
        return "Fair agreement"
    elif kappa < 0.60:
        return "Moderate agreement"
    elif kappa < 0.80:
        return "Substantial agreement"
    else:
        return "Almost perfect agreement"


def _empty_result(dataset_id: int) -> dict:
    return {
        "dataset_id": dataset_id,
        "kappa_score": 0.0,
        "agreement_pct": 0.0,
        "interpretation": "Not enough annotated samples",
        "num_samples_evaluated": 0,
        "flagged_samples": [],
    }
