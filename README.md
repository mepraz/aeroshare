# Aeroshare

A serverless-style P2P file-sharing application that transfers files directly between peers using WebRTC DataChannels. No file storage on servers - pure peer-to-peer transfer.

## Features

- 🚀 **Lightning Fast** - Direct peer-to-peer file transfer
- 🔒 **Secure** - End-to-end encrypted via WebRTC
- 👥 **Multi-Peer** - Share with multiple people simultaneously
- 💬 **Chat** - Built-in text messaging
- 📱 **QR Code** - Easy room sharing via QR code
- 📊 **Progress Tracking** - Real-time transfer progress

## Architecture

```
📁 aeroshare/
├── 📁 backend/          # Node.js signaling server
│   ├── src/
│   │   ├── server.ts    # Express + WebSocket server
│   │   ├── roomManager.ts
│   │   └── types.ts
│   └── package.json
│
├── 📁 frontend/         # Next.js 14 app
│   ├── src/
│   │   ├── app/         # App Router pages
│   │   ├── hooks/       # WebRTC, Signaling, Room hooks
│   │   ├── store/       # Zustand state
│   │   └── types/       # TypeScript types
│   └── package.json
│
└── README.md
```

## Quick Start

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

The signaling server will start at `http://localhost:3001`.

### 2. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

The frontend will start at `http://localhost:3000`.

## Environment Variables

### Backend (`.env`)

```env
PORT=3001
CORS_ORIGIN=http://localhost:3000
```

### Frontend (`.env.local`)

```env
NEXT_PUBLIC_SIGNALING_URL=ws://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Deployment

### Backend on Render

1. Create a new **Web Service** on [Render](https://render.com)
2. Connect your repository
3. Configure:
   - **Build Command**: `cd backend && npm install && npm run build`
   - **Start Command**: `cd backend && npm start`
4. Add environment variables:
   - `PORT`: Leave empty (Render sets this)
   - `CORS_ORIGIN`: Your Vercel frontend URL (e.g., `https://aeroshare.vercel.app`)

### Backend on Railway

1. Create a new project on [Railway](https://railway.app)
2. Deploy from GitHub
3. Set root directory to `/backend`
4. Add environment variables:
   - `CORS_ORIGIN`: Your Vercel frontend URL

### Backend on Fly.io

```bash
cd backend
fly launch
fly secrets set CORS_ORIGIN=https://your-frontend.vercel.app
fly deploy
```

### Frontend on Vercel

1. Import your repository on [Vercel](https://vercel.com)
2. Set root directory to `frontend`
3. Add environment variables:
   - `NEXT_PUBLIC_SIGNALING_URL`: Your deployed backend WebSocket URL (e.g., `wss://aeroshare-backend.onrender.com`)
   - `NEXT_PUBLIC_API_URL`: Your deployed backend HTTPS URL (e.g., `https://aeroshare-backend.onrender.com`)

> **Note**: Use `wss://` for WebSocket and `https://` for the API URL in production.

## How It Works

### File Transfer Protocol

1. **Sender** reads file in 64KB chunks
2. Sends metadata first:
   ```json
   { "type": "file-start", "metadata": { "filename": "...", "size": ..., "mime": "..." } }
   ```
3. Streams chunks as base64:
   ```json
   { "type": "chunk", "fileId": "...", "index": 0, "data": "<base64>" }
   ```
4. Sends completion signal:
   ```json
   { "type": "done", "fileId": "..." }
   ```

### WebSocket Message Types

| Type | Direction | Description |
|------|-----------|-------------|
| `join` | Client → Server | Join a room |
| `leave` | Client → Server | Leave a room |
| `offer` | Peer → Peer | WebRTC SDP offer |
| `answer` | Peer → Peer | WebRTC SDP answer |
| `candidate` | Peer → Peer | ICE candidate |
| `peer-list` | Server → Client | List of peers in room |
| `peer-joined` | Server → Clients | New peer notification |
| `peer-left` | Server → Clients | Peer left notification |

## Tech Stack

### Backend
- Node.js + TypeScript
- Express
- WebSocket (ws)
- UUID

### Frontend
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Zustand
- WebRTC

- and some mindfucks obn deployments and hostig.
- qrcode.react

## License

MIT
