from app.db import get_conn
from app.utils.security import hash_password, utc_now_iso

DEFAULT_HR_ACCOUNTS = [
    {"email": "hr1@company.com", "name": "Apoorv HR", "password": "Hr@12345"},
    {"email": "hr2@company.com", "name": "Neha HR", "password": "Hr@12345"},
]


def seed_hr_accounts():
    with get_conn() as conn:
        cur = conn.cursor()
        for hr in DEFAULT_HR_ACCOUNTS:
            cur.execute("SELECT id FROM users WHERE email = ?", (hr["email"],))
            row = cur.fetchone()
            if row:
                continue
            cur.execute(
                """
                INSERT INTO users (email, password_hash, role, name, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    hr["email"],
                    hash_password(hr["password"]),
                    "HR",
                    hr["name"],
                    utc_now_iso(),
                ),
            )
            user_id = cur.lastrowid
            cur.execute(
                """
                INSERT INTO hr_profiles (user_id, display_name)
                VALUES (?, ?)
                """,
                (user_id, hr["name"]),
            )
