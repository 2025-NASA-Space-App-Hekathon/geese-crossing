"use client";
import { ActionIcon, useMantineColorScheme, useComputedColorScheme } from '@mantine/core';
import { IconSun, IconMoon } from '@tabler/icons-react';

export default function ThemeControl() {
    const { setColorScheme } = useMantineColorScheme();
    const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });
    return (
        <ActionIcon
            onClick={() => setColorScheme(computedColorScheme === 'light' ? 'dark' : 'light')}
            variant="default"
            size="lg"
            aria-label="Toggle color scheme"
        >
            <IconSun display={computedColorScheme === 'light' ? 'block' : 'none'} stroke={1.2} />
            <IconMoon display={computedColorScheme === 'dark' ? 'block' : 'none'} stroke={1.2} />
        </ActionIcon>
    );
}
