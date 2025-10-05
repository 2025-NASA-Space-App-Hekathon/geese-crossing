"use client";
import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { loadGeoTiffMaskTexture, loadStandardImage } from '../utils/textureLoaders';
import { useOrderedOverlays, useOverlayActions, useOverlayStore, OverlayRecord } from '../store/overlayStore';

interface OverlayManagerProps {
    folderPath: string;
    globeRef: React.RefObject<THREE.Mesh | null>;
    segments?: number;
    autoRefreshMs?: number; // optional polling interval
}

// Multi overlay manager (zustand driven)
// Responsibilities:
// 1. Fetch overlay index (id, path, extension) then initialize store (no textures yet)
// 2. Lazy-load texture when an overlay becomes visible
// 3. Render all visible overlays sorted by order (lower order under higher order)
export default function OverlayManager({ folderPath, globeRef, segments = 96, autoRefreshMs }: OverlayManagerProps) {
    const ordered = useOrderedOverlays();
    const initialize = useOverlayStore(s => s.initialize);
    const { registerTexture, markLoading, markError } = useOverlayActions();

    // Fetch overlay list + optional polling
    useEffect(() => {
        let aborted = false;
        const fetchList = async () => {
            try {
                const res = await fetch(`/api/overlays?folder=${encodeURIComponent(folderPath)}`);
                const json = await res.json();
                if (!json.success) throw new Error(json.error || 'Failed to load overlays');
                if (!aborted) {
                    initialize(json.files.map((f: any) => ({ id: f.id, name: f.name, path: f.path, extension: f.extension })));
                }
            } catch (e) {
                if (!aborted) console.warn('[OverlayManager] list fetch error:', e);
            }
        };
        fetchList();
        let timer: any;
        if (autoRefreshMs && autoRefreshMs > 0) {
            timer = setInterval(fetchList, autoRefreshMs);
        }
        return () => { aborted = true; if (timer) clearInterval(timer); };
    }, [folderPath, autoRefreshMs, initialize]);

    // Lazy load textures for visible overlays
    useEffect(() => {
        ordered.forEach(o => {
            if (o.visible && o.status === 'idle') {
                markLoading(o.id);
                const ext = o.extension.toLowerCase();
                (async () => {
                    try {
                        let tex: THREE.Texture;
                        if (ext === '.tif' || ext === '.tiff') {
                            tex = await loadGeoTiffMaskTexture(o.path, { threshold: 0, color: o.color, maxAlpha: 0.85, scaleAlphaByValue: true });
                        } else {
                            tex = await loadStandardImage(o.path);
                            tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true;
                        }
                        registerTexture(o.id, tex, (ext === '.tif' || ext === '.tiff'));
                    } catch (err: any) {
                        markError(o.id, String(err));
                    }
                })();
            }
        });
    }, [ordered, registerTexture, markLoading, markError]);

    const visibleOverlays = useMemo(() => ordered.filter(o => o.visible && o.status === 'ready' && o.texture), [ordered]);
    const sortedVisible = useMemo(() => [...visibleOverlays].sort((a, b) => a.order - b.order), [visibleOverlays]);

    return (
        <>
            {sortedVisible.map((o, idx) => (
                <OverlayMesh
                    key={o.id}
                    record={o}
                    globeRef={globeRef}
                    segments={segments}
                    renderOrderBase={250 + idx}
                />
            ))}
        </>
    );
}

function OverlayMesh({ record, globeRef, segments, renderOrderBase }: { record: OverlayRecord; globeRef: React.RefObject<THREE.Mesh | null>; segments: number; renderOrderBase: number; }) {
    const ref = React.useRef<THREE.Mesh | null>(null);
    useFrame(() => {
        if (globeRef.current && ref.current) {
            ref.current.quaternion.copy(globeRef.current.quaternion);
        }
    });
    const material = React.useMemo(() => {
        if (!record.texture) return null;
        return new THREE.MeshBasicMaterial({
            map: record.texture,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            opacity: record.opacity,
            side: THREE.FrontSide,
            toneMapped: false,
            alphaTest: 0.05,
            blending: THREE.NormalBlending
        });
    }, [record.texture, record.opacity]);
    if (!material) return null;
    // Small incremental lift to mitigate z-fighting (order stable)
    const radius = 1.512 + (record.order * 0.0004);
    return (
        <mesh ref={ref} renderOrder={renderOrderBase}>
            <sphereGeometry args={[radius, segments, segments]} />
            <primitive object={material} attach="material" />
        </mesh>
    );
}

export type { OverlayRecord };
