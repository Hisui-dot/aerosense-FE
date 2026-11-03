# Task 3 Report — Seed API Keys & Historical Readings

## Commit

`158bbc8` — `feat(db): seed per-device API keys and historical sensor readings`

## Verification Output

```
Seeded device API keys (local dev only):
  S001: ak_e216109eea7c378d3e3d00ae5c918b9f65b972348ecf9fbd
  S002: ak_da38114f25d7e49af0976cdb787de5a17e25a3e20bee28f0
  S003: ak_3d5abd8bebe02a818092dfc49803812b876b986bd3223ac6
  S004: ak_128c06520be74cc3609300281cebfe16fc8b2cfea5b5535c
  S005: ak_019399460f627bfded85012cae92a0f00a6a819297a464f7
  S006: ak_a0095eac7ee5c0cea4b4802e95eda4bd1e3001a837c9e5f0
  S007: ak_463d0c628d99f86534b813c196fe3ea767bbd7adb8eec915
keys ok: true
readings for S001 = 24
```

## Example Seeded Key

`S001: ak_e216109eea7c378d3e3d00ae5c918b9f65b972348ecf9fbd`

## Changes Made

- **Edit A**: Replaced positional `INSERT INTO devices VALUES (?,?,...18)` with an explicit column-list insert that includes `apiKey`, populated via `crypto.randomBytes(24)`.
- **Edit B**: Added historical sensor readings loop — 24 readings per device, spaced 5 minutes apart (covering last 2 hours), with jitter on pm25/voc values.
- **Edit C**: Added `console.log` after `COMMIT` to print each device's seeded API key.
- **Fix (alerts)**: Also updated the alerts insert to use an explicit column list, since migrations added 4 columns (`deviceId`, `pm25`, `voc`, `source`) to the alerts table after the base schema — the positional insert was similarly broken for alerts.

## Concerns

- The alerts positional insert (`INSERT INTO alerts VALUES (?,?,...10)`) was also broken by migrations adding 4 columns. This fix was applied to unblock seeding, though it was outside the original task scope.
- `vape.db.bak` appeared as an untracked file in the repo root — not staged or committed. May be a leftover from a previous manual DB wipe attempt.
