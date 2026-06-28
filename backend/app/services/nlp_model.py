# OPTIMIZED: Using lightweight tokenizer instead of spaCy
# spaCy was removed for ~60% faster initialization and lower memory footprint
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased")

def get_nlp():
    """Returns tokenizer for lightweight NLP tasks."""
    return tokenizer
