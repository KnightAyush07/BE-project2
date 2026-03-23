# backend/app/utils/keywords.py

import re


SKILLS = [
    "python", "java", "c++", "javascript", "react", "node",
    "fastapi", "django", "flask",
    "sql", "mysql", "postgresql", "mongodb",
    "html", "css",
    "machine learning", "deep learning",
    "data science", "nlp",
    "docker", "git", "aws"
]

EDUCATION_KEYWORDS = [
    "bachelor", "b.tech", "be", "b.e",
    "master", "m.tech", "mba", "msc",
    "phd", "doctorate",
    "computer science", "information technology",
    "electronics", "mechanical"
]

JOB_KEYWORDS = {
    "python_dev": [
        "python",
        "fastapi",
        "django",
        "rest",
        "sql",
        "backend",
        "api",
        "testing",
        "docker",
    ],
    "fullstack_dev": [
        "react",
        "node",
        "javascript",
        "python",
        "rest",
        "database",
        "sql",
        "cloud",
        "api",
    ],
    "java_dev": [
        "java",
        "spring",
        "spring boot",
        "oop",
        "sql",
        "backend",
        "api",
        "testing",
        "microservice",
    ],
}


def normalize_role_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (value or "").strip().lower()).strip("_")


def tokenize_text(text: str) -> list[str]:
    return re.findall(r"[a-zA-Z][a-zA-Z0-9+#.-]*", (text or "").lower())


def derive_role_keywords(role: str, jd_text: str = "", limit: int = 12) -> list[str]:
    normalized_role = normalize_role_name(role)
    if normalized_role in JOB_KEYWORDS:
        return list(JOB_KEYWORDS[normalized_role])

    keywords: list[str] = []
    seen: set[str] = set()

    def add(term: str):
        cleaned = (term or "").strip().lower()
        if not cleaned or cleaned in seen:
            return
        seen.add(cleaned)
        keywords.append(cleaned)

    for token in tokenize_text(role.replace("_", " ")):
        if len(token) > 2:
            add(token)

    jd_lower = (jd_text or "").lower()
    for skill in SKILLS:
        if skill in jd_lower:
            add(skill)

    stopwords = {
        "with", "from", "that", "this", "have", "will", "your", "role", "team",
        "year", "years", "work", "working", "using", "good", "strong", "ability",
        "must", "should", "nice", "plus", "about", "into", "their", "them",
    }
    token_counts: dict[str, int] = {}
    for token in tokenize_text(jd_text):
        if len(token) <= 3 or token in stopwords:
            continue
        token_counts[token] = token_counts.get(token, 0) + 1

    ranked_tokens = sorted(token_counts.items(), key=lambda item: (-item[1], item[0]))
    for token, _count in ranked_tokens:
        add(token)
        if len(keywords) >= limit:
            break

    return keywords[:limit]
