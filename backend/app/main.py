from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import candidate, ats
from app.routes import application
from app.routes import hr
from app.routes import status
from app.routes import oa_test
from app.routes import interview
from app.routes import auth
from app.db import init_db


app = FastAPI(title="AI Hiring System")

init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(candidate.router, prefix="/candidate", tags=["Candidate"])
app.include_router(ats.router, prefix="/ats", tags=["ATS"])
app.include_router(application.router, prefix="/application", tags=["Application"])
app.include_router(hr.router, prefix="/hr", tags=["HR"])
app.include_router(status.router, prefix="/candidate", tags=["Candidate"])
app.include_router(oa_test.router)
app.include_router(interview.router)
app.include_router(auth.router)

@app.get("/")
def root():
    return {"message": "Backend Running"}