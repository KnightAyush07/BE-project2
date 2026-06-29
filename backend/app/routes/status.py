from fastapi import APIRouter
from datetime import datetime, timedelta
from app.db import get_conn, clear_all_data

router = APIRouter()

# ⏱ For testing: 2 minutes instead of 2 days
RESULT_DELAY = timedelta(minutes=2)


def _has_completed_full_process(candidate) -> bool:
    oa_status = (candidate["oa_status"] or "").strip().upper()
    interview_status = (candidate["interview_status"] or "").strip().upper()
    return oa_status in {"PASS", "FAIL"} and interview_status in {"PASS", "FAIL"}

@router.get("/check-status")
def check_status(email: str):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM candidates WHERE email = ?", (email,))
        candidate = cur.fetchone()

    if not candidate:
        return {"error": "No application was submitted"}

    current_status = (candidate["status"] or "").strip().upper()
    visible = candidate["visible_to_candidate"] if "visible_to_candidate" in candidate.keys() else 0

    # ── Final decisions (persisted by HR) ──
    if current_status in ("SELECTED", "CONGRATULATIONS"):
        return {
            "status": "SELECTED",
            "visible_to_candidate": 1,
            "message": "Congratulations! You have been selected as a top candidate!",
        }
    if current_status == "REGRET":
        return {
            "status": "NOT_SELECTED",
            "visible_to_candidate": int(visible),
            "message": "Thank you for your effort. Unfortunately you were not selected for this role.",
        }
    if current_status in ("APPROVED", "REJECTED"):
        return {
            "status": current_status,
            "visible_to_candidate": int(visible),
            "message": "HR has reviewed your application.",
        }

    # ── Still in progress ──
    time_passed = datetime.utcnow() - datetime.fromisoformat(candidate["submitted_at"])

    if _has_completed_full_process(candidate):
        return {
            "status": "UNDER_REVIEW",
            "visible_to_candidate": 0,
            "message": "You completed all rounds. Waiting for HR final decision.",
        }

    if time_passed < RESULT_DELAY:
        return {
            "status": "UNDER_REVIEW",
            "visible_to_candidate": 0,
            "message": "Your application is still under review.",
        }

    return {
        "status": "UNDER_REVIEW",
        "visible_to_candidate": 0,
        "message": "Your application is under review.",
    }



@router.post("/clear-all-data")
def clear_all_data_endpoint():
    """Clear all HR and Candidate data from the database"""
    return clear_all_data()
