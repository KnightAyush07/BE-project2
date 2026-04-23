import hashlib
import random
import re
from datetime import datetime

from app.data.question_bank import QUESTION_BANK
from app.db import from_json, get_conn, to_json
from app.utils.keywords import derive_role_keywords


ROLE_AUGMENTED_QUESTIONS = {
    "python_dev": [
        {
            "question": "Which structure provides O(1) average lookup for key-value pairs in Python?",
            "options": ["list", "tuple", "dict", "set"],
            "answer": "dict",
            "topic": "Data Structures",
        },
        {
            "question": "Which testing framework is widely used in Python projects?",
            "options": ["Jest", "PyTest", "JUnit", "Mocha"],
            "answer": "PyTest",
            "topic": "Testing",
        },
        {
            "question": "In FastAPI, which feature validates request data by default?",
            "options": ["Pydantic models", "Decorators", "Type comments only", "Flask schemas"],
            "answer": "Pydantic models",
            "topic": "FastAPI",
        },
        {
            "question": "Which SQL operation is safest for adding records without removing existing rows?",
            "options": ["DROP", "TRUNCATE", "INSERT", "DELETE"],
            "answer": "INSERT",
            "topic": "SQL",
        },
        {
            "question": "Which Docker command builds an image from a Dockerfile?",
            "options": ["docker run", "docker build", "docker push", "docker exec"],
            "answer": "docker build",
            "topic": "DevOps",
        },
    ],
    "java_dev": [
        {
            "question": "Which framework is commonly used to build Java microservices?",
            "options": ["Spring Boot", "Flask", "Express", "Laravel"],
            "answer": "Spring Boot",
            "topic": "Frameworks",
        },
        {
            "question": "Which keyword is used to implement an interface in Java?",
            "options": ["extends", "implements", "inherits", "instanceof"],
            "answer": "implements",
            "topic": "OOP",
        },
        {
            "question": "Which tool is commonly used for Java project dependency management?",
            "options": ["Gradle/Maven", "Pip", "Npm", "Poetry"],
            "answer": "Gradle/Maven",
            "topic": "Build Tools",
        },
        {
            "question": "Which Java feature is used to handle concurrent tasks?",
            "options": ["Threads", "Enums", "Annotations", "Reflection"],
            "answer": "Threads",
            "topic": "Concurrency",
        },
        {
            "question": "Which HTTP response code indicates successful resource creation?",
            "options": ["200", "201", "301", "404"],
            "answer": "201",
            "topic": "APIs",
        },
    ],
    "fullstack_dev": [
        {
            "question": "Which React hook is commonly used for side effects like API calls?",
            "options": ["useState", "useEffect", "useMemo", "useRef"],
            "answer": "useEffect",
            "topic": "Frontend",
        },
        {
            "question": "Which Node.js framework is common for REST APIs?",
            "options": ["Django", "Express", "FastAPI", "Spring"],
            "answer": "Express",
            "topic": "Backend",
        },
        {
            "question": "Which SQL clause filters rows before aggregation?",
            "options": ["GROUP BY", "HAVING", "WHERE", "ORDER BY"],
            "answer": "WHERE",
            "topic": "Database",
        },
        {
            "question": "Which browser storage survives tab close and browser restart?",
            "options": ["sessionStorage", "localStorage", "state", "cookies only"],
            "answer": "localStorage",
            "topic": "Frontend",
        },
        {
            "question": "Which cloud principle improves scaling for varying traffic?",
            "options": ["Hardcoded capacity", "Auto-scaling", "Single-thread runtime", "Manual deploy only"],
            "answer": "Auto-scaling",
            "topic": "Cloud",
        },
    ],
}

GENERIC_OA_POOL = [
    {
        "question": "Which approach improves API reliability in production systems?",
        "options": ["No logging", "Validation + retries + monitoring", "Hardcoded responses", "Skipping error handling"],
        "answer": "Validation + retries + monitoring",
        "topic": "APIs",
    },
    {
        "question": "Which practice best improves code maintainability?",
        "options": ["Long functions", "No tests", "Modular code with tests", "Copy-paste reuse"],
        "answer": "Modular code with tests",
        "topic": "Engineering",
    },
    {
        "question": "Which database operation should use transactions for consistency?",
        "options": ["Single read-only query", "Multiple dependent writes", "Static file load", "Cache lookup"],
        "answer": "Multiple dependent writes",
        "topic": "Database",
    },
    {
        "question": "Which deployment strategy minimizes downtime risk?",
        "options": ["Manual server edits", "Blue-green or canary rollout", "No backups", "Deploy in production only"],
        "answer": "Blue-green or canary rollout",
        "topic": "DevOps",
    },
    {
        "question": "Which authentication mechanism is common for stateless APIs?",
        "options": ["Session file", "JWT bearer tokens", "Plain text password in URL", "No auth"],
        "answer": "JWT bearer tokens",
        "topic": "Security",
    },
    {
        "question": "Which action best improves frontend performance?",
        "options": ["Bundle everything in one file", "Code splitting and lazy loading", "Disable caching", "Inline all images"],
        "answer": "Code splitting and lazy loading",
        "topic": "Frontend",
    },
    {
        "question": "Which metric helps evaluate service latency?",
        "options": ["p95 response time", "Total file count", "CPU model name", "Disk label"],
        "answer": "p95 response time",
        "topic": "Observability",
    },
    {
        "question": "Which SQL index type is commonly used for exact-match lookups?",
        "options": ["B-tree", "Bitmap image", "Hash map in frontend", "Queue index"],
        "answer": "B-tree",
        "topic": "SQL",
    },
    {
        "question": "Which is a valid CI/CD objective?",
        "options": ["Avoid automation", "Faster safe releases", "Increase manual steps", "Deploy without tests"],
        "answer": "Faster safe releases",
        "topic": "DevOps",
    },
    {
        "question": "Which practice improves model/algorithm evaluation quality?",
        "options": ["Single random trial only", "Train/validation split with metrics", "No baseline", "Ignore edge cases"],
        "answer": "Train/validation split with metrics",
        "topic": "Evaluation",
    },
    {
        "question": "Which method helps protect sensitive configuration values?",
        "options": ["Commit secrets to git", "Use environment secrets manager", "Share in chat", "Store in frontend bundle"],
        "answer": "Use environment secrets manager",
        "topic": "Security",
    },
    {
        "question": "Which pattern improves scalability for asynchronous workloads?",
        "options": ["Synchronous blocking only", "Queue-based workers", "Global mutex for all tasks", "Infinite polling loops"],
        "answer": "Queue-based workers",
        "topic": "Architecture",
    },
]

def _tokenize(text: str) -> set[str]:
    if not text:
        return set()
    return set(re.findall(r"[a-zA-Z0-9_]+", text.lower()))


def _hash_seed(value: str) -> int:
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()
    return int(digest[:8], 16)


def _build_focus_terms(role: str, jd_text: str, resume_text: str) -> set[str]:
    focus = set(derive_role_keywords(role, jd_text))
    jd_tokens = _tokenize(jd_text)
    resume_tokens = _tokenize(resume_text)
    focus.update(term for term in jd_tokens if len(term) > 3)
    focus.update(term for term in resume_tokens if len(term) > 3)
    return focus


def _question_score(question: dict, focus_terms: set[str], rng: random.Random) -> float:
    text = " ".join(
        [
            question.get("question", ""),
            " ".join(question.get("options", [])),
            question.get("topic", ""),
        ]
    )
    tokens = _tokenize(text)
    overlap = len(tokens.intersection(focus_terms))
    return float(overlap) + rng.uniform(0.0, 0.6)


def _build_pool_for_role(role: str) -> list[dict]:
    if role in QUESTION_BANK:
        pool = []
        for item in QUESTION_BANK.get(role, []):
            pool.append(
                {
                    "question": item["question"],
                    "options": list(item["options"]),
                    "answer": item["answer"],
                    "topic": item.get("topic", "Core"),
                }
            )
        pool.extend(ROLE_AUGMENTED_QUESTIONS.get(role, []))
        return pool
    return list(GENERIC_OA_POOL)


def generate_agentic_quiz(
    role: str,
    jd_text: str = "",
    resume_text: str = "",
    seed_hint: str = "",
    num_questions: int = 10,
) -> list[dict]:
    target = max(5, min(int(num_questions or 10), 15))
    focus_terms = _build_focus_terms(role, jd_text, resume_text)
    if not focus_terms:
        focus_terms = _tokenize(role.replace("_", " "))
    seed = _hash_seed(f"{role}|{jd_text[:160]}|{resume_text[:160]}|{seed_hint}")
    rng = random.Random(seed)

    base_questions = _build_pool_for_role(role)

    if not base_questions:
        return []

    scored = sorted(
        base_questions,
        key=lambda q: _question_score(q, focus_terms, rng),
        reverse=True,
    )

    # Keep topic diversity by cycling high-score questions topic-wise.
    by_topic: dict[str, list[dict]] = {}
    for q in scored:
        by_topic.setdefault(q.get("topic", "Core"), []).append(q)

    ordered_topics = sorted(by_topic.keys(), key=lambda t: len(by_topic[t]), reverse=True)
    selected: list[dict] = []
    seen_questions: set[str] = set()
    topic_cursor = 0

    while len(selected) < min(target, len(scored)):
        topic = ordered_topics[topic_cursor % len(ordered_topics)]
        topic_cursor += 1
        if not by_topic[topic]:
            if all(len(items) == 0 for items in by_topic.values()):
                break
            continue
        candidate = by_topic[topic].pop(0)
        qtext = candidate["question"].strip().lower()
        if qtext in seen_questions:
            continue
        seen_questions.add(qtext)
        selected.append(candidate)

    for index, question in enumerate(selected, start=1):
        question["id"] = index

    return selected


def save_generated_quiz(candidate_email: str, role: str, questions: list[dict]):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO oa_generated_quizzes (candidate_email, role, questions_json, created_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(candidate_email, role)
            DO UPDATE SET
                questions_json = excluded.questions_json,
                created_at = excluded.created_at
            """,
            (
                candidate_email.lower().strip(),
                role,
                to_json(questions),
                datetime.utcnow().isoformat(),
            ),
        )


def load_generated_quiz(candidate_email: str, role: str) -> list[dict]:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT questions_json
            FROM oa_generated_quizzes
            WHERE candidate_email = ? AND role = ?
            """,
            (candidate_email.lower().strip(), role),
        )
        row = cur.fetchone()
    if not row:
        return []
    return from_json(row["questions_json"], [])    