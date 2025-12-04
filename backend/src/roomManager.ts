import { Room, ExtendedWebSocket, PeerInfo, PeerListMessage, PeerJoinedMessage, PeerLeftMessage } from './types';

class RoomManager {
    private rooms: Map<string, Room> = new Map();

    createRoom(roomId: string): Room {
        const room: Room = {
            id: roomId,
            peers: new Map(),
            createdAt: Date.now(),
        };
        this.rooms.set(roomId, room);
        return room;
    }

    getRoom(roomId: string): Room | undefined {
        return this.rooms.get(roomId);
    }

    roomExists(roomId: string): boolean {
        return this.rooms.has(roomId);
    }

    joinRoom(roomId: string, ws: ExtendedWebSocket): boolean {
        let room = this.rooms.get(roomId);

        // Auto-create room if it doesn't exist
        if (!room) {
            room = this.createRoom(roomId);
        }

        // Add peer to room
        room.peers.set(ws.id, ws);
        ws.roomId = roomId;

        // Notify existing peers about new peer
        const newPeerInfo: PeerInfo = {
            id: ws.id,
            username: ws.username,
            joinedAt: Date.now(),
        };

        const peerJoinedMessage: PeerJoinedMessage = {
            type: 'peer-joined',
            roomId,
            senderId: 'server',
            payload: newPeerInfo,
        };

        this.broadcastToRoom(roomId, JSON.stringify(peerJoinedMessage), ws.id);

        // Send peer list to the new peer
        const peerList = this.getPeerList(roomId);
        const peerListMessage: PeerListMessage = {
            type: 'peer-list',
            roomId,
            senderId: 'server',
            payload: peerList,
        };

        ws.send(JSON.stringify(peerListMessage));

        return true;
    }

    leaveRoom(ws: ExtendedWebSocket): void {
        if (!ws.roomId) return;

        const room = this.rooms.get(ws.roomId);
        if (!room) return;

        // Remove peer from room
        room.peers.delete(ws.id);

        // Notify remaining peers
        const peerLeftMessage: PeerLeftMessage = {
            type: 'peer-left',
            roomId: ws.roomId,
            senderId: 'server',
            payload: { peerId: ws.id },
        };

        this.broadcastToRoom(ws.roomId, JSON.stringify(peerLeftMessage));

        // Clean up empty rooms
        if (room.peers.size === 0) {
            this.rooms.delete(ws.roomId);
        }

        ws.roomId = undefined;
    }

    getPeerList(roomId: string): PeerInfo[] {
        const room = this.rooms.get(roomId);
        if (!room) return [];

        const peers: PeerInfo[] = [];
        room.peers.forEach((ws, id) => {
            peers.push({
                id,
                username: ws.username,
                joinedAt: Date.now(), // We don't track join time per peer, using current time
            });
        });

        return peers;
    }

    broadcastToRoom(roomId: string, message: string, excludePeerId?: string): void {
        const room = this.rooms.get(roomId);
        if (!room) return;

        room.peers.forEach((ws, id) => {
            if (id !== excludePeerId && ws.readyState === ws.OPEN) {
                ws.send(message);
            }
        });
    }

    sendToPeer(roomId: string, peerId: string, message: string): boolean {
        const room = this.rooms.get(roomId);
        if (!room) return false;

        const peer = room.peers.get(peerId);
        if (!peer || peer.readyState !== peer.OPEN) return false;

        peer.send(message);
        return true;
    }

    getPeerSocket(roomId: string, peerId: string): ExtendedWebSocket | undefined {
        const room = this.rooms.get(roomId);
        if (!room) return undefined;
        return room.peers.get(peerId);
    }

    getRoomCount(): number {
        return this.rooms.size;
    }

    getTotalPeerCount(): number {
        let count = 0;
        this.rooms.forEach((room) => {
            count += room.peers.size;
        });
        return count;
    }

    // Clean up stale rooms (rooms older than 24 hours with no peers)
    cleanupStaleRooms(): void {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        this.rooms.forEach((room, roomId) => {
            if (room.peers.size === 0 && now - room.createdAt > maxAge) {
                this.rooms.delete(roomId);
            }
        });
    }
}

export const roomManager = new RoomManager();
