'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import {
    Send,
    Paperclip,
    Copy,
    Check,
    LogOut,
    X,
    Download,
    QrCode,
    User,
} from 'lucide-react';
import { useRoom } from '@/hooks/useRoom';
import { useStore } from '@/store/useStore';

// Avatar colors for peers
const AVATAR_COLORS = [
    'bg-gradient-to-br from-orange-400 to-pink-500',
    'bg-gradient-to-br from-blue-400 to-purple-500',
    'bg-gradient-to-br from-green-400 to-teal-500',
    'bg-gradient-to-br from-pink-400 to-rose-500',
    'bg-gradient-to-br from-yellow-400 to-orange-500',
    'bg-gradient-to-br from-indigo-400 to-blue-500',
];

function getAvatarColor(id: string): string {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function RoomPage() {
    const params = useParams();
    const router = useRouter();
    const roomIdParam = params.id as string;

    const {
        joinRoom,
        leaveRoom,
        sendChatMessage,
        sendFile,
        getRoomLink,
    } = useRoom();

    const {
        peerId,
        username,
        isConnected,
        peers,
        peerConnections,
        messages,
        transfers,
    } = useStore();

    const [messageInput, setMessageInput] = useState('');
    const [copied, setCopied] = useState(false);
    const [showQR, setShowQR] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // Username Modal State
    const [showNameModal, setShowNameModal] = useState(false);
    const [nameInput, setNameInput] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Join room logic
    useEffect(() => {
        // Check if we already have a username in session storage
        const storedUsername = sessionStorage.getItem('aeroshare_username');

        if (!peerId) {
            if (storedUsername) {
                // If we have a username, join immediately
                joinRoom(roomIdParam, storedUsername);
            } else {
                // Otherwise, show the name modal
                setShowNameModal(true);
            }
        }
    }, [roomIdParam, joinRoom, peerId]);

    const handleJoinWithUsername = () => {
        if (!nameInput.trim()) return;

        const finalName = nameInput.trim();
        sessionStorage.setItem('aeroshare_username', finalName);
        joinRoom(roomIdParam, finalName);
        setShowNameModal(false);
    };

    // Scroll to bottom on new items
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, transfers]);

    const handleSendMessage = () => {
        if (!messageInput.trim()) return;
        sendChatMessage(messageInput.trim());
        setMessageInput('');
    };

    const handleFileSelect = (files: FileList | null) => {
        if (!files || files.length === 0) return;

        Array.from(files).forEach(file => {
            sendFile(file);
        });
    };

    const copyLink = async () => {
        const link = getRoomLink();
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleLeave = () => {
        leaveRoom();
        sessionStorage.removeItem('aeroshare_username'); // Optional: clear on leave? Maybe keep it.
        router.push('/');
    };

    // Drag and drop handlers
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileSelect(e.dataTransfer.files);
    }, []);

    const connectedPeersCount = Array.from(peerConnections.values()).filter(pc => pc.connected).length;

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    };

    // Combine messages and transfers into a unified feed, sorted by timestamp
    const feedItems = [
        ...messages.map(m => ({ ...m, itemType: 'message' as const })),
        ...transfers.map(t => ({ ...t, itemType: 'transfer' as const })),
    ].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    // Calculate transfer stats
    const activeTransfers = transfers.filter(t => t.status === 'transferring').length;
    const totalSent = transfers.filter(t => t.direction === 'send' && t.status === 'completed').reduce((acc, t) => acc + t.size, 0);
    const totalReceived = transfers.filter(t => t.direction === 'receive' && t.status === 'completed').reduce((acc, t) => acc + t.size, 0);

    return (
        <main
            className="flex flex-col h-screen bg-[#0d0d1a] overflow-hidden"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Drag overlay */}
            {isDragging && (
                <div className="absolute inset-0 z-50 bg-purple-500/20 border-2 border-dashed border-purple-500 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                        <Paperclip className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                        <p className="text-xl text-white">Drop files to share</p>
                    </div>
                </div>
            )}

            {/* Username Modal */}
            {showNameModal && (
                <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
                    <div className="bg-[#1a1a2e] rounded-2xl p-8 max-w-md w-full border border-white/10 shadow-2xl">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/20">
                                <User className="w-8 h-8 text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Join Room</h2>
                            <p className="text-gray-400">Enter your name to join the conversation</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Display Name</label>
                                <input
                                    type="text"
                                    value={nameInput}
                                    onChange={(e) => setNameInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleJoinWithUsername()}
                                    placeholder="e.g. Alex"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                    autoFocus
                                />
                            </div>
                            <button
                                onClick={handleJoinWithUsername}
                                disabled={!nameInput.trim()}
                                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-purple-500/20"
                            >
                                Join Room
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* QR Modal */}
            {showQR && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setShowQR(false)}>
                    <div className="bg-[#1a1a2e] rounded-2xl p-6 max-w-sm w-full border border-white/10" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-medium text-white">Scan to Join</h3>
                            <button onClick={() => setShowQR(false)} className="text-gray-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="bg-white rounded-xl p-4 mx-auto w-fit">
                            <QRCodeSVG value={getRoomLink()} size={200} />
                        </div>
                        <p className="text-center text-gray-400 text-sm mt-4">
                            Or share: <code className="text-purple-400 bg-purple-500/10 px-2 py-1 rounded">{roomIdParam}</code>
                        </p>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="bg-[#12121f] border-b border-white/5 px-4 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                            <span className="text-white font-bold text-sm">A</span>
                        </div>
                        <span className="font-semibold text-white hidden sm:inline">AeroShare</span>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 text-sm bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                        <span className="text-gray-500">Room ID:</span>
                        <code className="text-purple-400 font-mono">{roomIdParam.slice(0, 8).toUpperCase()}</code>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Connection Status */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]' : 'bg-red-400'}`} />
                        <span className={`text-sm ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                            {isConnected ? 'Connected' : 'Disconnected'}
                        </span>
                    </div>

                    {/* QR Button */}
                    <button
                        onClick={() => setShowQR(true)}
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/5"
                        title="Show QR Code"
                    >
                        <QrCode className="w-5 h-5 text-gray-400" />
                    </button>

                    {/* Copy Link */}
                    <button
                        onClick={copyLink}
                        className="hidden sm:flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/5"
                    >
                        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
                        <span className="text-sm text-gray-300">{copied ? 'Copied!' : 'Copy Link'}</span>
                    </button>

                    {/* Leave Room */}
                    <button
                        onClick={handleLeave}
                        className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors border border-red-500/20"
                        title="Leave Room"
                    >
                        <LogOut className="w-5 h-5 text-red-400" />
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Chat Area */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Messages Feed */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                        {feedItems.length === 0 && (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                                    <Send className="w-8 h-8 text-purple-400" />
                                </div>
                                <p className="text-gray-400 mb-2">No messages yet</p>
                                <p className="text-gray-600 text-sm">Start chatting or drop files to share</p>
                            </div>
                        )}

                        {feedItems.map((item) => {
                            // Determine if it's a message or transfer
                            if (item.itemType === 'message') {
                                const msg = item;
                                const isOwn = msg.senderId === peerId;
                                const avatarColor = getAvatarColor(msg.senderId);

                                return (
                                    <div key={msg.id} className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
                                        {/* Avatar */}
                                        {!isOwn && (
                                            <div className={`w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center shrink-0 shadow-lg`}>
                                                <span className="text-white font-medium text-sm">
                                                    {(msg.senderName || 'U')[0].toUpperCase()}
                                                </span>
                                            </div>
                                        )}

                                        <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
                                            {/* Sender name */}
                                            {!isOwn && (
                                                <p className="text-xs text-gray-500 mb-1 ml-1">{msg.senderName || 'Unknown'}</p>
                                            )}
                                            {isOwn && (
                                                <p className="text-xs text-gray-500 mb-1 mr-1 text-right">You</p>
                                            )}

                                            {/* Message bubble */}
                                            <div
                                                className={`rounded-2xl px-4 py-2.5 shadow-md ${isOwn
                                                    ? 'bg-gradient-to-r from-purple-600 to-purple-500 rounded-tr-sm'
                                                    : 'bg-[#1e1e32] rounded-tl-sm border border-white/5'
                                                    }`}
                                            >
                                                <p className="text-white text-sm leading-relaxed">{msg.content}</p>
                                            </div>
                                            <p className="text-[10px] text-gray-600 mt-1 px-1">
                                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>

                                        {/* Own avatar */}
                                        {isOwn && (
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center shrink-0 shadow-lg">
                                                <span className="text-white font-medium text-sm">
                                                    {(username || 'Y')[0].toUpperCase()}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            } else {
                                const transfer = item;
                                const isOwn = transfer.direction === 'send';
                                const avatarColor = getAvatarColor(transfer.peerId || 'unknown');
                                const isImage = transfer.mime?.startsWith('image/');
                                const isVideo = transfer.mime?.startsWith('video/');
                                const blobUrl = transfer.blob ? URL.createObjectURL(transfer.blob) : null;

                                const handleDownload = () => {
                                    if (!transfer.blob) return;
                                    const url = URL.createObjectURL(transfer.blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = transfer.filename;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                    URL.revokeObjectURL(url);
                                };

                                return (
                                    <div key={transfer.id} className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
                                        {/* Avatar */}
                                        {!isOwn && (
                                            <div className={`w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center shrink-0 shadow-lg`}>
                                                <span className="text-white font-medium text-sm">
                                                    {(transfer.peerName || 'U')[0].toUpperCase()}
                                                </span>
                                            </div>
                                        )}

                                        <div className={`max-w-[85%] md:max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}>
                                            {/* Sender name */}
                                            {!isOwn && (
                                                <p className="text-xs text-gray-500 mb-1 ml-1">{transfer.peerName || 'Unknown'}</p>
                                            )}
                                            {isOwn && (
                                                <p className="text-xs text-gray-500 mb-1 mr-1 text-right">You</p>
                                            )}

                                            {/* File card */}
                                            <div className="bg-[#1e1e32] rounded-2xl overflow-hidden border border-white/5 shadow-md">
                                                {/* Media Preview for completed transfers */}
                                                {transfer.status === 'completed' && blobUrl && isImage && (
                                                    <div className="relative group">
                                                        <img
                                                            src={blobUrl}
                                                            alt={transfer.filename}
                                                            className="max-w-full max-h-64 object-contain bg-black/20"
                                                        />
                                                        {!isOwn && (
                                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                <button
                                                                    onClick={handleDownload}
                                                                    className="p-2 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-sm transition-colors"
                                                                >
                                                                    <Download className="w-6 h-6 text-white" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {transfer.status === 'completed' && blobUrl && isVideo && (
                                                    <div className="relative">
                                                        <video
                                                            src={blobUrl}
                                                            controls
                                                            className="max-w-full max-h-64 bg-black/20"
                                                        />
                                                    </div>
                                                )}

                                                {/* File info section */}
                                                <div className="p-4">
                                                    <div className="flex gap-4">
                                                        {/* File icon for non-media or in-progress */}
                                                        {(transfer.status !== 'completed' || (!isImage && !isVideo)) && (
                                                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-900/50 to-pink-900/50 border border-purple-500/20 flex items-center justify-center shrink-0">
                                                                <Download className="w-6 h-6 text-purple-400" />
                                                            </div>
                                                        )}

                                                        {/* File info */}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-white truncate mb-0.5">{transfer.filename}</p>
                                                            <p className="text-sm text-gray-500 mb-2">{formatFileSize(transfer.size)}</p>

                                                            {/* Progress */}
                                                            {transfer.status === 'transferring' && (
                                                                <>
                                                                    <div className="flex justify-between text-xs mb-1">
                                                                        <span className="text-purple-400">
                                                                            {transfer.direction === 'send' ? 'Uploading...' : 'Downloading...'}
                                                                        </span>
                                                                        <span className="text-white">{transfer.progress}%</span>
                                                                    </div>
                                                                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                                        <div
                                                                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-300"
                                                                            style={{ width: `${transfer.progress}%` }}
                                                                        />
                                                                    </div>
                                                                </>
                                                            )}

                                                            {/* Completed - show download button for received files (non-media or explicit download) */}
                                                            {transfer.status === 'completed' && !isOwn && (!isImage && !isVideo) && (
                                                                <button
                                                                    onClick={handleDownload}
                                                                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm text-white transition-colors mt-2 shadow-lg shadow-purple-600/20"
                                                                >
                                                                    <Download className="w-4 h-4" />
                                                                    Download
                                                                </button>
                                                            )}

                                                            {transfer.status === 'completed' && isOwn && (
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <Check className="w-4 h-4 text-green-400" />
                                                                    <span className="text-sm text-green-400">Sent</span>
                                                                </div>
                                                            )}

                                                            {transfer.status === 'failed' && (
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <X className="w-4 h-4 text-red-400" />
                                                                    <span className="text-sm text-red-400">{transfer.error || 'Failed'}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-gray-600 mt-1 px-1">
                                                {new Date(transfer.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>

                                        {/* Own avatar */}
                                        {isOwn && (
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center shrink-0 shadow-lg">
                                                <span className="text-white font-medium text-sm">
                                                    {(username || 'Y')[0].toUpperCase()}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            }
                        })}

                        <div ref={chatEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 border-t border-white/5 bg-[#12121f]">
                        <div className="flex items-center gap-3 bg-[#1a1a2e] rounded-xl px-4 py-2 border border-white/5 focus-within:border-purple-500/50 transition-colors">
                            <input
                                type="text"
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                placeholder="Type a message or drop a file..."
                                className="flex-1 bg-transparent text-white placeholder-gray-500 focus:outline-none text-sm py-2"
                            />
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                onChange={(e) => handleFileSelect(e.target.files)}
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="p-2 hover:bg-white/5 rounded-lg transition-colors text-gray-400 hover:text-white"
                                title="Attach file"
                            >
                                <Paperclip className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleSendMessage}
                                disabled={!messageInput.trim()}
                                className="w-10 h-10 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-all shadow-lg shadow-purple-500/20"
                            >
                                <Send className="w-4 h-4 text-white" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Sidebar (Desktop) */}
                <aside className="w-72 bg-[#12121f] border-l border-white/5 p-4 hidden lg:flex flex-col shrink-0">
                    {/* Peers Section */}
                    <div className="mb-6">
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                            Peers ({peers.length + 1})
                        </h3>
                        <div className="space-y-2">
                            {/* You */}
                            <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/5">
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center shadow-lg">
                                        <span className="text-white font-medium text-sm">
                                            {(username || 'Y')[0].toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-[#12121f]" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-white text-sm font-medium truncate">You</p>
                                    <p className="text-xs text-gray-500 truncate">{username}</p>
                                </div>
                            </div>

                            {/* Other peers */}
                            {peers.map(peer => {
                                const pc = peerConnections.get(peer.id);
                                const isConnectedPeer = pc?.connected;
                                const avatarColor = getAvatarColor(peer.id);

                                return (
                                    <div key={peer.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5">
                                        <div className="relative">
                                            <div className={`w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center shadow-lg`}>
                                                <span className="text-white font-medium text-sm">
                                                    {(peer.username || 'P')[0].toUpperCase()}
                                                </span>
                                            </div>
                                            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#12121f] ${isConnectedPeer ? 'bg-green-400' : 'bg-gray-500'}`} />
                                        </div>
                                        <span className="text-white text-sm truncate">{peer.username || `Peer-${peer.id.slice(0, 4)}`}</span>
                                    </div>
                                );
                            })}

                            {peers.length === 0 && (
                                <p className="text-gray-600 text-sm text-center py-4 border border-dashed border-white/10 rounded-lg">
                                    Share the room link to invite others
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Transfer Stats */}
                    <div className="mt-auto">
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                            Transfer Stats
                        </h3>
                        <div className="space-y-3 bg-white/5 rounded-xl p-4 border border-white/5">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400 text-sm">Active Transfers</span>
                                <span className="text-white font-semibold">{activeTransfers}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400 text-sm">Total Sent</span>
                                <span className="text-purple-400 font-semibold">{formatFileSize(totalSent)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-400 text-sm">Total Received</span>
                                <span className="text-purple-400 font-semibold">{formatFileSize(totalReceived)}</span>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </main>
    );
}
