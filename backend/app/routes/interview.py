from fastapi import APIRouter
from app.data.interview_questions import INTERVIEW_QUESTIONS
from app.utils.store import CANDIDATES

router = APIRouter(prefix="/interview", tags=["Interview"])


def _find_candidate(email: str):
    return next((c for c in CANDIDATES if c.get("email") == email), None)


@router.get("/eligibility")
def check_eligibility(email: str):
    candidate = _find_candidate(email)
    if not candidate:
        return {"error": "Candidate not found"}

    return {
        "eligible": bool(candidate.get("interview_eligible")),
        "role": candidate.get("role"),
        "interview_status": candidate.get("interview_status", "NOT_TAKEN"),
        "interview_score": candidate.get("interview_score"),
        "interview_percentage": candidate.get("interview_percentage"),
    }


@router.get("/questions/{role}")
def get_questions(role: str, email: str):
    candidate = _find_candidate(email)
    if not candidate:
        return {"error": "Candidate not found"}

    if candidate.get("role") != role:
        return {"error": "Role mismatch"}

    if not candidate.get("interview_eligible"):
        return {"error": "Interview not available for this candidate yet"}

    if role not in INTERVIEW_QUESTIONS:
        return {"error": "Invalid role"}

    questions = INTERVIEW_QUESTIONS[role]

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
def submit_answers(payload: dict):
    role = payload.get("role")
    answers = payload.get("answers", {})
    email = payload.get("email")

    candidate = _find_candidate(email)
    if not candidate:
        return {"error": "Candidate not found"}

    if candidate.get("role") != role:
        return {"error": "Role mismatch"}

    if not candidate.get("interview_eligible"):
        return {"error": "Interview not available for this candidate yet"}

    if role not in INTERVIEW_QUESTIONS:
        return {"error": "Invalid role"}

    questions = INTERVIEW_QUESTIONS[role]
    if not questions:
        return {"error": "No interview questions configured"}

    total_score = 0.0
    for q in questions:
        qid = str(q["id"])
        answer = answers.get(qid, "")
        total_score += _keyword_score(answer, q["keywords"])

    percentage = round((total_score / len(questions)) * 100, 2)
    status = "PASS" if percentage >= 60 else "FAIL"

    candidate["interview_score"] = round(total_score, 2)
    candidate["interview_percentage"] = percentage
    candidate["interview_status"] = status
    candidate["interview_breakdown"] = [
        {
            "id": q["id"],
            "relevance": round(_keyword_score(answers.get(str(q["id"]), ""), q["keywords"]) * 100, 2),
        }
        for q in questions
    ]

    return {
        "score": round(total_score, 2),
        "percentage": percentage,
        "status": status,
    }
