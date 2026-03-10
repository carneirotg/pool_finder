import Fastify from "fastify";

import {
  WEEKDAYS,
  formatPrice,
  queryOpenPools,
  titleWeekday,
  validateDate,
  validateTime,
} from "../../../packages/core/src/index";

const app = Fastify({ logger: true });
type Weekday = (typeof WEEKDAYS)[number];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function localDate(now: Date): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function localTime(now: Date): string {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function validateWeekday(value: string): Weekday {
  const normalized = value.trim().toLowerCase() as Weekday;
  if (!WEEKDAYS.includes(normalized)) {
    throw new Error("Weekday must be one of monday through sunday.");
  }
  return normalized;
}

function nextDateForWeekday(weekday: Weekday, now: Date): string {
  const weekdayIndex = WEEKDAYS.indexOf(weekday);
  const currentIndex = (now.getDay() + 6) % 7;
  const offset = (weekdayIndex - currentIndex + 7) % 7;
  const target = new Date(now);
  target.setDate(now.getDate() + offset);
  return localDate(target);
}

function resolveInputs(
  dateValue: string | undefined,
  weekdayValue: string | undefined,
  timeValue: string | undefined,
  useNow: boolean,
): { date: string; time: string; weekday: string } {
  if (useNow || (!dateValue && !timeValue)) {
    const now = new Date();
    return {
      date: localDate(now),
      time: localTime(now),
      weekday: WEEKDAYS[(now.getDay() + 6) % 7],
    };
  }

  if (timeValue && weekdayValue && !dateValue) {
    const now = new Date();
    const weekday = validateWeekday(weekdayValue);
    return {
      date: nextDateForWeekday(weekday, now),
      time: validateTime(timeValue),
      weekday,
    };
  }

  if (timeValue && !dateValue && !weekdayValue) {
    validateTime(timeValue);
    const now = new Date();
    return {
      date: localDate(now),
      time: timeValue,
      weekday: WEEKDAYS[(now.getDay() + 6) % 7],
    };
  }

  if (dateValue && timeValue) {
    return {
      date: validateDate(dateValue),
      time: validateTime(timeValue),
      weekday: WEEKDAYS[(new Date(`${dateValue}T00:00:00`).getDay() + 6) % 7],
    };
  }

  throw new Error("Provide time and weekday, both date and time, or now=1.");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderPage(input: {
  queryDate: string;
  queryTime: string;
  queryWeekday: string;
  count: number;
  pools: Array<{ name: string; price_eur: number | null; swim_until: string; notes: string; warning: string }>;
  error?: string;
}): string {
  const weekdayButtons = WEEKDAYS.map((weekday) => {
    const selected = weekday === input.queryWeekday ? " selected" : "";
    return `
      <label class="weekday-chip${selected}">
        <input type="radio" name="weekday" value="${weekday}"${selected ? " checked" : ""}>
        <span>${titleWeekday(weekday).slice(0, 3)}</span>
      </label>
    `;
  }).join("");

  const cards =
    input.pools.length > 0
      ? input.pools
          .map((pool) => {
            const warning = pool.warning
              ? `<p class="warning">${escapeHtml(pool.warning)}</p>`
              : "";
            const notes = pool.notes ? `<p class="notes">${escapeHtml(pool.notes)}</p>` : "";

            return `
              <article class="pool-card">
                <div class="pool-topline">
                  <h2>${escapeHtml(pool.name)}</h2>
                  <span class="price">${escapeHtml(formatPrice(pool.price_eur))}</span>
                </div>
                <p class="swim-until">Swim until ${escapeHtml(pool.swim_until)}</p>
                ${notes}
                ${warning}
              </article>
            `;
          })
          .join("")
      : `
          <article class="pool-card empty">
            <h2>No pools found</h2>
            <p>Try another time or use the Now shortcut.</p>
          </article>
        `;

  const error = input.error ? `<p class="error">${escapeHtml(input.error)}</p>` : "";

  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Amsterdam Pools</title>
      <style>
        :root {
          --bg: #f4efe6;
          --paper: #fffaf1;
          --ink: #182126;
          --muted: #5f696e;
          --accent: #0a7f45;
          --accent-strong: #0a5ed7;
          --warning: #a3471d;
          --line: #d8d0c4;
          --shadow: rgba(24, 33, 38, 0.08);
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background:
            radial-gradient(circle at top left, rgba(10, 127, 69, 0.10), transparent 30%),
            linear-gradient(180deg, #efe7d7 0%, var(--bg) 100%);
          color: var(--ink);
        }
        .shell { width: min(720px, calc(100% - 24px)); margin: 0 auto; padding: 24px 0 48px; }
        .hero { padding: 8px 4px 18px; }
        .eyebrow {
          margin: 0 0 8px;
          font-size: .9rem;
          font-weight: 700;
          letter-spacing: .08em;
          text-transform: uppercase;
          color: var(--accent-strong);
        }
        .hero h1 { margin: 0; font-size: clamp(2.2rem, 6vw, 4rem); line-height: .95; max-width: 10ch; }
        .lede { max-width: 34ch; margin: 14px 0 0; color: var(--muted); font-size: 1.05rem; }
        .panel, .summary, .pool-card {
          background: var(--paper);
          border: 1px solid var(--line);
          box-shadow: 0 14px 32px var(--shadow);
        }
        .panel { padding: 16px; border-radius: 20px; }
        .query-form { display: grid; gap: 12px; }
        .query-form label { display: grid; gap: 6px; }
        .query-form span, .summary-label {
          font-size: .85rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: .08em;
          color: var(--muted);
        }
        .query-form input {
          width: 100%;
          padding: 14px 16px;
          border-radius: 14px;
          border: 1px solid var(--line);
          background: #fff;
          font: inherit;
          color: var(--ink);
        }
        .weekday-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .weekday-chip {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 58px;
          padding: 10px 14px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: #fff;
          color: var(--ink);
          font-weight: 700;
          cursor: pointer;
        }
        .weekday-chip input {
          position: absolute;
          inset: 0;
          opacity: 0;
          pointer-events: none;
        }
        .weekday-chip.selected {
          background: var(--accent);
          border-color: var(--accent);
          color: white;
        }
        .actions { display: flex; gap: 10px; padding-top: 4px; }
        .actions button, .actions a {
          appearance: none;
          border: 0;
          border-radius: 999px;
          padding: 12px 18px;
          font: inherit;
          font-weight: 700;
          text-decoration: none;
          cursor: pointer;
        }
        .actions button { background: var(--accent); color: white; }
        .actions a { background: white; color: var(--accent-strong); border: 1px solid var(--line); }
        .summary {
          margin-top: 16px;
          padding: 14px 16px;
          border-radius: 18px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 16px;
        }
        .summary-value { margin: 4px 0 0; font-size: 1.1rem; font-weight: 700; }
        .results { display: grid; gap: 14px; margin-top: 18px; }
        .pool-card { border-radius: 20px; padding: 18px 18px 16px; }
        .pool-topline {
          display: flex;
          gap: 12px;
          align-items: baseline;
          justify-content: space-between;
        }
        .pool-topline h2 { margin: 0; font-size: 1.45rem; }
        .price { color: var(--accent-strong); font-weight: 700; white-space: nowrap; }
        .swim-until { margin: 10px 0 0; font-size: 1.1rem; font-weight: 700; }
        .notes { margin: 8px 0 0; color: var(--muted); }
        .warning {
          margin: 10px 0 0;
          padding: 10px 12px;
          border-radius: 12px;
          background: #f6e4d9;
          color: var(--warning);
          font-weight: 700;
        }
        .error { margin: 14px 2px 0; color: #9c2e1d; }
        .empty h2, .empty p { margin: 0; }
        .empty p { margin-top: 8px; color: var(--muted); }
        @media (min-width: 640px) {
          .query-form { grid-template-columns: 1fr 1fr auto; align-items: end; }
          .actions { padding-top: 0; }
        }
      </style>
    </head>
    <body>
      <main class="shell">
        <section class="hero">
          <p class="eyebrow">Amsterdam Pools</p>
          <h1>Swimming pool finder</h1>
          <p class="lede">Amsterdam pools timetable</p>
        </section>

        <section class="panel">
          <form class="query-form" method="get" action="/">
            <label>
              <span>Day</span>
              <div class="weekday-row">
                ${weekdayButtons}
              </div>
            </label>
            <label>
              <span>Time</span>
              <input type="time" name="time" value="${escapeHtml(input.queryTime)}">
            </label>
            <div class="actions">
              <button type="submit">Check pools</button>
              <a href="/?now=1">Now</a>
            </div>
          </form>
          ${error}
        </section>

        <section class="summary">
          <div>
            <p class="summary-label">Query</p>
            <p class="summary-value">${escapeHtml(titleWeekday(input.queryWeekday))}, ${escapeHtml(input.queryDate)} at ${escapeHtml(input.queryTime)}</p>
          </div>
          <div>
            <p class="summary-label">Matches</p>
            <p class="summary-value">${input.count}</p>
          </div>
        </section>

        <section class="results">
          ${cards}
        </section>
      </main>
    </body>
  </html>`;
}

app.get("/", async (request, reply) => {
  try {
    const query = request.query as Record<string, string | undefined>;
    const { date, time, weekday } = resolveInputs(
      query.date,
      query.weekday,
      query.time,
      query.now === "1",
    );
    const result = await queryOpenPools(date, time);
    return reply.type("text/html").send(
      renderPage({
        queryDate: result.query_date,
        queryTime: result.query_time,
        queryWeekday: weekday,
        count: result.count,
        pools: result.pools,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return reply.status(400).type("text/html").send(
      renderPage({
        queryDate: "",
        queryTime: "",
        queryWeekday: "monday",
        count: 0,
        pools: [],
        error: message,
      }),
    );
  }
});

app.get("/api/open", async (request) => {
  const query = request.query as Record<string, string | undefined>;
  const { date, time } = resolveInputs(query.date, query.weekday, query.time, query.now === "1");
  return queryOpenPools(date, time);
});

const port = Number(process.env.PORT ?? "3000");

app.listen({ host: "0.0.0.0", port }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
