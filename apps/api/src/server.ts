import { readFile } from "node:fs/promises";
import path from "node:path";

import Fastify from "fastify";

import {
  WEEKDAYS,
  formatPrice,
  isLocale,
  queryOpenPools,
  resolveLocale,
  t,
  validateDate,
  validateTime,
  weekdayForDate,
  weekdayLabel,
  weekdayShortLabel,
} from "../../../packages/core/src/index";

const app = Fastify({ logger: true });
type Weekday = (typeof WEEKDAYS)[number];
const FLAG_ASSET_DIR = path.join(process.cwd(), "assets", "flags");

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
  locale: "en" | "nl";
  queryDate: string;
  queryTime: string;
  queryWeekday: string;
  count: number;
  pools: Array<{
    name: string;
    price_eur: number | null;
    swim_until: string;
    notes: string;
    warning: string;
    source_url: string;
    last_updated: string;
  }>;
  error?: string;
}): string {
  const queryWeekday = input.queryWeekday as Weekday;
  const weekdayButtons = WEEKDAYS.map((weekday) => {
    const selected = weekday === input.queryWeekday ? " selected" : "";
    return `
      <label class="weekday-chip${selected}">
        <input type="radio" name="weekday" value="${weekday}"${selected ? " checked" : ""}>
        <span>${weekdayShortLabel(input.locale, weekday)}</span>
      </label>
    `;
  }).join("");

  const localeLinks = (["en", "nl"] as const)
    .map((locale) => {
      const selected = locale === input.locale ? " selected" : "";
      return `
        <a class="locale-chip${selected}" href="/?locale=${locale}&weekday=${escapeHtml(queryWeekday)}&time=${escapeHtml(input.queryTime)}" aria-label="${locale === "en" ? "Switch to English" : "Overschakelen naar Nederlands"}">
          <img src="/assets/flags/${locale === "en" ? "us-circle.svg" : "nl-circle.svg"}" alt="${locale === "en" ? "English" : "Nederlands"}">
          <span>${locale === "en" ? "EN" : "NL"}</span>
        </a>
      `;
    })
    .join("");

  const cards =
    input.pools.length > 0
      ? input.pools
          .map((pool) => {
            const warning = pool.warning
              ? `<p class="warning">${escapeHtml(pool.warning)}</p>`
              : "";
            const notes = pool.notes ? `<p class="notes">${escapeHtml(pool.notes)}</p>` : "";
            const detailsRows = [
              pool.source_url
                ? `<div class="detail-row"><span class="detail-label">${escapeHtml(t(input.locale, "official_website"))}</span><a class="detail-link" href="${escapeHtml(pool.source_url)}" target="_blank" rel="noreferrer">${escapeHtml(pool.source_url)}</a></div>`
                : "",
              pool.last_updated
                ? `<div class="detail-row"><span class="detail-label">${escapeHtml(t(input.locale, "last_updated"))}</span><span class="detail-value">${escapeHtml(pool.last_updated)}</span></div>`
                : "",
            ]
              .filter(Boolean)
              .join("");
            const expanded = detailsRows
              ? `<div class="pool-details">${detailsRows}</div>`
              : "";

            return `
              <details class="pool-card">
                <summary class="pool-summary">
                  <div class="pool-topline">
                    <h2>${escapeHtml(pool.name)}</h2>
                    <span class="price">${escapeHtml(formatPrice(pool.price_eur, input.locale))}</span>
                  </div>
                  <p class="swim-until">${escapeHtml(t(input.locale, "swim_until"))} ${escapeHtml(pool.swim_until)}</p>
                  ${notes}
                  ${warning}
                </summary>
                ${expanded}
              </details>
            `;
          })
          .join("")
      : `
          <article class="pool-card empty">
            <h2>${escapeHtml(t(input.locale, "no_pools_found"))}</h2>
            <p>${escapeHtml(t(input.locale, "empty_try_another_time"))}</p>
          </article>
        `;

  const error = input.error ? `<p class="error">${escapeHtml(input.error)}</p>` : "";

  return `<!doctype html>
  <html lang="${input.locale}">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${escapeHtml(t(input.locale, "app_eyebrow"))}</title>
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
        .hero-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 10px;
        }
        .eyebrow {
          margin: 0;
          font-size: .9rem;
          font-weight: 700;
          letter-spacing: .08em;
          text-transform: uppercase;
          color: var(--accent-strong);
        }
        .locale-switcher {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .locale-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          min-width: 56px;
          height: 34px;
          padding: 0 8px 0 3px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: rgba(255,255,255,0.7);
          text-decoration: none;
          color: var(--ink);
        }
        .locale-chip img {
          width: 24px;
          height: 24px;
          display: block;
          border-radius: 999px;
          flex: 0 0 auto;
        }
        .locale-chip span {
          font-size: .72rem;
          font-weight: 800;
          letter-spacing: .03em;
        }
        .locale-chip.selected {
          border-color: var(--accent-strong);
          box-shadow: inset 0 0 0 2px var(--accent-strong);
          background: white;
        }
        .hero h1 { margin: 0; font-size: clamp(2.2rem, 6vw, 4rem); line-height: .95; }
        .lede { margin: 14px 0 0; color: var(--muted); font-size: 1.05rem; }
        .panel, .summary, .pool-card {
          background: var(--paper);
          border: 1px solid var(--line);
          box-shadow: 0 14px 32px var(--shadow);
        }
        .panel { padding: 16px; border-radius: 20px; }
        .query-form { display: grid; gap: 12px; }
        .query-row { display: grid; gap: 12px; justify-items: center; }
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
        .day-field {
          width: 100%;
          justify-items: center;
        }
        .weekday-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
          justify-content: center;
        }
        .weekday-chip {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 64px;
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
        .weekday-chip.selected span {
          color: white;
        }
        .controls-cluster {
          width: 100%;
          display: grid;
          gap: 12px;
          justify-items: center;
        }
        .time-field {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .time-field input {
          width: min(200px, 100%);
        }
        .actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
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
          padding: 22px 16px;
          border-radius: 18px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 16px;
          align-items: center;
        }
        .summary > div {
          display: grid;
          gap: 10px;
          align-content: center;
        }
        .summary p {
          margin: 0;
        }
        .summary-value { font-size: 1.1rem; font-weight: 700; }
        .results { display: grid; gap: 14px; margin-top: 18px; }
        .pool-card { border-radius: 20px; overflow: hidden; }
        .pool-summary {
          list-style: none;
          cursor: pointer;
          padding: 18px 18px 16px;
        }
        .pool-summary::-webkit-details-marker {
          display: none;
        }
        .pool-card[open] .pool-summary {
          padding-bottom: 14px;
        }
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
        .pool-details {
          display: grid;
          gap: 10px;
          padding: 0 18px;
          border-top: 1px solid var(--line);
          background: rgba(255,255,255,0.45);
          max-height: 0;
          opacity: 0;
          overflow: hidden;
          transition:
            max-height 220ms ease,
            opacity 180ms ease,
            padding 220ms ease;
        }
        .pool-card[open] .pool-details {
          max-height: 220px;
          opacity: 1;
          padding: 0 18px 18px;
        }
        .detail-row {
          display: grid;
          gap: 4px;
          padding-top: 12px;
        }
        .detail-label {
          font-size: .8rem;
          font-weight: 700;
          letter-spacing: .06em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .detail-link,
        .detail-value {
          color: var(--ink);
          font-size: .98rem;
          overflow-wrap: anywhere;
        }
        .detail-link {
          color: var(--accent-strong);
          text-decoration-thickness: 1px;
          text-underline-offset: 2px;
        }
        .error { margin: 14px 2px 0; color: #9c2e1d; }
        .empty h2, .empty p { margin: 0; }
        .empty p { margin-top: 8px; color: var(--muted); }
        @media (max-width: 389px) {
          .summary {
            grid-template-columns: 1fr;
          }
          .hero-top {
            justify-content: space-between;
            margin-bottom: 10px;
          }
        }
        @media (min-width: 390px) {
          .controls-cluster {
            width: auto;
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: center;
            gap: 12px;
          }
          .time-field {
            width: auto;
          }
          .time-field input { width: 148px; }
          .actions {
            flex-wrap: nowrap;
            gap: 8px;
          }
          .actions button, .actions a {
            padding: 10px 14px;
          }
          .summary {
            grid-template-columns: 1fr auto;
          }
          .summary-value {
            font-size: 1rem;
          }
        }
        @media (min-width: 520px) {
          .controls-cluster {
            gap: 16px;
          }
          .time-field input { width: 200px; }
          .actions {
            gap: 10px;
          }
          .actions button, .actions a {
            padding: 12px 18px;
          }
          .summary-value {
            font-size: 1.1rem;
          }
        }
      </style>
    </head>
    <body>
      <main class="shell">
        <section class="hero">
          <div class="hero-top">
            <p class="eyebrow">${escapeHtml(t(input.locale, "app_eyebrow"))}</p>
            <div class="locale-switcher">
              ${localeLinks}
            </div>
          </div>
          <h1>${escapeHtml(t(input.locale, "app_title"))}</h1>
          <p class="lede">${escapeHtml(t(input.locale, "app_subtitle"))}</p>
        </section>

        <section class="panel">
          <form class="query-form" method="get" action="/" id="query-form">
            <input type="hidden" name="locale" value="${escapeHtml(input.locale)}">
            <div class="query-row">
              <label class="day-field">
                <div class="weekday-row">
                  ${weekdayButtons}
                </div>
              </label>
            </div>
            <div class="query-row controls">
              <div class="controls-cluster">
                <label class="time-field">
                  <input type="time" name="time" value="${escapeHtml(input.queryTime)}" aria-label="${escapeHtml(t(input.locale, "time"))}">
                </label>
                <div class="actions">
                  <button type="submit">${escapeHtml(t(input.locale, "check_pools"))}</button>
                  <a href="/?now=1&locale=${escapeHtml(input.locale)}">${escapeHtml(t(input.locale, "now"))}</a>
                </div>
              </div>
            </div>
          </form>
          ${error}
        </section>

        <section class="summary">
          <div>
            <p class="summary-label">${escapeHtml(t(input.locale, "query"))}</p>
            <p class="summary-value">${escapeHtml(weekdayLabel(input.locale, queryWeekday))}, ${escapeHtml(input.queryDate)} ${input.locale === "nl" ? "om" : "at"} ${escapeHtml(input.queryTime)}</p>
          </div>
          <div>
            <p class="summary-label">${escapeHtml(t(input.locale, "matches"))}</p>
            <p class="summary-value">${input.count}</p>
          </div>
        </section>

        <section class="results">
          ${cards}
        </section>
      </main>
      <script>
        const weekdayInputs = document.querySelectorAll('input[name="weekday"]');
        const form = document.getElementById('query-form');
        const poolCards = document.querySelectorAll('.pool-card');

        weekdayInputs.forEach((input) => {
          input.addEventListener('change', () => {
            form.requestSubmit();
          });
        });

        poolCards.forEach((card) => {
          card.addEventListener('toggle', () => {
            if (!card.open) {
              return;
            }

            poolCards.forEach((otherCard) => {
              if (otherCard !== card) {
                otherCard.open = false;
              }
            });
          });
        });
      </script>
    </body>
  </html>`;
}

app.get("/", async (request, reply) => {
  try {
    const query = request.query as Record<string, string | undefined>;
    const locale = isLocale(query.locale)
      ? query.locale
      : resolveLocale(request.headers["accept-language"]);
    const { date, time, weekday } = resolveInputs(
      query.date,
      query.weekday,
      query.time,
      query.now === "1",
    );
    const result = await queryOpenPools(date, time, locale);
    return reply.type("text/html").send(
      renderPage({
        locale,
        queryDate: result.query_date,
        queryTime: result.query_time,
        queryWeekday: weekday,
        count: result.count,
        pools: result.pools,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const locale = resolveLocale(request.headers["accept-language"]);
    return reply.status(400).type("text/html").send(
      renderPage({
        locale,
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

app.get("/assets/flags/:name", async (request, reply) => {
  const params = request.params as { name: string };
  if (!/^[a-z-]+\.(svg|png)$/.test(params.name)) {
    return reply.status(404).send("Not found");
  }

  const filePath = path.join(FLAG_ASSET_DIR, params.name);
  const content = await readFile(filePath);
  const contentType = params.name.endsWith(".svg") ? "image/svg+xml" : "image/png";
  return reply.type(contentType).send(content);
});

app.get("/api/open", async (request) => {
  const query = request.query as Record<string, string | undefined>;
  const locale = isLocale(query.locale)
    ? query.locale
    : resolveLocale(request.headers["accept-language"]);
  const { date, time } = resolveInputs(query.date, query.weekday, query.time, query.now === "1");
  return queryOpenPools(date, time, locale);
});

const port = Number(process.env.PORT ?? "3000");

app.listen({ host: "0.0.0.0", port }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
