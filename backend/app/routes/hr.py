from fastapi import APIRouter
from app.utils.store import CANDIDATES

router = APIRouter()

@router.get("/candidates")
def get_all_candidates():
    """
    HR: View all candidates
    """
    return CANDIDATES


@router.get("/shortlist")
@router.post("/shortlist")
def shortlist_candidates(role: str, top_n: int = 50, limit: int | None = None):
    """
    HR: Shortlist top N candidates based on ATS score
    """
    filtered = [c for c in CANDIDATES if c["role"] == role]
    n = limit if limit is not None else top_n

    sorted_candidates = sorted(
        filtered,
        key=lambda x: x["ats_score"],
        reverse=True
    )

    shortlisted = sorted_candidates[:n]

    for c in shortlisted:
        c["status"] = "INTERVIEW_SHORTLISTED"
        c["oa_eligible"] = True
        if c.get("oa_status") in (None, "NOT_TAKEN"):
            c["oa_status"] = "NOT_TAKEN"

    return {
        "role": role,
        "shortlisted_count": len(shortlisted),
        "candidates": shortlisted
    }


@router.get("/finalize")
@router.post("/finalize")
def finalize_candidates(role: str, top_n: int = 10, limit: int | None = None):
    """
    HR: Final selection after interview
    """
    filtered = [c for c in CANDIDATES if c["role"] == role]
    n = limit if limit is not None else top_n

    sorted_candidates = sorted(
        filtered,
        key=lambda x: x["ats_score"],
        reverse=True
    )

    final_list = sorted_candidates[:n]

    for c in final_list:
        c["status"] = "SELECTED"

    return {
        "role": role,
        "selected_count": len(final_list),
        "candidates": final_list
    }
