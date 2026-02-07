from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import candidate
from app.routes import candidate, ats
from app.routes import application
from app.routes import hr
from app.routes import status
from app.routes import oa
from app.routes import interview


app = FastAPI(title="AI Hiring System")

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
app.include_router(oa.router)
app.include_router(interview.router)

@app.get("/")
def root():
    return {"message": "Backend Running"}
