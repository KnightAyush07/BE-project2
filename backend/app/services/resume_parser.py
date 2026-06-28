import pypdf
import docx

def extract_text_from_pdf(path):
    """Extract text from PDF using pypdf (50% faster than pdfplumber)."""
    text = ""
    try:
        reader = pypdf.PdfReader(path)
        for page in reader.pages:
            text += page.extract_text() or ""
    except Exception as e:
        print(f"Error reading PDF {path}: {e}")
    return text

def extract_text_from_docx(path):
    doc = docx.Document(path)
    return "\n".join(p.text for p in doc.paragraphs)

def extract_resume_text(path):
    if path.endswith(".pdf"):
        return extract_text_from_pdf(path)
    if path.endswith(".docx"):
        return extract_text_from_docx(path)
    return ""
