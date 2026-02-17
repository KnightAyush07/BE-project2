from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from app.db import get_conn
from app.utils.security import (
    hash_password,
    verify_password,
    generate_token,
    utc_now_iso,
)

router = APIRouter(prefix="/auth", tags=["Auth"])
HR_DEMO_EMAIL = "gawandeayush071004@gmail.com"
HR_DEMO_PASSWORD = "123456789"
HR_DEMO_NAME = "Ayush Gawande"
HR_DEMO_COMPANY = "HireX"


class RegisterPayload(BaseModel):
    email: str
    password: str
    name: str


class LoginPayload(BaseModel):
    email: str
    password: str


class RegisterHrPayload(BaseModel):
    email: str
    password: str
    name: str
    company_name: str


def _validate_register_input(email: str, password: str):
    clean_email = email.strip().lower()
    if "@" not in clean_email or "." not in clean_email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Invalid email")
    if not password:
        raise HTTPException(status_code=400, detail="Password is required")
    return clean_email


def _get_user_by_token(token: str):
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT users.id, users.email, users.role, users.name
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token = ?
            """,
            (token,),
        )
        return cur.fetchone()


def get_current_user(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1].strip()
    user = _get_user_by_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user


def require_role(role: str):
    def _require(user=Depends(get_current_user)):
        if user["role"] != role:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user

    return _require


@router.post("/register")
def register_candidate(payload: RegisterPayload):
    email = _validate_register_input(payload.email, payload.password)
    display_name = payload.name.strip() if payload.name else ""
    if not display_name:
        display_name = email.split("@")[0]
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE LOWER(email) = ?", (email,))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="Email already exists")
        cur.execute(
            """
            INSERT INTO users (email, password_hash, role, name, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                email,
                hash_password(payload.password),
                "CANDIDATE",
                display_name,
                utc_now_iso(),
            ),
        )
        return {"message": "Registered successfully"}


@router.post("/register-hr")
def register_hr(payload: RegisterHrPayload):
    raise HTTPException(status_code=403, detail="HR registration is disabled")


@router.post("/login")
def login(payload: LoginPayload):
    email = (payload.email or "").strip().lower()
    password = (payload.password or "").strip()
    if email == HR_DEMO_EMAIL and password == HR_DEMO_PASSWORD:
        with get_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT id, role, name FROM users WHERE email = ?",
                (HR_DEMO_EMAIL,),
            )
            hr_user = cur.fetchone()
            if not hr_user:
                cur.execute(
                    "SELECT id FROM companies WHERE LOWER(name) = ?",
                    (HR_DEMO_COMPANY.lower(),),
                )
                company_row = cur.fetchone()
                if company_row:
                    company_id = company_row["id"]
                else:
                    cur.execute(
                        """
                        INSERT INTO companies (name, created_at)
                        VALUES (?, ?)
                        """,
                        (HR_DEMO_COMPANY, utc_now_iso()),
                    )
                    company_id = cur.lastrowid

                cur.execute(
                    """
                    INSERT INTO users (email, password_hash, role, name, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        HR_DEMO_EMAIL,
                        hash_password(HR_DEMO_PASSWORD),
                        "HR",
                        HR_DEMO_NAME,
                        utc_now_iso(),
                    ),
                )
                user_id = cur.lastrowid
                cur.execute(
                    """
                    INSERT INTO hr_profiles (user_id, display_name, company_id)
                    VALUES (?, ?, ?)
                    """,
                    (user_id, HR_DEMO_NAME, company_id),
                )
                hr_user = {"id": user_id, "role": "HR", "name": HR_DEMO_NAME}

            token = generate_token()
            cur.execute(
                """
                INSERT INTO sessions (user_id, token, created_at)
                VALUES (?, ?, ?)
                """,
                (hr_user["id"], token, utc_now_iso()),
            )
            return {"token": token, "role": "HR", "name": hr_user["name"]}

    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, password_hash, role, name FROM users WHERE email = ?",
            (email,),
        )
        row = cur.fetchone()
        if row and row["role"] == "HR":
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not row or not verify_password(password, row["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        token = generate_token()
        cur.execute(
            """
            INSERT INTO sessions (user_id, token, created_at)
            VALUES (?, ?, ?)
            """,
            (row["id"], token, utc_now_iso()),
        )
        return {"token": token, "role": row["role"], "name": row["name"]}


@router.get("/me")
def me(user=Depends(get_current_user)):
    return {"email": user["email"], "role": user["role"], "name": user["name"]}


@router.post("/logout")
def logout(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1].strip()
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM sessions WHERE token = ?", (token,))
    return {"message": "Logged out"}
