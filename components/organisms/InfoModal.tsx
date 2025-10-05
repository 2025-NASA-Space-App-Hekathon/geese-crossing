"use client";
import { useDisclosure } from '@mantine/hooks';
import { Modal, Button, Flex, Title, Stack } from '@mantine/core';

function JsonParser({ data }: { data: string }) {
    const parsedData = JSON.parse(data);

    return (
        <Stack>

        </Stack>
    );
}

export default function InfoModal() {
    const [opened, { open, close }] = useDisclosure(false);

    const data = require('/public/content/what-is-sar.json');
  // Path to your HTML inside public/content/Explanation
  const htmlFilePath = '/content/Explanation/summary.html';
  const iframeSrc = encodeURI(htmlFilePath);

    return (
        <>
            <Modal opened={opened} onClose={close} withCloseButton={false} size={"100%"}>
                <Flex justify="space-between" p="md">
                    <Title order={3}>Explanation</Title>
                    <Button variant="outline" onClick={close}>Close</Button>
                </Flex>
                <hr />
                <div style={{ height: 'calc(100dvh - 120px)' }}>
                    <iframe
                        src={iframeSrc}
                        style={{ width: '100%', height: '100%', border: 0 }}
                        title="Explanation"
                    />
                </div>
            </Modal>

            <Button variant="default" onClick={open}>
                Open modal
            </Button>
        </>
    );
}