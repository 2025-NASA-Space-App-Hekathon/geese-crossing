"use client";
import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export default function CameraFollowingLight() {
    const lightRef = useRef<THREE.DirectionalLight>(null);
    const { camera } = useThree();

    useFrame(() => {
        if (lightRef.current) {
            lightRef.current.position.copy(camera.position);
            lightRef.current.lookAt(0, 0, 0);
        }
    });

    return <directionalLight ref={lightRef} intensity={5} color="#ffffff" castShadow={false} />;
}
