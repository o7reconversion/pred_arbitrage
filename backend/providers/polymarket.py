import json
import logging
from urllib.request import Request, urlopen
from urllib.parse import quote

try:
    from py_clob_client.client import ClobClient
except ImportError:  # pragma: no cover - optional dependency
    ClobClient = None

POLYMARKET_MARKET_URL = "https://gamma-api.polymarket.com/markets"
POLYMARKET_CLOB_URL = "https://clob.polymarket.com"

_clob_client = None


def _fetch_json(url: str) -> list[dict]:
    req = Request(url, headers={"User-Agent": "monitor-backend"})
    with urlopen(req, timeout=10) as response:
        return json.loads(response.read())


def _parse_json_list(value) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, list) else []
        except json.JSONDecodeError:
            return []
    return []


def _get_clob_client() -> "ClobClient":
    global _clob_client
    if _clob_client is None:
        if ClobClient is None:
            raise RuntimeError("py_clob_client is not installed")
        _clob_client = ClobClient(POLYMARKET_CLOB_URL)
    return _clob_client


def _best_price(orders, best: str) -> float | None:
    if not orders:
        return None
    key_fn = lambda order: float(getattr(order, "price", 0))
    if best == "min":
        return key_fn(min(orders, key=key_fn))
    return key_fn(max(orders, key=key_fn))


def _fetch_clob_books(token_ids: list[str]) -> tuple[list[float | None], list[float | None]]:
    client = _get_clob_client()
    bids = []
    asks = []
    for token_id in token_ids:
        try:
            book = client.get_order_book(str(token_id))
            bids.append(_best_price(getattr(book, "bids", []), "max"))
            asks.append(_best_price(getattr(book, "asks", []), "min"))
        except Exception as exc:
            logging.warning("order book fetch failed for %s: %s", token_id, exc)
            bids.append(None)
            asks.append(None)
    return bids, asks


def fetch_markets_by_ids(ids: list[str]) -> dict:
    markets = []
    errors = []

    for market_id in ids:
        url = f"{POLYMARKET_MARKET_URL}?id={quote(market_id)}"
        try:
            items = _fetch_json(url)
        except Exception as exc:
            errors.append({"id": market_id, "error": str(exc)})
            continue

        if not items:
            errors.append({"id": market_id, "error": "market not found"})
            continue

        for market in items:
            token_ids = _parse_json_list(market.get("clobTokenIds"))
            try:
                outcome_bids, outcome_asks = _fetch_clob_books(token_ids)
                market["outcomeBids"] = outcome_bids
                market["outcomeAsks"] = outcome_asks
            except Exception as exc:
                logging.warning("clob pricing failed for %s: %s", market.get("id"), exc)
            market["outcomes"] = _parse_json_list(market.get("outcomes"))
            markets.append(market)

    return {"markets": markets, "errors": errors}
