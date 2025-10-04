"use client";
import { Autocomplete, Burger, Flex, Group, Mark, Text, Title } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import ThemeControl from '../../../components/atoms/ThemeControl';
import { useMountainStore } from '../../store/mountainStore';

export default function Header({ opened, toggle }: { opened: boolean; toggle: () => void; }) {
    return (
        <Flex p="sm" justify="space-between" align="center">
            <Group>
                <Burger opened={opened} onClick={toggle} size="sm" />
                <Title order={3}>Geese Crossing</Title>
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
