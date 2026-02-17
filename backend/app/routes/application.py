from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import datetime

from app.db import get_conn, to_json
from app.routes.auth import require_role
from app.services.ats_matcher import compute_ats_score
from app.services.explainability import explain_ats

router = APIRouter()


class ApplicationRequest(BaseModel):
    name: str
    email: str
    phone: str
    skills: list[str]
    education: list[str]
    resume_text: str
    role: str
    hr_id: int
    jd_text: str | None = None
    jd_filename: str | None = None


@router.post("/submit")
def submit_application(data: ApplicationRequest, user=Depends(require_role("CANDIDATE"))):
    if data.email.lower() != user["email"].lower():
        raise HTTPException(status_code=403, detail="Email mismatch")

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM hr_profiles WHERE id = ?", (data.hr_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=400, detail="Invalid HR selection")

        jd_text = data.jd_text.strip() if data.jd_text else ""
        jd_filename = (data.jd_filename or "").strip()
        if not jd_text:
            cur.execute(
                """
                SELECT jd_text, jd_filename
                FROM hr_job_descriptions
                WHERE hr_id = ? AND role = ?
                """,
                (data.hr_id, data.role),
            )
            jd_row = cur.fetchone()
            if not jd_row or not (jd_row["jd_text"] or "").strip():
                raise HTTPException(
                    status_code=400,
                    detail="Selected HR has not uploaded JD for this role",
                )
            jd_text = jd_row["jd_text"]
            jd_filename = jd_row["jd_filename"] or ""

        cur.execute("SELECT id FROM users WHERE id = ?", (user["id"],))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="User not found")

        ats_score = compute_ats_score(data.resume_text, jd_text)
        ats_explain = explain_ats(data.skills, data.role)

        cur.execute("SELECT id FROM candidates WHERE user_id = ?", (user["id"],))
        existing = cur.fetchone()
        submitted_at = datetime.utcnow().isoformat()
        if existing:
            cur.execute(
                """
                UPDATE candidates
                SET hr_id = ?, name = ?, email = ?, phone = ?, skills = ?, education = ?,
                    resume_text = ?, jd_text = ?, jd_filename = ?, role = ?, ats_score = ?, ats_match_percent = ?,
                    ats_matched_skills = ?, ats_missing_skills = ?, status = ?,
                    oa_eligible = 0, interview_eligible = 0, oa_score = NULL,
                    oa_total = NULL, oa_percentage = NULL, oa_status = 'NOT_TAKEN',
                    oa_topic_breakdown = ?, interview_score = NULL,
                    interview_percentage = NULL, interview_status = 'NOT_TAKEN',
                    submitted_at = ?
                WHERE user_id = ?
                """,
                (
                    data.hr_id,
                    data.name,
                    data.email,
                    data.phone,
                    to_json(data.skills),
                    to_json(data.education),
                    data.resume_text,
                    jd_text,
                    jd_filename,
                    data.role,
                    ats_score,
                    ats_explain.get("match_percent"),
                    to_json(ats_explain.get("matched_skills")),
                    to_json(ats_explain.get("missing_skills")),
                    "UNDER_REVIEW",
                    to_json({}),
                    submitted_at,
                    user["id"],
                ),
            )
        else:
            cur.execute(
                """
                INSERT INTO candidates (
                    user_id, hr_id, name, email, phone, skills, education, resume_text,
                    jd_text, jd_filename, role, status, oa_eligible, interview_eligible,
                    ats_score, ats_match_percent, ats_matched_skills, ats_missing_skills,
                    oa_score, oa_total, oa_percentage, oa_status, oa_topic_breakdown,
                    interview_score, interview_percentage, interview_status, submitted_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, NULL, NULL, NULL, 'NOT_TAKEN', ?, NULL, NULL, 'NOT_TAKEN', ?)
                """,
                (
                    user["id"],
                    data.hr_id,
                    data.name,
                    data.email,
                    data.phone,
                    to_json(data.skills),
                    to_json(data.education),
                    data.resume_text,
                    jd_text,
                    jd_filename,
                    data.role,
                    "UNDER_REVIEW",
                    ats_score,
                    ats_explain.get("match_percent"),
                    to_json(ats_explain.get("matched_skills")),
                    to_json(ats_explain.get("missing_skills")),
                    to_json({}),
                    submitted_at,
                ),
            )

    return {
        "message": "Application submitted successfully",
        "status": "UNDER_REVIEW",
    }
