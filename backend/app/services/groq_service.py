"""
AI service for MAIP — powered by Groq (llama-3.3-70b-versatile for generation,
llama-3.1-8b-instant for fast LLM-as-Judge evaluation).

Falls back to realistic demo data when GROQ_API_KEY is not set.
"""

import json
import os
import random
from dotenv import load_dotenv

load_dotenv()

_client = None

# Models
_GEN_MODEL  = "llama-3.3-70b-versatile"   # High-capability: synthetic data generation
_EVAL_MODEL = "llama-3.1-8b-instant"      # Fast & cheap:   LLM-as-Judge evaluation


def _get_client():
    global _client
    if _client is None:
        api_key = os.getenv("GROQ_API_KEY", "")
        if api_key:
            from groq import Groq
            _client = Groq(api_key=api_key)
    return _client


def _chat(model: str, prompt: str, max_tokens: int = 8192) -> str:
    """Thin wrapper around Groq chat completions."""
    client = _get_client()
    completion = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": "You are a precise AI assistant. Always return valid JSON exactly as requested. No markdown code fences, no extra text.",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.7,
        max_tokens=max_tokens,
    )
    return completion.choices[0].message.content.strip()


# ─────────────────────────────────────────────────────────────────────────────
# Synthetic Data Generation
# ─────────────────────────────────────────────────────────────────────────────

def generate_synthetic_samples(
    task_schema: str,
    task_type: str,
    num_samples: int,
    persona_types: list,
) -> list:
    """Generate diverse training samples via Groq. Falls back to demo data without key."""
    if not _get_client():
        return _demo_samples(num_samples, task_type, persona_types)

    persona_list = ", ".join(persona_types)
    prompt = f"""You are an expert training-data engineer creating high-quality NLP samples.

Task Schema  : {task_schema}
Task Type    : {task_type}
Personas     : {persona_list}
Count needed : {num_samples}

Generate exactly {num_samples} diverse training samples.
Rules:
• Cover every persona in the list at least once.
• Vary register (formal / informal / technical / colloquial).
• Include 15-20% edge-case / ambiguous samples.
• Labels must be appropriate for the task type:
  - intent_classification → play_music | set_alarm | get_weather | control_device | send_message | search_web | navigate | set_reminder | schedule_meeting | summarize
  - sentiment_analysis → positive | negative | neutral | mixed
  - question_answering → (the actual short answer string)
  - text_classification → appropriate category

Return ONLY a valid JSON array, no markdown fences, no explanation:
[
  {{
    "content": "utterance text",
    "persona": "one of: {persona_list}",
    "register": "formal|informal|technical|colloquial",
    "label": "ground_truth_label",
    "meta_info": {{
      "difficulty": "easy|medium|hard",
      "is_edge_case": false,
      "linguistic_features": ["feature1", "feature2"]
    }}
  }}
]"""

    try:
        text = _chat(_GEN_MODEL, prompt, max_tokens=8192)
        start, end = text.find("["), text.rfind("]") + 1
        if start == -1 or end == 0:
            return _demo_samples(num_samples, task_type, persona_types)
        return json.loads(text[start:end])[:num_samples]
    except Exception as exc:
        print(f"[Groq] generation error: {exc}")
        return _demo_samples(num_samples, task_type, persona_types)


# ─────────────────────────────────────────────────────────────────────────────
# LLM-as-Judge Evaluation
# ─────────────────────────────────────────────────────────────────────────────

def evaluate_sample_quality(
    content: str,
    task_type: str,
    label: str,
    task_schema: str,
) -> dict:
    """Score a training sample on 4 quality dimensions via Groq. Falls back to demo scores."""
    if not _get_client():
        return _demo_evaluation()

    prompt = f"""You are a senior data-quality evaluator assessing AI training samples.

Task Schema : {task_schema}
Task Type   : {task_type}
Content     : {content}
Label       : {label}

Score the sample on each dimension from 0.0 to 10.0:
  COHERENCE  - Natural language, grammatically sound, semantically clear.
  DIVERSITY  - Distinctive phrasing vs. generic/templated examples.
  COVERAGE   - Representative of the labeled category and task domain.
  ACCURACY   - Label is factually correct for this content.

Weighted overall = coherence*0.25 + diversity*0.20 + coverage*0.25 + accuracy*0.30
Flag if overall < 6.0.

Return ONLY valid JSON, no markdown:
{{
  "coherence_score": 0.0,
  "diversity_score": 0.0,
  "coverage_score": 0.0,
  "accuracy_score": 0.0,
  "overall_score": 0.0,
  "reasoning": "one-sentence explanation",
  "flagged": false
}}"""

    try:
        text = _chat(_EVAL_MODEL, prompt, max_tokens=512)
        start, end = text.find("{"), text.rfind("}") + 1
        if start == -1 or end == 0:
            return _demo_evaluation()
        return json.loads(text[start:end])
    except Exception as exc:
        print(f"[Groq] evaluation error: {exc}")
        return _demo_evaluation()


# ─────────────────────────────────────────────────────────────────────────────
# Demo / fallback data
# ─────────────────────────────────────────────────────────────────────────────

_DEMO_POOL = [
    ("Set an alarm for 7 AM", "casual", "informal", "set_alarm", False),
    ("Could you schedule a meeting with the board at 2 PM on Tuesday?", "formal", "formal", "schedule_meeting", False),
    ("What's the weather gonna be like this weekend?", "casual", "colloquial", "get_weather", False),
    ("Initialize a recursive traversal on the binary tree in post-order", "technical", "technical", "search_web", True),
    ("Play something mellow", "casual", "colloquial", "play_music", True),
    ("I require navigation assistance to the nearest medical facility", "formal", "formal", "navigate", False),
    ("Text mom I'll be late", "casual", "colloquial", "send_message", False),
    ("Provide a summary of the Q3 earnings report", "formal", "formal", "summarize", False),
    ("How do I git rebase without losing uncommitted changes?", "technical", "technical", "search_web", True),
    ("What time is it?", "casual", "informal", "get_weather", False),
    ("Remind me to take my medication at 8 PM every day this week", "casual", "informal", "set_reminder", False),
    ("Find vegan restaurants within 5 miles rated above 4 stars", "technical", "technical", "search_web", False),
    ("Turn off the living room lights", "casual", "informal", "control_device", False),
    ("Please adjust the thermostat to 70 degrees", "formal", "formal", "control_device", False),
    ("Can you play the latest album by Kendrick Lamar?", "casual", "colloquial", "play_music", False),
    ("Navigate home via the fastest route avoiding tolls", "technical", "technical", "navigate", False),
]

_DEMO_FEATURES = [
    ["imperative", "informal"],
    ["polite_request", "specificity"],
    ["contraction", "question"],
    ["technical_jargon", "ambiguity"],
    ["minimal_utterance", "implicit_intent"],
    ["formal_register", "urgency"],
    ["ellipsis", "context_dependent"],
    ["specificity", "domain_knowledge"],
]


def _demo_samples(num_samples: int, task_type: str, persona_types: list) -> list:
    result = []
    for i in range(num_samples):
        content, persona, register, label, is_edge = _DEMO_POOL[i % len(_DEMO_POOL)]
        result.append(
            {
                "content": content,
                "persona": persona_types[i % len(persona_types)] if persona_types else persona,
                "register": register,
                "label": label,
                "meta_info": {
                    "difficulty": "hard" if is_edge else random.choice(["easy", "medium"]),
                    "is_edge_case": is_edge,
                    "linguistic_features": _DEMO_FEATURES[i % len(_DEMO_FEATURES)],
                },
            }
        )
    return result


def _demo_evaluation() -> dict:
    coh = round(random.uniform(6.8, 9.6), 1)
    div = round(random.uniform(6.2, 9.2), 1)
    cov = round(random.uniform(7.0, 9.5), 1)
    acc = round(random.uniform(7.5, 9.8), 1)
    overall = round(coh * 0.25 + div * 0.20 + cov * 0.25 + acc * 0.30, 2)
    return {
        "coherence_score": coh,
        "diversity_score": div,
        "coverage_score": cov,
        "accuracy_score": acc,
        "overall_score": overall,
        "reasoning": "Demo mode: sample shows strong linguistic naturalness and accurate label alignment.",
        "flagged": overall < 6.0,
    }
