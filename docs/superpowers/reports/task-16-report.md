# Task 16 Report — Live Readings Charts on Detail Pages

## Files Edited

| File | Route-id variable |
|------|------------------|
| `src/app/pages/SensorDetail.tsx` | `id` (from `const { id } = useParams()`) |
| `src/app/pages/admin/AdminDeviceDetail.tsx` | `id` (from `const { id } = useParams()`) |

Admin detail file path: `C:\Capstone_Vape\Vape\src\app\pages\admin\AdminDeviceDetail.tsx`

## Changes Made

### Both files
- Added `readingsApi` and `type Reading` to existing api import
- Added `import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'`
- Added `const [readings, setReadings] = useState<Reading[]>([])` state
- Added `useEffect` to fetch `readingsApi.forDevice(id, 100)` and reverse for chronological order

### SensorDetail.tsx
- Chart inserted between "Live Readings" section and "Diagnostics" section, wrapped in a `<Card>` with heading "Sensor Readings (last 100)"

### AdminDeviceDetail.tsx
- Chart inserted as a new `<Card>` section between "Live Sensor Readings" and "Device Activity" cards in the main left column

## Build Result

`npm run build` succeeded in 5.45s. Only the pre-existing chunk-size warning (>500 kB) present — no new errors.

## Commit

Hash: `7e8d1d5`
Branch: `feat/iot-loop`
Message: `feat(frontend): add live readings charts to device/sensor detail pages`
Files staged: `src/app/pages/SensorDetail.tsx`, `src/app/pages/admin/AdminDeviceDetail.tsx` (Login.tsx excluded)
