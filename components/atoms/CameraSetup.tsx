"use client";
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

export default function CameraSetup() {
    const { camera } = useThree();
    useEffect(() => {
        camera.position.set(0, 0, 4);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
    }, [camera]);
    return null;
}
