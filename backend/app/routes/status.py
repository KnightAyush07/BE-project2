from fastapi import APIRouter
from datetime import datetime, timedelta
from app.utils.store import CANDIDATES

router = APIRouter()

# ⏱ For testing: 2 minutes instead of 2 days
RESULT_DELAY = timedelta(minutes=2)

@router.get("/check-status")
def check_status(email: str):
    candidate = next((c for c in CANDIDATES if c["email"] == email), None)

    if not candidate:
        return {"error": "Candidate not found"}

    time_passed = datetime.utcnow() - candidate["submitted_at"]

    if time_passed < RESULT_DELAY:
        return {
            "status": "UNDER_REVIEW",
            "message": "Your application is still under review"
        }

    # After delay
    if candidate["status"] == "SELECTED" or candidate["ats_score"] >= 60:
        candidate["status"] = "CONGRATULATIONS"
        return {
            "status": "CONGRATULATIONS",
            "message": "Congratulations! You have been shortlisted."
        }
    else:
        candidate["status"] = "REGRET"
        return {
            "status": "REGRET",
            "message": "Thank you for applying. Unfortunately, you were not shortlisted."
        }
