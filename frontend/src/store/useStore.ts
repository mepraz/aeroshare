import { create } from 'zustand';
import {
    PeerInfo,
    ChatMessage,
    FileTransfer,
    PeerConnection,
} from '@/types';

export interface LogEntry {
    id: string;
    timestamp: number;
    level: 'info' | 'warn' | 'error' | 'success';
    message: string;
}

interface AppState {
    // Connection state
    peerId: string | null;
    username: string;
    roomId: string | null;
    isConnected: boolean;

    // Peers
    peers: PeerInfo[];
    peerConnections: Map<string, PeerConnection>;

    // Chat
    messages: ChatMessage[];

    // File transfers
    transfers: FileTransfer[];

    // Logs
    logs: LogEntry[];

    // Actions
    setPeerId: (id: string | null) => void;
    setUsername: (name: string) => void;
    setRoomId: (id: string | null) => void;
    setConnected: (connected: boolean) => void;

    // Peer actions
    setPeers: (peers: PeerInfo[]) => void;
    addPeer: (peer: PeerInfo) => void;
    removePeer: (peerId: string) => void;
    setPeerConnection: (peerId: string, connection: PeerConnection) => void;
    removePeerConnection: (peerId: string) => void;
    updatePeerConnection: (peerId: string, updates: Partial<PeerConnection>) => void;

    // Chat actions
    addMessage: (message: ChatMessage) => void;
    clearMessages: () => void;

    // Transfer actions
    addTransfer: (transfer: FileTransfer) => void;
    updateTransfer: (id: string, updates: Partial<FileTransfer>) => void;
    removeTransfer: (id: string) => void;
    clearTransfers: () => void;

    // Log actions
    addLog: (level: LogEntry['level'], message: string) => void;
    clearLogs: () => void;

    // Reset
    reset: () => void;
}

const initialState = {
    peerId: null,
    username: '',
    roomId: null,
    isConnected: false,
    peers: [],
    peerConnections: new Map(),
    messages: [],
    transfers: [],
    logs: [],
};

export const useStore = create<AppState>((set, get) => ({
    ...initialState,

    setPeerId: (id) => set({ peerId: id }),
    setUsername: (name) => set({ username: name }),
    setRoomId: (id) => set({ roomId: id }),
    setConnected: (connected) => set({ isConnected: connected }),

    setPeers: (peers) => set({ peers }),

    addPeer: (peer) => set((state) => ({
        peers: [...state.peers.filter(p => p.id !== peer.id), peer],
    })),

    removePeer: (peerId) => set((state) => ({
        peers: state.peers.filter(p => p.id !== peerId),
    })),

    setPeerConnection: (peerId, connection) => set((state) => {
        const newMap = new Map(state.peerConnections);
        newMap.set(peerId, connection);
        return { peerConnections: newMap };
    }),

    removePeerConnection: (peerId) => set((state) => {
        const newMap = new Map(state.peerConnections);
        const pc = newMap.get(peerId);
        if (pc) {
            pc.dataChannel?.close();
            pc.connection.close();
        }
        newMap.delete(peerId);
        return { peerConnections: newMap };
    }),

    updatePeerConnection: (peerId, updates) => set((state) => {
        const newMap = new Map(state.peerConnections);
        const existing = newMap.get(peerId);
        if (existing) {
            newMap.set(peerId, { ...existing, ...updates });
        }
        return { peerConnections: newMap };
    }),

    addMessage: (message) => set((state) => ({
        messages: [...state.messages, message],
    })),

    clearMessages: () => set({ messages: [] }),

    addTransfer: (transfer) => set((state) => ({
        transfers: [...state.transfers, transfer],
    })),

    updateTransfer: (id, updates) => set((state) => ({
        transfers: state.transfers.map(t =>
            t.id === id ? { ...t, ...updates } : t
        ),
    })),

    removeTransfer: (id) => set((state) => ({
        transfers: state.transfers.filter(t => t.id !== id),
    })),

    clearTransfers: () => set({ transfers: [] }),

    reset: () => {
        const { peerConnections } = get();
        peerConnections.forEach(pc => {
            pc.dataChannel?.close();
            pc.connection.close();
        });
        set({ ...initialState, peerConnections: new Map() });
    },

    // Logs
    addLog: (level, message) => set((state) => ({
        logs: [...state.logs, {
            id: Math.random().toString(36).slice(2) + Date.now().toString(36),
            timestamp: Date.now(),
            level,
            message,
        }],
    })),

    clearLogs: () => set({ logs: [] }),
}));
