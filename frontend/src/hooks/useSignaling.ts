'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import {
    SignalingMessage,
    PeerListMessage,
    PeerJoinedMessage,
    PeerLeftMessage,
    OfferMessage,
    AnswerMessage,
    CandidateMessage,
    PeerInfo,
} from '@/types';

const SIGNALING_URL = process.env.NEXT_PUBLIC_SIGNALING_URL || 'ws://localhost:3001';

export function useSignaling() {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const {
        peerId,
        roomId,
        username,
        setPeerId,
        setConnected,
        setPeers,
        addPeer,
        removePeer,
        addLog,
    } = useStore();

    // Refs to hold latest state for callbacks without triggering re-renders
    const stateRef = useRef({ peerId, roomId, username });
    useEffect(() => {
        stateRef.current = { peerId, roomId, username };
    }, [peerId, roomId, username]);

    const messageHandlersRef = useRef<{
        onOffer?: (msg: OfferMessage) => void;
        onAnswer?: (msg: AnswerMessage) => void;
        onCandidate?: (msg: CandidateMessage) => void;
        onPeerJoined?: (msg: PeerJoinedMessage) => void;
        onPeerLeft?: (msg: PeerLeftMessage) => void;
        onPeerList?: (peers: PeerInfo[]) => void;
    }>({});

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        const ws = new WebSocket(SIGNALING_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('[Signaling] Connected');
            addLog('success', 'Connected to signaling server');
            setConnected(true);
        };

        ws.onclose = () => {
            console.log('[Signaling] Disconnected');
            addLog('warn', 'Disconnected from signaling server');
            setConnected(false);
            setPeerId(null);

            // Attempt reconnect after 3 seconds
            reconnectTimeoutRef.current = setTimeout(() => {
                if (stateRef.current.roomId) {
                    addLog('info', 'Attempting to reconnect...');
                    connect();
                }
            }, 3000);
        };

        ws.onerror = (error) => {
            console.error('[Signaling] Error:', error);
            addLog('error', 'Signaling connection error');
        };

        ws.onmessage = (event) => {
            try {
                const message: SignalingMessage = JSON.parse(event.data);
                handleMessage(message);
            } catch (error) {
                console.error('[Signaling] Failed to parse message:', error);
                addLog('error', 'Failed to parse signaling message');
            }
        };
    }, [setConnected, setPeerId, addLog]); // Removed roomId dependency

    const handleMessage = useCallback((message: SignalingMessage) => {
        switch (message.type) {
            case 'peer-list': {
                const { payload } = message as PeerListMessage;
                const filteredPeers = payload.filter(p => p.id !== stateRef.current.peerId);
                setPeers(filteredPeers);
                addLog('info', `Received peer list: ${filteredPeers.length} peers`);
                messageHandlersRef.current.onPeerList?.(filteredPeers);
                break;
            }

            case 'peer-joined': {
                const { payload } = message as PeerJoinedMessage;
                if (payload.id !== stateRef.current.peerId) {
                    addPeer(payload);
                    addLog('info', `Peer joined: ${payload.username || payload.id}`);
                    messageHandlersRef.current.onPeerJoined?.(message as PeerJoinedMessage);
                }
                break;
            }

            case 'peer-left': {
                const { payload } = message as PeerLeftMessage;
                removePeer(payload.peerId);
                addLog('info', `Peer left: ${payload.peerId}`);
                messageHandlersRef.current.onPeerLeft?.(message as PeerLeftMessage);
                break;
            }

            case 'offer': {
                messageHandlersRef.current.onOffer?.(message as OfferMessage);
                break;
            }

            case 'answer': {
                messageHandlersRef.current.onAnswer?.(message as AnswerMessage);
                break;
            }

            case 'candidate': {
                messageHandlersRef.current.onCandidate?.(message as CandidateMessage);
                break;
            }

            case 'error': {
                console.error('[Signaling] Error:', message.payload);
                addLog('error', `Signaling error: ${JSON.stringify(message.payload)}`);
                break;
            }
        }
    }, [setPeers, addPeer, removePeer, addLog]);

    const joinRoom = useCallback((targetRoomId: string, name: string) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            console.error('[Signaling] Not connected');
            addLog('error', 'Cannot join room: Not connected to signaling server');
            return;
        }

        const newPeerId = Math.random().toString(36).slice(2) + Date.now().toString(36);
        setPeerId(newPeerId);

        const joinMessage: SignalingMessage = {
            type: 'join',
            roomId: targetRoomId,
            senderId: newPeerId,
            payload: { username: name },
        };

        wsRef.current.send(JSON.stringify(joinMessage));
        addLog('info', `Joining room ${targetRoomId} as ${name}`);
    }, [setPeerId, addLog]);

    const leaveRoom = useCallback(() => {
        const { roomId, peerId } = stateRef.current;
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !roomId || !peerId) {
            return;
        }

        const leaveMessage: SignalingMessage = {
            type: 'leave',
            roomId,
            senderId: peerId,
        };

        wsRef.current.send(JSON.stringify(leaveMessage));
    }, []); // No dependencies needed as we use stateRef

    const sendOffer = useCallback((targetId: string, offer: RTCSessionDescriptionInit) => {
        const { roomId, peerId } = stateRef.current;
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !roomId || !peerId) return;

        const message: OfferMessage = {
            type: 'offer',
            roomId,
            senderId: peerId,
            targetId,
            payload: offer,
        };

        wsRef.current.send(JSON.stringify(message));
    }, []);

    const sendAnswer = useCallback((targetId: string, answer: RTCSessionDescriptionInit) => {
        const { roomId, peerId } = stateRef.current;
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !roomId || !peerId) return;

        const message: AnswerMessage = {
            type: 'answer',
            roomId,
            senderId: peerId,
            targetId,
            payload: answer,
        };

        wsRef.current.send(JSON.stringify(message));
    }, []);

    const sendCandidate = useCallback((targetId: string, candidate: RTCIceCandidateInit) => {
        const { roomId, peerId } = stateRef.current;
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !roomId || !peerId) return;

        const message: CandidateMessage = {
            type: 'candidate',
            roomId,
            senderId: peerId,
            targetId,
            payload: candidate,
        };

        wsRef.current.send(JSON.stringify(message));
    }, []);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        leaveRoom();
        wsRef.current?.close();
        wsRef.current = null;
    }, [leaveRoom]);

    const setMessageHandlers = useCallback((handlers: typeof messageHandlersRef.current) => {
        messageHandlersRef.current = handlers;
    }, []);

    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    return {
        connect,
        disconnect,
        joinRoom,
        leaveRoom,
        sendOffer,
        sendAnswer,
        sendCandidate,
        setMessageHandlers,
    };
}
