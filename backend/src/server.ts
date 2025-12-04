import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { roomManager } from './roomManager';
import {
    ExtendedWebSocket,
    SignalingMessage,
    CreateRoomResponse,
    HealthResponse,
    ErrorMessage,
} from './types';

const app = express();
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// Middleware
app.use(cors({
    origin: CORS_ORIGIN.split(',').map(s => s.trim()),
    methods: ['GET', 'POST'],
    credentials: true,
}));
app.use(express.json());

// HTTP Routes
app.get('/', (_req, res) => {
    res.json({
        name: 'AeroShare Signaling Server',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            health: '/health',
            createRoom: 'POST /create-room',
            websocket: 'ws:// or wss://',
        },
        cors: CORS_ORIGIN.split(',').map(s => s.trim()),
        uptime: process.uptime(),
    });
});

app.post('/create-room', (_req, res) => {
    const roomId = uuidv4().substring(0, 8); // Short room ID
    roomManager.createRoom(roomId);

    const response: CreateRoomResponse = { roomId };
    res.json(response);
});

app.get('/health', (_req, res) => {
    const response: HealthResponse = {
        status: 'ok',
        uptime: process.uptime(),
        rooms: roomManager.getRoomCount(),
        peers: roomManager.getTotalPeerCount(),
    };
    res.json(response);
});

// Create HTTP server
const server = http.createServer(app);

// WebSocket Server
const wss = new WebSocketServer({ server });

// Heartbeat interval (30 seconds)
const HEARTBEAT_INTERVAL = 30000;

function heartbeat(this: ExtendedWebSocket) {
    this.isAlive = true;
}

// Ping all clients periodically
const heartbeatIntervalId = setInterval(() => {
    wss.clients.forEach((ws) => {
        const extWs = ws as ExtendedWebSocket;
        if (!extWs.isAlive) {
            roomManager.leaveRoom(extWs);
            return extWs.terminate();
        }
        extWs.isAlive = false;
        extWs.ping();
    });
}, HEARTBEAT_INTERVAL);

wss.on('close', () => {
    clearInterval(heartbeatIntervalId);
});

wss.on('connection', (ws: WebSocket) => {
    const extWs = ws as ExtendedWebSocket;
    extWs.id = uuidv4();
    extWs.isAlive = true;

    console.log(`[WS] New connection: ${extWs.id}`);

    extWs.on('pong', () => { extWs.isAlive = true; });

    extWs.on('message', (data) => {
        try {
            const message: SignalingMessage = JSON.parse(data.toString());
            handleSignalingMessage(extWs, message);
        } catch (error) {
            console.error('[WS] Invalid message format:', error);
            sendError(extWs, 'INVALID_MESSAGE', 'Invalid message format');
        }
    });

    extWs.on('close', () => {
        console.log(`[WS] Connection closed: ${extWs.id}`);
        roomManager.leaveRoom(extWs);
    });

    extWs.on('error', (error) => {
        console.error(`[WS] Error for ${extWs.id}:`, error);
        roomManager.leaveRoom(extWs);
    });
});

function handleSignalingMessage(ws: ExtendedWebSocket, message: SignalingMessage): void {
    const { type, roomId, targetId, payload } = message;

    switch (type) {
        case 'join': {
            const joinPayload = payload as { username?: string } | undefined;
            ws.username = joinPayload?.username || `Peer-${ws.id.substring(0, 4)}`;
            roomManager.joinRoom(roomId, ws);
            console.log(`[WS] ${ws.username} joined room ${roomId}`);
            break;
        }

        case 'leave': {
            roomManager.leaveRoom(ws);
            console.log(`[WS] ${ws.username || ws.id} left room ${roomId}`);
            break;
        }

        case 'offer':
        case 'answer':
        case 'candidate': {
            if (!targetId) {
                sendError(ws, 'MISSING_TARGET', 'Target peer ID is required');
                return;
            }

            // Forward the message to the target peer
            const forwardMessage: SignalingMessage = {
                type,
                roomId,
                senderId: ws.id,
                targetId,
                payload,
            };

            const sent = roomManager.sendToPeer(roomId, targetId, JSON.stringify(forwardMessage));
            if (!sent) {
                sendError(ws, 'PEER_NOT_FOUND', `Target peer ${targetId} not found`);
            }
            break;
        }

        default:
            sendError(ws, 'UNKNOWN_TYPE', `Unknown message type: ${type}`);
    }
}

function sendError(ws: ExtendedWebSocket, code: string, errorMessage: string): void {
    const error: ErrorMessage = {
        type: 'error',
        roomId: ws.roomId || '',
        senderId: 'server',
        payload: { code, message: errorMessage },
    };
    ws.send(JSON.stringify(error));
}

// Cleanup stale rooms every hour
setInterval(() => {
    roomManager.cleanupStaleRooms();
}, 60 * 60 * 1000);

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Aeroshare signaling server running on port ${PORT}`);
    console.log(`📡 WebSocket server ready`);
    console.log(`🌐 CORS origin: ${CORS_ORIGIN}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    wss.close();
    server.close(() => {
        process.exit(0);
    });
});
