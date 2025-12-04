import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'Aeroshare - P2P File Sharing',
    description: 'Share files instantly with anyone, anywhere. Peer-to-peer, encrypted, no limits.',
    keywords: ['file sharing', 'P2P', 'WebRTC', 'transfer', 'secure'],
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <div className="min-h-screen flex flex-col">
                    {children}
                </div>
            </body>
        </html>
    );
}
