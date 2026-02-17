from fastapi import APIRouter
from datetime import datetime, timedelta
from app.db import get_conn

router = APIRouter()

# ⏱ For testing: 2 minutes instead of 2 days
RESULT_DELAY = timedelta(minutes=2)

@router.get("/check-status")
def check_status(email: str):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM candidates WHERE email = ?", (email,))
        candidate = cur.fetchone()

    if not candidate:
        return {"error": "No application was submitted"}

    current_status = candidate["status"]
    if current_status in ("APPROVED", "REJECTED"):
        return {
            "status": current_status,
            "message": "HR has reviewed your application."
        }

    time_passed = datetime.utcnow() - datetime.fromisoformat(candidate["submitted_at"])

    if time_passed < RESULT_DELAY:
        return {
            "status": "UNDER_REVIEW",
            "message": "Your application is still under review"
        }

    # After delay
    if candidate["status"] == "SELECTED" or (candidate["ats_score"] or 0) >= 60:
        with get_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "UPDATE candidates SET status = ? WHERE email = ?",
                ("CONGRATULATIONS", email),
            )
        return {
            "status": "CONGRATULATIONS",
            "message": "Congratulations! You have been shortlisted."
        }
    else:
        with get_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "UPDATE candidates SET status = ? WHERE email = ?",
                ("REGRET", email),
            )
        return {
            "status": "REGRET",
            "message": "Thank you for applying. Unfortunately, you were not shortlisted."
        }
