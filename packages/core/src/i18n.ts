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
export type Locale = "en" | "nl";

export const NOTE_KEYS = [
  "lane_swimming",
  "lane_swimming_less_space_lessons",
  "nude_swimming",
  "lane_swimming_sport_and_relaxation",
  "lane_swimming_25m_indoor_pool",
  "lane_swimming_3_lanes_available",
  "lane_swimming_sports_pool",
  "lane_swimming_club_pool",
] as const;

export type NoteKey = (typeof NOTE_KEYS)[number];

type TranslationKey =
  | "app_eyebrow"
  | "app_title"
  | "app_subtitle"
  | "day"
  | "time"
  | "check_pools"
  | "now"
  | "show_all_pools"
  | "only_favorites"
  | "query"
  | "matches"
  | "swim_until"
  | "no_pools_found"
  | "empty_try_another_time"
  | "empty_no_favorite_match"
  | "empty_try_other_day"
  | "loading"
  | "could_not_load_pool_data"
  | "not_available";

const UI_STRINGS: Record<Locale, Record<TranslationKey, string>> = {
  en: {
    app_eyebrow: "Amsterdam Pools",
    app_title: "Swimming pool finder",
    app_subtitle: "Amsterdam pools timetable",
    day: "Day",
    time: "Time",
    check_pools: "Check pools",
    now: "Now",
    show_all_pools: "Show all pools",
    only_favorites: "Only favorites",
    query: "Query",
    matches: "Matches",
    swim_until: "Swim until",
    no_pools_found: "No pools found",
    empty_try_another_time: "Try another time or use the Now shortcut.",
    empty_no_favorite_match: "No favorite pools match this moment.",
    empty_try_other_day: "Try another time or switch to a different day.",
    loading: "Loading...",
    could_not_load_pool_data: "Could not load pool data.",
    not_available: "n/a",
  },
  nl: {
    app_eyebrow: "Amsterdamse zwembaden",
    app_title: "Zwembadzoeker",
    app_subtitle: "Zwembadrooster van Amsterdam",
    day: "Dag",
    time: "Tijd",
    check_pools: "Zoek zwembaden",
    now: "Nu",
    show_all_pools: "Toon alle zwembaden",
    only_favorites: "Alleen favorieten",
    query: "Zoekopdracht",
    matches: "Resultaten",
    swim_until: "Zwemmen tot",
    no_pools_found: "Geen zwembaden gevonden",
    empty_try_another_time: "Probeer een ander tijdstip of gebruik Nu.",
    empty_no_favorite_match: "Geen favoriete zwembaden passen op dit moment.",
    empty_try_other_day: "Probeer een ander tijdstip of kies een andere dag.",
    loading: "Laden...",
    could_not_load_pool_data: "Kon de zwembadgegevens niet laden.",
    not_available: "n.v.t.",
  },
};

const WEEKDAY_LABELS: Record<Locale, Record<Weekday, string>> = {
  en: {
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday",
  },
  nl: {
    monday: "Maandag",
    tuesday: "Dinsdag",
    wednesday: "Woensdag",
    thursday: "Donderdag",
    friday: "Vrijdag",
    saturday: "Zaterdag",
    sunday: "Zondag",
  },
};

const WEEKDAY_SHORT_LABELS: Record<Locale, Record<Weekday, string>> = {
  en: {
    monday: "Mon",
    tuesday: "Tue",
    wednesday: "Wed",
    thursday: "Thu",
    friday: "Fri",
    saturday: "Sat",
    sunday: "Sun",
  },
  nl: {
    monday: "Maa",
    tuesday: "Din",
    wednesday: "Woe",
    thursday: "Don",
    friday: "Vrij",
    saturday: "Zat",
    sunday: "Zon",
  },
};

const NOTE_TRANSLATIONS: Record<Locale, Record<NoteKey, string>> = {
  en: {
    lane_swimming: "Lane swimming",
    lane_swimming_less_space_lessons:
      "Lane swimming - less pool space available due to swim lessons",
    nude_swimming: "Nude swimming",
    lane_swimming_sport_and_relaxation: "Lane swimming - sport and relaxation",
    lane_swimming_25m_indoor_pool: "Lane swimming - 25-meter indoor pool",
    lane_swimming_3_lanes_available: "Lane swimming - 3 lanes available",
    lane_swimming_sports_pool: "Lane swimming - sports pool",
    lane_swimming_club_pool: "Lane swimming - club pool",
  },
  nl: {
    lane_swimming: "Banenzwemmen",
    lane_swimming_less_space_lessons:
      "Banenzwemmen - minder water beschikbaar door zwemlessen",
    nude_swimming: "Naaktzwemmen",
    lane_swimming_sport_and_relaxation: "Banenzwemmen sportief & ontspannen",
    lane_swimming_25m_indoor_pool: "Banenzwemmen - 25-meterbad binnen",
    lane_swimming_3_lanes_available: "Banenzwemmen - 3 banen beschikbaar",
    lane_swimming_sports_pool: "Banenzwemmen - Sportbad",
    lane_swimming_club_pool: "Banenzwemmen - Verenigingsbad",
  },
};

const LEGACY_NOTE_KEY_MAP: Record<string, NoteKey> = {
  "Banenzwemmen": "lane_swimming",
  "Banenzwemmen (secondary source, checked 2026-02-23)": "lane_swimming",
  "Banenzwemmen - minder water beschikbaar door zwemlessen":
    "lane_swimming_less_space_lessons",
  Naaktzwemmen: "nude_swimming",
  "Banenzwemmen sportief & ontspannen": "lane_swimming_sport_and_relaxation",
  "Banenzwemmen - 25-meterbad binnen": "lane_swimming_25m_indoor_pool",
  "Banenzwemmen - 3 banen beschikbaar": "lane_swimming_3_lanes_available",
  "Banenzwemmen - Sportbad": "lane_swimming_sports_pool",
  "Banenzwemmen - Verenigingsbad": "lane_swimming_club_pool",
  "Lane swimming": "lane_swimming",
  "Lane swimming - less pool space available due to swim lessons":
    "lane_swimming_less_space_lessons",
  "Nude swimming": "nude_swimming",
  "Lane swimming - sport and relaxation": "lane_swimming_sport_and_relaxation",
  "Lane swimming - 25-meter indoor pool": "lane_swimming_25m_indoor_pool",
  "Lane swimming - 3 lanes available": "lane_swimming_3_lanes_available",
  "Lane swimming - sports pool": "lane_swimming_sports_pool",
  "Lane swimming - club pool": "lane_swimming_club_pool",
};

export function isLocale(value: string | undefined): value is Locale {
  return value === "en" || value === "nl";
}

export function resolveLocale(value: string | undefined): Locale {
  if (isLocale(value)) {
    return value;
  }

  const normalized = value?.toLowerCase() ?? "";
  return normalized.startsWith("nl") ? "nl" : "en";
}

export function t(locale: Locale, key: TranslationKey): string {
  return UI_STRINGS[locale][key];
}

export function weekdayLabel(locale: Locale, value: Weekday): string {
  return WEEKDAY_LABELS[locale][value];
}

export function weekdayShortLabel(locale: Locale, value: Weekday): string {
  return WEEKDAY_SHORT_LABELS[locale][value];
}

export function formatPrice(priceEur: number | null | undefined, locale: Locale = "en"): string {
  if (priceEur == null) {
    return t(locale, "not_available");
  }

  return `EUR ${priceEur.toFixed(2)}`;
}

export function normalizeNoteKey(value: string | undefined): NoteKey | undefined {
  if (!value) {
    return undefined;
  }

  if ((NOTE_KEYS as readonly string[]).includes(value)) {
    return value as NoteKey;
  }

  return LEGACY_NOTE_KEY_MAP[value];
}

export function translateNote(locale: Locale, noteKey: string | undefined): string {
  const normalized = normalizeNoteKey(noteKey);
  if (!normalized) {
    return noteKey ?? "";
  }

  return NOTE_TRANSLATIONS[locale][normalized];
}

