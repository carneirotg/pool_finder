# Amsterdam Pools

Minimal local-first Python workflow for answering:

- Which pools are open at a given date/time?
- Until when can I swim there?
- What is the ticket price?

## Files

- `data/pools.json`: pool records
- `pool_query.py`: shared query logic
- `scripts/find_open_pools.py`: query pools by date/time
- `scripts/update_pools.py`: helper for updating pool records
- `app.py`: mobile-friendly Flask app
- `render.yaml`: Render deployment config

## Pool data format

Each pool record looks like this:

```json
{
  "name": "Examplebad",
  "price_eur": 6.5,
  "source_url": "https://example.nl/pool",
  "last_updated": "2026-03-10",
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

## Usage

Show pools open at a specific moment:

```bash
python3 scripts/find_open_pools.py --date 2026-03-10 --time 17:30
```

Short wrapper from the repo root:

```bash
./pool-open --date 2026-03-10 --time 17:30
```

If you provide only `--time`, the script uses today's date:

```bash
./pool-open --time 17:30
```

Show pools open right now:

```bash
./pool-open --now
```

Run the web app locally:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
flask --app app run --debug
```

Then open [http://127.0.0.1:5000](http://127.0.0.1:5000).

JSON endpoint:

```bash
curl "http://127.0.0.1:5000/api/open?date=2026-03-10&time=19:30"
```

Add or update a pool manually:

```bash
python3 scripts/update_pools.py add \
  --name "Examplebad" \
  --price 6.5 \
  --source-url "https://example.nl/pool"
```

Add an availability window:

```bash
python3 scripts/update_pools.py add-slot \
  --name "Examplebad" \
  --date 2026-03-10 \
  --opens-at 17:00 \
  --closes-at 21:00 \
  --swim-until 20:45 \
  --notes "Lane swimming"
```

Add a recurring weekly availability window:

```bash
python3 scripts/update_pools.py add-weekly-slot \
  --name "SportPlaza Mercator" \
  --weekday monday \
  --opens-at 07:00 \
  --closes-at 08:30 \
  --notes "Banenzwemmen"
```

## Deploy To Render

1. Push this repo to GitHub.
2. In Render, create a new Blueprint or Web Service from the repo.
3. Render will pick up `render.yaml`.
4. Deploy the app and open the generated URL on your phone.

The app uses the free Render plan in `render.yaml`, which is a good fit for this small hobby project.
