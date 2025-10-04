"use client";
import React, { useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

type ThreeSceneProps = {
    wireframe?: boolean;
    color?: string;
};

function RotatingBox({ wireframe = false, color = '#4ade80' }: ThreeSceneProps) {
    const ref = useRef<THREE.Mesh | null>(null);
    useFrame((state, delta) => {
        if (!ref.current) return;
        ref.current.rotation.x += delta * 0.6;
        ref.current.rotation.y += delta * 0.4;
    });
    return (
        <mesh ref={ref}>
            <boxGeometry args={[1.5, 1.5, 1.5]} />
            <meshStandardMaterial color={color} wireframe={wireframe} />
        </mesh>
    );
}

export default function ThreeScene(props: ThreeSceneProps) {
    return (
        <div className="canvas-wrap">
            <Canvas camera={{ position: [3, 3, 3] }}>
                <ambientLight intensity={0.5} />
                <directionalLight position={[5, 5, 5]} intensity={1} />
                <RotatingBox wireframe={props.wireframe} color={props.color} />
                <OrbitControls />
            </Canvas>
        </div>
    );
}
