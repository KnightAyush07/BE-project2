from fastapi import APIRouter, Depends, HTTPException
import os
from app.data.interview_questions import INTERVIEW_QUESTIONS
from app.db import get_conn
from app.routes.auth import require_role

router = APIRouter(prefix="/interview", tags=["Interview"])
DEMO_INTERVIEW_ALWAYS_ON = os.getenv("DEMO_INTERVIEW_ALWAYS_ON", "1").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}


def _find_candidate(email: str):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM candidates WHERE email = ?", (email,))
        return cur.fetchone()


def _resolve_role_for_questions(role: str, candidate_role: str | None = None) -> str:
    if role in INTERVIEW_QUESTIONS:
        return role
    if candidate_role and candidate_role in INTERVIEW_QUESTIONS:
        return candidate_role
    return "python_dev"


@router.get("/eligibility")
def check_eligibility(email: str, user=Depends(require_role("CANDIDATE"))):
    if email.lower() != user["email"].lower():
        raise HTTPException(status_code=403, detail="Email mismatch")
    candidate = _find_candidate(email)
    if not candidate:
        return {"error": "Candidate not found"}

    demo_unlocked = DEMO_INTERVIEW_ALWAYS_ON
    eligible = bool(candidate["interview_eligible"]) or demo_unlocked

    return {
        "eligible": eligible,
        "role": candidate["role"],
        "interview_status": candidate["interview_status"] or "NOT_TAKEN",
        "interview_score": candidate["interview_score"],
        "interview_percentage": candidate["interview_percentage"],
    }


@router.get("/questions/{role}")
def get_questions(role: str, email: str, user=Depends(require_role("CANDIDATE"))):
    if email.lower() != user["email"].lower():
        raise HTTPException(status_code=403, detail="Email mismatch")
    candidate = _find_candidate(email)
    if not candidate:
        return {"error": "Candidate not found"}

    if candidate["role"] != role and not DEMO_INTERVIEW_ALWAYS_ON:
        return {"error": "Role mismatch"}

    demo_unlocked = DEMO_INTERVIEW_ALWAYS_ON
    if not candidate["interview_eligible"] and not demo_unlocked:
        return {"error": "Interview not available for this candidate yet"}

    effective_role = _resolve_role_for_questions(role, candidate["role"])
    questions = INTERVIEW_QUESTIONS.get(effective_role, [])
    if not questions:
        return {"error": "No interview questions configured"}

    safe_questions = []
    for q in questions:
        safe_questions.append({"id": q["id"], "question": q["question"]})

    return safe_questions


def _keyword_score(answer: str, keywords: list[str]) -> float:
    if not answer:
        return 0.0
    answer_lower = answer.lower()
    hits = 0
    for kw in keywords:
        if kw in answer_lower:
            hits += 1
    return hits / max(len(keywords), 1)


@router.post("/submit")
def submit_answers(payload: dict, user=Depends(require_role("CANDIDATE"))):
    role = payload.get("role")
    answers = payload.get("answers", {})
    email = payload.get("email")

    if email.lower() != user["email"].lower():
        raise HTTPException(status_code=403, detail="Email mismatch")

    candidate = _find_candidate(email)
    if not candidate:
        return {"error": "Candidate not found"}

    if candidate["role"] != role and not DEMO_INTERVIEW_ALWAYS_ON:
        return {"error": "Role mismatch"}

    demo_unlocked = DEMO_INTERVIEW_ALWAYS_ON
    if not candidate["interview_eligible"] and not demo_unlocked:
        return {"error": "Interview not available for this candidate yet"}

    effective_role = _resolve_role_for_questions(role, candidate["role"])
    questions = INTERVIEW_QUESTIONS.get(effective_role, [])
    if not questions:
        return {"error": "No interview questions configured"}

    total_score = 0.0
    for q in questions:
        qid = str(q["id"])
        answer = answers.get(qid, "")
        total_score += _keyword_score(answer, q["keywords"])

    percentage = round((total_score / len(questions)) * 100, 2)
    status = "PASS" if percentage >= 60 else "FAIL"

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE candidates
            SET interview_score = ?, interview_percentage = ?, interview_status = ?
            WHERE email = ?
            """,
            (round(total_score, 2), percentage, status, email),
        )

    return {
        "score": round(total_score, 2),
        "percentage": percentage,
        "status": status,
    }
