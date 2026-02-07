from fastapi import APIRouter, UploadFile, File
import os, uuid
from app.services.resume_parser import extract_resume_text
from app.services.info_extractor import extract_candidate_info

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload-resume")
async def upload_resume(file: UploadFile = File(...)):
    file_ext = file.filename.split(".")[-1].lower()
    if file_ext not in ["pdf", "docx"]:
        return {"error": "Unsupported file format"}

    filename = f"{uuid.uuid4()}.{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    with open(file_path, "wb") as f:
        f.write(await file.read())

    extracted_text = extract_resume_text(file_path)
    candidate_info = extract_candidate_info(extracted_text)

    return {
        "message": "Resume uploaded and parsed successfully",
        "candidate_info": candidate_info,
        "resume_text": extracted_text   # 🔥 IMPORTANT
    }
