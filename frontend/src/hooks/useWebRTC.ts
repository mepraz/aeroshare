'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { useSignaling } from './useSignaling';
import {
    PeerConnection,
    FileMetadata,
    FileStart,
    FileChunk,
    FileComplete,
    ChatMessage,
    DataChannelMessage,
    FileTransfer,
    OfferMessage,
    AnswerMessage,
    CandidateMessage,
    PeerJoinedMessage,
    PeerLeftMessage,
} from '@/types';

const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
];

const CHUNK_SIZE = 64 * 1024; // 64KB chunks

export function useWebRTC() {
    const {
        peerId,
        username,
        roomId,
        peers,
        peerConnections,
        setPeerConnection,
        removePeerConnection,
        updatePeerConnection,
        addMessage,
        addTransfer,
        updateTransfer,
        addLog,
    } = useStore();

    const {
        connect,
        disconnect,
        joinRoom,
        leaveRoom,
        sendOffer,
        sendAnswer,
        sendCandidate,
        setMessageHandlers,
    } = useSignaling();

    const fileBuffersRef = useRef<Map<string, { metadata: FileMetadata; chunks: Uint8Array[]; receivedSize: number }>>(new Map());

    // Ref to hold setupDataChannel to break circular dependency
    const setupDataChannelRef = useRef<((peerId: string, channel: RTCDataChannel) => void) | null>(null);

    // Create RTCPeerConnection for a peer
    const createPeerConnection = useCallback((targetPeerId: string, targetUsername?: string): PeerConnection => {
        const config: RTCConfiguration = { iceServers: ICE_SERVERS };
        const pc = new RTCPeerConnection(config);

        const peerConnection: PeerConnection = {
            id: targetPeerId,
            username: targetUsername,
            connection: pc,
            connected: false,
        };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                sendCandidate(targetPeerId, event.candidate.toJSON());
            }
        };

        pc.onconnectionstatechange = () => {
            console.log(`[WebRTC] Connection state with ${targetPeerId}:`, pc.connectionState);
            addLog('info', `Connection with ${targetUsername || targetPeerId}: ${pc.connectionState}`);

            if (pc.connectionState === 'connected') {
                updatePeerConnection(targetPeerId, { connected: true });
                addLog('success', `Connected to ${targetUsername || targetPeerId}`);
            } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                updatePeerConnection(targetPeerId, { connected: false });
                addLog('warn', `Disconnected from ${targetUsername || targetPeerId}`);
            }
        };

        // Handle incoming data channel
        pc.ondatachannel = (event) => {
            console.log(`[WebRTC] Data channel received from ${targetPeerId}`);
            addLog('info', `Received data channel from ${targetUsername || targetPeerId}`);
            setupDataChannelRef.current?.(targetPeerId, event.channel);
        };

        setPeerConnection(targetPeerId, peerConnection);
        return peerConnection;
    }, [sendCandidate, setPeerConnection, updatePeerConnection, addLog]);

    // Handle incoming data channel messages
    const handleDataChannelMessage = useCallback((senderId: string, data: string | ArrayBuffer) => {
        try {
            const message: DataChannelMessage = JSON.parse(
                typeof data === 'string' ? data : new TextDecoder().decode(data)
            );

            switch (message.type) {
                case 'chat': {
                    addMessage(message as ChatMessage);
                    break;
                }

                case 'file-start': {
                    const { metadata } = message as FileStart;
                    addLog('info', `Receiving file: ${metadata.filename} (${(metadata.size / 1024).toFixed(1)} KB) from ${metadata.senderName}`);
                    // Initialize file buffer
                    fileBuffersRef.current.set(metadata.id, {
                        metadata,
                        chunks: [],
                        receivedSize: 0,
                    });

                    // Add to transfers
                    addTransfer({
                        id: metadata.id,
                        filename: metadata.filename,
                        size: metadata.size,
                        mime: metadata.mime,
                        progress: 0,
                        status: 'transferring',
                        direction: 'receive',
                        peerId: senderId,
                        peerName: metadata.senderName,
                        chunks: [],
                        timestamp: Date.now(),
                    });
                    break;
                }

                case 'chunk': {
                    const { fileId, data: chunkData } = message as FileChunk;
                    const buffer = fileBuffersRef.current.get(fileId);
                    if (!buffer) return;

                    // Decode base64 chunk
                    const binaryString = atob(chunkData);
                    const bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }

                    buffer.chunks.push(bytes);
                    buffer.receivedSize += bytes.length;

                    // Update progress
                    const progress = Math.round((buffer.receivedSize / buffer.metadata.size) * 100);
                    updateTransfer(fileId, { progress });
                    break;
                }

                case 'done': {
                    const { fileId } = message as FileComplete;
                    const buffer = fileBuffersRef.current.get(fileId);
                    if (!buffer) return;

                    addLog('success', `File received: ${buffer.metadata.filename}`);

                    // Combine chunks into blob
                    const blob = new Blob(buffer.chunks as BlobPart[], { type: buffer.metadata.mime });

                    // Update transfer status with blob (no auto-download)
                    updateTransfer(fileId, { status: 'completed', progress: 100, blob });

                    // Cleanup
                    fileBuffersRef.current.delete(fileId);
                    break;
                }
            }
        } catch (error) {
            console.error('[WebRTC] Failed to parse data channel message:', error);
            addLog('error', 'Failed to parse data channel message');
        }
    }, [addMessage, addTransfer, updateTransfer, addLog]);

    // Setup data channel event handlers
    const setupDataChannel = useCallback((targetPeerId: string, channel: RTCDataChannel) => {
        channel.binaryType = 'arraybuffer';

        channel.onopen = () => {
            console.log(`[WebRTC] Data channel open with ${targetPeerId}`);
            addLog('success', `Data channel open with ${targetPeerId}`);
            updatePeerConnection(targetPeerId, { dataChannel: channel, connected: true });
        };

        channel.onclose = () => {
            console.log(`[WebRTC] Data channel closed with ${targetPeerId}`);
            addLog('warn', `Data channel closed with ${targetPeerId}`);
            updatePeerConnection(targetPeerId, { connected: false });
        };

        channel.onerror = (error) => {
            console.error(`[WebRTC] Data channel error with ${targetPeerId}:`, error);
            addLog('error', `Data channel error with ${targetPeerId}`);
        };

        channel.onmessage = (event) => {
            handleDataChannelMessage(targetPeerId, event.data);
        };
    }, [updatePeerConnection, handleDataChannelMessage, addLog]);

    // Keep ref updated with latest setupDataChannel
    useEffect(() => {
        setupDataChannelRef.current = setupDataChannel;
    }, [setupDataChannel]);

    // Download file
    const downloadFile = useCallback((blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, []);

    // Create offer and data channel for new peer
    const initiateConnection = useCallback(async (targetPeerId: string, targetUsername?: string) => {
        console.log(`[WebRTC] Initiating connection to ${targetPeerId}`);
        addLog('info', `Initiating connection to ${targetUsername || targetPeerId}`);

        const peerConnection = createPeerConnection(targetPeerId, targetUsername);
        const { connection: pc } = peerConnection;

        // Create data channel (as initiator)
        const dataChannel = pc.createDataChannel('aeroshare', { ordered: true });
        setupDataChannel(targetPeerId, dataChannel);

        // Create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        sendOffer(targetPeerId, offer);
    }, [createPeerConnection, setupDataChannel, sendOffer, addLog]);

    // Queue for ICE candidates received before remote description is set
    const candidateQueuesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

    // Helper to process queued candidates
    const processCandidateQueue = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
        const queue = candidateQueuesRef.current.get(peerId);
        if (queue && queue.length > 0) {
            console.log(`[WebRTC] Processing ${queue.length} queued candidates for ${peerId}`);
            addLog('info', `Processing ${queue.length} queued candidates for ${peerId}`);
            for (const candidate of queue) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (err) {
                    console.error(`[WebRTC] Failed to add queued candidate for ${peerId}:`, err);
                }
            }
            candidateQueuesRef.current.delete(peerId);
        }
    }, [addLog]);

    // Handle incoming offer
    const handleOffer = useCallback(async (message: OfferMessage) => {
        const { senderId, payload: offer } = message;
        console.log(`[WebRTC] Received offer from ${senderId}`);
        addLog('info', `Received offer from ${senderId}`);

        // Get latest peer connections from store directly to avoid stale closures
        const currentPeerConnections = useStore.getState().peerConnections;
        let pc = currentPeerConnections.get(senderId)?.connection;

        if (!pc) {
            const peerConnection = createPeerConnection(senderId);
            pc = peerConnection.connection;
        }

        // Check for collision/glare
        if (pc.signalingState !== 'stable') {
            // If we are already connecting (have local offer), and we receive an offer:
            // This is a glare situation.
            // Strategy: "New Peer Initiates" - if we are the older peer (or based on ID comparison), we might need to rollback.
            // But for now, let's just log it. The 'polite' peer logic is complex.
            // Simple approach: If we have a local offer (we are trying to connect), and receive an offer,
            // we might want to ignore this offer if we are the initiator?
            // Actually, with "New Peer Initiates", the new peer sends the offer.
            // If we (existing peer) receive an offer, we should accept it.
            // But if we also tried to send an offer (race condition), we have a problem.

            // For this specific error (Unknown ufrag), it's usually just timing of candidates vs description.
            // So we proceed with setting remote description.
            console.warn(`[WebRTC] Signaling state is ${pc.signalingState} when receiving offer from ${senderId}`);
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        // Process any queued candidates
        await processCandidateQueue(senderId, pc);

        // Create answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        sendAnswer(senderId, answer);
    }, [createPeerConnection, sendAnswer, addLog, processCandidateQueue]);

    // Handle incoming answer
    const handleAnswer = useCallback(async (message: AnswerMessage) => {
        const { senderId, payload: answer } = message;
        console.log(`[WebRTC] Received answer from ${senderId}`);
        addLog('info', `Received answer from ${senderId}`);

        const currentPeerConnections = useStore.getState().peerConnections;
        const pc = currentPeerConnections.get(senderId)?.connection;

        if (!pc) {
            console.error(`[WebRTC] No peer connection for ${senderId}`);
            addLog('error', `Received answer but no connection for ${senderId}`);
            return;
        }

        // Check if we're in the right state to receive an answer
        if (pc.signalingState !== 'have-local-offer') {
            console.warn(`[WebRTC] Ignoring answer in ${pc.signalingState} state from ${senderId}`);
            addLog('warn', `Ignoring answer from ${senderId} in state ${pc.signalingState}`);
            return;
        }

        await pc.setRemoteDescription(new RTCSessionDescription(answer));

        // Process any queued candidates
        await processCandidateQueue(senderId, pc);
    }, [addLog, processCandidateQueue]);

    // Handle incoming ICE candidate
    const handleCandidate = useCallback(async (message: CandidateMessage) => {
        const { senderId, payload: candidate } = message;

        const currentPeerConnections = useStore.getState().peerConnections;
        const pc = currentPeerConnections.get(senderId)?.connection;

        if (!pc) {
            console.error(`[WebRTC] No peer connection for ${senderId} to add candidate`);
            // We could create one, but usually candidate comes after offer.
            // If we don't have a PC, we might want to queue it? 
            // But we need a PC to know if we can add it.
            // For now, assume PC exists (created by offer/initiate).
            return;
        }

        if (pc.signalingState === 'closed') {
            console.warn(`[WebRTC] Ignoring candidate for closed connection ${senderId}`);
            return;
        }

        if (!pc.remoteDescription) {
            console.log(`[WebRTC] Queuing candidate for ${senderId} (no remote description)`);
            const queue = candidateQueuesRef.current.get(senderId) || [];
            queue.push(candidate);
            candidateQueuesRef.current.set(senderId, queue);
        } else {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
                console.error(`[WebRTC] Failed to add candidate for ${senderId}:`, err);
            }
        }
    }, []);

    // Handle new peer joining - initiate connection
    const handlePeerJoined = useCallback((message: PeerJoinedMessage) => {
        const { payload: peer } = message;
        console.log(`[WebRTC] Peer joined: ${peer.username || peer.id}`);
        // Do NOT initiate connection here. Wait for the new peer to initiate.
    }, []);

    // Handle peer list - new peer initiates connections to all existing peers
    const handlePeerList = useCallback((peerList: any[]) => {
        console.log(`[WebRTC] Received peer list with ${peerList.length} peers, initiating connections`);
        addLog('info', `Received peer list (${peerList.length} peers), initiating connections...`);
        peerList.forEach(peer => {
            initiateConnection(peer.id, peer.username);
        });
    }, [initiateConnection, addLog]);

    // Handle peer leaving
    const handlePeerLeft = useCallback((message: PeerLeftMessage) => {
        const { payload: { peerId: leftPeerId } } = message;
        console.log(`[WebRTC] Peer left: ${leftPeerId}`);
        addLog('info', `Peer left: ${leftPeerId}`);

        // Close and remove peer connection
        removePeerConnection(leftPeerId);

        // Mark any transfers from this peer as failed
        const transfers = useStore.getState().transfers;
        transfers.forEach(t => {
            if (t.peerId === leftPeerId && t.status === 'transferring') {
                updateTransfer(t.id, { status: 'failed', error: 'Peer disconnected' });
                addLog('error', `Transfer failed: Peer ${leftPeerId} disconnected`);
            }
        });
    }, [removePeerConnection, updateTransfer, addLog]);

    // Set up signaling message handlers
    useEffect(() => {
        setMessageHandlers({
            onOffer: handleOffer,
            onAnswer: handleAnswer,
            onCandidate: handleCandidate,
            onPeerJoined: handlePeerJoined,
            onPeerLeft: handlePeerLeft,
            onPeerList: handlePeerList,
        });
    }, [setMessageHandlers, handleOffer, handleAnswer, handleCandidate, handlePeerJoined, handlePeerLeft, handlePeerList]);

    // Send chat message
    const sendChatMessage = useCallback((content: string, targetPeerId?: string) => {
        const message: ChatMessage = {
            type: 'chat',
            id: Math.random().toString(36).slice(2) + Date.now().toString(36),
            senderId: peerId || '',
            senderName: username,
            content,
            timestamp: Date.now(),
        };

        const messageStr = JSON.stringify(message);

        // Get latest connections
        const currentPeerConnections = useStore.getState().peerConnections;

        if (targetPeerId) {
            // Send to specific peer
            const pc = currentPeerConnections.get(targetPeerId);
            if (pc?.dataChannel?.readyState === 'open') {
                pc.dataChannel.send(messageStr);
                addLog('info', `Sent message to ${targetPeerId}`);
            } else {
                addLog('error', `Cannot send message: no data channel with ${targetPeerId}`);
            }
        } else {
            // Broadcast to all peers
            let sentCount = 0;
            currentPeerConnections.forEach(pc => {
                if (pc.dataChannel?.readyState === 'open') {
                    pc.dataChannel.send(messageStr);
                    sentCount++;
                }
            });
            addLog('info', `Broadcasted message to ${sentCount} peers`);
        }

        // Add to own messages
        addMessage(message);
    }, [peerId, username, addMessage, addLog]);

    // Send file
    const sendFile = useCallback(async (file: File, targetPeerId?: string) => {
        const fileId = Math.random().toString(36).slice(2) + Date.now().toString(36);

        const metadata: FileMetadata = {
            id: fileId,
            filename: file.name,
            size: file.size,
            mime: file.type || 'application/octet-stream',
            senderId: peerId || '',
            senderName: username,
        };

        // Get latest connections
        const currentPeerConnections = useStore.getState().peerConnections;

        // Determine target connections
        const targetConnections: PeerConnection[] = [];
        if (targetPeerId) {
            const pc = currentPeerConnections.get(targetPeerId);
            if (pc) targetConnections.push(pc);
        } else {
            currentPeerConnections.forEach(pc => targetConnections.push(pc));
        }

        if (targetConnections.length === 0) {
            console.error('[WebRTC] No peers to send file to');
            addLog('warn', 'No peers to send file to');
            return;
        }

        addLog('info', `Sending file: ${file.name} (${(file.size / 1024).toFixed(1)} KB) to ${targetPeerId ? targetPeerId : 'all peers'}`);

        // Add transfer to state
        const transfer: FileTransfer = {
            id: fileId,
            filename: file.name,
            size: file.size,
            mime: file.type,
            progress: 0,
            status: 'transferring',
            direction: 'send',
            peerId: targetPeerId || 'broadcast',
            timestamp: Date.now(),
        };
        addTransfer(transfer);

        // Send file start message
        const startMessage: FileStart = { type: 'file-start', metadata };
        const startStr = JSON.stringify(startMessage);
        targetConnections.forEach(pc => {
            if (pc.dataChannel?.readyState === 'open') {
                pc.dataChannel.send(startStr);
            }
        });

        // Read and send file in chunks
        const reader = new FileReader();
        let offset = 0;
        let chunkIndex = 0;

        const readNextChunk = () => {
            const slice = file.slice(offset, offset + CHUNK_SIZE);
            reader.readAsArrayBuffer(slice);
        };

        reader.onload = (e) => {
            if (!e.target?.result) return;

            const chunk = new Uint8Array(e.target.result as ArrayBuffer);

            // Convert to base64
            let binary = '';
            chunk.forEach(byte => binary += String.fromCharCode(byte));
            const base64 = btoa(binary);

            const chunkMessage: FileChunk = {
                type: 'chunk',
                fileId,
                index: chunkIndex,
                data: base64,
            };

            const chunkStr = JSON.stringify(chunkMessage);
            targetConnections.forEach(pc => {
                if (pc.dataChannel?.readyState === 'open') {
                    pc.dataChannel.send(chunkStr);
                }
            });

            offset += chunk.length;
            chunkIndex++;

            // Update progress
            const progress = Math.round((offset / file.size) * 100);
            updateTransfer(fileId, { progress });

            if (offset < file.size) {
                // Add small delay to prevent overwhelming the channel
                setTimeout(readNextChunk, 10);
            } else {
                // File complete
                const doneMessage: FileComplete = { type: 'done', fileId };
                const doneStr = JSON.stringify(doneMessage);
                targetConnections.forEach(pc => {
                    if (pc.dataChannel?.readyState === 'open') {
                        pc.dataChannel.send(doneStr);
                    }
                });

                updateTransfer(fileId, { status: 'completed', progress: 100 });
                addLog('success', `File sent: ${file.name}`);
            }
        };

        reader.onerror = () => {
            console.error('[WebRTC] Error reading file');
            addLog('error', `Error reading file: ${file.name}`);
            updateTransfer(fileId, { status: 'failed', error: 'Error reading file' });
        };

        readNextChunk();
    }, [peerId, username, addTransfer, updateTransfer, addLog]);

    return {
        connect,
        disconnect,
        joinRoom,
        leaveRoom,
        sendChatMessage,
        sendFile,
    };
}
