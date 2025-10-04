"use client";
import React, { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getGlobeRotationForLatLon } from '../../components/utils/globeMath';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Box, useComputedColorScheme } from '@mantine/core';
import EarthMesh from './EarthMesh';
import CameraFollowingLight from '../../components/atoms/CameraFollowingLight';
import ClickInfoPanel from '../../components/molecules/ClickInfoPanel';
import { ClickInfo } from '../../components/utils/globeMath';
import { loadGeoTiffToTexture, loadStandardImage, loadGeoTiffHeightMap } from '../../components/utils/textureLoaders';
import FocusAnimator from '../atoms/FocusAnimator';
import MountainRanges from './MountainRanges';

export default function EarthGlobe() {
    const DEBUG = typeof window !== 'undefined' && (window as any).__GLOBE_DEBUG__ === true; // 전역 플래그로 제어 (기본 off)
    const dlog = (...args: any[]) => { if (DEBUG) console.log('[EarthGlobe]', ...args); };

    const [texture, setTexture] = useState<THREE.Texture | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [heightMap, setHeightMap] = useState<THREE.Texture | null>(null);
    const [clickInfo, setClickInfo] = useState<ClickInfo | null>(null);
    const globeRef = useRef<THREE.Mesh | null>(null);
    // 가상 지구 회전 변화 (라디안)
    const [rotationDelta, setRotationDelta] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    // mode: 'idle' | 'focusing' | 'focused' | 'unfocusing'
    const focusState = useRef<{
        mode: string;
        progress: number;
        startRotX?: number;
        startRotY?: number;
        targetRotX?: number;
        targetRotY?: number;
        originalDistance?: number; // 실제 카메라-지구중심 거리 (포커스 전)
    }>({ mode: 'idle', progress: 0 });
    const [focusMode, setFocusMode] = useState<'idle' | 'focusing' | 'focused' | 'unfocusing'>('idle');
    // 한국 기준 회전 (클릭 / 버튼 시 사용)
    const koreaBaseRotationRef = useRef(getGlobeRotationForLatLon(37.5, 127));

    // 짧은 회전 경로 보정 (-PI~PI) helper
    const normalizeAngle = (a: number) => {
        const TWO = Math.PI * 2;
        return ((a + Math.PI) % TWO + TWO) % TWO - Math.PI;
    };
    const shortest = (from: number, to: number) => {
        let diff = normalizeAngle(to - from);
        return from + diff;
    };

    const startFocus = (targetRotX: number, targetRotY: number) => {
        if (!globeRef.current) return;
        if (focusState.current.mode === 'focusing' || focusState.current.mode === 'focused') return;
        // 현재 회전 상태
        const curX = globeRef.current.rotation.x;
        const curY = globeRef.current.rotation.y;
        // 최단 회전 경로로 목표 재조정
        const adjTargetX = shortest(curX, targetRotX);
        const adjTargetY = shortest(curY, targetRotY);
        const globeCenter = globeRef.current.getWorldPosition(new THREE.Vector3());
        const cam = sceneCameraRef.current;
        const originalDistance = cam ? cam.position.distanceTo(globeCenter) : 4;
        focusState.current = {
            mode: 'focusing',
            progress: 0,
            startRotX: curX,
            startRotY: curY,
            originalDistance,
            targetRotX: adjTargetX,
            targetRotY: adjTargetY
        };
        setFocusMode('focusing');
        dlog('Focus start', { curX: curX.toFixed(3), curY: curY.toFixed(3), targetRotX: adjTargetX.toFixed(3), targetRotY: adjTargetY.toFixed(3) });
    };

    const containerRef = useRef<HTMLDivElement>(null);
    const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });
    const url = computedColorScheme === 'light' ? '/earth_daymap.jpg' : '/earth_nightmap.jpg';

    useEffect(() => {
        let cancelled = false;
        const startedAt = performance.now();
        const lower = url.toLowerCase();
        const isTiff = lower.endsWith('.tif') || lower.endsWith('.tiff');
        dlog('Texture load start', { url, isTiff });
        (isTiff ? loadGeoTiffToTexture(url) : loadStandardImage(url))
            .then(tex => {
                if (!cancelled) {
                    dlog('Texture load success', { url, ms: Math.round(performance.now() - startedAt), size: { w: tex.image?.width, h: tex.image?.height } });
                    setTexture(tex);
                }
            })
            .catch(e => {
                if (!cancelled) {
                    dlog('Texture load error', e);
                    setError(e.message);
                }
            });
        const hmStart = performance.now();
        loadGeoTiffHeightMap('/earth1.tif', { invert: true })
            .then(h => { if (!cancelled) { dlog('HeightMap load success', { ms: Math.round(performance.now() - hmStart) }); setHeightMap(h); } })
            .catch(e => { if (!cancelled) { console.warn('Height map load failed', e); dlog('HeightMap load failed', e); } });
        return () => { cancelled = true; };
    }, [url]);

    useEffect(() => {
        const handleResize = () => {
            if (containerRef.current) {
                const canvas = containerRef.current.querySelector('canvas');
                if (canvas) {
                    const { clientWidth, clientHeight } = containerRef.current;
                    canvas.style.width = clientWidth + 'px';
                    canvas.style.height = clientHeight + 'px';
                }
            }
        };
        window.addEventListener('resize', handleResize);
        setTimeout(handleResize, 100);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const controlsRef = useRef<any>(null);
    const sceneCameraRef = useRef<THREE.Camera | null>(null); // Canvas 내부 카메라 캡쳐용
    const [showMountains, setShowMountains] = useState(true);
    const [showMountainLabels, setShowMountainLabels] = useState(true);

    return (
        <Box
            ref={containerRef}
            className="three-canvas-container"
            pos="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            w="100%"
            h="100%"
            style={{ overflow: 'hidden' }}
        >
            <Canvas
                camera={{ position: [0, 0, 4] }}
                style={{ width: '100%', height: '100%', display: 'block' }}
                dpr={Math.min(1.5, typeof window !== 'undefined' ? window.devicePixelRatio : 1)}
                gl={{ antialias: true, alpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' }}
                resize={{ scroll: false, debounce: { scroll: 50, resize: 0 } }}
            >
                <ambientLight intensity={0.3} />
                <CameraFollowingLight />
                <EarthMesh
                    texture={texture}
                    heightMap={heightMap}
                    autoRotate={false}
                    rotationSpeed={0.01}
                    onLocationClick={(info) => {
                        setClickInfo(info);
                        dlog('Click', {
                            lat: info.latitude.toFixed(3),
                            lon: info.longitude.toFixed(3),
                            isKorea: info.isKorea,
                            currentMode: focusState.current.mode,
                            current: globeRef.current ? { rotX: globeRef.current.rotation.x.toFixed(4), rotY: globeRef.current.rotation.y.toFixed(4) } : null
                        });
                        // Korea 클릭시에만 포커스. 다른 지역 클릭은 완전 무시
                        if (info.isKorea) {
                            // 한국 클릭 -> 한국 기준 회전 값 사용 (rotationDelta 로 보정)
                            const base = koreaBaseRotationRef.current;
                            const targetRotY = base.rotationY - rotationDelta.y;
                            const targetRotX = base.rotationX + rotationDelta.x;
                            startFocus(targetRotX, targetRotY);
                        } else {
                            dlog('Non-Korea click (no focus)');
                        }
                    }}
                    externalRef={globeRef}
                />
                {/* 카메라 객체를 상위 ref에 저장 */}
                <CaptureCamera onCapture={(cam) => { sceneCameraRef.current = cam; }} />
                <OrbitControls ref={controlsRef} enablePan={false} enableRotate={focusMode === 'idle'} enableZoom={focusMode === 'idle'} />
                {/* 포커싱 애니메이션 */}
                <FocusAnimator globeRef={globeRef} focusStateRef={focusState} setFocusMode={setFocusMode} />
                {/* 산맥(GeoJSON) 라인 */}
                <MountainRanges
                    radius={1.5}
                    visible={showMountains}
                    simplifyModulo={4}
                    altitudeOffset={0.06}
                    color={computedColorScheme === 'light' ? '#ffcf4d' : '#ffd27a'}
                    attachTo={globeRef}
                    showLabels={showMountainLabels}
                    labelColor={'#ffffff'}
                    labelBackground={'rgba(0,0,0,0.55)'}
                    labelSize={18}
                    labelAltitudeOffset={0.12}
                    onRangeClick={({ centroid }) => {
                        // 산맥 중심(lat/lon) -> 회전값 계산 후 포커스
                        const rot = getGlobeRotationForLatLon(centroid.lat, centroid.lon);
                        // rotationDelta 반영 (현재 가상 회전) 역보정
                        const targetRotY = rot.rotationY - rotationDelta.y;
                        const targetRotX = rot.rotationX + rotationDelta.x;
                        startFocus(targetRotX, targetRotY);
                    }}
                />
                {/* 회전 변화 추적기 */}
                <RotationTracker
                    globeRef={globeRef}
                    controlsRef={controlsRef}
                    initialMeshRotation={{ x: 0, y: 0 }}
                    onDelta={(d) => setRotationDelta(d)}
                />
            </Canvas>
            <ClickInfoPanel info={clickInfo} onClose={() => setClickInfo(null)} />
            {/* 회전 변화 표시 (초기 기준) */}
            <div
                style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    fontSize: 12,
                    lineHeight: 1.4,
                    background: 'rgba(0,0,0,0.55)',
                    color: '#fff',
                    padding: '6px 10px',
                    borderRadius: 6,
                    fontFamily: 'monospace',
                    zIndex: 1200,
                    pointerEvents: 'none'
                }}
            >
                <div style={{ opacity: 0.75 }}>Virtual Globe Rotation Δ (rad)</div>
                <div>ΔX: {rotationDelta.x.toFixed(3)}</div>
                <div>ΔY: {rotationDelta.y.toFixed(3)}</div>
            </div>
            {(focusMode === 'focused' || focusMode === 'focusing') && (
                <button
                    onClick={() => {
                        if (!globeRef.current) return;
                        if (focusState.current.mode === 'unfocusing') return; // already
                        // 수동 축소
                        dlog('Unfocus button clicked', { from: focusState.current.mode });
                        focusState.current = {
                            mode: 'unfocusing',
                            progress: 0,
                            startRotX: globeRef.current.rotation.x,
                            startRotY: globeRef.current.rotation.y,
                            originalDistance: focusState.current.originalDistance,
                            targetRotX: globeRef.current.rotation.x,
                            targetRotY: globeRef.current.rotation.y
                        };
                        setFocusMode('unfocusing');
                    }}
                    style={{
                        position: 'absolute',
                        top: 16,
                        left: 16,
                        zIndex: 1100,
                        background: 'rgba(0,0,0,0.55)',
                        color: 'white',
                        border: '1px solid rgba(255,255,255,0.2)',
                        padding: '8px 14px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        backdropFilter: 'blur(4px)'
                    }}
                >축소</button>
            )}
            {error && (
                <div style={{ position: 'absolute', top: 8, left: 8, color: 'red', fontSize: 12, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.7)', padding: '4px 8px', borderRadius: '4px' }}>Error: {error}</div>
            )}
            {/* 한국 포커스 버튼 (선택적 수동 트리거) */}
            {focusMode === 'idle' && (
                <button
                    onClick={() => {
                        const base = koreaBaseRotationRef.current;
                        const targetRotY = base.rotationY - rotationDelta.y;
                        const targetRotX = base.rotationX + rotationDelta.x;
                        startFocus(targetRotX, targetRotY);
                    }}
                    style={{
                        position: 'absolute',
                        top: 16,
                        left: 16,
                        zIndex: 1100,
                        background: 'rgba(0,0,0,0.55)',
                        color: 'white',
                        border: '1px solid rgba(255,255,255,0.2)',
                        padding: '8px 14px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        backdropFilter: 'blur(4px)'
                    }}
                >한국 포커스</button>
            )}
            {/* 산맥 표시 토글 */}
            <button
                onClick={() => setShowMountains(v => !v)}
                style={{
                    position: 'absolute',
                    bottom: 16,
                    left: 300,
                    zIndex: 1100,
                    background: 'rgba(0,0,0,0.55)',
                    color: 'white',
                    border: '1px solid rgba(255,255,255,0.2)',
                    padding: '6px 12px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 12,
                    backdropFilter: 'blur(4px)'
                }}
            >{showMountains ? '산맥 숨기기' : '산맥 보이기'}</button>
            {/* 산맥 라벨 토글 */}
            <button
                onClick={() => setShowMountainLabels(v => !v)}
                style={{
                    position: 'absolute',
                    bottom: 16,
                    left: 430,
                    zIndex: 1100,
                    background: 'rgba(0,0,0,0.55)',
                    color: 'white',
                    border: '1px solid rgba(255,255,255,0.2)',
                    padding: '6px 12px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 12,
                    backdropFilter: 'blur(4px)'
                }}
            >{showMountainLabels ? '라벨 숨기기' : '라벨 보이기'}</button>
        </Box>
    );
}

// Canvas 내부에서 three.js camera를 참조용 ref에 저장
function CaptureCamera({ onCapture }: { onCapture: (c: THREE.Camera) => void }) {
    const { camera } = useThree();
    useEffect(() => { onCapture(camera); }, [camera, onCapture]);
    return null;
}

// OrbitControls 기반 '가상 지구 회전' 추적 컴포넌트
// 카메라가 도는 것을 지구가 반대로 돈 것으로 간주하여 Δ를 계산
function RotationTracker({ globeRef, controlsRef, initialMeshRotation, onDelta }: {
    globeRef: React.RefObject<THREE.Mesh | null>;
    controlsRef: React.RefObject<any>;
    initialMeshRotation: { x: number; y: number };
    onDelta: (d: { x: number; y: number }) => void;
}) {
    const lastSent = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const baseAnglesRef = useRef<{ azimuthal: number; polar: number } | null>(null);
    const norm = (r: number) => {
        const TWO = Math.PI * 2;
        return ((r + Math.PI) % TWO + TWO) % TWO - Math.PI; // -PI~PI
    };
    useFrame(() => {
        const ctrl = controlsRef.current;
        if (!ctrl) return;
        // THREE.OrbitControls 내부의 구면 좌표 접근 (비공식 속성: getPolarAngle / getAzimuthalAngle가 있으면 사용)
        const azimuthal = typeof ctrl.getAzimuthalAngle === 'function' ? ctrl.getAzimuthalAngle() : (ctrl as any).azimuthalAngle || 0;
        const polar = typeof ctrl.getPolarAngle === 'function' ? ctrl.getPolarAngle() : (ctrl as any).polarAngle || 0;
        if (!baseAnglesRef.current) {
            baseAnglesRef.current = { azimuthal, polar };
        }
        const dazim = norm(azimuthal - baseAnglesRef.current.azimuthal);
        const dpolar = norm(polar - baseAnglesRef.current.polar);
        // 카메라가 +azimuthal 로 돈 것은 지구가 -Y 로 돈 것과 유사
        // ΔY: -dazim, ΔX: dpolar (위/아래 기울임 느낌)
        const dx = dpolar; // x축 회전 변화(위/아래)
        const dy = -dazim; // y축 회전 변화(좌/우)
        if (Math.abs(dx - lastSent.current.x) > 0.004 || Math.abs(dy - lastSent.current.y) > 0.004) {
            lastSent.current = { x: dx, y: dy };
            onDelta({ x: dx, y: dy });
        }
    });
    return null;
}


