from typing import Callable, Dict, List

from . import limitless, polymarket

ProviderFn = Callable[[List[str]], Dict]


def get_provider(name: str) -> ProviderFn:
    normalized = (name or "polymarket").strip().lower()
    if normalized == "polymarket":
        return polymarket.fetch_markets_by_ids
    if normalized == "limitless":
        return limitless.fetch_markets_by_ids
    raise ValueError(f"unknown provider: {name}")
