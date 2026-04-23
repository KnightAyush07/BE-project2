from fastapi import APIRouter
from datetime import datetime, timedelta
from app.db import get_conn

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
    if current_status in ("APPROVED", "REJECTED"):
        return {
            "status": current_status,
            "message": "HR has reviewed your application."
        }
    if current_status in ("SELECTED", "CONGRATULATIONS"):
        return {
            "status": "CONGRATULATIONS",
            "message": "Congratulations! You have been shortlisted."
        }
    if current_status == "REGRET":
        return {
            "status": "REGRET",
            "message": "Thank you for applying. Unfortunately, you were not shortlisted."
        }

    time_passed = datetime.utcnow() - datetime.fromisoformat(candidate["submitted_at"])

    if time_passed < RESULT_DELAY:
        return {
            "status": "UNDER_REVIEW",
            "message": "Your application is still under review"
        }

    # After delay, keep completed candidates waiting until HR finalizes top N.
    if _has_completed_full_process(candidate):
        return {
            "status": "UNDER_REVIEW",
            "message": "You completed all rounds. Waiting for HR final decision."
        }

    return {
        "status": "UNDER_REVIEW",
        "message": "Your application is still under review"
    }
