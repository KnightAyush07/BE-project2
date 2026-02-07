from fastapi import APIRouter
from pydantic import BaseModel
from datetime import datetime

from app.utils.store import CANDIDATES
from app.services.ats_matcher import compute_ats_score
from app.services.explainability import explain_ats
from app.utils.job_descriptions import JOB_DESCRIPTIONS

router = APIRouter()


class ApplicationRequest(BaseModel):
    name: str
    email: str
    phone: str
    skills: list[str]
    education: list[str]
    resume_text: str
    role: str


@router.post("/submit")
def submit_application(data: ApplicationRequest):
    jd = JOB_DESCRIPTIONS.get(data.role)
    if not jd:
        return {"error": "Invalid role"}

    ats_score = compute_ats_score(data.resume_text, jd)
    ats_explain = explain_ats(data.skills, data.role)

    candidate = {
        "name": data.name,
        "email": data.email,
        "phone": data.phone,
        "skills": data.skills,
        "education": data.education,
        "role": data.role,
        "ats_score": ats_score,
        "ats_match_percent": ats_explain.get("match_percent"),
        "ats_matched_skills": ats_explain.get("matched_skills"),
        "ats_missing_skills": ats_explain.get("missing_skills"),
        "status": "UNDER_REVIEW",
        "oa_eligible": False,
        "oa_score": None,
        "oa_total": None,
        "oa_percentage": None,
        "oa_status": "NOT_TAKEN",
        "oa_topic_breakdown": {},
        "interview_eligible": False,
        "interview_score": None,
        "interview_percentage": None,
        "interview_status": "NOT_TAKEN",
        "submitted_at": datetime.utcnow(),
    }

    CANDIDATES.append(candidate)

    return {
        "message": "Application submitted successfully",
        "status": "UNDER_REVIEW",
    }
