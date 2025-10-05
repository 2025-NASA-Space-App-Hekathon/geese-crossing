"use client";
import React from 'react';
import dynamic from 'next/dynamic';
import { Text, AppShell, Stack, Title, Card, Button, SimpleGrid, useComputedColorScheme } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import Header from '../components/organisms/header/Header';
import { useMountainStore } from '../components/store/mountainStore';
import OverlayPanel from '../components/organisms/OverlayPanel';
import { useUIStore } from '../components/store/uiStore';

const EarthGlobe = dynamic(() => import('../components/organisms/EarthGlobe'), { ssr: false });

export default function Page() {
    const [opened, { toggle }] = useDisclosure();
    const selectedMountain = useMountainStore((s) => s.selected);
    const hovered = useMountainStore((s) => s.hovered);
    const clearSelection = useMountainStore((s) => s.clear);
    const showMountainsMask = useUIStore((s) => s.showMountainsMask);
    const toggleMountainsMask = useUIStore((s) => s.toggleMountainsMask);
    const colorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });

    // Shared button style: dim when inactive
    const buttonRootStyle = (active: boolean): React.CSSProperties => ({
        filter: active ? undefined : 'grayscale(35%) brightness(0.9)'
    });

    // Three.js canvas background to sync with footer
    const sceneBg = colorScheme === 'light' ? '#ffffff' : '#000000';
    const footerTextColor = colorScheme === 'light' ? 'dark' : 'gray.4';

    return (
        <AppShell
            header={{ height: 60 }}
            footer={{ height: 60 }}
            navbar={{
                width: 300,
                breakpoint: 'sm',
                collapsed: {
                    mobile: !opened,
                    desktop: false,
                },
            }}
            aside={{
                width: 300,
                breakpoint: 'sm',
                collapsed: {
                    mobile: !opened,
                    desktop: false,
                },
            }}
            padding={0}
            styles={{
                main: {
                    padding: 0,
                    overflow: 'hidden',
                    position: 'relative',
                },
            }}
            h={'100dvh'}
        >
            <AppShell.Navbar p={16} bg={'rgba(0, 0, 0, 0)'} style={{ borderWidth: 0 }}>
                <Stack>
                    {/* Left panel title shows only clicked selection; otherwise placeholder */}
                    <Card style={{ opacity: 0.9 }}>
                        <Title order={4}>
                            {selectedMountain?.id && selectedMountain.id > 0
                                ? (selectedMountain.name || 'Selected mountain')
                                : 'Click a mountain range'}
                        </Title>
                    </Card>

                    {selectedMountain?.metadata && (
                        <Card style={{ opacity: 0.9 }}>
                            <Text>Latitude: {selectedMountain.metadata.latitude.toFixed(4)}°</Text>
                            <Text>Longitude: {selectedMountain.metadata.longitude.toFixed(4)}°</Text>
                        </Card>
                    )}

                    {/* Action buttons: 축소 & 산 마스크, 2-column grid */}
                    <Card style={{ opacity: 0.9 }}>
                        <SimpleGrid cols={2} spacing={8}>
                            {(() => {
                                const isShrinkActive = !!(selectedMountain && (selectedMountain.id ?? 0) > 0);
                                return (
                                    <Button
                                        size="xs"
                                        onClick={() => clearSelection()}
                                        disabled={!isShrinkActive}
                                        variant={isShrinkActive ? 'filled' : 'default'}
                                        styles={{ root: buttonRootStyle(isShrinkActive) }}
                                    >Return</Button>
                                );
                            })()}
                            {(() => {
                                const isMaskActive = !!showMountainsMask;
                                return (
                                    <Button
                                        size="xs"
                                        onClick={() => toggleMountainsMask()}
                                        variant={isMaskActive ? 'filled' : 'default'}
                                        styles={{ root: buttonRootStyle(isMaskActive) }}
                                    >{isMaskActive ? 'Uncolor' : 'Color'} Range</Button>
                                );
                            })()}
                        </SimpleGrid>
                    </Card>

                    <Card style={{ opacity: 0.9 }}>
                        <OverlayPanel />
                    </Card>
                </Stack>
            </AppShell.Navbar>

            <AppShell.Header>
                <Header opened={opened} toggle={toggle} />
            </AppShell.Header>

            <AppShell.Main
                pos="relative"
                w="100%"
                h="100%"
                style={{
                    padding: 0,
                    margin: 0,
                    overflow: 'hidden',
                    height: 'calc(100dvh - 120px)', // header(60px) + footer(60px) 제외
                }}
            >
                <EarthGlobe />
            </AppShell.Main>

            {/* Right side aside with hover info */}
            <AppShell.Aside p={16} bg={'rgba(0, 0, 0, 0)'} style={{ borderWidth: 0 }}>
                <Stack>
                    <Card style={{ opacity: 0.9 }}>
                        {hovered?.name ? (
                            <>
                                <Text fw={600} mt={8}>{hovered.name}</Text>
                                {hovered.metadata && (
                                    <Text size="sm" c="dimmed">
                                        Lat: {hovered.metadata.latitude.toFixed(4)}° · Lon: {hovered.metadata.longitude.toFixed(4)}°
                                    </Text>
                                )}
                            </>
                        ) : (
                            <Text c="dimmed" size="sm" mt={6}>hover your mouse on mountain range</Text>
                        )}
                    </Card>
                </Stack>
            </AppShell.Aside>

            <AppShell.Footer bg={'rgba(0, 0, 0, 0)'} style={{ borderWidth: 0, background: 'transparent' }}>
                <Text size="xs" c={'white'} mt={8}>
                    The 3D canvas is rendered with react-three-fiber (three.js) and controlled with Mantine UI (App Router).
                </Text>
            </AppShell.Footer>
        </AppShell>
    );
}