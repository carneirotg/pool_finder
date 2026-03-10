import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  type Locale,
  type Weekday,
  WEEKDAYS,
  formatPrice,
  resolveLocale,
  t,
  weekdayLabel,
  weekdayShortLabel,
} from "../../packages/core/src/i18n";

type PoolResult = {
  name: string;
  price_eur: number | null;
  swim_until: string;
  notes: string;
  warning: string;
};

type OpenPoolsResult = {
  query_date: string;
  query_time: string;
  count: number;
  pools: PoolResult[];
};

type QueryInput = {
  weekday?: Weekday;
  time?: string;
  locale?: Locale;
  minLoadingMs?: number;
};

const PUBLIC_API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://pool-finder.onrender.com";
const FAVORITE_POOLS_STORAGE_KEY = "favorite_pools";
const LOCALE_STORAGE_KEY = "app_locale";
const FLAG_IMAGES = {
  en: require("../../assets/flags/us-circle.png"),
  nl: require("../../assets/flags/nl-circle.png"),
} as const;

function weekdayFromDate(value: string): Weekday {
  const date = new Date(`${value}T00:00:00`);
  return WEEKDAYS[(date.getDay() + 6) % 7];
}

function deviceLocale(): Locale {
  return resolveLocale(Intl.DateTimeFormat().resolvedOptions().locale);
}

function currentWeekday(): Weekday {
  const index = (new Date().getDay() + 6) % 7;
  return WEEKDAYS[index];
}

function currentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function timeToDate(value: string): Date {
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(deviceLocale());
  const [weekday, setWeekday] = useState<Weekday>(currentWeekday());
  const [time, setTime] = useState(currentTime());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [favoritePools, setFavoritePools] = useState<string[]>([]);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState<OpenPoolsResult | null>(null);

  async function fetchPools(overrides: QueryInput = {}) {
    setLoading(true);
    setError("");

    try {
      const nextWeekday = overrides.weekday ?? weekday;
      const nextTime = overrides.time ?? time;
      const nextLocale = overrides.locale ?? locale;
      const minLoadingMs = overrides.minLoadingMs ?? 0;
      const trimmedBaseUrl = PUBLIC_API_BASE_URL.trim().replace(/\/$/, "");
      const [response] = await Promise.all([
        fetch(
          `${trimmedBaseUrl}/api/open?locale=${nextLocale}&weekday=${nextWeekday}&time=${encodeURIComponent(nextTime)}`,
        ),
        delay(minLoadingMs),
      ]);

      if (!response.ok) {
        throw new Error(`API error ${response.status}`);
      }

      const data = (await response.json()) as OpenPoolsResult;
      setResult(data);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : t(overrides.locale ?? locale, "could_not_load_pool_data");
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function initialize() {
      try {
        const savedFavorites = await AsyncStorage.getItem(FAVORITE_POOLS_STORAGE_KEY);
        const savedLocale = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);

        if (savedFavorites) {
          setFavoritePools(JSON.parse(savedFavorites) as string[]);
        }
        const nextLocale = savedLocale ? resolveLocale(savedLocale) : deviceLocale();
        setLocale(nextLocale);
        await fetchPools({ locale: nextLocale });
      } finally {
        setInitializing(false);
      }
    }

    void initialize();
  }, []);

  async function toggleFavorite(poolName: string) {
    const nextFavorites = favoritePools.includes(poolName)
      ? favoritePools.filter((name) => name !== poolName)
      : [...favoritePools, poolName];

    setFavoritePools(nextFavorites);
    await AsyncStorage.setItem(FAVORITE_POOLS_STORAGE_KEY, JSON.stringify(nextFavorites));
  }

  async function handleLocaleSelect(nextLocale: Locale) {
    setLocale(nextLocale);
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    void fetchPools({ locale: nextLocale, minLoadingMs: 250 });
  }

  function handleWeekdaySelect(nextWeekday: Weekday) {
    setWeekday(nextWeekday);
    setShowTimePicker(false);
    void fetchPools({ weekday: nextWeekday, time, minLoadingMs: 500 });
  }

  const displayedPools = (result?.pools ?? [])
    .slice()
    .sort((left, right) => {
      const leftFavorite = favoritePools.includes(left.name) ? 1 : 0;
      const rightFavorite = favoritePools.includes(right.name) ? 1 : 0;

      if (leftFavorite !== rightFavorite) {
        return rightFavorite - leftFavorite;
      }

      if (left.swim_until === right.swim_until) {
        return left.name.localeCompare(right.name);
      }

      return left.swim_until.localeCompare(right.swim_until);
    })
    .filter((pool) => !onlyFavorites || favoritePools.includes(pool.name));

  function handleTimeChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (event.type === "dismissed" || !selectedDate) {
      setShowTimePicker(false);
      return;
    }

    setTime(
      `${String(selectedDate.getHours()).padStart(2, "0")}:${String(
        selectedDate.getMinutes(),
      ).padStart(2, "0")}`,
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <View style={styles.heroTopline}>
            <Text style={styles.eyebrow}>{t(locale, "app_eyebrow")}</Text>
            <View style={styles.localeSwitcher}>
              {(["en", "nl"] as const).map((value) => {
                const selected = value === locale;
                return (
                  <Pressable
                    key={value}
                    onPress={() => void handleLocaleSelect(value)}
                    style={({ pressed }) => [
                      styles.localeButton,
                      selected && styles.localeButtonSelected,
                      pressed && styles.linkPressed,
                    ]}
                  >
                    <Image source={FLAG_IMAGES[value]} style={styles.localeButtonImage} />
                    <Text style={styles.localeButtonLabel}>{value === "en" ? "EN" : "NL"}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Text style={styles.title}>{t(locale, "app_title")}</Text>
          <Text style={styles.lede}>{t(locale, "app_subtitle")}</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.label}>{t(locale, "day")}</Text>
          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((day) => {
              const selected = day === weekday;
              return (
                <Pressable
                  key={day}
                  onPress={() => handleWeekdaySelect(day)}
                  style={({ pressed }) => [
                    styles.dayChip,
                    selected && styles.dayChipSelected,
                    pressed && styles.dayChipPressed,
                  ]}
                >
                  <Text style={[styles.dayChipText, selected && styles.dayChipTextSelected]}>
                    {weekdayShortLabel(locale, day)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>{t(locale, "time")}</Text>
          <Pressable
            onPress={() => setShowTimePicker(true)}
            style={({ pressed }) => [styles.inputButton, pressed && styles.controlPressed]}
          >
            <Text style={styles.inputButtonText}>{time}</Text>
          </Pressable>
          {showTimePicker ? (
            <DateTimePicker
              display={Platform.OS === "ios" ? "spinner" : "default"}
              mode="time"
              onChange={handleTimeChange}
              value={timeToDate(time)}
            />
          ) : null}

          <View style={styles.actions}>
            <Pressable
              onPress={() => {
                setShowTimePicker(false);
                void fetchPools({ minLoadingMs: 500 });
              }}
              disabled={loading || initializing}
              style={({ pressed }) => [
                styles.primaryButton,
                (loading || initializing) && styles.buttonDisabled,
                pressed && !(loading || initializing) && styles.buttonPressed,
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>{t(locale, "check_pools")}</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => {
                const nextWeekday = currentWeekday();
                const nextTime = currentTime();
                setShowTimePicker(false);
                setWeekday(nextWeekday);
                setTime(nextTime);
                void fetchPools({ weekday: nextWeekday, time: nextTime, minLoadingMs: 500 });
              }}
              disabled={loading || initializing}
              style={({ pressed }) => [
                styles.secondaryButton,
                (loading || initializing) && styles.secondaryButtonDisabled,
                pressed && !(loading || initializing) && styles.buttonPressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>
                {loading ? t(locale, "loading") : t(locale, "now")}
              </Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => setOnlyFavorites((value) => !value)}
            style={({ pressed }) => [styles.tertiaryButton, pressed && styles.linkPressed]}
          >
            <Text style={styles.tertiaryButtonText}>
              {onlyFavorites ? t(locale, "show_all_pools") : t(locale, "only_favorites")}
            </Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {result ? (
          <View style={styles.summary}>
            <View>
              <Text style={styles.summaryLabel}>{t(locale, "query")}</Text>
              <Text style={styles.summaryValue}>
                {weekdayLabel(locale, weekdayFromDate(result.query_date))}, {result.query_date}{" "}
                {locale === "nl" ? "om" : "at"} {result.query_time}
              </Text>
            </View>
            <View>
              <Text style={styles.summaryLabel}>{t(locale, "matches")}</Text>
              <Text style={styles.summaryValue}>{result.count}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.results}>
          {displayedPools.map((pool) => (
            <View key={`${pool.name}-${pool.swim_until}-${pool.notes}`} style={styles.card}>
              <View style={styles.cardTopline}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>{pool.name}</Text>
                  <Pressable
                    onPress={() => void toggleFavorite(pool.name)}
                    style={({ pressed }) => [styles.favoriteButton, pressed && styles.linkPressed]}
                  >
                    <Text style={styles.favoriteButtonText}>
                      {favoritePools.includes(pool.name) ? "★" : "☆"}
                    </Text>
                  </Pressable>
                </View>
                <Text style={styles.cardPrice}>{formatPrice(pool.price_eur, locale)}</Text>
              </View>
              <Text style={styles.cardTime}>
                {t(locale, "swim_until")} {pool.swim_until}
              </Text>
              {pool.notes ? <Text style={styles.cardNotes}>{pool.notes}</Text> : null}
              {pool.warning ? <Text style={styles.cardWarning}>{pool.warning}</Text> : null}
            </View>
          ))}

          {result && displayedPools.length === 0 && !loading ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t(locale, "no_pools_found")}</Text>
              <Text style={styles.cardNotes}>
                {onlyFavorites
                  ? t(locale, "empty_no_favorite_match")
                  : t(locale, "empty_try_other_day")}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f4efe6",
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 16,
  },
  hero: {
    paddingVertical: 8,
  },
  heroTopline: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  eyebrow: {
    color: "#0a5ed7",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  localeSwitcher: {
    flexDirection: "row",
    gap: 8,
  },
  localeButton: {
    minWidth: 68,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d8d0c4",
    backgroundColor: "rgba(255,255,255,0.7)",
    paddingLeft: 3,
    paddingRight: 10,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  localeButtonSelected: {
    borderColor: "#0a5ed7",
    backgroundColor: "#ffffff",
  },
  localeButtonImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  localeButtonLabel: {
    color: "#182126",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  title: {
    color: "#182126",
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 36,
  },
  lede: {
    marginTop: 12,
    color: "#5f696e",
    fontSize: 16,
    lineHeight: 22,
    maxWidth: 320,
  },
  panel: {
    backgroundColor: "#fffaf1",
    borderWidth: 1,
    borderColor: "#d8d0c4",
    borderRadius: 20,
    padding: 16,
    gap: 10,
  },
  label: {
    marginTop: 2,
    color: "#5f696e",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  inputButton: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d8d0c4",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  inputButtonText: {
    color: "#182126",
    fontSize: 16,
  },
  controlPressed: {
    transform: [{ scale: 0.995 }],
    opacity: 0.96,
  },
  weekdayRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dayChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d8d0c4",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dayChipSelected: {
    backgroundColor: "#0a7f45",
    borderColor: "#0a7f45",
  },
  dayChipPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  dayChipText: {
    color: "#182126",
    fontWeight: "700",
  },
  dayChipTextSelected: {
    color: "#ffffff",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  primaryButton: {
    backgroundColor: "#0a7f45",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
  },
  buttonDisabled: {
    opacity: 0.78,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  buttonPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  secondaryButton: {
    backgroundColor: "#ffffff",
    borderColor: "#d8d0c4",
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
  },
  secondaryButtonDisabled: {
    opacity: 0.72,
  },
  secondaryButtonText: {
    color: "#0a5ed7",
    fontWeight: "800",
  },
  tertiaryButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  tertiaryButtonText: {
    color: "#0a5ed7",
    fontWeight: "800",
    fontSize: 14,
  },
  linkPressed: {
    opacity: 0.65,
  },
  loading: {
    paddingVertical: 12,
  },
  error: {
    color: "#9c2e1d",
    fontWeight: "700",
  },
  summary: {
    backgroundColor: "#fffaf1",
    borderWidth: 1,
    borderColor: "#d8d0c4",
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  summaryLabel: {
    color: "#5f696e",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  summaryValue: {
    marginTop: 4,
    color: "#182126",
    fontSize: 18,
    fontWeight: "800",
    maxWidth: 220,
  },
  results: {
    gap: 14,
  },
  card: {
    backgroundColor: "#fffaf1",
    borderWidth: 1,
    borderColor: "#d8d0c4",
    borderRadius: 20,
    padding: 16,
  },
  cardTopline: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  cardTitle: {
    color: "#182126",
    fontSize: 24,
    fontWeight: "800",
    flexShrink: 1,
  },
  favoriteButton: {
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  favoriteButtonText: {
    color: "#0a5ed7",
    fontSize: 22,
    lineHeight: 22,
  },
  cardPrice: {
    color: "#0a5ed7",
    fontWeight: "800",
  },
  cardTime: {
    marginTop: 10,
    color: "#182126",
    fontSize: 18,
    fontWeight: "800",
  },
  cardNotes: {
    marginTop: 8,
    color: "#5f696e",
    fontSize: 15,
    lineHeight: 20,
  },
  cardWarning: {
    marginTop: 10,
    backgroundColor: "#f6e4d9",
    color: "#a3471d",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: "800",
  },
});
