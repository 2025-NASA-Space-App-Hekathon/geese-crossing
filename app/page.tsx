"use client";
import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Text, AppShell } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import Header from '../components/organisms/header/Header';

const EarthGlobe = dynamic(() => import('../components/organisms/EarthGlobe'), { ssr: false });

export default function Page() {
    const [wireframe, setWireframe] = useState(false);
    const [color, setColor] = useState('#4ade80');
    const [mode, setMode] = useState<'cube' | 'earth'>('earth');
    const [earthTex, setEarthTex] = useState<'tif' | 'jpg'>('jpg');

    const [opened, { toggle }] = useDisclosure();

    return (
        <AppShell
            header={{ height: 60 }}
            footer={{ height: 60 }}
            padding={0}
            styles={{
                main: {
                    padding: 0,
                    overflow: 'hidden',
                    position: 'relative'
                }
            }}
            h={'100dvh'}
        >
            <AppShell.Header>
                <Header
                    opened={opened}
                    toggle={toggle}
                />
            </AppShell.Header>
            <AppShell.Main
                pos="relative"
                w="100%"
                h="100%"
                style={{
                    padding: 0,
                    margin: 0,
                    overflow: 'hidden',
                    height: 'calc(100dvh - 120px)' // header(60px) + footer(60px) 제외
                }}
            >
                <EarthGlobe />
            </AppShell.Main>
            <AppShell.Footer>
                <Text size="xs" c="dimmed" mt={8}>
                    The 3D canvas is rendered with react-three-fiber (three.js) and controlled with Mantine UI (App Router).
                </Text>
            </AppShell.Footer>
        </AppShell>
    );
}
