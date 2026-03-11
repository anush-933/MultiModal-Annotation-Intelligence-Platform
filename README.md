# MAIP — MultiModal Annotation Intelligence Platform

> An end-to-end AGI data pipeline platform simulating the full lifecycle of AI training data: synthetic generation → human annotation → LLM quality evaluation.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     React Frontend                       │
│  Dashboard │ Synthetic Generator │ Annotation │ Eval     │
└─────────────────────┬───────────────────────────────────┘
                      │ REST API (FastAPI)
┌─────────────────────▼───────────────────────────────────┐
│                   FastAPI Backend                        │
│  /synthetic  │  /annotation  │  /evaluation  │ /dashboard│
└──────────────┬──────────────────────────────────────────┘
               │
   ┌───────────┴────────────┐
   │    Claude API           │    SQLite (maip.db)
   │  Opus 4.6 (generate)    │◄──────────────────────
   │  Sonnet 4.6 (evaluate)  │
   └────────────────────────┘
```

## Modules

### 1. Synthetic Data Generator Engine
- Input: task schema + task type (intent classification, sentiment, QA, text classification)
- Claude Opus 4.6 generates linguistically diverse samples across personas (formal, casual, technical, regional)
- Covers edge cases, varied registers, and multiple difficulty levels
- Export to JSONL (ML training format)

### 2. Human-in-the-Loop Annotation Workspace
- Live annotation queue with per-sample labeling UI
- Confidence scoring slider per annotation
- Automatic simulated second annotator (80% agreement rate) for IAA computation
- **Cohen's Kappa** (κ) computed live without external dependencies
- Quality gating: disagreement samples flagged for re-review

### 3. LLM-as-Judge Evaluation Layer
- Claude Sonnet 4.6 scores each sample on 4 dimensions:
  - **Coherence** (×0.25): linguistic naturalness
  - **Diversity** (×0.20): distinctiveness vs. templated examples
  - **Coverage** (×0.25): representativeness of labeled category
  - **Accuracy** (×0.30): label-content alignment
- Async background evaluation with real-time progress polling
- Export evaluation results to JSONL
- Quality gate: samples scoring < 6.0 are flagged

---

## Tech Stack

| Layer      | Technology                                      |
|------------|-------------------------------------------------|
| Backend    | Python 3.11+, FastAPI, SQLAlchemy, SQLite        |
| AI         | Anthropic Claude API (Opus 4.6 + Sonnet 4.6)    |
| Frontend   | React 18, Vite, Tailwind CSS, Recharts          |
| Charts     | Recharts (LineChart, BarChart, RadarChart)       |
| Icons      | Lucide React                                    |

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- An Anthropic API key (optional — demo mode works without one)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY (optional)

# Start the API server
uvicorn app.main:app --reload --port 8000
```

The API will auto-seed demo data on first startup.
Visit **http://localhost:8000/docs** for the interactive API docs.

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Visit **http://localhost:5173**

---

## Demo Mode (No API Key)

If `ANTHROPIC_API_KEY` is not set, the platform runs in **demo mode**:
- Synthetic generation returns realistic pre-built samples
- Evaluation returns plausible randomized quality scores
- All dashboard metrics, IAA scores, and trend charts use the auto-seeded data

This means the full UI is functional for portfolio demonstrations without any API costs.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/synthetic/generate` | Generate a new dataset with Claude |
| GET  | `/api/synthetic/datasets` | List all datasets |
| GET  | `/api/synthetic/datasets/{id}/samples` | Get samples for a dataset |
| GET  | `/api/synthetic/datasets/{id}/export` | Download dataset as JSONL |
| POST | `/api/annotation/submit` | Submit a human annotation |
| GET  | `/api/annotation/iaa/{dataset_id}` | Get Cohen's Kappa score |
| POST | `/api/evaluation/run` | Start LLM-as-Judge evaluation |
| GET  | `/api/evaluation/status/{dataset_id}` | Poll evaluation progress |
| GET  | `/api/evaluation/results/{dataset_id}` | Get per-sample scores |
| GET  | `/api/dashboard/stats` | Platform-wide metrics |
| GET  | `/api/dashboard/trends` | Quality score time series |

---

## Portfolio Signal Mapping

| What Recruiters See | Maps To |
|---------------------|---------|
| Synthetic data pipeline | "synthetic and model-based data generation" |
| IAA + quality gating | "define and implement quality targets and mechanisms" |
| LLM-as-judge scoring | "evaluate performance of AI models" |
| Python tooling + dashboard | "build tools for data analysis or data creation" |
| Background task evaluation | Async pipeline / production engineering patterns |
| Cohen's Kappa (custom impl) | Statistical rigor in annotation systems |
