from fastapi import APIRouter
from app.data.oa_questions import OA_QUESTIONS
from app.utils.store import CANDIDATES

router = APIRouter(prefix="/oa", tags=["Online Assessment"])

def _find_candidate(email: str):
    return next((c for c in CANDIDATES if c.get("email") == email), None)


@router.get("/eligibility")
def check_eligibility(email: str):
    candidate = _find_candidate(email)
    if not candidate:
        return {"error": "Candidate not found"}

    return {
        "eligible": bool(candidate.get("oa_eligible")),
        "role": candidate.get("role"),
        "oa_status": candidate.get("oa_status", "NOT_TAKEN"),
        "oa_score": candidate.get("oa_score"),
        "oa_total": candidate.get("oa_total"),
        "oa_percentage": candidate.get("oa_percentage"),
    }


@router.get("/questions/{role}")
def get_questions(role: str, email: str):
    candidate = _find_candidate(email)
    if not candidate:
        return {"error": "Candidate not found"}

    if candidate.get("role") != role:
        return {"error": "Role mismatch"}

    if not candidate.get("oa_eligible"):
        return {"error": "OA not available for this candidate yet"}

    if role not in OA_QUESTIONS:
        return {"error": "Invalid role"}

    questions = OA_QUESTIONS[role]

    # Remove correct answers before sending to candidate
    safe_questions = []
    for q in questions:
        safe_questions.append({
            "id": q["id"],
            "question": q["question"],
            "options": q["options"]
        })

    return safe_questions


@router.post("/submit")
def submit_answers(payload: dict):
    role = payload.get("role")
    answers = payload.get("answers")
    email = payload.get("email")

    candidate = _find_candidate(email)
    if not candidate:
        return {"error": "Candidate not found"}

    if candidate.get("role") != role:
        return {"error": "Role mismatch"}

    if not candidate.get("oa_eligible"):
        return {"error": "OA not available for this candidate yet"}

    if role not in OA_QUESTIONS:
        return {"error": "Invalid role"}

    score = 0
    total = len(OA_QUESTIONS[role])
    topic_totals = {}
    topic_correct = {}

    for q in OA_QUESTIONS[role]:
        qid = str(q["id"])
        topic = q.get("topic", "General")
        topic_totals[topic] = topic_totals.get(topic, 0) + 1
        if answers.get(qid) == q["answer"]:
            score += 1
            topic_correct[topic] = topic_correct.get(topic, 0) + 1

    percentage = round((score / total) * 100, 2)
    status = "PASS" if percentage >= 60 else "FAIL"
    topic_breakdown = {}
    for topic, total_count in topic_totals.items():
        correct = topic_correct.get(topic, 0)
        topic_breakdown[topic] = {
            "correct": correct,
            "total": total_count,
            "percentage": round((correct / total_count) * 100, 2),
        }

    candidate["oa_score"] = score
    candidate["oa_total"] = total
    candidate["oa_percentage"] = percentage
    candidate["oa_status"] = status
    candidate["oa_topic_breakdown"] = topic_breakdown
    if status == "PASS":
        candidate["interview_eligible"] = True

    return {
        "score": score,
        "total": total,
        "percentage": percentage,
        "status": status,
        "topic_breakdown": topic_breakdown,
    }
