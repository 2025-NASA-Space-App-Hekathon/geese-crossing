"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { Box, Divider, Group, Text } from '@mantine/core';
import { useOrderedOverlays } from '../store/overlayStore';

type YearsJson = {
  viridis_rgb_mapping: Record<string, {
    rgb: [number, number, number];
    hex: string;
    year: number;
    geological_period: string;
    normalized_value: number;
  }>;
};

type RockTypeJson = {
  rgb_mappings: Array<{
    rgb: [number, number, number];
    hex: string;
    rock_type: string;
  }>;
};

export default function OverlayLegend() {
  const overlays = useOrderedOverlays();

  // Determine visibility of target overlays by name (from file name without extension)
  const yearVisible = useMemo(() => overlays.some(o => o.visible && /year_of_creation/i.test(o.name)), [overlays]);
  const rockVisible = useMemo(() => overlays.some(o => o.visible && /rocks_per_region/i.test(o.name)), [overlays]);

  // Data states (lazy-load only when first needed)
  const [yearsData, setYearsData] = useState<YearsJson | null>(null);
  const [rockData, setRockData] = useState<RockTypeJson | null>(null);
  const [yearsErr, setYearsErr] = useState<string | null>(null);
  const [rockErr, setRockErr] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    if (yearVisible && !yearsData && !yearsErr) {
      fetch('/years.json')
        .then(r => r.json())
        .then((j: YearsJson) => { if (!aborted) setYearsData(j); })
        .catch(e => { if (!aborted) setYearsErr(String(e)); });
    }
    return () => { aborted = true; };
  }, [yearVisible, yearsData, yearsErr]);

  useEffect(() => {
    let aborted = false;
    if (rockVisible && !rockData && !rockErr) {
      fetch('/rock_type.json')
        .then(r => r.json())
        .then((j: RockTypeJson) => { if (!aborted) setRockData(j); })
        .catch(e => { if (!aborted) setRockErr(String(e)); });
    }
    return () => { aborted = true; };
  }, [rockVisible, rockData, rockErr]);

  // Prepare render arrays
  const yearsList = useMemo(() => {
    if (!yearsData) return [] as Array<{ hex: string; year: number; period: string; norm: number }>; 
    return Object.values(yearsData.viridis_rgb_mapping)
      .filter(v => (v.geological_period || '').toLowerCase() !== 'background')
      .sort((a, b) => a.normalized_value - b.normalized_value)
      .map(v => ({ hex: v.hex, year: v.year, period: v.geological_period, norm: v.normalized_value }));
  }, [yearsData]);

  const rockGroups = useMemo(() => {
    if (!rockData) return [] as Array<{ label: string; colors: string[] }>; 
    // Group by rock_type, maintain insertion order and unique colors per group
    const map = new Map<string, string[]>();
    for (const m of rockData.rgb_mappings) {
      if (!map.has(m.rock_type)) map.set(m.rock_type, []);
      const arr = map.get(m.rock_type)!;
      if (!arr.includes(m.hex)) arr.push(m.hex);
    }
    return Array.from(map.entries()).map(([label, colors]) => ({ label, colors }));
  }, [rockData]);

  // Nothing to show
  if (!yearVisible && !rockVisible) return null;

  return (
    <Box style={{ background: 'transparent', color: '#fff' }}>
      <Text size="lg" fw={700} mb={8} c="white">Legend</Text>

      {yearVisible && (
        <Box mb={rockVisible ? 12 : 0} style={{ background: 'transparent' }}>
          <Text size="md" fw={600} mb={6}>Year of Creation</Text>
          {yearsErr && <Text size="xs" c="red">Failed to load years.json</Text>}
          {!yearsErr && yearsList.length === 0 && <Text size="md" c="white" style={{ opacity: 0.85 }}>Loading…</Text>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {yearsList.map((item, idx) => (
              <LegendRow key={`${item.hex}-${idx}`} color={item.hex}>
                <Text size="md">Age: {item.year} · {item.period}</Text>
              </LegendRow>
            ))}
          </div>
        </Box>
      )}

      {yearVisible && rockVisible && (
        <Divider my={8} variant="dashed" style={{ opacity: 0.4 }} />
      )}

      {rockVisible && (
        <Box style={{ background: 'transparent' }}>
          <Text size="md" fw={600} mb={6}>Rocks per region</Text>
          {rockErr && <Text size="xs" c="red">Failed to load rock_type.json</Text>}
          {!rockErr && rockGroups.length === 0 && <Text size="md" c="white" style={{ opacity: 0.85 }}>Loading…</Text>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rockGroups.map((g) => (
              <div key={g.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 144 }}>
                  {g.colors.map((hex, i) => (
                    <ColorSwatch key={`${g.label}-${hex}-${i}`} hex={hex} shape="circle" />
                  ))}
                </div>
                <Text size="md" style={{ lineHeight: 1.2 }}>{g.label}</Text>
              </div>
            ))}
          </div>
        </Box>
      )}
    </Box>
  );
}

function LegendRow({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <ColorSwatch hex={color} />
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function ColorSwatch({ hex, shape = 'square' }: { hex: string; shape?: 'square' | 'circle' }) {
  const style: React.CSSProperties = {
    width: 18,
    height: 18,
    borderRadius: shape === 'circle' ? 999 : 3,
    background: hex,
    border: '1px solid rgba(0,0,0,0.2)',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.25)'
  };
  return <div style={style} aria-label={hex} title={hex} />;
}
