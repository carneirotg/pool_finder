# Amsterdam Pools

Amsterdam pool lookup built with TypeScript for web and mobile.

## Architecture

- `data/pools.json`: source of truth for pool records
- `packages/core/src/index.ts`: shared query logic and types
- `apps/api/src/server.ts`: Fastify web app and JSON API
- `apps/mobile/App.tsx`: Expo / React Native client
- `render.yaml`: Render deployment config for the Node service

## Run The Web App Locally

You need Node.js 20+.

```bash
npm install
npm run dev
```

Then open [http://127.0.0.1:3000](http://127.0.0.1:3000).

Production-style build:

```bash
npm run build
npm start
```

JSON endpoint example:

```bash
curl "http://127.0.0.1:3000/api/open?weekday=tuesday&time=19:30"
```

## Run The Expo App

The mobile app lives in `apps/mobile`.
Because Expo is running inside a workspace with hoisted dependencies, the repo root also contains a tiny `App.tsx` that forwards to `apps/mobile/App.tsx`.

Install dependencies from the repo root:

```bash
npm install
```

Start Expo:

```bash
npm run mobile
```

The mobile app is configured to use the deployed API URL by default.
For local testing, start the web app with `npm run dev` and point the mobile app to your computer's LAN IP if needed.

## Pool Data Format

Each pool record looks like this:

```json
{
  "name": "Examplebad",
  "price_eur": 6.5,
  "source_url": "https://example.nl/pool",
  "last_updated": "2026-03-10",
  "warning": "Summer closure possible in August; verify official site.",
  "availability": [
    {
      "date": "2026-03-10",
      "opens_at": "17:00",
      "closes_at": "21:00",
      "swim_until": "20:45",
      "notes": "Lane swimming"
    }
  ]
}
```

Recurring weekly availability is also supported:

```json
{
  "weekday": "monday",
  "opens_at": "07:00",
  "closes_at": "08:30",
  "swim_until": "08:30",
  "notes": "Lane swimming"
}
```

`warning` is optional and intended for seasonal closures or low-confidence schedule periods.

## Deploy To Render

1. Push this repo to GitHub.
2. In Render, create a new Blueprint or Web Service from the repo.
3. Render will use `render.yaml`.
4. Deploy and open the generated URL on your phone.

The current Render config builds with `npm install && npm run build` and starts with `npm start`.
