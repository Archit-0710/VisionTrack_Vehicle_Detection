<div align="center">

# 🚗 VisionTrack

### Vehicle Identification & Speed Detection Dashboard

A professional full-stack traffic monitoring system that processes uploaded traffic videos using computer vision to detect vehicles, track their movement, calculate real-time speeds, and flag violations — all streamed live to an interactive web dashboard.

![Dashboard](https://img.shields.io/badge/Status-Running-brightgreen?style=flat-square)
![Python](https://img.shields.io/badge/Python-3.14-blue?style=flat-square&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.136-teal?style=flat-square&logo=fastapi)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?style=flat-square&logo=typescript)
![OpenCV](https://img.shields.io/badge/OpenCV-4.13-5C3EE8?style=flat-square&logo=opencv)

</div>

---

## 🏗️ Architecture

```
Browser (port 5173)
    │
    ├── REST /api/*  ──(Vite proxy)──▶  Python FastAPI (port 8000)
    │                                       ├── Video upload & storage
    │                                       ├── Motion CV pipeline
    │                                       ├── SQLite event log
    │                                       └── WebSocket /ws/{run_id}
    │
    └── Socket.io  ──────────────────▶  Node.js Gateway (port 3001)
                                            └── Python WS bridge
```

| Layer | Technology | Port |
|---|---|---|
| Python CV Service | FastAPI · OpenCV · SQLite · aiosqlite | **8000** |
| Node.js Gateway | Express · Socket.io · ws | **3001** |
| React Frontend | Vite · TypeScript · Tailwind CSS · Recharts | **5173** |

---

## ✨ Features

### 📤 Video Upload & Management
- Drag-and-drop upload zone (MP4, AVI, MOV, MKV · up to 500 MB)
- Auto-extracted metadata: FPS, resolution, duration, file size
- Per-video status tracking (`pending → ready → processing → completed`)
- Delete videos with one click

### 🎥 Motion-Based CV Pipeline
- **Background subtraction** — MOG2 or KNN (switchable in Config)
- **Morphological cleanup** — dilate/erode/close to remove noise
- **Contour filtering** — min/max area, aspect ratio, solidity, extent
- **CentroidTracker** — pure-numpy greedy matching (no scipy dependency)
- **Dual-line speed trap** — measures crossing time between two virtual trip-wires
  ```
  speed (km/h) = (known_distance_m / crossing_time_s) × 3.6
  ```
- **Vehicle classification** — heuristic by bounding-box area & shape (car / motorcycle / truck)
- **Violation detection** — flags vehicles exceeding the speed limit
- **Violation snapshots** — JPEGs cropped from the frame, saved to disk

### 📡 Real-time WebSocket Streaming
- Frame-by-frame updates every 5 frames via Socket.io
- Live thumbnail of the currently processed frame
- Emits `frame_processed` and `event_detected` events to the browser

### 📹 Annotated Video Output
- Full-resolution MP4 rendered server-side during processing
- Colored bounding boxes:
  - 🟠 Orange → being tracked, speed not yet measured
  - 🟢 Green → measured, within limit
  - 🔴 Red → **violation**
- ID labels, speed overlays, speed-trap lines drawn on every frame
- **One-click download** directly from the video player

### 📊 Live Statistics Panel
| Metric | Description |
|---|---|
| Active Tracks | Vehicles currently in frame |
| Total Detections | Cumulative vehicle count |
| Avg Speed | Mean of all speed-measured vehicles |
| Max Speed | Highest recorded speed |
| Violations | Count of over-limit vehicles |
| Processing FPS | Pipeline throughput rate |

### 📈 Analytics Charts (Recharts)
- **Speed Distribution** histogram — violation zone highlighted in red, speed limit reference line
- **Speed Timeline** — avg speed + violation count per 5-second window
- **Vehicle Type Breakdown** — donut chart (car / motorcycle / truck / bus)

### 📋 Event Log
- Real-time populating table with all speed-measured detections
- Sortable by frame number, timestamp, or speed
- Filters: vehicle type, violation status, Track ID search
- Paginated (50 rows per page) — handles thousands of events
- **CSV download** and **JSON download** per run

### ⚙️ Configuration Panel
All parameters are editable from the UI before starting a run:

| Section | Parameters |
|---|---|
| Speed Trap | Line 1/2 Y positions · Known distance (m) · Speed limit (km/h) |
| Background Subtraction | Method (MOG2/KNN) · History · Threshold · Shadow detection |
| Contour Filtering | Min/Max area · Aspect ratio · Solidity · Extent |
| Tracking | Max match distance · Max missed frames · Confirm frames |
| Preprocessing | CLAHE · Blur kernel · Warmup frames |

---

## 📁 Project Structure

```
mv/
├── python-service/          # FastAPI + OpenCV (port 8000)
│   ├── main.py              # App entry-point, CORS, lifespan
│   ├── requirements.txt
│   ├── core/
│   │   ├── pipeline.py      # MotionPipeline — full detection loop
│   │   ├── tracker.py       # CentroidTracker (pure numpy)
│   │   └── speed.py         # SpeedEstimator — dual-line crossing
│   ├── routers/
│   │   ├── upload.py        # POST /api/upload · GET /api/videos
│   │   └── process.py       # POST /api/process · WS /api/ws/{id}
│   │                        # GET /api/results/{id}
│   │                        # GET /api/runs/{id}/download/{video|csv|json}
│   ├── db/
│   │   └── database.py      # SQLite schema + async CRUD (aiosqlite)
│   └── models/
│       └── schemas.py       # Pydantic models
│
├── backend/                 # Node.js Socket.io gateway (port 3001)
│   ├── src/
│   │   └── server.ts        # Express + Socket.io → Python WS bridge
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                # React 18 + Vite + TypeScript (port 5173)
│   ├── src/
│   │   ├── App.tsx           # Root + tab navigation
│   │   ├── store/
│   │   │   └── useStore.ts   # Zustand global state
│   │   ├── services/
│   │   │   ├── api.ts        # Typed axios wrappers
│   │   │   └── socketClient.ts  # Socket.io singleton
│   │   ├── components/
│   │   │   ├── upload/       # VideoUploader · VideoList
│   │   │   ├── dashboard/    # ProcessingControl · LiveStats · VideoPlayer · ProgressBar
│   │   │   ├── analytics/    # SpeedChart · TimelineChart · VehicleTypeChart
│   │   │   ├── events/       # EventTable (sortable, filterable, paginated)
│   │   │   └── config/       # ConfigPanel (collapsible sections)
│   │   └── pages/            # DashboardPage · AnalyticsPage · EventsPage · ConfigPage
│   ├── tailwind.config.js
│   └── vite.config.ts
│
└── data/                    # Runtime data (auto-created)
    ├── uploads/             # Raw uploaded videos
    ├── outputs/             # Annotated MP4s + violation snapshots
    └── db/
        └── vehicles.db      # SQLite database
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Python | 3.10+ | 3.14 tested |
| Node.js | 18+ | 24 tested |
| npm | 8+ | |
| OpenCV | 4.8+ | `pip install opencv-python` |

### 1. Clone / Open the Project

```powershell
cd a:\padhai_related\vit\projects\mv
```

### 2. Install Python Dependencies

```powershell
cd python-service
pip install fastapi "uvicorn[standard]" python-multipart aiofiles aiosqlite pydantic
```

> **Note:** `opencv-python` and `numpy` must already be installed (they were pre-installed in this environment).

### 3. Install Node.js Dependencies

```powershell
# Gateway
cd ..\backend
npm install

# Frontend
cd ..\frontend
npm install
```

### 4. Start All Three Services

Open **3 terminal windows**:

**Terminal 1 — Python CV Service**
```powershell
cd a:\padhai_related\vit\projects\mv\python-service
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Node.js Gateway**
```powershell
cd a:\padhai_related\vit\projects\mv\backend
npx ts-node-dev --respawn --transpile-only src/server.ts
```

**Terminal 3 — React Frontend**
```powershell
cd a:\padhai_related\vit\projects\mv\frontend
npm run dev
```

### 5. Open Dashboard

```
http://localhost:5173
```

---

## 🔌 API Reference

Full interactive docs available at **http://localhost:8000/docs** (Swagger UI).

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/upload` | Upload a video file |
| `GET` | `/api/videos` | List all uploaded videos |
| `GET` | `/api/videos/{id}` | Get video + its run history |
| `DELETE` | `/api/videos/{id}` | Delete a video |
| `POST` | `/api/process` | Start processing `{ video_id, config }` |
| `DELETE` | `/api/process/{run_id}` | Cancel an active run |
| `GET` | `/api/process/{run_id}/status` | Poll processing progress |
| `GET` | `/api/results/{run_id}` | Get full results + events |
| `GET` | `/api/runs/{run_id}/download/video` | Download annotated MP4 |
| `GET` | `/api/runs/{run_id}/download/csv` | Download events as CSV |
| `GET` | `/api/runs/{run_id}/download/json` | Download events as JSON |
| `WS` | `/api/ws/{run_id}` | Real-time frame/event stream |
| `GET` | `/outputs/{file}` | Serve annotated videos / snapshots |
| `GET` | `/health` | Health check |

### WebSocket Messages

```jsonc
// Emitted every 5 frames
{ "type": "frame_processed", "frameNumber": 1245, "totalFrames": 3600,
  "progress": 34.6, "processingFps": 18.5, "activeTracks": 3,
  "avgSpeed": 52.3, "maxSpeed": 78.1, "violations": 2,
  "vehicleTypes": { "car": 2, "motorcycle": 0, "truck": 0 },
  "thumbnail": "data:image/jpeg;base64,..." }

// Emitted when a vehicle crosses both speed-trap lines
{ "type": "event_detected", "trackId": 23, "vehicleType": "car",
  "speedKmph": 72.3, "isViolation": true, "frameNumber": 1245,
  "bboxX": 120, "bboxY": 80, "bboxWidth": 180, "bboxHeight": 100 }

// Emitted when processing finishes
{ "type": "processing_complete", "runId": 1 }
```

---

## 🗄️ Database Schema

SQLite at `data/db/vehicles.db`

```sql
videos           -- uploaded videos + metadata
processing_runs  -- each processing job + config snapshot
vehicle_events   -- per-vehicle speed events (one row per speed measurement)
tracks           -- full track trajectories (reserved for future use)
```

---

## ⚡ Performance Notes

- Processing runs in a `ThreadPoolExecutor` — the FastAPI event loop stays non-blocking
- WebSocket uses thread-safe `queue.Queue` bridged to asyncio via `run_in_executor`
- Thumbnail base64 encoded at 320×180 / 70% JPEG quality every 30 frames
- Event table is client-side paginated (50 rows) with in-memory filtering — handles 5,000+ events
- CentroidTracker uses O(n²) greedy sort-and-match — optimal for typical traffic densities (< 20 simultaneous tracks)

---

## 🔧 Tuning Tips

| Scenario | Parameter | Adjust To |
|---|---|---|
| Too many false detections | `minArea` | Increase (e.g. 5000–8000) |
| Missing large vehicles | `maxArea` | Increase (e.g. 200000) |
| Tracks switching IDs | `maxMatchDistance` | Decrease (e.g. 60–80 px) |
| Speed always 0 | `line1Y` / `line2Y` | Place lines in vehicle path |
| Ghosting / shadows | `mog2DetectShadows` | Enable |
| Slow processing | `warmupFrames` | Reduce to 15 |

---

## 🛠️ Tech Stack

| Component | Library |
|---|---|
| CV Processing | OpenCV 4.13 |
| REST + WebSocket API | FastAPI 0.136 + uvicorn |
| Async DB | aiosqlite 0.22 |
| Data Validation | Pydantic v2 |
| WS Gateway | Socket.io 4.7 + ws |
| Frontend Build | Vite 5.3 |
| UI Framework | React 18 + TypeScript |
| Styling | Tailwind CSS v3 |
| Charts | Recharts 2.12 |
| State Management | Zustand 4.5 |
| HTTP Client | Axios |
| File Upload | react-dropzone |
| Icons | Lucide React |

---

## 📄 License

MIT — free to use for academic and research purposes.

---

<div align="center">
Built with ♥ for real-time traffic analytics research
</div>
