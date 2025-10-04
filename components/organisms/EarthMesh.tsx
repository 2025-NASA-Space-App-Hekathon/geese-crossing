"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { cartesianToLatLon, ClickInfo, getGlobeRotationForLatLon, isInSouthKorea } from '../../components/utils/globeMath';

export default function EarthMesh({ texture, autoRotate, rotationSpeed, onLocationClick }: {
    texture: THREE.Texture | null;
    autoRotate: boolean;
    rotationSpeed: number;
    onLocationClick: (c: ClickInfo) => void;
}) {
    const ref = useRef<THREE.Mesh | null>(null);
    const { raycaster } = useThree();
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        if (ref.current && texture && !isInitialized) {
            const { rotationX, rotationY } = getGlobeRotationForLatLon(37.5, 127);
            ref.current.rotation.set(rotationX, rotationY, 0);
            setIsInitialized(true);
        }
    }, [texture, isInitialized]);

    useFrame((_, delta) => {
        if (autoRotate && ref.current && isInitialized) {
            ref.current.rotation.y += rotationSpeed * delta;
        }
    });

    const material = useMemo(() => texture
        ? new THREE.MeshStandardMaterial({ map: texture })
        : new THREE.MeshStandardMaterial({ color: '#444' })
        , [texture]);

    const handleClick = (e: any) => {
        e.stopPropagation();
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

    return (
        <mesh ref={ref} onClick={handleClick}>
            <sphereGeometry args={[1.5, 64, 64]} />
            <primitive object={material} attach="material" />
        </mesh>
    );
}
