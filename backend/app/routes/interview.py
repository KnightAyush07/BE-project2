from fastapi import APIRouter, Depends, HTTPException
import os
import re
from app.data.interview_questions import INTERVIEW_QUESTIONS
from app.db import get_conn
from app.routes.auth import require_role
from app.utils.keywords import derive_role_keywords

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
    return ""


def _compact_text(value: str, max_len: int = 90) -> str:
    cleaned = re.sub(r"\s+", " ", (value or "")).strip(" -:|,.;")
    if len(cleaned) <= max_len:
        return cleaned
    return cleaned[: max_len - 3].rstrip() + "..."


def _extract_resume_highlights(resume_text: str) -> tuple[str, str]:
    project_line = ""
    internship_line = ""
    if not resume_text:
        return project_line, internship_line

    lines = [re.sub(r"\s+", " ", line).strip() for line in resume_text.splitlines()]
    lines = [line for line in lines if 12 <= len(line) <= 180]

    for line in lines:
        low = line.lower()
        if (
            not project_line
            and any(token in low for token in ["project", "built", "developed", "implemented", "created"])
        ):
            project_line = _compact_text(line)
        if (
            not internship_line
            and any(token in low for token in ["internship", "intern", "trainee"])
        ):
            internship_line = _compact_text(line)
        if project_line and internship_line:
            break

    return project_line, internship_line


def _build_personalized_questions(candidate) -> list[dict]:
    name = (candidate["name"] or "").strip() if candidate else ""
    greeting_name = name or "there"
    resume_text = (candidate["resume_text"] or "") if candidate else ""
    project_line, internship_line = _extract_resume_highlights(resume_text)

    questions = []
    if project_line:
        questions.append(
            {
                "question": (
                    f"Hi {greeting_name}, in your project '{project_line}', "
                    "what was your design approach and biggest technical trade-off?"
                ),
                "keywords": ["design", "architecture", "trade", "decision", "scale", "performance"],
            }
        )
    if internship_line:
        questions.append(
            {
                "question": (
                    f"In your internship experience '{internship_line}', "
                    "what problem did you solve and how did you measure impact?"
                ),
                "keywords": ["problem", "solution", "impact", "metric", "result", "ownership"],
            }
        )
    if not questions:
        questions.append(
            {
                "question": (
                    f"Hi {greeting_name}, please summarize one project or internship where "
                    "you solved a real problem end-to-end."
                ),
                "keywords": ["problem", "approach", "result", "impact", "learning", "ownership"],
            }
        )

    return questions


def _build_generic_questions(role: str, candidate) -> list[dict]:
    effective_role = (role or (candidate["role"] if candidate else "") or "this role").replace("_", " ")
    jd_text = (candidate["jd_text"] or "") if candidate else ""
    role_keywords = derive_role_keywords(role or effective_role, jd_text)
    lead_keywords = role_keywords[:4] or ["problem solving", "communication", "delivery", "quality"]

    return [
        {
            "question": (
                f"What experience makes you a good fit for the {effective_role} role, "
                f"especially around {', '.join(lead_keywords[:2])}?"
            ),
            "keywords": lead_keywords + ["experience", "impact", "ownership"],
        },
        {
            "question": (
                f"Tell us about a project where you used {', '.join(lead_keywords[2:4] or lead_keywords[:2])} "
                "to solve a real problem."
            ),
            "keywords": lead_keywords + ["project", "solution", "result"],
        },
        {
            "question": "How do you ensure quality, collaboration, and reliability while delivering work?",
            "keywords": ["testing", "review", "communication", "monitoring", "quality", "delivery"],
        },
        {
            "question": "Describe a technical challenge you faced recently and how you resolved it.",
            "keywords": ["challenge", "debug", "approach", "result", "trade", "learning"],
        },
    ]


def _resolve_question_set(candidate, role: str) -> list[dict]:
    effective_role = _resolve_role_for_questions(role, candidate["role"] if candidate else None)
    base_questions = INTERVIEW_QUESTIONS.get(effective_role, [])
    personalized = _build_personalized_questions(candidate)
    generic = _build_generic_questions(role, candidate)

    if not base_questions:
        merged = personalized + generic
    else:
        replace_count = min(len(personalized), len(base_questions))
        merged = personalized + base_questions[replace_count:]

    resolved = []
    for index, q in enumerate(merged, start=1):
        resolved.append(
            {
                "id": index,
                "question": q["question"],
                "keywords": q.get("keywords", []),
            }
        )
    return resolved


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

    questions = _resolve_question_set(candidate, role)
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
    tab_switches = max(0, int(payload.get("tab_switches", 0) or 0))

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

    questions = _resolve_question_set(candidate, role)
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
            SET interview_score = ?, interview_percentage = ?, interview_status = ?, interview_tab_switches = ?
            WHERE email = ?
            """,
            (round(total_score, 2), percentage, status, tab_switches, email),
        )

    return {
        "score": round(total_score, 2),
        "percentage": percentage,
        "status": status,
        "tab_switches": tab_switches,
    }
