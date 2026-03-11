import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from app.database import engine, SessionLocal, Base
from app.routers import synthetic, annotation, evaluation, dashboard

load_dotenv()

# Create all tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="MAIP — MultiModal Annotation Intelligence Platform",
    description=(
        "End-to-end AGI data pipeline: synthetic generation, "
        "human-in-the-loop annotation, and LLM-as-Judge quality evaluation."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(synthetic.router,   prefix="/api/synthetic",   tags=["Synthetic Data"])
app.include_router(annotation.router,  prefix="/api/annotation",  tags=["Annotation"])
app.include_router(evaluation.router,  prefix="/api/evaluation",  tags=["Evaluation"])
app.include_router(dashboard.router,   prefix="/api/dashboard",   tags=["Dashboard"])


@app.on_event("startup")
def auto_seed():
    """Seed demo data on first startup if the database is empty."""
    db = SessionLocal()
    try:
        from app.models import Dataset
        if db.query(Dataset).count() == 0:
            from app.routers.dashboard import seed_demo_data
            seed_demo_data(db)
            print("[MAIP] Demo data seeded successfully.")
    finally:
        db.close()


@app.get("/", tags=["Health"])
def root():
    return {
        "service": "MAIP API",
        "version": "1.0.0",
        "status": "operational",
        "demo_mode": not bool(os.getenv("GROQ_API_KEY")),
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}
