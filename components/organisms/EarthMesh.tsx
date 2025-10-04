"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { cartesianToLatLon, ClickInfo, getGlobeRotationForLatLon, isInSouthKorea } from '../../components/utils/globeMath';

export default function EarthMesh({ texture, heightMap, autoRotate, rotationSpeed, onLocationClick, externalRef, initialFocus }: {
    texture: THREE.Texture | null;
    heightMap?: THREE.Texture | null;
    autoRotate: boolean;
    rotationSpeed: number;
    onLocationClick: (c: ClickInfo) => void;
    externalRef?: React.RefObject<THREE.Mesh | null>;
    initialFocus?: { latitude: number; longitude: number };
}) {
    const internalRef = useRef<THREE.Mesh | null>(null);
    const ref = externalRef || internalRef;
    const { raycaster } = useThree();
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        if (ref.current && texture && !isInitialized) {
            if (initialFocus) {
                const { rotationX, rotationY } = getGlobeRotationForLatLon(initialFocus.latitude, initialFocus.longitude);
                ref.current.rotation.set(rotationX, rotationY, 0);
            }
            setIsInitialized(true);
        }
    }, [texture, isInitialized, initialFocus]);

    useFrame((_, delta) => {
        if (autoRotate && ref.current && isInitialized) {
            ref.current.rotation.y += rotationSpeed * delta;
        }
    });

    const material = useMemo(() => {
        if (texture) {
            const mat = new THREE.MeshStandardMaterial({
                map: texture,
                displacementMap: heightMap || undefined,
                displacementScale: heightMap ? 0.2 : 0, // 지형 과장률
                displacementBias: 0,
                roughness: 1,
                metalness: 0
            });
            return mat;
        }
        return new THREE.MeshStandardMaterial({ color: '#444' });
    }, [texture, heightMap]);

    // 클릭 vs 드래그 구분용 상태
    const pointerDownRef = useRef<{ x: number; y: number; t: number } | null>(null);
    const movedRef = useRef<boolean>(false);
    const DRAG_THRESHOLD_PX = 6; // 픽셀 이동 허용 범위

    const resolveClick = () => {
        if (!ref.current) return;
        const intersects = raycaster.intersectObject(ref.current);
        if (!intersects.length) return;
        const { point } = intersects[0];
        const inverseQuat = ref.current.quaternion.clone().invert();
        const localPoint = point.clone().applyQuaternion(inverseQuat);
        const { latitude, longitude } = cartesianToLatLon(localPoint);
        const clickInfo: ClickInfo = {
            latitude,
            longitude,
            isKorea: isInSouthKorea(latitude, longitude),
            timestamp: Date.now()
        };
        onLocationClick(clickInfo);
    };

    const handlePointerDown = (e: any) => {
        pointerDownRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
        movedRef.current = false;
    };

    const handlePointerMove = (e: any) => {
        if (!pointerDownRef.current) return;
        if (movedRef.current) return;
        const dx = e.clientX - pointerDownRef.current.x;
        const dy = e.clientY - pointerDownRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD_PX) {
            movedRef.current = true; // 드래그로 판정 (회전은 OrbitControls 담당)
        }
    };

    const handlePointerUp = (e: any) => {
        if (!pointerDownRef.current) return;
        const wasMoved = movedRef.current;
        pointerDownRef.current = null;
        if (!wasMoved) {
            resolveClick();
        }
    };

    return (
        <mesh
            ref={ref as any}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={() => { pointerDownRef.current = null; }}
        >
            {/* LOD: 기본 세그먼트 수를 줄여 성능 개선 (128 -> 96) */}
            <sphereGeometry args={[1.5, 96, 96]} />
            <primitive object={material} attach="material" />
        </mesh>
    );
}
