"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { cartesianToLatLon, ClickInfo, getGlobeRotationForLatLon } from '../../components/utils/globeMath';
import { useMountainStore } from '../../components/store/mountainStore';
import { SingleBandDataset } from '../../components/utils/textureLoaders';

export default function EarthMesh({ texture, heightMap, autoRotate, rotationSpeed, onLocationClick, externalRef, initialFocus, mountainsDataset, segments = 96, visible = true }: {
    texture: THREE.Texture | null;
    heightMap?: THREE.Texture | null;
    autoRotate: boolean;
    rotationSpeed: number;
    onLocationClick: (c: ClickInfo) => void;
    externalRef?: React.RefObject<THREE.Mesh | null>;
    initialFocus?: { latitude: number; longitude: number };
    mountainsDataset?: SingleBandDataset | null;
    segments?: number; // sphere segment resolution (both width & height)
    visible?: boolean;
}) {
    const internalRef = useRef<THREE.Mesh | null>(null);
    const ref = externalRef || internalRef;
    const { raycaster } = useThree();
    const [isInitialized, setIsInitialized] = useState(false);
    const { setHovered } = useMountainStore();

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
                displacementMap: heightMap || null,
                displacementScale: heightMap ? 0.08 : 0, // 지형 과장률
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

        const { point, uv } = intersects[0];

        // 클릭된 지점의 로컬 좌표 계산 (지구 회전 적용 전)
        const inverseQuat = ref.current.quaternion.clone().invert();
        const localPoint = point.clone().applyQuaternion(inverseQuat);

        // 위경도 계산
        const { latitude, longitude } = cartesianToLatLon(localPoint);

        // 정규화된 로컬 벡터 (구의 반지름 1.5로 정규화)
        const normalizedLocalVector = localPoint.clone().normalize().multiplyScalar(1.5);

        const clickInfo: ClickInfo = {
            latitude,
            longitude,
            timestamp: Date.now(),
            localVector: {
                x: normalizedLocalVector.x,
                y: normalizedLocalVector.y,
                z: normalizedLocalVector.z
            }
        };

        // Sample mountains dataset if available
        if (mountainsDataset && mountainsDataset.width > 0 && uv) {
            // uv from raycast already matches the geometry's map coordinates (including the longitude shift baked into texture)
            // Ensure wrapping range [0,1]
            let u = uv.x; let v = uv.y;
            if (u < 0) u = 0; else if (u > 1) u = 1;
            if (v < 0) v = 0; else if (v > 1) v = 1;
            const px = Math.min(mountainsDataset.width - 1, Math.max(0, Math.round(u * (mountainsDataset.width - 1))));
            const py = Math.min(mountainsDataset.height - 1, Math.max(0, Math.round((1 - v) * (mountainsDataset.height - 1)))); // invert v because texture loader used top->bottom mapping
            const idx = py * mountainsDataset.width + px;
            const val = mountainsDataset.data[idx];
            clickInfo.mountainsValue = val;
            clickInfo.mountainsPixelX = px;
            clickInfo.mountainsPixelY = py;

            // mountains.tif 값이 0보다 큰 경우에만 클릭 이벤트 발생
            if (val > 0) {
                onLocationClick(clickInfo);
            }
        } else {
            // mountains dataset가 없는 경우 기본적으로 클릭 이벤트 발생
            onLocationClick(clickInfo);
        }
    };

    const handlePointerDown = (e: any) => {
        pointerDownRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
        movedRef.current = false;
    };

    const handlePointerMove = (e: any) => {
        // If mouse is currently pressed, update drag threshold detection for click vs drag
        if (pointerDownRef.current) {
            const dx = e.clientX - pointerDownRef.current.x;
            const dy = e.clientY - pointerDownRef.current.y;
            if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD_PX) {
                movedRef.current = true; // 드래그로 판정 (회전은 OrbitControls 담당)
            }
        }

        // Always perform hover sampling on move (independent of mouse down)
        if (ref.current && mountainsDataset) {
            const intersects = raycaster.intersectObject(ref.current);
            
            if (intersects.length && intersects[0].uv) {
                let { x: u, y: v } = intersects[0].uv;
                if (u < 0) u = 0; else if (u > 1) u = 1;
                if (v < 0) v = 0; else if (v > 1) v = 1;
                const px = Math.min(mountainsDataset.width - 1, Math.max(0, Math.round(u * (mountainsDataset.width - 1))));
                const py = Math.min(mountainsDataset.height - 1, Math.max(0, Math.round((1 - v) * (mountainsDataset.height - 1))));
                const idx = py * mountainsDataset.width + px;
                const val = mountainsDataset.data[idx];
                
                const intId = Math.round(val);
                if (intId > 0) {
                    
                // Compute lat/lon for display
                    const inverseQuat = ref.current.quaternion.clone().invert();
                    const point = intersects[0].point.clone();
                    const localPoint = point.applyQuaternion(inverseQuat);
                    const { latitude, longitude } = cartesianToLatLon(localPoint.clone().normalize().multiplyScalar(1.5));
                    setHovered({ id: intId, metadata: { latitude, longitude } });
                } else {
                    setHovered(null);
                }
            } else {
                setHovered(null);
            }
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

    if (!visible) {
        return null;
    }

    return (
        <mesh
            ref={ref as any}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={() => { pointerDownRef.current = null; setHovered(null); }}
        >
            {/* Adjustable segment resolution */}
            <sphereGeometry args={[1.5, segments, segments]} />
            <primitive object={material} attach="material" />
        </mesh>
    );
}
