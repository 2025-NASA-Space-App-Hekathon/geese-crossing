"use client";
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useMountainStore } from '../../components/store/mountainStore';

export interface MountainPathPoint { lon: number; lat: number }
export interface MountainRangeData { id: string; name?: string; paths: MountainPathPoint[][] }

interface MountainRangesProps {
    ranges?: MountainRangeData[]; // 외부에서 이미 제공되는 산맥 분류 데이터
    radius?: number;
    visible?: boolean;
    color?: string;
    altitudeOffset?: number;
    thickness?: number; // 라인 두께 흉내 (확장 라인)
    attachTo?: React.RefObject<THREE.Object3D | null>;
    onRangeClick?: (info: { name?: string; centroid: { lat: number; lon: number } }) => void;
    showLabels?: boolean;
    labelColor?: string;
    labelBackground?: string;
    labelSize?: number;
    labelAltitudeOffset?: number;
}

export default function MountainRanges({
    ranges = [],
    radius = 1.5,
    visible = true,
    color = '#2d8bff',
    altitudeOffset = 0.04,
    thickness = 0,
    attachTo,
    onRangeClick,
    showLabels = true,
    labelColor = '#ffffff',
    labelBackground = 'rgba(0,0,0,0.55)',
    labelSize = 24,
    labelAltitudeOffset = 0.08
}: MountainRangesProps) {
    const groupRef = useRef<THREE.Group>(null);
    const allLineObjectsRef = useRef<THREE.Line[]>([]);
    const labelSpritesRef = useRef<THREE.Sprite[]>([]);
    const selected = useMountainStore(s => s.selected);

    // Height sampling (DataTexture assumed). Returns 0..1 or 0 if not available
    const lonLatToVec3 = (lonDeg: number, latDeg: number): THREE.Vector3 => {
        const SHIFT_DEG = 90;
        const rawLon = (lonDeg + SHIFT_DEG) * Math.PI / 180;
        const lat = latDeg * Math.PI / 180;
        const r = radius + altitudeOffset;
        const cosLat = Math.cos(lat);
        return new THREE.Vector3(
            cosLat * Math.sin(rawLon) * r,
            Math.sin(lat) * r,
            cosLat * Math.cos(rawLon) * r
        );
    };

    // 라벨용 위치 (조금 더 띄워서)
    const lonLatToLabelVec3 = (lonDeg: number, latDeg: number): THREE.Vector3 => {
        const SHIFT_DEG = 90;
        const rawLon = (lonDeg + SHIFT_DEG) * Math.PI / 180;
        const lat = latDeg * Math.PI / 180;
        const baseR = radius + altitudeOffset + labelAltitudeOffset;
        const cosLat = Math.cos(lat);
        return new THREE.Vector3(
            cosLat * Math.sin(rawLon) * baseR,
            Math.sin(lat) * baseR,
            cosLat * Math.cos(rawLon) * baseR
        );
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
        ctx.lineWidth = 10;
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.strokeText(text, canvas.width / 2, canvas.height / 2 + 4);
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
        if (attachTo?.current && groupRef.current && attachTo.current !== groupRef.current.parent) {
            attachTo.current.add(groupRef.current);
        }
    }, [attachTo]);

    useEffect(() => {
        const g = groupRef.current; if (!g) return;
        // cleanup old
        allLineObjectsRef.current.forEach(o => g.remove(o));
        labelSpritesRef.current.forEach(o => g.remove(o));
        allLineObjectsRef.current.length = 0;
        labelSpritesRef.current.length = 0;
        const baseMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 });
        for (const r of ranges) {
            let cx = 0, cy = 0, cz = 0, cc = 0;
            const linesForRange: THREE.Line[] = [];
            for (const path of r.paths) {
                if (path.length < 2) continue;
                const pts = path.map(p => lonLatToVec3(p.lon, p.lat));
                const geom = new THREE.BufferGeometry().setFromPoints(pts);
                const line = new THREE.Line(geom, baseMat.clone());
                line.userData.__mountainName = r.name;
                g.add(line);
                allLineObjectsRef.current.push(line);
                linesForRange.push(line);
                if (thickness > 0) {
                    const baseRad = radius + altitudeOffset;
                    const expand = (baseRad + thickness) / baseRad;
                    const thickPts = pts.map(v => v.clone().multiplyScalar(expand));
                    const thickGeom = new THREE.BufferGeometry().setFromPoints(thickPts);
                    const thickLine = new THREE.Line(thickGeom, (line.material as THREE.LineBasicMaterial).clone());
                    (thickLine.material as THREE.LineBasicMaterial).opacity = 0.6;
                    thickLine.userData.__mountainName = r.name;
                    thickLine.renderOrder = 2;
                    g.add(thickLine);
                    allLineObjectsRef.current.push(thickLine);
                    linesForRange.push(thickLine);
                }
                // centroid accumulate
                for (const p of path) {
                    const latR = THREE.MathUtils.degToRad(p.lat);
                    const lonR = THREE.MathUtils.degToRad(p.lon);
                    const cosLat = Math.cos(latR);
                    cx += cosLat * Math.cos(lonR);
                    cy += Math.sin(latR);
                    cz += cosLat * Math.sin(lonR);
                    cc++;
                }
            }
            let centroid = { lat: 0, lon: 0 };
            if (cc > 0) {
                cx /= cc; cy /= cc; cz /= cc;
                const hyp = Math.sqrt(cx * cx + cz * cz) || 1;
                const latR = Math.atan2(cy, hyp);
                const lonR = Math.atan2(cz, cx);
                centroid = { lat: THREE.MathUtils.radToDeg(latR), lon: THREE.MathUtils.radToDeg(lonR) };
            }
            for (const l of linesForRange) l.userData.__featureCentroid = centroid;
            if (showLabels && r.name) {
                const sprite = createLabelSprite(r.name, r.id);
                if (sprite) {
                    sprite.position.copy(lonLatToLabelVec3(centroid.lon, centroid.lat));
                    sprite.userData.__mountainName = r.name;
                    sprite.userData.__featureCentroid = centroid;
                    g.add(sprite);
                    labelSpritesRef.current.push(sprite);
                }
            }
        }
    }, [ranges, radius, altitudeOffset, color, thickness, showLabels, labelAltitudeOffset, labelBackground, labelColor, labelSize]);

    useEffect(() => { labelSpritesRef.current.forEach(s => { s.visible = showLabels; }); }, [showLabels]);

    useEffect(() => {
        const sel = selected?.name;
        allLineObjectsRef.current.forEach(l => {
            const mat = l.material as THREE.LineBasicMaterial;
            if (!sel) {
                mat.color.set(color); mat.opacity = 1; l.renderOrder = 1; return;
            }
            const match = l.userData.__mountainName === sel;
            if (match) { mat.color.set('#ffffff'); mat.opacity = 1; l.renderOrder = 1000; }
            else { mat.color.set(color); mat.opacity = 0.25; l.renderOrder = 1; }
        });
    }, [selected, color]);

    // 별도 raycast hook 불필요 (group onClick 사용)

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
                const cen = obj.userData.__featureCentroid as { lat: number; lon: number } | undefined;
                if (cen) onRangeClick({ name, centroid: { lat: cen.lat, lon: cen.lon } });
            }}
        />
    );
}
