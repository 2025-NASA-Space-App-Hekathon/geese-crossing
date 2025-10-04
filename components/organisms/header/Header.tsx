import { Autocomplete, Burger, Flex, Group, Mark, Text, Title } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import ThemeControl from '../../../components/atoms/ThemeControl';
import InfoModal from '../InfoModal';

export default function Header({ opened, toggle }: { opened: boolean; toggle: () => void; }) {
    return (
        <Flex p="sm" justify="space-between" align="center">
            <Group>
                <Burger opened={opened} onClick={toggle} size="sm" hiddenFrom='sm' />
                <Title order={3}>SARchive</Title>
            </Group>
            <Group>
                <Group ml={50} gap={5} visibleFrom="sm">
                    <InfoModal />
                </Group>
                {/* <Autocomplete
                    placeholder="Search"
                    leftSection={<IconSearch size={16} stroke={1} />}
                    data={['React', 'Angular', 'Vue', 'Next.js', 'Riot.js', 'Svelte', 'Blitz.js']}
                    size="sm"
                /> */}
                <ThemeControl />
            </Group>
        </Flex>
    );
}
