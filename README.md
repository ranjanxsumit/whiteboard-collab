# Collaborative Whiteboard

Real-time collaborative whiteboard built with MERN + Socket.io. Supports incremental stroke streaming, cursor presence, and persistent room history.

## Features
- Join/create rooms by simple 6-8 char code
- Live multi-user drawing (pencil only) with color + stroke width
- Real-time cursor tracking
- Canvas clear & persistence of strokes per room
- Automatic cleanup of inactive rooms (>24h)

## Tech Stack
- Backend: Node.js, Express, Socket.io, MongoDB (Mongoose)
- Frontend: React (Vite), socket.io-client, Axios

## Quick Start
1. Copy `.env.example` to `.env` (root or `server/`) and fill variables.
2. Install dependencies:
	```
	npm install
	```
3. Start dev (concurrent client + server):
	```
	npm run dev
	```
4. Open `http://localhost:5173`.

## How to Run (Detailed)

### 1. One-command dev (recommended)
```
npm install
npm run dev
```
Opens client at http://localhost:5173 (proxying /api to server at :4000).

### 2. Run server only
```
npm run dev:server
```
Server available at http://localhost:4000
Test health:
```
curl http://localhost:4000/health
```

### 3. Run client only
```
npm run dev:client
```
Then open http://localhost:5173

### 4. Create / join a room
Use UI (enter code) or API:
```
curl -X POST http://localhost:4000/api/rooms/join \
	-H "Content-Type: application/json" \
	-d '{"roomId":"abc123"}'
```

### 5. Production build (client)
```
cd client
npm run build
```
Outputs `client/dist/` (deploy to static hosting / behind CDN). Run server separately (`npm run start --workspace=server`).

### 6. Environment files
- Root or server `.env` holds: PORT, MONGODB_URI, CORS_ORIGIN.
- Client `.env` (optional) only non-secret `VITE_*` vars.
	- `VITE_SOCKET_URL` (optional) explicit Socket.IO backend URL (defaults to `http://localhost:4000`). Set this in production if API domain differs.

### 7. Common issues
| Symptom | Fix |
|---------|-----|
| Mongo connection error | Check `MONGODB_URI` & IP allowlist in Atlas |
| CORS error in browser | Ensure `CORS_ORIGIN` includes frontend URL |
| Socket not connecting | Confirm ports 4000/5173 running; check browser console |
| Blank canvas after join | Inspect network tab; verify `init-data` socket event |

### 8. Lint / tests
No linters or tests configured yet; can add ESLint/Jest if needed.

## Environment Variables
Server (.env):
PORT=4000
MONGODB_URI=mongodb://127.0.0.1:27017/whiteboard_dev
CORS_ORIGIN=http://localhost:5173

Client (.env):
VITE_API_BASE=/api

## REST API

Base URL: `http://<server-host>:4000/api`

| Method | Path | Body | Response | Notes |
|--------|------|------|----------|-------|
| POST | `/rooms/join` | `{ roomId }` | `{ roomId }` | Creates if absent (6–8 alnum). Lowercased normalization. |
| GET | `/rooms/:roomId` | – | `{ roomId, createdAt, lastActivity, strokes }` | 404 if not found. Validation on code format. |

Validation: `roomId` must match `/^[a-zA-Z0-9]{6,8}$/`.

## Socket API

Namespace: default (`/`), rooms joined via `roomId`.

### Outgoing (Client → Server)
| Event | Payload | Description |
|-------|---------|-------------|
| `join-room` | `{ roomId }` | Join logical drawing room. |
| `cursor-move` | `{ x, y }` | Throttled (~60fps) cursor position; server adds color & userId. |
| `draw-start` | `{ color, width }` | Begin stroke; metadata broadcast to peers. |
| `draw-move` | `{ points: [{x,y}, ...] }` | Batched incremental stroke points (1+). |
| `draw-end` | `{ points: [...], color, width }` | Final stroke (persisted). |
| `clear-canvas` | `{}` | Clears and persists clear command. |

### Incoming (Server → Client)
| Event | Payload | Description |
|-------|---------|-------------|
| `user-count` | `{ count }` | Current connected users in room. |
| `init-data` | `[ DrawingCommand ]` | Historical commands on join. |
| `cursor-move` | `{ userId, x, y, color }` | Peer cursor update. |
| `draw-start` | `{ userId, color, width }` | Peer stroke start. |
| `draw-move` | `{ userId, points:[...] }` | Batched incremental points. |
| `draw-end` | `{ userId, points:[...], color, width }` | Finalized stroke. |
| `clear-canvas` | `{}` | Clear signal. |

### Drawing Command Schema
`DrawingCommand` (persisted):
```
{ type: 'stroke', data: { points:[{x,y},...], color, width }, timestamp } | { type:'clear', data:{}, timestamp }
```

## Data Model
Room:
{ roomId, createdAt, lastActivity, drawingData: [ DrawingCommand ] }

DrawingCommand:
{ type: 'stroke' | 'clear', data: { points?, color?, width? }, timestamp }

## Architecture Overview

### High-Level Flow
1. Client joins room (REST optional; primary via socket `join-room`).
2. Server assigns / reuses a color for the socket, broadcasts `user-count`.
3. Server sends historical `init-data` (drawing commands) for reconstruction.
4. Active drawing streams via incremental `draw-move` batches; peers render segments immediately.
5. On `draw-end`, server persists stroke to Mongo for late joiners & pruning strategy keeps recent history.

### Components
| Layer | Responsibility |
|-------|----------------|
| Client React | UI, canvas rendering, input capture, batching, interpolation smoothing. |
| Socket.io Server | Real-time relay, room membership, color assignment, persistence trigger. |
| Express REST | Minimal room lifecycle endpoints & health. |
| MongoDB | Durable storage of drawing timeline (commands). |

### Persistence Strategy
- Append-only command list; late joiners replay list.
- Periodic pruning (>5000 → keep last 4000) to cap memory / payload.
- Clear stored as command (enables timeline continuity).

### Performance Techniques
- requestAnimationFrame batching for cursor + stroke point emission.
- Batched point arrays reduce per-event overhead.
- Incremental canvas segment rendering (no full canvas data transfer).
- Simple gap interpolation for remote point smoothing.

### Failure / Edge Handling
- Input validation on room codes.
- Duplicate room creation race handled (Mongo unique error). 
- Socket disconnect updates counts & frees color mapping.
- If persistence fails, real-time still works (best-effort logging).

## Deployment Guide

### 1. Build & Bundle
```
npm install
cd client && npm run build && cd ..
```
Serve `client/dist` via:
- Static file host (Netlify / Vercel / S3+CloudFront) OR
- Express static middleware (optional integration step).

### 2. Server Runtime
```
NODE_ENV=production PORT=4000 node server/server.js
```
Recommended: PM2 / systemd for process supervision.

### 3. Environment Hardening
| Variable | Recommendation |
|----------|---------------|
| MONGODB_URI | Use dedicated production cluster / replica set. |
| CORS_ORIGIN | Exact HTTPS frontend origin (no wildcard). |
| PORT | Behind reverse proxy (Nginx/Traefik) for TLS. |

### 4. Scaling
| Concern | Action |
|---------|--------|
| Socket load | Sticky sessions (IP hash) + multiple Node instances. |
| Horizontal scale | Use Redis adapter for Socket.io pub/sub. |
| Persistence contention | Separate write worker if commands high volume. |
| Cleanup | External cron hitting maintenance endpoint instead of in-process timer. |

### 5. Security & Hardening
- Rate limit join endpoint (ex: express-rate-limit) to mitigate brute force room scans.
- Add room auth / tokens for private boards.
- Enforce HTTPS & secure cookies if auth added.

### 6. Observability
- Add log aggregation (Winston + stdout to CloudWatch/ELK).
- Basic metrics: stroke rate, avg room size, command replay time.

### 7. Zero-Downtime Deploy
1. Spin up new server version.
2. Warm readiness (DB connect ok, health endpoint returns 200).
3. Shift traffic (load balancer weight).
4. Drain old sockets (graceful close after timeout).

## Advanced Roadmap
- Undo/redo with stroke IDs
- Offline queue & reconciling
- Tool plugins (shape, text, image import)
- Differential sync w/ CRDT for shapes
- Export board (PNG / SVG composite)

## Future Improvements
- Authentication & user naming
- Undo/redo stack
- Additional tools (shapes, text, eraser)
- Compression / delta encoding for strokes
- Collaborative presence avatars

---
Status: MVP complete; production hardening steps outlined above.
