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
    // Optional: apply the same terrain displacement as the base Earth
    heightMap?: THREE.Texture | null;
    displacementScale?: number; // default aligns with EarthMesh (0.08)
    displacementBias?: number;  // small lift to mitigate z-fighting (e.g., 0.0005)
}

// Multi overlay manager (zustand driven)
// Responsibilities:
// 1. Fetch overlay index (id, path, extension) then initialize store (no textures yet)
// 2. Lazy-load texture when an overlay becomes visible
// 3. Render all visible overlays sorted by order (lower order under higher order)
export default function OverlayManager({ folderPath, globeRef, segments = 96, autoRefreshMs, heightMap, displacementScale = 0.08, displacementBias = 0.0005 }: OverlayManagerProps) {
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
                    heightMap={heightMap}
                    displacementScale={displacementScale}
                    displacementBias={displacementBias}
                />
            ))}
        </>
    );
}

function OverlayMesh({ record, globeRef, segments, renderOrderBase, heightMap, displacementScale, displacementBias }: { record: OverlayRecord; globeRef: React.RefObject<THREE.Mesh | null>; segments: number; renderOrderBase: number; heightMap?: THREE.Texture | null; displacementScale?: number; displacementBias?: number; }) {
    const ref = React.useRef<THREE.Mesh | null>(null);
    useFrame(() => {
        if (globeRef.current && ref.current) {
            ref.current.quaternion.copy(globeRef.current.quaternion);
        }
    });
    const material = React.useMemo(() => {
        if (!record.texture) return null;
        // If a heightMap is provided, use a displacement-capable material so the overlay follows terrain
        if (heightMap) {
            const mat = new THREE.MeshStandardMaterial({
                map: record.texture,
                transparent: true,
                depthWrite: false,
                depthTest: true,
                opacity: record.opacity,
                side: THREE.FrontSide,
                toneMapped: false,
                alphaTest: 0.05,
                blending: THREE.NormalBlending,
                displacementMap: heightMap,
                displacementScale: displacementScale ?? 0.08,
                displacementBias: displacementBias ?? 0.0005,
                roughness: 1,
                metalness: 0,
                color: 0xffffff,
            });
            // Slight polygon offset to reduce z-fighting with the base Earth
            mat.polygonOffset = true;
            mat.polygonOffsetFactor = -1;
            mat.polygonOffsetUnits = -1;
            return mat;
        }
        // Fallback: no displacement, keep Basic material (lighter & unlit)
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
    }, [record.texture, record.opacity, heightMap, displacementScale, displacementBias]);
    if (!material) return null;
    // Base radius: if using displacement, align with EarthMesh radius (1.5) and add tiny epsilon.
    // Otherwise keep prior slightly lifted shell.
    const baseRadius = heightMap ? 1.5 : 1.512;
    const epsilon = heightMap ? 0.001 : 0.0;
    const radius = baseRadius + epsilon + (record.order * 0.0003);
    return (
        <mesh ref={ref} renderOrder={renderOrderBase}>
            <sphereGeometry args={[radius, segments, segments]} />
            <primitive object={material} attach="material" />
        </mesh>
    );
}

export type { OverlayRecord };
