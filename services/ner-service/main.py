from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import spacy
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="MediBot NER Service",
    description="Medical Named Entity Recognition using scispaCy",
    version="1.0.0"
)

# Load scispaCy model — download once with: python -m spacy download en_core_sci_sm
try:
    nlp = spacy.load("en_core_sci_sm")
    logger.info("✅ scispaCy model loaded: en_core_sci_sm")
except OSError:
    logger.error("❌ Model not found. Run: python -m spacy download en_core_sci_sm")
    raise


# ─── Request / Response Models ─────────────────────────────────────────────────

class NERRequest(BaseModel):
    text: str


class Entity(BaseModel):
    text:  str
    label: str   # CHEMICAL | DISEASE | ANATOMY | ORGANISM | etc.
    start: int
    end:   int


# ─── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/ner", response_model=List[Entity])
def extract_entities(req: NERRequest):
    """
    Extract medical named entities from input text.
    Returns a list of entities with their type labels and character positions.
    """
    if not req.text or len(req.text.strip()) < 5:
        raise HTTPException(status_code=400, detail="Text must be at least 5 characters")

    doc = nlp(req.text)
    entities = [
        Entity(
            text=ent.text,
            label=ent.label_,
            start=ent.start_char,
            end=ent.end_char
        )
        for ent in doc.ents
    ]

    logger.info(f"NER: extracted {len(entities)} entities from {len(req.text)} chars")
    return entities


@app.get("/health")
def health():
    """Health check endpoint."""
    return {"status": "ok", "model": "en_core_sci_sm", "service": "ner-service"}
