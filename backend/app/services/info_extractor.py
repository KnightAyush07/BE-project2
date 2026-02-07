import re
from app.utils.keywords import SKILLS, EDUCATION_KEYWORDS
from app.services.nlp_model import get_nlp

nlp = get_nlp()

def extract_email(text):
    m = re.search(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", text)
    return m.group(0) if m else ""

def extract_phone(text):
    m = re.search(r"\b\d{10}\b", text)
    return m.group(0) if m else ""

def extract_name(text):
    doc = nlp(text)
    for ent in doc.ents:
        if ent.label_ == "PERSON":
            return ent.text
    return ""

def extract_skills(text):
    t = text.lower()
    return list(set(s for s in SKILLS if s in t))

def extract_education(text):
    t = text.lower()
    return list(set(e for e in EDUCATION_KEYWORDS if e in t))

def extract_candidate_info(text):
    return {
        "name": extract_name(text),
        "email": extract_email(text),
        "phone": extract_phone(text),
        "skills": extract_skills(text),
        "education": extract_education(text),
    }
