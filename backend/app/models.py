from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from app.database import Base


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    task_schema = Column(Text, nullable=False)
    task_type = Column(String, nullable=False)
    num_samples_requested = Column(Integer, default=10)
    status = Column(String, default="ready")              # ready | error
    evaluation_status = Column(String, default="not_started")  # not_started | running | completed | error
    created_at = Column(DateTime, default=datetime.utcnow)

    samples = relationship("Sample", back_populates="dataset", cascade="all, delete-orphan")


class Sample(Base):
    __tablename__ = "samples"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False)
    content = Column(Text, nullable=False)
    persona = Column(String)
    speech_register = Column("register", String)
    label = Column(String)
    meta_info = Column(JSON, default=dict)
    annotation_status = Column(String, default="pending")  # pending | completed | flagged
    created_at = Column(DateTime, default=datetime.utcnow)

    dataset = relationship("Dataset", back_populates="samples")
    annotations = relationship("Annotation", back_populates="sample", cascade="all, delete-orphan")
    evaluations = relationship("Evaluation", back_populates="sample", cascade="all, delete-orphan")


class Annotation(Base):
    __tablename__ = "annotations"

    id = Column(Integer, primary_key=True, index=True)
    sample_id = Column(Integer, ForeignKey("samples.id"), nullable=False)
    annotator_id = Column(String, nullable=False)
    label = Column(String, nullable=False)
    confidence = Column(Float, default=1.0)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    sample = relationship("Sample", back_populates="annotations")


class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(Integer, primary_key=True, index=True)
    sample_id = Column(Integer, ForeignKey("samples.id"), nullable=False)
    coherence_score = Column(Float, default=0.0)
    diversity_score = Column(Float, default=0.0)
    coverage_score = Column(Float, default=0.0)
    accuracy_score = Column(Float, default=0.0)
    overall_score = Column(Float, default=0.0)
    reasoning = Column(Text)
    flagged = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    sample = relationship("Sample", back_populates="evaluations")


class IAARecord(Base):
    __tablename__ = "iaa_records"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, nullable=False)
    kappa_score = Column(Float)
    agreement_pct = Column(Float)
    num_samples_evaluated = Column(Integer)
    computed_at = Column(DateTime, default=datetime.utcnow)
