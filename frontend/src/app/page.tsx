'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Zap,
    Users,
    Shield,
    ArrowRight,
    Loader2,
    FileUp,
    MessageSquare,
    Globe,
    Infinity
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function HomePage() {
    const router = useRouter();
    const [roomId, setRoomId] = useState('');
    const [username, setUsername] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState('');

    const createRoom = async () => {
        if (!username.trim()) {
            setError('Please enter your name');
            return;
        }

        setError('');
        setIsCreating(true);

        try {
            const response = await fetch(`${API_URL}/create-room`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            if (!response.ok) throw new Error('Failed to create room');

            const { roomId: newRoomId } = await response.json();

            // Store username for room page
            sessionStorage.setItem('aeroshare_username', username);
            router.push(`/room/${newRoomId}`);
        } catch (err) {
            setError('Failed to create room. Is the server running?');
            setIsCreating(false);
        }
    };

    const joinRoom = () => {
        if (!username.trim()) {
            setError('Please enter your name');
            return;
        }
        if (!roomId.trim()) {
            setError('Please enter a room ID');
            return;
        }

        setError('');
        setIsJoining(true);

        sessionStorage.setItem('aeroshare_username', username);
        router.push(`/room/${roomId.trim()}`);
    };

    return (
        <main className="min-h-screen bg-[#0d0d1a] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-pink-600/20 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 w-full max-w-6xl mx-auto flex flex-col items-center">

                {/* Hero Section */}
                <div className="text-center mb-16 max-w-3xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-6 backdrop-blur-sm">
                        <span className="flex h-2 w-2 rounded-full bg-green-400 animate-pulse"></span>
                        <span className="text-xs font-medium text-gray-300 tracking-wide uppercase">Live P2P Network</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight leading-tight">
                        Share files & text <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-orange-500 animate-gradient">
                            at lightspeed
                        </span>
                    </h1>

                    <p className="text-lg md:text-xl text-gray-400 mb-8 leading-relaxed">
                        AeroShare is a secure, peer-to-peer file sharing and chat platform.
                        No sign-ups, no file size limits, and no servers storing your data.
                        Just direct device-to-device transfer.
                    </p>

                    {/* Feature Pills */}
                    <div className="flex flex-wrap justify-center gap-3 mb-8">
                        {['P2P File Transfer', 'Encrypted Chat', 'No Size Limits', 'Cross-Device'].map((feature) => (
                            <span key={feature} className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-300">
                                {feature}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Main Action Card */}
                <div className="w-full max-w-md bg-[#1a1a2e]/80 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl shadow-purple-900/20 mb-20">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
                            <Shield className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                            <p className="text-red-300 text-sm">{error}</p>
                        </div>
                    )}

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2 ml-1">Display Name</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="How should we call you?"
                                    className="w-full bg-[#12121f] border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <button
                                onClick={createRoom}
                                disabled={isCreating}
                                className="w-full group relative overflow-hidden bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold py-4 rounded-xl transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <div className="relative z-10 flex items-center justify-center gap-2">
                                    {isCreating ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            <span>Creating Room...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Create New Room</span>
                                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </div>
                            </button>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-white/10"></div>
                                </div>
                                <div className="relative flex justify-center text-xs uppercase tracking-widest">
                                    <span className="px-4 bg-[#1a1a2e] text-gray-500">Or join existing</span>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    value={roomId}
                                    onChange={(e) => setRoomId(e.target.value)}
                                    placeholder="Enter Room ID"
                                    className="flex-1 bg-[#12121f] border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-mono text-sm"
                                    onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                                />
                                <button
                                    onClick={joinRoom}
                                    disabled={isJoining}
                                    className="px-6 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
                                >
                                    {isJoining ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Join'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Features Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl">
                    <div className="bg-white/5 border border-white/5 rounded-2xl p-6 hover:bg-white/10 transition-colors">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-4">
                            <Zap className="w-6 h-6 text-purple-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">Lightning Fast</h3>
                        <p className="text-gray-400 leading-relaxed">
                            Direct peer-to-peer connection means your data takes the shortest path. No server bottlenecks, just pure speed.
                        </p>
                    </div>

                    <div className="bg-white/5 border border-white/5 rounded-2xl p-6 hover:bg-white/10 transition-colors">
                        <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center mb-4">
                            <Shield className="w-6 h-6 text-pink-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">Secure & Private</h3>
                        <p className="text-gray-400 leading-relaxed">
                            Your files never touch our servers. WebRTC encryption ensures only you and your peers can see what you share.
                        </p>
                    </div>

                    <div className="bg-white/5 border border-white/5 rounded-2xl p-6 hover:bg-white/10 transition-colors">
                        <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center mb-4">
                            <Infinity className="w-6 h-6 text-orange-400" />
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">No Limits</h3>
                        <p className="text-gray-400 leading-relaxed">
                            Share files of any size. From photos to 4K videos, if your device can handle it, AeroShare can send it.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <footer className="mt-20 text-center text-gray-500 text-sm pb-8">
                    <p>&copy; {new Date().getFullYear()} AeroShare. Built for the decentralized web.</p>
                </footer>
            </div>
        </main>
    );
}
