import json
import os
import sqlite3
from contextlib import contextmanager

BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "app.db")


def _ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def _connect():
    _ensure_data_dir()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def get_conn():
    conn = _connect()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS companies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS hr_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE NOT NULL,
                display_name TEXT NOT NULL,
                company_id INTEGER,
                FOREIGN KEY(company_id) REFERENCES companies(id),
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS candidates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER UNIQUE NOT NULL,
                hr_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                phone TEXT,
                skills TEXT,
                education TEXT,
                resume_text TEXT,
                jd_text TEXT,
                jd_filename TEXT,
                role TEXT NOT NULL,
                status TEXT NOT NULL,
                oa_eligible INTEGER NOT NULL DEFAULT 0,
                interview_eligible INTEGER NOT NULL DEFAULT 0,
                ats_score REAL,
                ats_match_percent REAL,
                ats_matched_skills TEXT,
                ats_missing_skills TEXT,
                oa_score INTEGER,
                oa_total INTEGER,
                oa_percentage REAL,
                oa_status TEXT,
                oa_tab_switches INTEGER NOT NULL DEFAULT 0,
                oa_topic_breakdown TEXT,
                interview_score INTEGER,
                interview_percentage REAL,
                interview_status TEXT,
                interview_tab_switches INTEGER NOT NULL DEFAULT 0,
                submitted_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id),
                FOREIGN KEY(hr_id) REFERENCES hr_profiles(id)
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token TEXT UNIQUE NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS hr_job_descriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hr_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                jd_text TEXT NOT NULL,
                jd_filename TEXT,
                updated_at TEXT NOT NULL,
                UNIQUE(hr_id, role),
                FOREIGN KEY(hr_id) REFERENCES hr_profiles(id)
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS oa_generated_quizzes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                candidate_email TEXT NOT NULL,
                role TEXT NOT NULL,
                questions_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                UNIQUE(candidate_email, role)
            )
            """
        )

        _ensure_columns(
            conn,
            "candidates",
            {
                "jd_text": "TEXT",
                "jd_filename": "TEXT",
                "oa_tab_switches": "INTEGER NOT NULL DEFAULT 0",
                "interview_tab_switches": "INTEGER NOT NULL DEFAULT 0",
            },
        )
        _ensure_columns(
            conn,
            "hr_profiles",
            {
                "company_id": "INTEGER",
            },
        )


def _ensure_columns(conn, table: str, columns: dict):
    cur = conn.cursor()
    cur.execute(f"PRAGMA table_info({table})")
    existing = {row[1] for row in cur.fetchall()}
    for name, col_type in columns.items():
        if name not in existing:
            cur.execute(f"ALTER TABLE {table} ADD COLUMN {name} {col_type}")


def to_json(value):
    if value is None:
        return None
    return json.dumps(value)


def from_json(value, default=None):
    if value is None:
        return default
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return default
