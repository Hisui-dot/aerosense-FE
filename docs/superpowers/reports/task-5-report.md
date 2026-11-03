# Task 5 Report — API-key generator + device-auth middleware

## Status
COMPLETE

## Commit Hash
`8a7394d`

## Test Output
```
✔ generates a prefixed key (0.854ms)
✔ generates unique keys (0.2094ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ duration_ms 76.0096
```

## Files Committed
- `backend/utils/apiKey.js` — crypto-based key generator (`ak_` prefix + 48-char hex)
- `backend/utils/apiKey.test.js` — 2 node:test tests (prefix check, uniqueness check)
- `backend/middleware/deviceAuth.js` — Express middleware checking `x-device-key` header via `store.findOne`

## Concerns
- `store.findOne` does a full table scan with a JS predicate; for large device tables an indexed SQL lookup on `apiKey` would be faster. The `devices` table has no `apiKey` column in the seed schema — the middleware will always return 401 until a migration adds and populates that column.
- `Login.tsx` has a pre-existing unstaged modification on the branch; `vape.db.bak` is an untracked artifact. Neither was touched by this task.
