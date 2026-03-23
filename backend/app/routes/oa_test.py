import os

from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from app.db import get_conn, to_json
from app.routes.auth import require_role
from app.services.agentic_quiz import (
    generate_agentic_quiz,
    load_generated_quiz,
    save_generated_quiz,
)

router = APIRouter(prefix="/oa", tags=["OA Test"])
DEMO_OA_ALWAYS_ON = os.getenv("DEMO_OA_ALWAYS_ON", "1").strip().lower() in {
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


def _latest_jd_for_role(role: str) -> str:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT jd_text
            FROM hr_job_descriptions
            WHERE role = ?
            ORDER BY updated_at DESC
            LIMIT 1
            """,
            (role,),
        )
        row = cur.fetchone()
        return (row["jd_text"] if row else "") or ""


@router.get("/eligibility")
def check_eligibility(email: str, user=Depends(require_role("CANDIDATE"))):
    if email.lower() != user["email"].lower():
        raise HTTPException(status_code=403, detail="Email mismatch")
    candidate = _find_candidate(email)
    if not candidate:
        return {"error": "No application was submitted", "eligible": False}

    eligible = bool(candidate["oa_eligible"]) or DEMO_OA_ALWAYS_ON
    return {
        "eligible": eligible,
        "role": candidate["role"],
        "oa_status": candidate["oa_status"] or "NOT_TAKEN",
        "oa_score": candidate["oa_score"],
        "oa_total": candidate["oa_total"],
        "oa_percentage": candidate["oa_percentage"],
    }


@router.get("/questions")
def get_questions(role: str, user=Depends(require_role("CANDIDATE"))):
    candidate = _find_candidate(user["email"])
    if candidate and candidate["role"] != role and not DEMO_OA_ALWAYS_ON:
        return {"error": "Role mismatch"}
    if not candidate and not DEMO_OA_ALWAYS_ON:
        return {"error": "Candidate not found. Submit application first."}
    if candidate and not candidate["oa_eligible"] and not DEMO_OA_ALWAYS_ON:
        return {"error": "OA not available yet. Wait for HR shortlist."}

    jd_text = (candidate["jd_text"] if candidate else "") or _latest_jd_for_role(role)
    resume_text = (candidate["resume_text"] if candidate else "") or ""

    generated_questions = generate_agentic_quiz(
        role=role,
        jd_text=jd_text,
        resume_text=resume_text,
        seed_hint=user["email"],
        num_questions=10,
    )
    if not generated_questions:
        return {"error": "No questions available"}

    save_generated_quiz(user["email"], role, generated_questions)

    safe_questions = []
    for q in generated_questions:
        safe_questions.append(
            {
                "id": q["id"],
                "question": q["question"],
                "options": q["options"],
            }
        )

    return safe_questions


@router.post("/submit")
def submit_test(payload: dict, user=Depends(require_role("CANDIDATE"))):
    email = payload.get("email")
    role = payload.get("role")
    answers = payload.get("answers", {})
    time_taken = payload.get("time_taken", 0)
    tab_switches = max(0, int(payload.get("tab_switches", 0) or 0))

    if not email:
        return {"error": "Email is required"}
    if email.lower() != user["email"].lower():
        raise HTTPException(status_code=403, detail="Email mismatch")

    candidate = _find_candidate(email)
    if candidate and candidate["role"] != role and not DEMO_OA_ALWAYS_ON:
        return {"error": "Role mismatch"}
    if not candidate and not DEMO_OA_ALWAYS_ON:
        return {"error": "Candidate not found. Submit application first."}
    if candidate and not candidate["oa_eligible"] and not DEMO_OA_ALWAYS_ON:
        return {"error": "OA not available yet. Wait for HR shortlist."}

    questions = load_generated_quiz(email, role)
    if not questions:
        jd_text = (candidate["jd_text"] if candidate else "") or _latest_jd_for_role(role)
        resume_text = (candidate["resume_text"] if candidate else "") or ""
        questions = generate_agentic_quiz(
            role=role,
            jd_text=jd_text,
            resume_text=resume_text,
            seed_hint=email,
            num_questions=10,
        )
        if questions:
            save_generated_quiz(email, role, questions)
    total = len(questions)
    if total == 0:
        return {"error": "No questions available"}

    score = 0
    topic_totals = {}
    topic_correct = {}
    for q in questions:
        qid = str(q["id"])
        topic = q.get("topic", "General")
        topic_totals[topic] = topic_totals.get(topic, 0) + 1
        if str(answers.get(qid, "")) == str(q["answer"]):
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
            "percentage": round((correct / total_count) * 100, 2) if total_count else 0,
        }

    if candidate:
        with get_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                UPDATE candidates
                SET oa_score = ?, oa_total = ?, oa_percentage = ?, oa_status = ?,
                    oa_tab_switches = ?, oa_topic_breakdown = ?, interview_eligible = 0, oa_eligible = 1, status = ?
                WHERE email = ?
                """,
                (
                    score,
                    total,
                    percentage,
                    status,
                    tab_switches,
                    to_json(topic_breakdown),
                    "UNDER_REVIEW",
                    email,
                ),
            )

    return {
        "score": score,
        "total": total,
        "percentage": percentage,
        "status": status,
        "tab_switches": tab_switches,
        "topic_breakdown": topic_breakdown,
        "demo_mode": bool(not candidate and DEMO_OA_ALWAYS_ON),
    }


def is_mcq_qualified(email: str) -> bool:
    candidate = _find_candidate(email)
    if not candidate:
        return False
    return bool(candidate["oa_percentage"] and candidate["oa_percentage"] >= 60)
