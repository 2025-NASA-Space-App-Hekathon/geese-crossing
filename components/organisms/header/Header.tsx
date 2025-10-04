"use client";
import { Autocomplete, Burger, Flex, Group, Text } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import ThemeControl from '../../../components/atoms/ThemeControl';

export default function Header({ opened, toggle }: { opened: boolean; toggle: () => void; }) {
    return (
        <Flex p="sm" justify="space-between" align="center">
            <Group>
                <Burger opened={opened} onClick={toggle} size="sm" hiddenFrom="sm" />
                <Text>Geese Crossing</Text>
            </Group>
            <Group>
                <Group ml={50} gap={5} visibleFrom="sm">Links</Group>
                <Autocomplete
                    placeholder="Search"
                    leftSection={<IconSearch size={16} stroke={1} />}
                    data={['React', 'Angular', 'Vue', 'Next.js', 'Riot.js', 'Svelte', 'Blitz.js']}
                    size="sm"
                />
                <ThemeControl />
            </Group>
        </Flex>
    );
}
