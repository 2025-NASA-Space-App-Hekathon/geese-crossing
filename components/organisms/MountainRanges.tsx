"use client";
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface MountainRangesProps {
    radius?: number; // sphere radius
    url?: string; // geojson path
    visible?: boolean;
    color?: string;
    lineWidth?: number; // (WebGL1 ignored, semantic only)
    simplifyModulo?: number; // sample every Nth point for performance
    altitudeOffset?: number; // lift above surface to avoid z-fighting
    onRangeClick?: (info: { name?: string; centroid: { lat: number; lon: number } }) => void;
    attachTo?: React.RefObject<THREE.Object3D | null>; // parent (globe) to follow rotation
    showLabels?: boolean; // 텍스트 라벨 표시 여부
    labelColor?: string; // 라벨 폰트 색
    labelBackground?: string; // 라벨 배경 색 (rgba)
    labelSize?: number; // 폰트 크기(px)
    labelAltitudeOffset?: number; // 기본 라인보다 추가 상승 높이
}

type GeoJSONPosition = [number, number]; // [lon, lat]

export default function MountainRanges({
    radius = 1.5,
    url = '/mountains.json',
    visible = true,
    color = '#ffcc66',
    lineWidth = 1,
    simplifyModulo = 1,
    altitudeOffset = 0.04,
    onRangeClick,
    attachTo,
    showLabels = true,
    labelColor = '#ffffff',
    labelBackground = 'rgba(0,0,0,0.55)',
    labelSize = 28,
    labelAltitudeOffset = 0.08
}: MountainRangesProps) {
    const groupRef = useRef<THREE.Group>(null);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const featureMetaRef = useRef<Array<{ name?: string; centroid: { lat: number; lon: number }; objects: THREE.Object3D[] }>>([]);
    const labelSpritesRef = useRef<THREE.Sprite[]>([]);

    // Convert lon/lat (deg) to 3D position on sphere (matching globeMath.ts conventions)
    const lonLatToVec3 = (lonDeg: number, latDeg: number): THREE.Vector3 => {
        // Apply texture shift of +90 deg used elsewhere
        const SHIFT_DEG = 90;
        const rawLon = (lonDeg + SHIFT_DEG) * Math.PI / 180;
        const lat = latDeg * Math.PI / 180;
        const r = radius + altitudeOffset;
        const cosLat = Math.cos(lat);
        const x = cosLat * Math.sin(rawLon) * r;
        const y = Math.sin(lat) * r;
        const z = cosLat * Math.cos(rawLon) * r;
        return new THREE.Vector3(x, y, z);
    };

    // 라벨용 위치 (조금 더 띄워서)
    const lonLatToLabelVec3 = (lonDeg: number, latDeg: number): THREE.Vector3 => {
        const SHIFT_DEG = 90;
        const rawLon = (lonDeg + SHIFT_DEG) * Math.PI / 180;
        const lat = latDeg * Math.PI / 180;
        const baseR = radius + altitudeOffset + labelAltitudeOffset;
        const cosLat = Math.cos(lat);
        const dir = new THREE.Vector3(
            cosLat * Math.sin(rawLon),
            Math.sin(lat),
            cosLat * Math.cos(rawLon)
        );
        dir.multiplyScalar(baseR);
        return dir;
    };

    const createLabelSprite = (text: string, key: string) => {
        const canvas = document.createElement('canvas');
        canvas.width = 512; // high-res for crispness
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = `bold ${labelSize * 4}px sans-serif`; // upscale then scale down
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const padding = 24;
        // background rounded rect
        const metrics = ctx.measureText(text);
        const bw = metrics.width + padding * 2;
        const bh = labelSize * 4 + padding * 2;
        const x = canvas.width / 2 - bw / 2;
        const y = canvas.height / 2 - bh / 2;
        const radiusCorner = 40;
        ctx.fillStyle = labelBackground;
        ctx.beginPath();
        ctx.moveTo(x + radiusCorner, y);
        ctx.lineTo(x + bw - radiusCorner, y);
        ctx.quadraticCurveTo(x + bw, y, x + bw, y + radiusCorner);
        ctx.lineTo(x + bw, y + bh - radiusCorner);
        ctx.quadraticCurveTo(x + bw, y + bh, x + bw - radiusCorner, y + bh);
        ctx.lineTo(x + radiusCorner, y + bh);
        ctx.quadraticCurveTo(x, y + bh, x, y + bh - radiusCorner);
        ctx.lineTo(x, y + radiusCorner);
        ctx.quadraticCurveTo(x, y, x + radiusCorner, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = labelColor;
        ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 4);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        const material = new THREE.SpriteMaterial({ map: texture, depthWrite: false, transparent: true });
        const sprite = new THREE.Sprite(material);
        const SCALE = 0.25; // tune
        sprite.scale.set(SCALE, SCALE * (canvas.height / canvas.width), 1);
        sprite.userData.__mountainName = text;
        sprite.userData.__isLabel = true;
        sprite.name = `Label:${key}`;
        return sprite;
    };

    useEffect(() => {
        // Parent to globe (attachTo) if provided
        if (attachTo?.current && groupRef.current && attachTo.current !== groupRef.current.parent) {
            attachTo.current.add(groupRef.current);
        }
    }, [attachTo]);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                if (cancelled) return;
                const g = groupRef.current;
                if (!g) return;

                const sharedMaterial = new THREE.LineBasicMaterial({ color, linewidth: lineWidth });

                const featureMetas: Array<{ name?: string; centroid: { lat: number; lon: number }; objects: THREE.Object3D[] }> = [];

                const addRing = (positions: GeoJSONPosition[]) => {
                    const pts: THREE.Vector3[] = [];
                    for (let i = 0; i < positions.length; i++) {
                        if (simplifyModulo > 1 && (i % simplifyModulo) !== 0 && i !== positions.length - 1) continue;
                        const [lon, lat] = positions[i];
                        pts.push(lonLatToVec3(lon, lat));
                    }
                    if (pts.length < 2) return;
                    const geom = new THREE.BufferGeometry().setFromPoints(pts);
                    const line = new THREE.Line(geom, sharedMaterial);
                    line.frustumCulled = true;
                    g.add(line);
                };

                if (Array.isArray(data.features)) {
                    for (const f of data.features) {
                        if (!f.geometry) continue;
                        const { type, coordinates } = f.geometry;
                        if (!coordinates) continue;
                        const objects: THREE.Object3D[] = [];
                        const collect = (ring: GeoJSONPosition[]) => {
                            const pts: THREE.Vector3[] = [];
                            const maxPoints = 800; // cap to avoid huge buffers
                            // adaptive step: longer rings -> larger step
                            const adaptiveStep = Math.max(simplifyModulo, Math.ceil(ring.length / maxPoints));
                            for (let i = 0; i < ring.length; i++) {
                                if ((i % adaptiveStep) !== 0 && i !== ring.length - 1) continue;
                                const [lon, lat] = ring[i];
                                pts.push(lonLatToVec3(lon, lat));
                            }
                            if (pts.length < 2) return;
                            const geom = new THREE.BufferGeometry().setFromPoints(pts);
                            const line = new THREE.Line(geom, sharedMaterial);
                            line.userData.__mountainName = f.properties?.Name;
                            line.userData.__mountainLonLat = ring[Math.floor(ring.length / 2)];
                            objects.push(line);
                            g.add(line);
                        };
                        if (type === 'Polygon') {
                            for (const ring of coordinates as GeoJSONPosition[][]) collect(ring);
                        } else if (type === 'MultiPolygon') {
                            for (const poly of coordinates as GeoJSONPosition[][][]) for (const ring of poly) collect(ring);
                        } else if (type === 'LineString') {
                            collect(coordinates as GeoJSONPosition[]);
                        } else if (type === 'MultiLineString') {
                            for (const line of coordinates as GeoJSONPosition[][]) collect(line);
                        }
                        // Improved centroid: average of all stored line userData lon/lat (midpoints)
                        let latSum = 0, lonSum = 0, cnt = 0;
                        for (const obj of objects) {
                            const ll = obj.userData.__mountainLonLat as GeoJSONPosition | undefined;
                            if (ll) { lonSum += ll[0]; latSum += ll[1]; cnt++; }
                        }
                        const centroid = { lat: cnt ? latSum / cnt : 0, lon: cnt ? lonSum / cnt : 0 };
                        featureMetas.push({ name: f.properties?.Name, centroid, objects });

                        // Label sprite
                        if (showLabels && f.properties?.Name) {
                            const sprite = createLabelSprite(f.properties.Name, f.properties.Name);
                            if (sprite) {
                                const pos = lonLatToLabelVec3(centroid.lon, centroid.lat);
                                sprite.position.copy(pos);
                                sprite.userData.__mountainLonLat = [centroid.lon, centroid.lat];
                                g.add(sprite);
                                labelSpritesRef.current.push(sprite);
                            }
                        }
                    }
                }
                featureMetaRef.current = featureMetas;
                setLoaded(true);
            } catch (e: any) {
                if (!cancelled) setError(e.message || String(e));
            }
        }
        load();
        return () => { cancelled = true; };
    }, [url, radius, color, lineWidth, simplifyModulo, altitudeOffset]);

    // 라벨 visibility 동기화
    useEffect(() => {
        labelSpritesRef.current.forEach(s => { s.visible = showLabels; });
    }, [showLabels]);

    // Raycast click handling if callback provided
    useEffect(() => {
        if (!onRangeClick) return;
        const handler = (e: MouseEvent) => {
            if (!groupRef.current) return;
            const rendererEl = (e.target as HTMLElement).closest('canvas');
            if (!rendererEl) return;
        };
        return () => { };
    }, [onRangeClick]);

    return (
        <group
            ref={groupRef}
            visible={visible}
            name="MountainRangesGroup"
            onClick={(e: any) => {
                if (!onRangeClick) return;
                e.stopPropagation();
                const obj = e.object as THREE.Object3D;
                const name = obj.userData.__mountainName as string | undefined;
                const ll = obj.userData.__mountainLonLat as GeoJSONPosition | undefined;
                if (ll) {
                    onRangeClick({ name, centroid: { lon: ll[0], lat: ll[1] } });
                }
            }}
        />
    );
}
