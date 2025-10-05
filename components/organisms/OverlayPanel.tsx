"use client"

import { Flex, Stack, Text } from "@mantine/core";
import { useOrderedOverlays, useOverlayActions } from "../store/overlayStore";

export default function OverlayPanel() {

    const orderedOverlays = useOrderedOverlays();
    const { toggleVisibility: onToggle, setOpacity: onOpacityChange, hideAll, showAll } = useOverlayActions();

    return (
        <Stack>
            <Text>
                Overlays
            </Text>
            {orderedOverlays.map((o) => (
                <Flex key={o.id} style={{
                    display: 'flex',
                    flexDirection: 'column',
                }}>
                    <Flex justify={"space-between"}>
                        <Text onClick={() => onToggle(o.id)} size="sm">
                            {o.name}
                        </Text>
                        <input
                            type="checkbox"
                            checked={o.visible}
                            onChange={() => onToggle(o.id)}
                            style={{ cursor: 'pointer' }}
                        />
                    </Flex>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                            type="range"
                            min={0.05}
                            max={1}
                            step={0.05}
                            value={o.opacity}
                            onChange={(e) => onOpacityChange(o.id, parseFloat(e.target.value))}
                            style={{ flex: 1 }}
                        />
                        <span style={{ width: 36, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{(o.opacity * 100).toFixed(0)}%</span>
                    </div>
                    <div style={{ fontSize: 10, opacity: 0.6 }}>
                        {o.status === 'idle' && !o.visible && '대기'}
                        {o.status === 'loading' && '로딩중...'}
                        {o.status === 'ready' && (o.visible ? '표시중' : '로드됨')}
                        {o.status === 'error' && <span style={{ color: '#ff6666' }}>오류</span>}
                    </div>
                </Flex>
            ))
            }
        </Stack >
    )
}