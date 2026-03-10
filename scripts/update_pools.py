#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "data" / "pools.json"


def load_pools() -> list[dict[str, Any]]:
    if not DATA_FILE.exists():
        return []

    with DATA_FILE.open("r", encoding="utf-8") as handle:
        data = json.load(handle)

    if not isinstance(data, list):
        raise ValueError("Expected data/pools.json to contain a JSON array.")

    return data


def save_pools(pools: list[dict[str, Any]]) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with DATA_FILE.open("w", encoding="utf-8") as handle:
        json.dump(pools, handle, indent=2, ensure_ascii=True)
        handle.write("\n")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Update local pool data.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    add_pool = subparsers.add_parser("add", help="Add or update a pool.")
    add_pool.add_argument("--name", required=True)
    add_pool.add_argument("--price", required=True, type=float)
    add_pool.add_argument("--source-url", default="")

    add_slot = subparsers.add_parser("add-slot", help="Add an availability slot.")
    add_slot.add_argument("--name", required=True)
    add_slot.add_argument("--date", required=True)
    add_slot.add_argument("--opens-at", required=True)
    add_slot.add_argument("--closes-at", required=True)
    add_slot.add_argument("--swim-until")
    add_slot.add_argument("--notes", default="")

    add_weekly_slot = subparsers.add_parser(
        "add-weekly-slot",
        help="Add a recurring weekly availability slot.",
    )
    add_weekly_slot.add_argument("--name", required=True)
    add_weekly_slot.add_argument("--weekday", required=True)
    add_weekly_slot.add_argument("--opens-at", required=True)
    add_weekly_slot.add_argument("--closes-at", required=True)
    add_weekly_slot.add_argument("--swim-until")
    add_weekly_slot.add_argument("--notes", default="")

    subparsers.add_parser("list", help="List saved pools.")
    return parser


def upsert_pool(pools: list[dict[str, Any]], args: argparse.Namespace) -> None:
    for pool in pools:
        if pool.get("name") == args.name:
            pool["price_eur"] = args.price
            pool["source_url"] = args.source_url
            pool["last_updated"] = str(date.today())
            break
    else:
        pools.append(
            {
                "name": args.name,
                "price_eur": args.price,
                "source_url": args.source_url,
                "last_updated": str(date.today()),
                "availability": [],
            }
        )


def add_slot(pools: list[dict[str, Any]], args: argparse.Namespace) -> None:
    for pool in pools:
        if pool.get("name") != args.name:
            continue

        pool.setdefault("availability", []).append(
            {
                "date": args.date,
                "opens_at": args.opens_at,
                "closes_at": args.closes_at,
                "swim_until": args.swim_until or args.closes_at,
                "notes": args.notes,
            }
        )
        pool["last_updated"] = str(date.today())
        return

    raise ValueError(f"Pool not found: {args.name}")


def add_weekly_slot(pools: list[dict[str, Any]], args: argparse.Namespace) -> None:
    for pool in pools:
        if pool.get("name") != args.name:
            continue

        pool.setdefault("availability", []).append(
            {
                "weekday": args.weekday.lower(),
                "opens_at": args.opens_at,
                "closes_at": args.closes_at,
                "swim_until": args.swim_until or args.closes_at,
                "notes": args.notes,
            }
        )
        pool["last_updated"] = str(date.today())
        return

    raise ValueError(f"Pool not found: {args.name}")


def list_pools(pools: list[dict[str, Any]]) -> None:
    if not pools:
        print("No pools saved.")
        return

    for pool in pools:
        print(f"- {pool.get('name', 'Unknown')}")


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    pools = load_pools()

    if args.command == "add":
        upsert_pool(pools, args)
        save_pools(pools)
        print(f"Saved pool: {args.name}")
        return 0

    if args.command == "add-slot":
        add_slot(pools, args)
        save_pools(pools)
        print(f"Saved slot for: {args.name}")
        return 0

    if args.command == "add-weekly-slot":
        add_weekly_slot(pools, args)
        save_pools(pools)
        print(f"Saved weekly slot for: {args.name}")
        return 0

    if args.command == "list":
        list_pools(pools)
        return 0

    parser.error(f"Unsupported command: {args.command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
