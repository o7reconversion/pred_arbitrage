import http.client
import json
LIMITLESS_HOST = "api.limitless.exchange"


def _fetch_market(market: str) -> dict:
    conn = http.client.HTTPSConnection(LIMITLESS_HOST)
    conn.request("GET", f"/markets/{market}")
    res = conn.getresponse()
    data = res.read()
    conn.close()
    if res.status >= 400:
        raise RuntimeError(f"limitless http {res.status}")
    return json.loads(data.decode("utf-8"))


def _ensure_two(values, fallback):
    if isinstance(values, list) and len(values) >= 2:
        return [values[0], values[1]]
    if isinstance(fallback, list) and len(fallback) >= 2:
        return [fallback[0], fallback[1]]
    return [None, None]



def fetch_markets_by_ids(ids: list[str]) -> dict:
    markets = []
    errors = []

    for market_id in ids:
        try:
            data = _fetch_market(market_id)
        except Exception as exc:
            errors.append({"id": market_id, "error": str(exc)})
            continue

        prices = data.get("prices") if isinstance(data, dict) else None
        trade_prices = data.get("tradePrices") if isinstance(data, dict) else {}
        buy_limit = trade_prices.get("buy", {}).get("limit") if isinstance(trade_prices, dict) else None
        sell_limit = trade_prices.get("sell", {}).get("limit") if isinstance(trade_prices, dict) else None

        outcome_bids = _ensure_two(buy_limit, prices)
        outcome_asks = _ensure_two(sell_limit, prices)

        market = {
            "id": data.get("id"),
            "slug": data.get("slug"),
            "question": data.get("title") or data.get("proxyTitle") or data.get("slug"),
            "outcomes": ["Yes", "No"],
            "outcomeBids": outcome_bids,
            "outcomeAsks": outcome_asks,
            "status": data.get("status"),
            "expirationDate": data.get("expirationDate"),
            "venue": data.get("venue"),
            "marketType": data.get("marketType"),
        }

        markets.append(market)

    return {"markets": markets, "errors": errors}
