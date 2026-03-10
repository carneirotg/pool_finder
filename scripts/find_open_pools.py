#!/usr/bin/env python3

from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from pool_query import find_open_pools, format_price, load_pools, validate_date, validate_time


USE_COLOR = sys.stdout.isatty()
RESET = "\033[0m" if USE_COLOR else ""
BOLD = "\033[1m" if USE_COLOR else ""
BLUE = "\033[94m" if USE_COLOR else ""
YELLOW = "\033[93m" if USE_COLOR else ""
GREEN = "\033[32m" if USE_COLOR else ""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Find pools open at a specific date and time."
    )
    parser.add_argument("--date", help="Date in YYYY-MM-DD format.")
    parser.add_argument("--time", help="Time in HH:MM format.")
    parser.add_argument(
        "--now",
        action="store_true",
        help="Use the current local date and time.",
    )
    return parser.parse_args()


def resolve_query_moment(args: argparse.Namespace) -> tuple[str, str]:
    if args.now:
        now = datetime.now()
        return now.strftime("%Y-%m-%d"), now.strftime("%H:%M")

    if args.time and not args.date:
        validate_time(args.time)
        return datetime.now().strftime("%Y-%m-%d"), args.time

    if not args.date or not args.time:
        raise ValueError("Use --now, provide --time, or provide both --date and --time.")

    validate_date(args.date)
    validate_time(args.time)
    return args.date, args.time


def render_header(query_date: str, query_time: str, count: int) -> None:
    print(f"{BOLD}{BLUE}Open Pools{RESET}")
    print(f"{BOLD}{query_date} at {query_time}{RESET}")
    print(f"{YELLOW}{count} match{'es' if count != 1 else ''}{RESET}")
    print()


def render_pool(pool: OpenPool) -> None:
    print(f"{BOLD}{pool.name}{RESET}")
    print(f"  {GREEN}Price{RESET}      {format_price(pool.price_eur)}")
    print(f"  {GREEN}Swim until{RESET} {pool.swim_until}")
    if pool.notes:
        print(f"  {GREEN}Notes{RESET}      {pool.notes}")
    print()


def main() -> int:
    args = parse_args()
    query_date, query_time = resolve_query_moment(args)
    pools = load_pools()
    matches = find_open_pools(pools, query_date, query_time)

    if not matches:
        render_header(query_date, query_time, 0)
        print("No pools found.")
        return 0

    render_header(query_date, query_time, len(matches))

    for pool in matches:
        render_pool(pool)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
