from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

# Load model once
model = SentenceTransformer("all-MiniLM-L6-v2")

def compute_ats_score(resume_text: str, job_description: str) -> float:
    embeddings = model.encode([resume_text, job_description])

    similarity = cosine_similarity(
        [embeddings[0]],
        [embeddings[1]]
    )[0][0]

    # 🔥 CRITICAL FIX: convert numpy.float32 → Python float
    return float(round(similarity * 100, 2))
