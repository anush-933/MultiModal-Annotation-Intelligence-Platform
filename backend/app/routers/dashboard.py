from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import Dataset, Sample, Annotation, Evaluation, IAARecord
from app.schemas import DashboardStats, QualityTrendPoint, ActivityItem

router = APIRouter()


@router.get("/stats", response_model=DashboardStats)
def get_stats(db: Session = Depends(get_db)):
    total_datasets = db.query(Dataset).count()
    total_samples = db.query(Sample).count()
    total_annotations = (
        db.query(Annotation)
        .filter(Annotation.annotator_id != "annotator_sim")
        .count()
    )

    evals = db.query(Evaluation).all()
    avg_quality = round(sum(e.overall_score for e in evals) / len(evals), 2) if evals else 0.0
    flagged = sum(1 for e in evals if e.flagged)

    iaa_records = db.query(IAARecord).all()
    avg_kappa = round(sum(r.kappa_score for r in iaa_records) / len(iaa_records), 3) if iaa_records else 0.0

    completed = db.query(Sample).filter(Sample.annotation_status == "completed").count()
    completion_rate = round(completed / total_samples * 100, 1) if total_samples else 0.0

    return DashboardStats(
        total_datasets=total_datasets,
        total_samples=total_samples,
        total_annotations=total_annotations,
        avg_quality_score=avg_quality,
        avg_kappa_score=avg_kappa,
        flagged_samples=flagged,
        annotation_completion_rate=completion_rate,
    )


@router.get("/trends", response_model=list[QualityTrendPoint])
def get_trends(db: Session = Depends(get_db)):
    """Return daily quality aggregates for the last 10 days."""
    points = []
    for days_ago in range(9, -1, -1):
        day = datetime.utcnow() - timedelta(days=days_ago)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)

        evals = (
            db.query(Evaluation)
            .filter(Evaluation.created_at >= day_start, Evaluation.created_at < day_end)
            .all()
        )
        n = len(evals)
        if n == 0:
            continue

        points.append(
            QualityTrendPoint(
                date=day.strftime("%b %d"),
                avg_score=round(sum(e.overall_score for e in evals) / n, 2),
                coherence=round(sum(e.coherence_score for e in evals) / n, 2),
                diversity=round(sum(e.diversity_score for e in evals) / n, 2),
                coverage=round(sum(e.coverage_score for e in evals) / n, 2),
                accuracy=round(sum(e.accuracy_score for e in evals) / n, 2),
                num_samples=n,
            )
        )
    return points


@router.get("/recent-activity", response_model=list[ActivityItem])
def recent_activity(db: Session = Depends(get_db)):
    items = []

    # Latest datasets
    for ds in db.query(Dataset).order_by(Dataset.created_at.desc()).limit(3).all():
        items.append(
            ActivityItem(
                type="dataset_created",
                message=f"Dataset '{ds.name}' created with {ds.num_samples_requested} samples",
                timestamp=ds.created_at,
                dataset_name=ds.name,
            )
        )

    # Latest evaluations completed
    for ds in (
        db.query(Dataset)
        .filter(Dataset.evaluation_status == "completed")
        .order_by(Dataset.created_at.desc())
        .limit(2)
        .all()
    ):
        items.append(
            ActivityItem(
                type="evaluation_completed",
                message=f"Quality evaluation completed for '{ds.name}'",
                timestamp=ds.created_at,
                dataset_name=ds.name,
            )
        )

    # Latest annotations
    recent_anns = (
        db.query(Annotation)
        .filter(Annotation.annotator_id != "annotator_sim")
        .order_by(Annotation.created_at.desc())
        .limit(3)
        .all()
    )
    for ann in recent_anns:
        items.append(
            ActivityItem(
                type="annotation_submitted",
                message=f"Annotation submitted by {ann.annotator_id} — label: {ann.label}",
                timestamp=ann.created_at,
            )
        )

    items.sort(key=lambda x: x.timestamp, reverse=True)
    return items[:10]


@router.post("/seed", status_code=201)
def seed_demo_data(db: Session = Depends(get_db)):
    """Populate the database with realistic demo data (idempotent)."""
    if db.query(Dataset).count() > 0:
        return {"message": "Already seeded"}

    import random
    random.seed(42)
    now = datetime.utcnow()

    # ── Dataset 1: Voice Assistant Intent Classification ──────────────────────
    ds1 = Dataset(
        name="Voice Assistant Intent Classification",
        task_schema="Multi-intent classification for a smart home voice assistant covering 10 intent classes",
        task_type="intent_classification",
        num_samples_requested=12,
        status="ready",
        evaluation_status="completed",
        created_at=now - timedelta(days=6),
    )
    db.add(ds1)
    db.flush()

    _seed_samples_ds1(db, ds1.id, now)

    # ── Dataset 2: Customer Support Sentiment ────────────────────────────────
    ds2 = Dataset(
        name="Customer Support Sentiment Analysis",
        task_schema="4-class sentiment analysis on e-commerce customer support chat transcripts",
        task_type="sentiment_analysis",
        num_samples_requested=15,
        status="ready",
        evaluation_status="completed",
        created_at=now - timedelta(days=3),
    )
    db.add(ds2)
    db.flush()

    _seed_samples_ds2(db, ds2.id, now)

    # ── Dataset 3: Medical QA Validation ─────────────────────────────────────
    ds3 = Dataset(
        name="Medical QA Validation Set",
        task_schema="Factual question-answering validation for clinical decision support knowledge base",
        task_type="question_answering",
        num_samples_requested=8,
        status="ready",
        evaluation_status="not_started",
        created_at=now - timedelta(days=1),
    )
    db.add(ds3)
    db.flush()

    _seed_samples_ds3(db, ds3.id, now)

    db.commit()
    return {"message": "Demo data seeded successfully", "datasets": 3}


# ─────────────────────────────────────────────────────────────────────────────
# Seed helpers
# ─────────────────────────────────────────────────────────────────────────────

def _add_annotation_pair(db, sample_id: int, label: str, disagree: bool):
    db.add(Annotation(sample_id=sample_id, annotator_id="annotator_1", label=label, confidence=0.95))
    sim_label = label
    if disagree:
        alts = ["play_music", "set_alarm", "get_weather", "control_device", "send_message"]
        alts = [l for l in alts if l != label]
        import random
        sim_label = random.choice(alts)
    db.add(Annotation(sample_id=sample_id, annotator_id="annotator_sim", label=sim_label, confidence=0.85))


def _seed_samples_ds1(db, dataset_id: int, now: datetime):
    import random
    random.seed(1)
    rows = [
        ("Set an alarm for 7 AM tomorrow", "casual", "informal", "set_alarm", False, 8.8, 7.9, 8.5, 9.2, -6),
        ("Could you schedule a board meeting for Tuesday at 2 PM?", "formal", "formal", "schedule_meeting", False, 9.1, 8.3, 8.9, 9.5, -6),
        ("What's the weather gonna be like this weekend?", "casual", "colloquial", "get_weather", False, 8.6, 7.5, 8.4, 9.0, -5),
        ("Initialize recursive traversal on the binary tree", "technical", "technical", "search_web", True, 7.2, 8.9, 7.1, 6.8, -5),
        ("Play something mellow", "casual", "colloquial", "play_music", True, 7.8, 9.1, 7.5, 8.2, -5),
        ("I require navigation assistance to the nearest facility", "formal", "formal", "navigate", False, 9.0, 8.0, 8.8, 9.3, -4),
        ("Text mom I'll be home late", "casual", "colloquial", "send_message", False, 8.7, 7.6, 8.5, 9.4, -4),
        ("Summarize the quarterly earnings report", "formal", "formal", "summarize", False, 9.2, 8.1, 9.0, 9.6, -4),
        ("How do I git rebase without losing changes?", "technical", "technical", "search_web", True, 8.0, 9.2, 8.2, 8.5, -3),
        ("Turn off all the lights downstairs", "casual", "informal", "control_device", False, 9.3, 7.8, 9.1, 9.7, -3),
        ("Remind me to take medication at 8 PM every day", "casual", "informal", "set_reminder", False, 8.9, 7.7, 8.8, 9.5, -3),
        ("Find vegan restaurants within 5 miles rated 4+ stars", "technical", "technical", "search_web", False, 8.5, 8.6, 8.7, 9.1, -2),
    ]
    for content, persona, register, label, is_edge, coh, div, cov, acc, days in rows:
        s = Sample(
            dataset_id=dataset_id,
            content=content,
            persona=persona,
            speech_register=register,
            label=label,
            meta_info={"difficulty": "hard" if is_edge else "medium", "is_edge_case": is_edge, "linguistic_features": []},
            annotation_status="completed",
            created_at=now + timedelta(days=days),
        )
        db.add(s)
        db.flush()
        _add_annotation_pair(db, s.id, label, is_edge)
        overall = round(coh * 0.25 + div * 0.20 + cov * 0.25 + acc * 0.30, 2)
        db.add(Evaluation(
            sample_id=s.id,
            coherence_score=coh,
            diversity_score=div,
            coverage_score=cov,
            accuracy_score=acc,
            overall_score=overall,
            reasoning="Strong sample with natural phrasing and accurate labeling.",
            flagged=overall < 6.0,
            created_at=now + timedelta(days=days + 1),
        ))
    db.add(IAARecord(dataset_id=dataset_id, kappa_score=0.82, agreement_pct=87.5, num_samples_evaluated=12, computed_at=now - timedelta(days=2)))


def _seed_samples_ds2(db, dataset_id: int, now: datetime):
    import random
    random.seed(2)
    rows = [
        ("This product is absolutely amazing, I love it!", "casual", "informal", "positive", False, 9.2, 7.4, 9.0, 9.8, -3),
        ("Terrible experience, the item arrived broken and support was unhelpful", "casual", "informal", "negative", False, 8.8, 8.1, 8.7, 9.5, -3),
        ("It's okay I guess, nothing special but it works", "casual", "colloquial", "neutral", False, 8.5, 8.4, 8.3, 9.0, -2),
        ("I love the design but the battery life is really disappointing", "casual", "informal", "mixed", True, 8.9, 9.2, 8.8, 9.3, -2),
        ("Your customer service representative was exceptionally courteous and resolved my issue promptly", "formal", "formal", "positive", False, 9.4, 8.0, 9.2, 9.7, -2),
        ("I am deeply dissatisfied with the quality of this product", "formal", "formal", "negative", False, 9.1, 7.9, 9.0, 9.6, -1),
        ("The shipping was fast but the packaging was damaged upon arrival", "casual", "informal", "mixed", True, 8.7, 8.8, 8.6, 8.9, -1),
        ("Product works as described", "casual", "informal", "neutral", False, 7.5, 6.8, 7.8, 8.5, -1),
        ("5 stars! Would definitely recommend to all my friends", "casual", "colloquial", "positive", False, 8.3, 7.2, 8.0, 8.9, 0),
        ("This is the worst purchase I've ever made. Absolute garbage.", "casual", "colloquial", "negative", False, 8.6, 8.5, 8.4, 9.2, 0),
        ("Decent product for the price point, meets basic requirements", "formal", "formal", "neutral", False, 8.9, 7.6, 8.7, 9.1, 0),
        ("Fantastic features but terrible customer support team", "casual", "informal", "mixed", True, 8.8, 9.0, 8.9, 9.0, 0),
        ("Refund processed quickly, very satisfied with the resolution", "formal", "formal", "positive", False, 9.3, 7.8, 9.1, 9.6, 0),
        ("Package still hasn't arrived after 3 weeks. Unacceptable.", "casual", "informal", "negative", False, 8.7, 8.3, 8.6, 9.4, 0),
        ("Good value, minor issues with setup instructions", "casual", "informal", "mixed", False, 8.4, 7.9, 8.2, 8.8, 0),
    ]
    for content, persona, register, label, is_edge, coh, div, cov, acc, days in rows:
        s = Sample(
            dataset_id=dataset_id,
            content=content,
            persona=persona,
            speech_register=register,
            label=label,
            meta_info={"difficulty": "hard" if is_edge else "easy", "is_edge_case": is_edge, "linguistic_features": []},
            annotation_status="completed",
            created_at=now + timedelta(days=days - 3),
        )
        db.add(s)
        db.flush()
        _add_annotation_pair(db, s.id, label, is_edge)
        overall = round(coh * 0.25 + div * 0.20 + cov * 0.25 + acc * 0.30, 2)
        db.add(Evaluation(
            sample_id=s.id,
            coherence_score=coh,
            diversity_score=div,
            coverage_score=cov,
            accuracy_score=acc,
            overall_score=overall,
            reasoning="Well-formed sentiment sample with clear emotional signal.",
            flagged=overall < 6.0,
            created_at=now + timedelta(days=days - 2),
        ))
    db.add(IAARecord(dataset_id=dataset_id, kappa_score=0.76, agreement_pct=82.3, num_samples_evaluated=15, computed_at=now - timedelta(days=1)))


def _seed_samples_ds3(db, dataset_id: int, now: datetime):
    rows = [
        ("What is the recommended first-line treatment for Type 2 diabetes?", "formal", "technical", "Metformin", False, -1),
        ("At what blood pressure level is hypertension diagnosed?", "technical", "technical", "130/80 mmHg or higher", False, -1),
        ("What is the half-life of aspirin?", "technical", "technical", "15-20 minutes (active) / 3-5 hours (total)", True, -1),
        ("Can beta-blockers be used in patients with asthma?", "formal", "technical", "Generally contraindicated due to bronchospasm risk", True, -1),
        ("What is the mechanism of action of statins?", "technical", "technical", "HMG-CoA reductase inhibition", False, -1),
        ("What are the signs of anaphylaxis?", "formal", "formal", "Urticaria, angioedema, hypotension, bronchospasm", False, 0),
        ("How long should antibiotics be prescribed for UTI in women?", "formal", "technical", "3-7 days depending on antibiotic class", False, 0),
        ("What is the Glasgow Coma Scale range?", "technical", "technical", "3 to 15", False, 0),
    ]
    for content, persona, register, label, is_edge, days in rows:
        s = Sample(
            dataset_id=dataset_id,
            content=content,
            persona=persona,
            speech_register=register,
            label=label,
            meta_info={"difficulty": "hard", "is_edge_case": is_edge, "linguistic_features": ["domain_specific", "technical"]},
            annotation_status="pending",
            created_at=now + timedelta(days=days - 1),
        )
        db.add(s)
