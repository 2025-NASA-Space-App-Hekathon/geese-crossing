"use client";
import { useDisclosure } from '@mantine/hooks';
import { Modal, Button, Flex, Title, Tabs, Box } from '@mantine/core';
import React from 'react';

export default function InfoModal() {
    const [opened, { open, close }] = useDisclosure(false);
    const [section, setSection] = React.useState<string>('1');
    // Path to your HTML inside public/content/Explanation
    const htmlFilePath = '/content/Explanation/summary.html';
    const iframeSrc = React.useMemo(() => {
        const url = new URL(htmlFilePath, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
        url.searchParams.set('section', section);
        return url.pathname + url.search;
    }, [section]);

    // Replace Modal's internal ScrollArea with a non-scrollable container
    const NoScrollArea: React.FC<React.ComponentPropsWithoutRef<'div'>> = ({ style, children, ...rest }) => (
        <div {...rest} style={{ ...style, overflow: 'hidden' }}>
            {children}
        </div>
    );

    return (
        <>
            <Modal
                opened={opened}
                onClose={close}
                withCloseButton={false}
                centered
                size="90%"
                scrollAreaComponent={NoScrollArea}
                padding={0}
            >
                <Box style={{ display: 'flex', flexDirection: 'column', height: '80dvh', width: '100%' }}>
                    <Flex justify="space-between" align="center" p="md" style={{ flex: '0 0 auto' }}>
                        <Title order={3}>About Our Project</Title>
                        <Button variant="outline" onClick={close}>Close</Button>
                    </Flex>
                    <hr style={{ margin: 0 }} />
                    <Tabs value={section} onChange={(v) => v && setSection(v)} style={{ flex: '0 0 auto' }}>
                        <Tabs.List>
                            <Tabs.Tab value="1">I</Tabs.Tab>
                            <Tabs.Tab value="2">II</Tabs.Tab>
                            <Tabs.Tab value="3">III</Tabs.Tab>
                            <Tabs.Tab value="4">IV</Tabs.Tab>
                        </Tabs.List>
                    </Tabs>
                    <div style={{ flex: '1 1 auto', height: 0 }}>
                        <iframe
                            src={iframeSrc}
                            style={{ width: '100%', height: '100%', border: 0 }}
                            title="Explanation"
                        />
                    </div>
                </Box>
            </Modal>

            <Button variant="default" onClick={open}>
                Open modal
            </Button>
        </>
    );
}