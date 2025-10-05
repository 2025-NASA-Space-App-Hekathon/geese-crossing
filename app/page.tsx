"use client";
import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Text, AppShell, Stack, Box, Title, Group, Card } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import Header from '../components/organisms/header/Header';
import { useMountainStore } from '../components/store/mountainStore';
import OverlayPanel from '../components/organisms/OverlayPanel';

const EarthGlobe = dynamic(() => import('../components/organisms/EarthGlobe'), { ssr: false });

export default function Page() {
    const [opened, { toggle }] = useDisclosure();

    const { selected: selectedMountain } = useMountainStore();

    return (
        <AppShell
            header={{ height: 60 }}
            footer={{ height: 60 }}
            navbar={{
                width: 300,
                breakpoint: 'sm',
                collapsed: {
                    mobile: !opened,
                    desktop: false
                },
            }}
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
            <AppShell.Navbar p={16} bg={'rgba(0, 0, 0, 0)'} style={{
                borderWidth: 0,
            }}>
                <Stack>
                    {selectedMountain && selectedMountain.id > 0 ? (
                        <>
                            <Card style={{ opacity: 0.9 }}>
                                <Title order={4}>
                                    {selectedMountain ? selectedMountain.name : 'No mountain selected'}
                                </Title>
                            </Card>

                            {selectedMountain && selectedMountain.metadata && (
                                <Card style={{ opacity: 0.9 }}>
                                    <Text>
                                        Latitude: {selectedMountain.metadata.latitude.toFixed(4)}°
                                    </Text>
                                    <Text>
                                        Longitude: {selectedMountain.metadata.longitude.toFixed(4)}°
                                    </Text>
                                </Card>
                            )}
                        </>
                    ) : (
                        <Card style={{ opacity: 0.5 }}>
                            <Text>
                                Select a mountain.
                            </Text>
                        </Card>
                    )}
                    <Card style={{ opacity: 0.9 }}>
                        <OverlayPanel />
                    </Card>
                </Stack>
            </AppShell.Navbar>
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
