from app.utils.keywords import JOB_KEYWORDS

def explain_ats(candidate_skills, role):
    jd_skills = JOB_KEYWORDS.get(role, [])

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
