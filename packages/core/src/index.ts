import { readFile } from "node:fs/promises";
import path from "node:path";

export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export type AvailabilitySlot = {
  date?: string;
  weekday?: string;
  opens_at: string;
  closes_at: string;
  swim_until?: string;
  notes?: string;
};

export type PoolRecord = {
  name: string;
  price_eur?: number | null;
  source_url?: string;
  last_updated?: string;
  warning?: string;
  availability?: AvailabilitySlot[];
};

export type OpenPool = {
  name: string;
  price_eur: number | null;
  swim_until: string;
  notes: string;
  warning: string;
};

export type OpenPoolsResult = {
  query_date: string;
  query_time: string;
  count: number;
  pools: OpenPool[];
};

const DEFAULT_DATA_FILE = path.join(process.cwd(), "data", "pools.json");

export function validateDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Date must use YYYY-MM-DD.");
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date.");
  }

  return value;
}

export function validateTime(value: string): string {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    throw new Error("Time must use HH:MM.");
  }

  const [hours, minutes] = value.split(":").map(Number);
  if (hours > 23 || minutes > 59) {
    throw new Error("Invalid time.");
  }

  return value;
}

export function weekdayForDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
}

export function titleWeekday(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatPrice(priceEur: number | null | undefined): string {
  if (priceEur == null) {
    return "n/a";
  }

  return `EUR ${priceEur.toFixed(2)}`;
}

export async function loadPools(dataFile = DEFAULT_DATA_FILE): Promise<PoolRecord[]> {
  const raw = await readFile(dataFile, "utf-8");
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Expected data/pools.json to contain a JSON array.");
  }

  return parsed as PoolRecord[];
}

export function isOpen(
  slot: AvailabilitySlot,
  queryDate: string,
  queryTime: string,
): boolean {
  const slotDate = slot.date;
  const slotWeekday = slot.weekday;
  let matchesDay = false;

  if (slotDate) {
    matchesDay = slotDate === queryDate;
  } else if (slotWeekday) {
    matchesDay = slotWeekday.toLowerCase() === weekdayForDate(queryDate);
  }

  const swimUntil = slot.swim_until ?? slot.closes_at;

  return matchesDay && slot.opens_at <= queryTime && queryTime < swimUntil;
}

export function findOpenPools(
  pools: PoolRecord[],
  queryDate: string,
  queryTime: string,
): OpenPool[] {
  const matches: OpenPool[] = [];

  for (const pool of pools) {
    for (const slot of pool.availability ?? []) {
      if (!isOpen(slot, queryDate, queryTime)) {
        continue;
      }

      matches.push({
        name: pool.name ?? "Unknown",
        price_eur: pool.price_eur ?? null,
        swim_until: slot.swim_until ?? slot.closes_at,
        notes: slot.notes ?? "",
        warning: pool.warning ?? "",
      });
    }
  }

  matches.sort((left, right) => {
    if (left.swim_until === right.swim_until) {
      return left.name.localeCompare(right.name);
    }

    return left.swim_until.localeCompare(right.swim_until);
  });

  return matches;
}

export async function queryOpenPools(
  queryDate: string,
  queryTime: string,
  dataFile = DEFAULT_DATA_FILE,
): Promise<OpenPoolsResult> {
  validateDate(queryDate);
  validateTime(queryTime);

  const pools = await loadPools(dataFile);
  const matches = findOpenPools(pools, queryDate, queryTime);

  return {
    query_date: queryDate,
    query_time: queryTime,
    count: matches.length,
    pools: matches,
  };
}
