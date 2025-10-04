"use client";
import React from 'react';
import { MantineProvider, ColorSchemeScript } from '@mantine/core';

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <>
            <ColorSchemeScript />
            <MantineProvider defaultColorScheme="dark">
                {children}
            </MantineProvider>
        </>
    );
}
