from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


# Load the sentence-transformer only when it is already available locally.
# This keeps the API bootable in offline or restricted-network environments.
try:
    model = SentenceTransformer("all-MiniLM-L6-v2", local_files_only=True)
    if hasattr(model, "to_onnx"):
        model.to_onnx()
except Exception:
    model = None


def compute_ats_score(resume_text: str, job_description: str) -> float:
    """Compute ATS matching score using embeddings, with an offline fallback."""
    if model is not None:
        embeddings = model.encode(
            [resume_text, job_description],
            convert_to_numpy=True,
            show_progress_bar=False,
        )
        similarity = cosine_similarity([embeddings[0]], [embeddings[1]])[0][0]
    else:
        vectors = TfidfVectorizer(stop_words="english").fit_transform(
            [resume_text, job_description]
        )
        similarity = cosine_similarity(vectors[0], vectors[1])[0][0]

    return float(round(similarity * 100, 2))
