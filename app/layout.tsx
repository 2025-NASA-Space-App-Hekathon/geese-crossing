import '@mantine/core/styles.css';
import './globals.css';
import React from 'react';
import type { Metadata } from 'next';
import Providers from './providers';

export const metadata: Metadata = {
    title: 'Geese Crossing - App Router',
    description: 'Mantine + Three.js (react-three-fiber) demo on Next.js 15 App Router'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="ko">
            <head />
            <body>
                <Providers>
                    {children}
                </Providers>
            </body>
        </html>
    );
}
