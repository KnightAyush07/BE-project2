from app.utils.keywords import derive_role_keywords
from app.services.model_explainers import explain_candidate_model


def explain_ats(candidate_skills, role):
    jd_skills = derive_role_keywords(role)

    candidate_skills = [s.lower() for s in candidate_skills]

    matched = [s for s in jd_skills if s in candidate_skills]
    missing = [s for s in jd_skills if s not in candidate_skills]

    match_percent = round(
        (len(matched) / len(jd_skills)) * 100, 2
    ) if jd_skills else 0

    return {
        "matched_skills": matched,
        "missing_skills": missing,
        "match_percent": match_percent
    }


def _safe_number(value, default=0):
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _safe_int(value, default=0):
    try:
        if value is None:
            return default
        return int(value)
    except (TypeError, ValueError):
        return default


def _status_label(value: str | None, fallback: str = "PENDING") -> str:
    clean = (value or "").strip().upper()
    return clean or fallback


def _bullet(text: str, items: list[str]):
    if text and text not in items:
        items.append(text)


def _stage_summary(stage: str) -> str:
    labels = {
        "resume": "Resume screening",
        "oa": "Online assessment",
        "interview": "Interview review",
        "final": "Final decision",
    }
    return labels.get(stage, "Hiring review")


def build_hr_xai(candidate: dict) -> dict:
    role = (candidate.get("role") or "").strip()
    expected_skills = derive_role_keywords(role, candidate.get("jd_text") or "")
    matched_skills = candidate.get("ats_matched_skills") or []
    missing_skills = candidate.get("ats_missing_skills") or []
    ats_score = round(_safe_number(candidate.get("ats_score")), 2)
    ats_match_percent = round(_safe_number(candidate.get("ats_match_percent")), 2)
    oa_percentage = round(_safe_number(candidate.get("oa_percentage")), 2)
    interview_percentage = round(_safe_number(candidate.get("interview_percentage")), 2)
    oa_score = _safe_int(candidate.get("oa_score"), default=0)
    oa_total = _safe_int(candidate.get("oa_total"), default=0)
    interview_score = round(_safe_number(candidate.get("interview_score")), 2)
    oa_tab_switches = _safe_int(candidate.get("oa_tab_switches"), default=0)
    interview_tab_switches = _safe_int(candidate.get("interview_tab_switches"), default=0)
    oa_topic_breakdown = candidate.get("oa_topic_breakdown") or {}
    final_status = _status_label(candidate.get("status"))
    oa_status = _status_label(candidate.get("oa_status"), fallback="NOT_TAKEN")
    interview_status = _status_label(candidate.get("interview_status"), fallback="NOT_TAKEN")
    model_explanations = explain_candidate_model(candidate)

    strengths = []
    concerns = []
    rationale = []
    next_steps = []

    if matched_skills:
        _bullet(
            f"Matched {len(matched_skills)} role keywords: {', '.join(matched_skills[:5])}.",
            strengths,
        )
    if ats_score >= 70:
        _bullet(f"High ATS similarity score ({ats_score}%).", strengths)
    elif ats_score >= 60:
        _bullet(f"ATS score is above shortlist threshold ({ats_score}%).", strengths)
    else:
        _bullet(f"ATS score is below preferred shortlist range ({ats_score}%).", concerns)

    if expected_skills:
        matched_count = len(matched_skills)
        _bullet(
            f"Skill coverage is {matched_count}/{len(expected_skills)} expected keywords ({ats_match_percent}%).",
            rationale,
        )
    if missing_skills:
        _bullet(
            f"Missing role keywords: {', '.join(missing_skills[:5])}.",
            concerns,
        )

    if oa_total > 0:
        _bullet(
            f"OA performance: {oa_score}/{oa_total} correct ({oa_percentage}%), status {oa_status}.",
            rationale,
        )
        if oa_status == "PASS":
            _bullet("Candidate cleared the OA benchmark.", strengths)
        elif oa_status == "FAIL":
            _bullet("Candidate did not clear the OA benchmark.", concerns)
    else:
        _bullet("OA has not been completed yet.", next_steps)

    strongest_topic = ""
    strongest_topic_score = -1
    weakest_topic = ""
    weakest_topic_score = 101
    for topic, stats in oa_topic_breakdown.items():
        topic_score = round(_safe_number((stats or {}).get("percentage")), 2)
        if topic_score > strongest_topic_score:
            strongest_topic = topic
            strongest_topic_score = topic_score
        if topic_score < weakest_topic_score:
            weakest_topic = topic
            weakest_topic_score = topic_score

    if strongest_topic:
        _bullet(
            f"Strongest OA area: {strongest_topic} ({strongest_topic_score}%).",
            strengths,
        )
    if weakest_topic and weakest_topic != strongest_topic:
        _bullet(
            f"Weakest OA area: {weakest_topic} ({weakest_topic_score}%).",
            concerns,
        )

    if oa_tab_switches >= 3:
        _bullet(f"OA integrity risk: {oa_tab_switches} tab switches were detected.", concerns)
    elif oa_tab_switches > 0:
        _bullet(f"OA had {oa_tab_switches} tab switches; review for possible distraction.", rationale)

    if interview_status in {"PASS", "FAIL"} or interview_score > 0:
        _bullet(
            f"Interview result: {interview_percentage}% ({interview_status}), keyword score {interview_score}.",
            rationale,
        )
        if interview_status == "PASS":
            _bullet("Interview responses met the current evaluation threshold.", strengths)
        elif interview_status == "FAIL":
            _bullet("Interview responses fell below the current evaluation threshold.", concerns)
    else:
        _bullet("Interview has not been completed yet.", next_steps)

    if interview_tab_switches >= 3:
        _bullet(
            f"Interview integrity risk: {interview_tab_switches} tab switches were detected.",
            concerns,
        )
    elif interview_tab_switches > 0:
        _bullet(
            f"Interview had {interview_tab_switches} tab switches; review with caution.",
            rationale,
        )

    advance_probability = round(model_explanations.get("advance_probability", 0), 2)
    if advance_probability >= 75:
        _bullet(
            f"Surrogate model estimates a strong advancement likelihood ({advance_probability}%).",
            strengths,
        )
    elif advance_probability >= 55:
        _bullet(
            f"Surrogate model indicates a borderline advancement likelihood ({advance_probability}%).",
            rationale,
        )
    else:
        _bullet(
            f"Surrogate model indicates limited advancement likelihood ({advance_probability}%).",
            concerns,
        )

    stage_payloads = {
        "resume": {
            "title": "Resume Screening XAI",
            "summary": _stage_summary("resume"),
            "recommendation": "SHORTLIST" if ats_score >= 60 else "HOLD",
            "strengths": strengths[:3],
            "concerns": concerns[:3],
            "rationale": rationale[:3],
            "next_steps": ["Move to OA" if ats_score >= 60 else "Wait for stronger fit"] + next_steps[:1],
        },
        "oa": {
            "title": "OA Review XAI",
            "summary": _stage_summary("oa"),
            "recommendation": "APPROVE_FOR_INTERVIEW" if oa_status == "PASS" else "REVIEW",
            "strengths": strengths[:4],
            "concerns": concerns[:4],
            "rationale": rationale[:4],
            "next_steps": (
                ["Approve for interview"] if oa_status == "PASS" else ["Review OA result before promotion"]
            ) + next_steps[:1],
        },
        "interview": {
            "title": "Interview Review XAI",
            "summary": _stage_summary("interview"),
            "recommendation": "SELECT" if interview_status == "PASS" else "HOLD",
            "strengths": strengths[:4],
            "concerns": concerns[:4],
            "rationale": rationale[:4],
            "next_steps": (
                ["Mark final selection"] if interview_status == "PASS" else ["Collect more evidence or reject"]
            ) + next_steps[:1],
        },
        "final": {
            "title": "Final Hiring XAI",
            "summary": _stage_summary("final"),
            "recommendation": final_status,
            "strengths": strengths[:5],
            "concerns": concerns[:5],
            "rationale": rationale[:5],
            "next_steps": ["Finalize candidate status in dashboard"],
        },
    }

    return {
        "current_status": final_status,
        "signals": {
            "ats_score": ats_score,
            "ats_match_percent": ats_match_percent,
            "matched_skills": matched_skills,
            "missing_skills": missing_skills,
            "oa_status": oa_status,
            "oa_percentage": oa_percentage,
            "oa_tab_switches": oa_tab_switches,
            "oa_topic_breakdown": oa_topic_breakdown,
            "interview_status": interview_status,
            "interview_percentage": interview_percentage,
            "interview_tab_switches": interview_tab_switches,
        },
        "stages": stage_payloads,
        "model_explanations": model_explanations,
    }
