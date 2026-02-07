import spacy

nlp = spacy.load("en_core_web_sm")

def get_nlp():
    return nlp
