// Signaling message types (matching backend)
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

export interface SignalingMessage {
    type: SignalingMessageType;
    roomId: string;
    senderId: string;
    targetId?: string;
    payload?: unknown;
}

export interface PeerInfo {
    id: string;
    username?: string;
    joinedAt: number;
}

export interface PeerListMessage extends SignalingMessage {
    type: 'peer-list';
    payload: PeerInfo[];
}

export interface PeerJoinedMessage extends SignalingMessage {
    type: 'peer-joined';
    payload: PeerInfo;
}

export interface PeerLeftMessage extends SignalingMessage {
    type: 'peer-left';
    payload: { peerId: string };
}

export interface OfferMessage extends SignalingMessage {
    type: 'offer';
    payload: RTCSessionDescriptionInit;
}

export interface AnswerMessage extends SignalingMessage {
    type: 'answer';
    payload: RTCSessionDescriptionInit;
}

export interface CandidateMessage extends SignalingMessage {
    type: 'candidate';
    payload: RTCIceCandidateInit;
}

export interface ErrorMessage extends SignalingMessage {
    type: 'error';
    payload: { code: string; message: string };
}

// File transfer types
export interface FileMetadata {
    id: string;
    filename: string;
    size: number;
    mime: string;
    senderId: string;
    senderName?: string;
}

export interface FileChunk {
    type: 'chunk';
    fileId: string;
    index: number;
    data: string; // base64 encoded
}

export interface FileComplete {
    type: 'done';
    fileId: string;
}

export interface FileStart {
    type: 'file-start';
    metadata: FileMetadata;
}

export type DataChannelMessage =
    | FileStart
    | FileChunk
    | FileComplete
    | ChatMessage;

export interface ChatMessage {
    type: 'chat';
    id: string;
    senderId: string;
    senderName: string;
    content: string;
    timestamp: number;
}

// Transfer state
export interface FileTransfer {
    id: string;
    filename: string;
    size: number;
    mime: string;
    progress: number; // 0-100
    status: 'pending' | 'transferring' | 'completed' | 'failed';
    direction: 'send' | 'receive';
    peerId: string;
    peerName?: string;
    chunks?: Uint8Array[];
    blob?: Blob;
    error?: string;
    timestamp: number; // When the transfer started
}

// Peer connection state
export interface PeerConnection {
    id: string;
    username?: string;
    connection: RTCPeerConnection;
    dataChannel?: RTCDataChannel;
    connected: boolean;
}

// API types
export interface CreateRoomResponse {
    roomId: string;
}
