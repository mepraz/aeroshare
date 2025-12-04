import WebSocket from 'ws';

// Signaling message types
export type SignalingMessageType =
    | 'join'
    | 'leave'
    | 'offer'
    | 'answer'
    | 'candidate'
    | 'peer-list'
    | 'peer-joined'
    | 'peer-left'
    | 'error';

// Base signaling message structure
export interface SignalingMessage {
    type: SignalingMessageType;
    roomId: string;
    senderId: string;
    targetId?: string;
    payload?: unknown;
}

// Join message
export interface JoinMessage extends SignalingMessage {
    type: 'join';
    payload: {
        username?: string;
    };
}

// Offer message (WebRTC SDP offer)
export interface OfferMessage extends SignalingMessage {
    type: 'offer';
    targetId: string;
    payload: unknown; // RTCSessionDescriptionInit - browser type
}

// Answer message (WebRTC SDP answer)
export interface AnswerMessage extends SignalingMessage {
    type: 'answer';
    targetId: string;
    payload: unknown; // RTCSessionDescriptionInit - browser type
}

// ICE Candidate message
export interface CandidateMessage extends SignalingMessage {
    type: 'candidate';
    targetId: string;
    payload: unknown; // RTCIceCandidateInit - browser type
}

// Peer info
export interface PeerInfo {
    id: string;
    username?: string;
    joinedAt: number;
}

// Peer list message
export interface PeerListMessage extends SignalingMessage {
    type: 'peer-list';
    payload: PeerInfo[];
}

// Peer joined message
export interface PeerJoinedMessage extends SignalingMessage {
    type: 'peer-joined';
    payload: PeerInfo;
}

// Peer left message
export interface PeerLeftMessage extends SignalingMessage {
    type: 'peer-left';
    payload: {
        peerId: string;
    };
}

// Error message
export interface ErrorMessage extends SignalingMessage {
    type: 'error';
    payload: {
        code: string;
        message: string;
    };
}

// Extended WebSocket with peer info
export interface ExtendedWebSocket extends WebSocket {
    id: string;
    roomId?: string;
    username?: string;
    isAlive: boolean;
}

// Room structure
export interface Room {
    id: string;
    peers: Map<string, ExtendedWebSocket>;
    createdAt: number;
}

// API response types
export interface CreateRoomResponse {
    roomId: string;
}

export interface HealthResponse {
    status: 'ok';
    uptime: number;
    rooms: number;
    peers: number;
}
