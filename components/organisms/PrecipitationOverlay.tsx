"use client";
import React, { useMemo } from 'react';
import * as THREE from 'three';

interface Props {
    texture: THREE.Texture | null;
    radius?: number;
    visible?: boolean;
    opacity?: number; // global opacity multiplier
    elevation?: number; // how far above base radius
    blending?: 'normal' | 'additive';
}

export default function PrecipitationOverlay({
    texture,
    radius = 1.5,
    visible = true,
    opacity = 0.85,
    elevation = 0.003,
    blending = 'normal'
}: Props) {
    const material = useMemo(() => {
        if (!texture) return null;
        const mat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false, // don't write to depth so underlying earth still visible
            depthTest: true,
            opacity,
            blending: blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending
        });
        // PremultipliedAlpha false (CanvasTexture is straight alpha)
        return mat;
    }, [texture, opacity, blending]);

    if (!texture || !material) return null;
    return (
        <mesh visible={visible} renderOrder={10}>
            <sphereGeometry args={[radius + elevation, 96, 96]} />
            <primitive object={material} attach="material" />
        </mesh>
    );
}