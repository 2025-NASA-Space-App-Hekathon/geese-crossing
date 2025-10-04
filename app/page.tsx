"use client";
import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Container, Title, Group, Button, ColorInput, Switch, Text } from '@mantine/core';

const ThreeScene = dynamic(() => import('../components/ThreeScene'), { ssr: false });

export default function Page() {
    const [wireframe, setWireframe] = useState(false);
    const [color, setColor] = useState('#4ade80');

    return (
        <Container size="lg" pt={24}>
            <Group justify="space-between" align="center">
                <Title order={2}>Geese Crossing — Mantine + Three.js (App Router)</Title>
                <Group>
                    <Text size="sm">Wireframe</Text>
                    <Switch checked={wireframe} onChange={(e) => setWireframe(e.currentTarget.checked)} />
                </Group>
            </Group>
            <Group gap="md" mt={12} mb={12}>
                <Button onClick={() => setWireframe(s => !s)}>Toggle Wireframe</Button>
                <ColorInput value={color} onChange={setColor} label="Cube color" format="hex" disallowInput={false} />
            </Group>
            <ThreeScene wireframe={wireframe} color={color} />
            <Text size="xs" c="dimmed" mt={8}>The 3D canvas is rendered with react-three-fiber (three.js) and controlled with Mantine UI (App Router).</Text>
        </Container>
    );
}
