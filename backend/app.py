import json
import logging
import os
from typing import List

from pydantic import BaseModel

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .providers import get_provider

LOG_DIR = os.path.join(os.path.dirname(__file__), "..", "logs")
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
PAIR_STATE_PATH = os.path.abspath(os.path.join(DATA_DIR, "pairs.json"))
os.makedirs(LOG_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)
logging.basicConfig(
    filename=os.path.abspath(os.path.join(LOG_DIR, "server.log")),
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class PairSide(BaseModel):
    provider: str
    id: str
    link: str = ""


class PairPayload(BaseModel):
    left: PairSide
    right: PairSide


class PairSnapshot(BaseModel):
    pairs: List[PairPayload]


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/markets")
def api_markets(ids: str = "", provider: str = "polymarket") -> dict:
    raw_ids = [entry.strip() for entry in ids.split(",") if entry.strip()]
    if not raw_ids:
        raise HTTPException(
            status_code=400, detail="missing ids, use /api/markets?ids=123,456"
        )

    try:
        fetcher = get_provider(provider)
        return fetcher(raw_ids)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logging.exception("api error")
        raise HTTPException(status_code=502, detail=str(exc))


def load_pairs() -> list:
    if not os.path.exists(PAIR_STATE_PATH):
        return []
    try:
        with open(PAIR_STATE_PATH, "r", encoding="utf-8") as handle:
            data = json.load(handle)
        return data if isinstance(data, list) else []
    except Exception:
        logging.exception("failed to read saved pairs")
        return []


def save_pairs(pairs: list) -> None:
    tmp_path = f"{PAIR_STATE_PATH}.tmp"
    with open(tmp_path, "w", encoding="utf-8") as handle:
        json.dump(pairs, handle, ensure_ascii=True, indent=2)
    os.replace(tmp_path, PAIR_STATE_PATH)


@app.get("/api/pairs")
def api_pairs() -> dict:
    return {"pairs": load_pairs()}


@app.post("/api/pairs")
def api_save_pairs(snapshot: PairSnapshot) -> dict:
    pairs = [pair.model_dump() for pair in snapshot.pairs]
    save_pairs(pairs)
    return {"status": "ok", "count": len(pairs)}
