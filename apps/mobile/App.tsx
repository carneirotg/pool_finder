import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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

const DEFAULT_API_BASE_URL = "http://127.0.0.1:3000";
const API_BASE_URL_STORAGE_KEY = "api_base_url";

function titleWeekday(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
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

export default function App() {
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
  const [weekday, setWeekday] = useState<Weekday>(currentWeekday());
  const [time, setTime] = useState(currentTime());
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState<OpenPoolsResult | null>(null);

  async function fetchPools(baseUrlOverride?: string) {
    setLoading(true);
    setError("");

    try {
      const trimmedBaseUrl = (baseUrlOverride ?? apiBaseUrl).trim().replace(/\/$/, "");
      const response = await fetch(
        `${trimmedBaseUrl}/api/open?weekday=${weekday}&time=${encodeURIComponent(time)}`,
      );

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
        if (savedBaseUrl) {
          setApiBaseUrl(savedBaseUrl);
          await fetchPools(savedBaseUrl);
          return;
        }
        await fetchPools(DEFAULT_API_BASE_URL);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Amsterdam Pools</Text>
          <Text style={styles.title}>Phone-first lane swimming lookup.</Text>
          <Text style={styles.lede}>
            Minimal Expo client for the same API used by the web app.
          </Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.label}>API base URL</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(value) => {
              void saveApiBaseUrl(value);
            }}
            style={styles.input}
            value={apiBaseUrl}
          />
          <Text style={styles.hint}>
            Use your Render URL later. For local phone testing, replace 127.0.0.1 with your
            computer&apos;s LAN IP.
          </Text>

          <Text style={styles.label}>Day</Text>
          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((day) => {
              const selected = day === weekday;
              return (
                <Pressable
                  key={day}
                  onPress={() => setWeekday(day)}
                  style={[styles.dayChip, selected && styles.dayChipSelected]}
                >
                  <Text style={[styles.dayChipText, selected && styles.dayChipTextSelected]}>
                    {titleWeekday(day).slice(0, 3)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>Time</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setTime}
            placeholder="19:30"
            style={styles.input}
            value={time}
          />

          <View style={styles.actions}>
            <Pressable onPress={() => void fetchPools()} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Check pools</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setWeekday(currentWeekday());
                setTime(currentTime());
                void fetchPools();
              }}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Now</Text>
            </Pressable>
          </View>
        </View>

        {loading || initializing ? (
          <View style={styles.loading}>
            <ActivityIndicator />
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {result ? (
          <View style={styles.summary}>
            <View>
              <Text style={styles.summaryLabel}>Query</Text>
              <Text style={styles.summaryValue}>
                {titleWeekday(weekday)}, {result.query_date} at {result.query_time}
              </Text>
            </View>
            <View>
              <Text style={styles.summaryLabel}>Matches</Text>
              <Text style={styles.summaryValue}>{result.count}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.results}>
          {result?.pools.map((pool) => (
            <View key={`${pool.name}-${pool.swim_until}-${pool.notes}`} style={styles.card}>
              <View style={styles.cardTopline}>
                <Text style={styles.cardTitle}>{pool.name}</Text>
                <Text style={styles.cardPrice}>{formatPrice(pool.price_eur)}</Text>
              </View>
              <Text style={styles.cardTime}>Swim until {pool.swim_until}</Text>
              {pool.notes ? <Text style={styles.cardNotes}>{pool.notes}</Text> : null}
              {pool.warning ? <Text style={styles.cardWarning}>{pool.warning}</Text> : null}
            </View>
          ))}

          {result && result.pools.length === 0 && !loading ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>No pools found</Text>
              <Text style={styles.cardNotes}>Try another time or switch to a different day.</Text>
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
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  secondaryButton: {
    backgroundColor: "#ffffff",
    borderColor: "#d8d0c4",
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
  },
  secondaryButtonText: {
    color: "#0a5ed7",
    fontWeight: "800",
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
  cardTitle: {
    color: "#182126",
    fontSize: 24,
    fontWeight: "800",
    flexShrink: 1,
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
