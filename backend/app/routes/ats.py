from fastapi import APIRouter
from pydantic import BaseModel

from app.services.ats_matcher import compute_ats_score
from app.utils.job_descriptions import JOB_DESCRIPTIONS

router = APIRouter()

class ATSRequest(BaseModel):
    resume_text: str
    role: str

@router.post("/score")
def ats_score(payload: ATSRequest):
    job_description = JOB_DESCRIPTIONS.get(payload.role)

    if not job_description:
        return {"error": "Invalid role selected"}

    score = compute_ats_score(payload.resume_text, job_description)

    return {
        "role": payload.role,
        "ats_score": score,
        "decision": "Shortlisted" if score >= 60 else "Rejected"
    }
