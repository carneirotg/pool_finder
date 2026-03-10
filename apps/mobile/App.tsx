import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

type Weekday = (typeof WEEKDAYS)[number];

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
  apiBaseUrl?: string;
  weekday?: Weekday;
  time?: string;
  minLoadingMs?: number;
};

const DEFAULT_API_BASE_URL = "http://127.0.0.1:3000";
const LOCAL_API_BASE_URL = "http://192.168.178.49:3000";
const API_BASE_URL_STORAGE_KEY = "api_base_url";
const FAVORITE_POOLS_STORAGE_KEY = "favorite_pools";

function titleWeekday(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function weekdayFromDate(value: string): Weekday {
  const date = new Date(`${value}T00:00:00`);
  return WEEKDAYS[(date.getDay() + 6) % 7];
}

function currentWeekday(): Weekday {
  const index = (new Date().getDay() + 6) % 7;
  return WEEKDAYS[index];
}

function currentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function formatPrice(priceEur: number | null): string {
  if (priceEur == null) {
    return "n/a";
  }
  return `EUR ${priceEur.toFixed(2)}`;
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
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
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
      const nextBaseUrl = overrides.apiBaseUrl ?? apiBaseUrl;
      const nextWeekday = overrides.weekday ?? weekday;
      const nextTime = overrides.time ?? time;
      const minLoadingMs = overrides.minLoadingMs ?? 0;
      const trimmedBaseUrl = nextBaseUrl.trim().replace(/\/$/, "");
      const [response] = await Promise.all([
        fetch(`${trimmedBaseUrl}/api/open?weekday=${nextWeekday}&time=${encodeURIComponent(nextTime)}`),
        delay(minLoadingMs),
      ]);

      if (!response.ok) {
        throw new Error(`API error ${response.status}`);
      }

      const data = (await response.json()) as OpenPoolsResult;
      setResult(data);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : "Could not load pool data.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function initialize() {
      try {
        const savedBaseUrl = await AsyncStorage.getItem(API_BASE_URL_STORAGE_KEY);
        const savedFavorites = await AsyncStorage.getItem(FAVORITE_POOLS_STORAGE_KEY);

        if (savedFavorites) {
          setFavoritePools(JSON.parse(savedFavorites) as string[]);
        }

        if (savedBaseUrl) {
          setApiBaseUrl(savedBaseUrl);
          await fetchPools({ apiBaseUrl: savedBaseUrl });
          return;
        }
        await fetchPools({ apiBaseUrl: DEFAULT_API_BASE_URL });
      } finally {
        setInitializing(false);
      }
    }

    void initialize();
  }, []);

  async function saveApiBaseUrl(value: string) {
    const normalized = value.trim();
    setApiBaseUrl(value);
    await AsyncStorage.setItem(API_BASE_URL_STORAGE_KEY, normalized);
  }

  async function useLocalApi() {
    await saveApiBaseUrl(LOCAL_API_BASE_URL);
  }

  async function toggleFavorite(poolName: string) {
    const nextFavorites = favoritePools.includes(poolName)
      ? favoritePools.filter((name) => name !== poolName)
      : [...favoritePools, poolName];

    setFavoritePools(nextFavorites);
    await AsyncStorage.setItem(FAVORITE_POOLS_STORAGE_KEY, JSON.stringify(nextFavorites));
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
          <Text style={styles.eyebrow}>Amsterdam Pools</Text>
          <Text style={styles.title}>Swimming pool finder.</Text>
          <Text style={styles.lede}>
            Minimal Expo client for the same API used by the web app.
          </Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.label}>API base URL</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(value: string) => {
              void saveApiBaseUrl(value);
            }}
            style={styles.input}
            value={apiBaseUrl}
          />
          <Text style={styles.hint}>
            Use your Render URL later. For local phone testing, replace 127.0.0.1 with your
            computer&apos;s LAN IP.
          </Text>
          <Pressable
            onPress={() => void useLocalApi()}
            style={({ pressed }) => [styles.tertiaryButton, pressed && styles.linkPressed]}
          >
            <Text style={styles.tertiaryButtonText}>Use local API</Text>
          </Pressable>

          <Text style={styles.label}>Day</Text>
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
                    {titleWeekday(day).slice(0, 3)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Time</Text>
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
                <Text style={styles.primaryButtonText}>Check pools</Text>
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
              <Text style={styles.secondaryButtonText}>{loading ? "Loading..." : "Now"}</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => setOnlyFavorites((value) => !value)}
            style={({ pressed }) => [styles.tertiaryButton, pressed && styles.linkPressed]}
          >
            <Text style={styles.tertiaryButtonText}>
              {onlyFavorites ? "Show all pools" : "Only favorites"}
            </Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {result ? (
          <View style={styles.summary}>
            <View>
              <Text style={styles.summaryLabel}>Query</Text>
              <Text style={styles.summaryValue}>
                {titleWeekday(weekdayFromDate(result.query_date))}, {result.query_date} at{" "}
                {result.query_time}
              </Text>
            </View>
            <View>
              <Text style={styles.summaryLabel}>Matches</Text>
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
                <Text style={styles.cardPrice}>{formatPrice(pool.price_eur)}</Text>
              </View>
              <Text style={styles.cardTime}>Swim until {pool.swim_until}</Text>
              {pool.notes ? <Text style={styles.cardNotes}>{pool.notes}</Text> : null}
              {pool.warning ? <Text style={styles.cardWarning}>{pool.warning}</Text> : null}
            </View>
          ))}

          {result && displayedPools.length === 0 && !loading ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>No pools found</Text>
              <Text style={styles.cardNotes}>
                {onlyFavorites
                  ? "No favorite pools match this moment."
                  : "Try another time or switch to a different day."}
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
  eyebrow: {
    color: "#0a5ed7",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: {
    color: "#182126",
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 36,
    maxWidth: 260,
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
    marginTop: 4,
    color: "#5f696e",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d8d0c4",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#182126",
    fontSize: 16,
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
  hint: {
    color: "#5f696e",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
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
