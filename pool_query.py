from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
DATA_FILE = ROOT / "data" / "pools.json"


@dataclass
class OpenPool:
    name: str
    price_eur: float | None
    swim_until: str
    notes: str


def load_pools() -> list[dict[str, Any]]:
    if not DATA_FILE.exists():
        raise FileNotFoundError(f"Missing data file: {DATA_FILE}")

    with DATA_FILE.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    if not isinstance(data, list):
        raise ValueError("Expected data/pools.json to contain a JSON array.")

    return data


def validate_time(value: str) -> str:
    datetime.strptime(value, "%H:%M")
    return value


def validate_date(value: str) -> str:
    datetime.strptime(value, "%Y-%m-%d")
    return value


def weekday_for_date(value: str) -> str:
    return datetime.strptime(value, "%Y-%m-%d").strftime("%A").lower()


def is_open(slot: dict[str, Any], query_date: str, query_time: str) -> bool:
    slot_date = slot.get("date")
    slot_weekday = slot.get("weekday")
    matches_day = False

    if slot_date:
        matches_day = slot_date == query_date
    elif slot_weekday:
        matches_day = slot_weekday.lower() == weekday_for_date(query_date)

    return (
        matches_day
        and slot.get("opens_at") <= query_time
        and query_time < slot.get("swim_until", slot.get("closes_at", "00:00"))
    )


def find_open_pools(
    pools: list[dict[str, Any]], query_date: str, query_time: str
) -> list[OpenPool]:
    matches: list[OpenPool] = []

    for pool in pools:
        for slot in pool.get("availability", []):
            if not is_open(slot, query_date, query_time):
                continue

            matches.append(
                OpenPool(
                    name=pool.get("name", "Unknown"),
                    price_eur=pool.get("price_eur"),
                    swim_until=slot.get("swim_until", slot.get("closes_at", "")),
                    notes=slot.get("notes", ""),
                )
            )

    matches.sort(key=lambda item: (item.swim_until, item.name))
    return matches


def format_price(price_eur: float | None) -> str:
    if price_eur is None:
        return "n/a"
    return f"EUR {price_eur:.2f}"
