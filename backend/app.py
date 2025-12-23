import logging
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .providers import get_provider

LOG_DIR = os.path.join(os.path.dirname(__file__), "..", "logs")
os.makedirs(LOG_DIR, exist_ok=True)
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
