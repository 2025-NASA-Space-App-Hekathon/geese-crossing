"use client";
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

export default function CameraSetup({ onReady }: {
    onReady?: (camera: THREE.PerspectiveCamera) => void
}) {
    const { camera } = useThree();
    useEffect(() => {
        camera.position.set(0, 0, 4);
        // camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
        onReady?.(camera as THREE.PerspectiveCamera);
    }, [camera, onReady]);
    return null;
}
