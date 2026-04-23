from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from app.db import get_conn, from_json
from app.routes.auth import require_role
from app.services.resume_parser import extract_resume_text
from app.services.explainability import build_hr_xai

router = APIRouter()


class DecisionPayload(BaseModel):
    email: str
    decision: str


def _safe_number(value, default: float = 0.0) -> float:
    try:
        if value is None:
            return float(default)
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def _has_completed_full_process(candidate: dict) -> bool:
    oa_status = (candidate.get("oa_status") or "").strip().upper()
    interview_status = (candidate.get("interview_status") or "").strip().upper()
    return oa_status in {"PASS", "FAIL"} and interview_status in {"PASS", "FAIL"}


def _final_ranking_key(candidate: dict):
    return (
        -_safe_number(candidate.get("interview_percentage")),
        -_safe_number(candidate.get("oa_percentage")),
        -_safe_number(candidate.get("ats_score")),
        _safe_number(candidate.get("interview_tab_switches")),
        _safe_number(candidate.get("oa_tab_switches")),
        candidate.get("submitted_at") or "",
        candidate.get("id") or 0,
    )


def _fallback_xai(record: dict, error: Exception | None = None) -> dict:
    status = (record.get("status") or "PENDING").strip().upper() or "PENDING"
    summary = "Explainability is temporarily unavailable for this candidate."
    if error:
        summary = f"{summary} Review raw candidate scores instead."
    return {
        "current_status": status,
        "signals": {
            "ats_score": record.get("ats_score"),
            "ats_match_percent": record.get("ats_match_percent"),
            "matched_skills": record.get("ats_matched_skills") or [],
            "missing_skills": record.get("ats_missing_skills") or [],
            "oa_status": (record.get("oa_status") or "NOT_TAKEN").strip().upper(),
            "oa_percentage": record.get("oa_percentage"),
            "oa_tab_switches": record.get("oa_tab_switches") or 0,
            "oa_topic_breakdown": record.get("oa_topic_breakdown") or {},
            "interview_status": (record.get("interview_status") or "NOT_TAKEN").strip().upper(),
            "interview_percentage": record.get("interview_percentage"),
            "interview_tab_switches": record.get("interview_tab_switches") or 0,
        },
        "stages": {
            "resume": {
                "title": "Resume Screening XAI",
                "summary": summary,
                "recommendation": "REVIEW",
                "strengths": [],
                "concerns": [],
                "rationale": ["ATS and stage metrics are still available in the table."],
                "next_steps": ["Use the visible candidate scores to continue review."],
            },
            "oa": {
                "title": "OA Review XAI",
                "summary": summary,
                "recommendation": "REVIEW",
                "strengths": [],
                "concerns": [],
                "rationale": ["OA score and status remain available in the dashboard."],
                "next_steps": ["Continue OA review using table data."],
            },
            "interview": {
                "title": "Interview Review XAI",
                "summary": summary,
                "recommendation": "REVIEW",
                "strengths": [],
                "concerns": [],
                "rationale": ["Interview outcome data remains available in the dashboard."],
                "next_steps": ["Continue interview review using table data."],
            },
            "final": {
                "title": "Final Hiring XAI",
                "summary": summary,
                "recommendation": status,
                "strengths": [],
                "concerns": [],
                "rationale": ["Candidate pipeline data loaded without the explainer layer."],
                "next_steps": ["Finalize status after reviewing available scores."],
            },
        },
        "model_explanations": {
            "surrogate_model": "unavailable",
            "target": "advance_probability",
            "advance_probability": 0.0,
            "shap_top_features": [],
            "lime_local_rules": [],
        },
    }


@router.get("/list")
def list_hr_profiles():
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT hr_profiles.id, hr_profiles.display_name, companies.name AS company_name
            FROM hr_profiles
            LEFT JOIN companies ON companies.id = hr_profiles.company_id
            ORDER BY hr_profiles.display_name
            """
        )
        rows = cur.fetchall()
    return [
        {
            "id": row["id"],
            "name": row["display_name"],
            "company_name": row["company_name"] or "",
        }
        for row in rows
    ]


@router.get("/roles")
def list_hr_roles():
    """
    Public: list only HR-role pairs that already have an uploaded JD.
    Candidate UI uses this to show real-time role availability.
    """
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT hr_profiles.id AS hr_id, hr_profiles.display_name AS hr_name, hr_job_descriptions.role
            FROM hr_job_descriptions
            JOIN hr_profiles ON hr_profiles.id = hr_job_descriptions.hr_id
            ORDER BY hr_profiles.display_name, hr_job_descriptions.role
            """
        )
        rows = cur.fetchall()

    return [
        {
            "hr_id": row["hr_id"],
            "hr_name": row["hr_name"],
            "role": row["role"],
        }
        for row in rows
    ]


@router.post("/jd")
async def upload_hr_jd(
    role: str,
    file: UploadFile = File(...),
    user=Depends(require_role("HR")),
):
    file_ext = (file.filename or "").split(".")[-1].lower()
    if file_ext != "pdf":
        raise HTTPException(status_code=400, detail="JD must be a PDF file")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    import os
    import uuid

    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    upload_dir = os.path.join(base_dir, "uploads")
    os.makedirs(upload_dir, exist_ok=True)

    temp_filename = f"{uuid.uuid4()}.pdf"
    file_path = os.path.join(upload_dir, temp_filename)
    with open(file_path, "wb") as f:
        f.write(content)

    jd_text = extract_resume_text(file_path).strip()
    if not jd_text:
        raise HTTPException(status_code=400, detail="Could not extract JD text")

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM hr_profiles WHERE user_id = ?", (user["id"],))
        hr_row = cur.fetchone()
        if not hr_row:
            raise HTTPException(status_code=404, detail="HR profile not found")

        hr_id = hr_row["id"]
        updated_at = datetime.utcnow().isoformat()
        cur.execute(
            """
            INSERT INTO hr_job_descriptions (hr_id, role, jd_text, jd_filename, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(hr_id, role)
            DO UPDATE SET
                jd_text = excluded.jd_text,
                jd_filename = excluded.jd_filename,
                updated_at = excluded.updated_at
            """,
            (hr_id, role, jd_text, file.filename or "jd.pdf", updated_at),
        )

    return {"message": "JD uploaded successfully", "role": role}


@router.get("/jd")
def get_hr_jd(hr_id: int, role: str):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT jd_text, jd_filename, updated_at
            FROM hr_job_descriptions
            WHERE hr_id = ? AND role = ?
            """,
            (hr_id, role),
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="JD not found for selected HR and role")

    return {
        "jd_text": row["jd_text"],
        "jd_filename": row["jd_filename"] or "",
        "updated_at": row["updated_at"],
    }


@router.get("/candidates")
def get_all_candidates(user=Depends(require_role("HR"))):
    """
    HR: View all candidates assigned to this HR
    """
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT candidates.*
            FROM candidates
            JOIN hr_profiles ON hr_profiles.id = candidates.hr_id
            WHERE hr_profiles.user_id = ?
            ORDER BY candidates.submitted_at DESC
            """,
            (user["id"],),
        )
        rows = cur.fetchall()

    response = []
    for row in rows:
        record = dict(row)
        record["skills"] = from_json(record.get("skills"), [])
        record["education"] = from_json(record.get("education"), [])
        record["ats_matched_skills"] = from_json(record.get("ats_matched_skills"), [])
        record["ats_missing_skills"] = from_json(record.get("ats_missing_skills"), [])
        record["oa_topic_breakdown"] = from_json(record.get("oa_topic_breakdown"), {})
        try:
            record["xai"] = build_hr_xai(record)
        except Exception as exc:
            record["xai"] = _fallback_xai(record, exc)
        response.append(record)

    return response


@router.get("/shortlist")
@router.post("/shortlist")
def shortlist_candidates(
    role: str,
    top_n: int = 50,
    limit: int | None = None,
    user=Depends(require_role("HR")),
):
    """
    HR: Shortlist top N candidates based on ATS score
    """
    n = limit if limit is not None else top_n
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT candidates.id
            FROM candidates
            JOIN hr_profiles ON hr_profiles.id = candidates.hr_id
            WHERE hr_profiles.user_id = ? AND candidates.role = ?
            ORDER BY candidates.ats_score DESC
            LIMIT ?
            """,
            (user["id"], role, n),
        )
        rows = cur.fetchall()
        candidate_ids = [row["id"] for row in rows]

        cur.executemany(
            """
            UPDATE candidates
            SET status = ?, oa_eligible = 1, oa_status = COALESCE(oa_status, 'NOT_TAKEN')
            WHERE id = ?
            """,
            [("INTERVIEW_SHORTLISTED", cid) for cid in candidate_ids],
        )

    return {"role": role, "shortlisted_count": len(candidate_ids)}


@router.get("/finalize")
@router.post("/finalize")
def finalize_candidates(
    role: str,
    top_n: int = 10,
    limit: int | None = None,
    user=Depends(require_role("HR")),
):
    """
    HR: Final selection after full process completion
    """
    n = limit if limit is not None else top_n
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT candidates.*
            FROM candidates
            JOIN hr_profiles ON hr_profiles.id = candidates.hr_id
            WHERE hr_profiles.user_id = ? AND candidates.role = ?
            """,
            (user["id"], role),
        )
        rows = cur.fetchall()

        completed_candidates = [row for row in rows if _has_completed_full_process(row)]
        ranked_candidates = sorted(completed_candidates, key=_final_ranking_key)
        selected_candidates = ranked_candidates[: max(0, n)]
        selected_ids = [row["id"] for row in selected_candidates]
        not_selected_ids = [row["id"] for row in ranked_candidates[max(0, n) :]]

        if selected_ids:
            cur.executemany(
                "UPDATE candidates SET status = ? WHERE id = ?",
                [("SELECTED", cid) for cid in selected_ids],
            )
        if not_selected_ids:
            cur.executemany(
                "UPDATE candidates SET status = ? WHERE id = ?",
                [("REGRET", cid) for cid in not_selected_ids],
            )

    return {
        "role": role,
        "completed_candidates": len(ranked_candidates),
        "selected_count": len(selected_ids),
        "not_selected_count": len(not_selected_ids),
    }


@router.post("/decision")
def set_candidate_decision(payload: DecisionPayload, user=Depends(require_role("HR"))):
    """
    HR: Approve or reject a candidate manually
    """
    decision = payload.decision.strip().upper()
    if decision not in {"APPROVED", "REJECTED"}:
        raise HTTPException(status_code=400, detail="Invalid decision")

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT candidates.id
            FROM candidates
            JOIN hr_profiles ON hr_profiles.id = candidates.hr_id
            WHERE candidates.email = ? AND hr_profiles.user_id = ?
            """,
            (payload.email, user["id"]),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Candidate not found")
        cur.execute(
            "UPDATE candidates SET status = ?, interview_eligible = ? WHERE id = ?",
            (decision, 1 if decision == "APPROVED" else 0, row["id"]),
        )

    return {"email": payload.email, "status": decision}
