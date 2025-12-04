'use client';

import { useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { useWebRTC } from './useWebRTC';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function useRoom() {
    const {
        roomId,
        username,
        isConnected,
        peers,
        peerConnections,
        setRoomId,
        setUsername,
        reset,
    } = useStore();

    const {
        connect,
        disconnect,
        joinRoom: signalingJoin,
        leaveRoom: signalingLeave,
        sendChatMessage,
        sendFile,
    } = useWebRTC();

    const createRoom = useCallback(async (): Promise<string | null> => {
        try {
            const response = await fetch(`${API_URL}/create-room`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) {
                throw new Error('Failed to create room');
            }

            const { roomId: newRoomId } = await response.json();
            return newRoomId;
        } catch (error) {
            console.error('[Room] Failed to create room:', error);
            return null;
        }
    }, []);

    const joinRoom = useCallback(async (targetRoomId: string, name: string) => {
        setRoomId(targetRoomId);
        setUsername(name);

        // Connect to signaling server
        connect();

        // Wait for connection then join
        setTimeout(() => {
            signalingJoin(targetRoomId, name);
        }, 500);
    }, [connect, signalingJoin, setRoomId, setUsername]);

    const leaveRoom = useCallback(() => {
        signalingLeave();
        disconnect();
        reset();
    }, [signalingLeave, disconnect, reset]);

    const getConnectedPeers = useCallback(() => {
        return Array.from(peerConnections.values()).filter(pc => pc.connected);
    }, [peerConnections]);

    const getRoomLink = useCallback(() => {
        if (typeof window === 'undefined' || !roomId) return '';
        return `${process.env.NEXT_PUBLIC_API_IP}/room/${roomId}`;
    }, [roomId]);

    return {
        roomId,
        username,
        isConnected,
        peers,
        createRoom,
        joinRoom,
        leaveRoom,
        sendChatMessage,
        sendFile,
        getConnectedPeers,
        getRoomLink,
    };
}
