"use client";
import React, { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getGlobeRotationForLatLon } from '../../components/utils/globeMath';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Box, useComputedColorScheme } from '@mantine/core';
import EarthMesh from './EarthMesh';
import CameraSetup from '../../components/atoms/CameraSetup';
import CameraFollowingLight from '../../components/atoms/CameraFollowingLight';
import ClickInfoPanel from '../../components/molecules/ClickInfoPanel';
import { ClickInfo } from '../../components/utils/globeMath';
import { loadGeoTiffToTexture, loadStandardImage, loadGeoTiffHeightMap } from '../../components/utils/textureLoaders';
import FocusAnimator from '../atoms/FocusAnimator';

export default function EarthGlobe() {
    const DEBUG = true; // 디버그 로깅 토글
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
        startZ?: number; // legacy (z-axis value) – kept for backward compatibility
        originalDistance?: number; // 실제 카메라-지구중심 거리 (포커스 전)
    }>({ mode: 'idle', progress: 0 });
    const [focusMode, setFocusMode] = useState<'idle' | 'focusing' | 'focused' | 'unfocusing'>('idle');
    // 초기 기본 회전 (대한민국 중앙)
    const initialBaseRotation = getGlobeRotationForLatLon(37.5, 127);

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
    // 축(axes) 표시 토글
    const [showAxes, setShowAxes] = useState<boolean>(true);
    const axesHelperRef = useRef<THREE.AxesHelper | null>(null);
    useEffect(() => {
        // 축이 안 보이던 이유:
        // 1) 축 길이가 지구 반지름(1.5)와 동일해서 선이 전부 구 내부에 가려짐
        // 2) effect 가 최초 렌더 때 globeRef.current 가 아직 설정 안 된 시점에 실행될 수 있음
        // 해결:
        // - 길이를 반지름보다 크게(2.2) 설정
        // - texture 로딩 이후(지구 mesh 초기화 후) 한 번 더 실행되도록 dependency 에 texture 포함
        if (!axesHelperRef.current) {
            axesHelperRef.current = new THREE.AxesHelper(2.2); // 지구 반지름(1.5)보다 크게
            axesHelperRef.current.name = 'GlobeAxesHelper';
            axesHelperRef.current.raycast = () => { };
        }
        const attachIfPossible = () => {
            if (!globeRef.current || !axesHelperRef.current) return;
            if (showAxes) {
                if (!globeRef.current.children.includes(axesHelperRef.current)) {
                    globeRef.current.add(axesHelperRef.current);
                }
            } else {
                if (globeRef.current.children.includes(axesHelperRef.current)) {
                    globeRef.current.remove(axesHelperRef.current);
                }
            }
        };
        attachIfPossible();
        // 한 번 더 지연 체크 (ref 세팅 지연 대비)
        const tid = setTimeout(attachIfPossible, 50);
        return () => {
            clearTimeout(tid);
            if (globeRef.current && axesHelperRef.current && globeRef.current.children.includes(axesHelperRef.current)) {
                globeRef.current.remove(axesHelperRef.current);
            }
        };
    }, [showAxes, texture]);

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
                dpr={[1, 2]}
                gl={{ antialias: true, alpha: false, preserveDrawingBuffer: false }}
                resize={{ scroll: false, debounce: { scroll: 50, resize: 0 } }}
            >
                {/* <CameraSetup onReady={(camera) => { }} /> */}
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
                        if (!info.isKorea) {
                            dlog('Non-Korea click -> ignore (no focus)');
                            return;
                        }
                        // 이미 focusing/focused 상태라면 재시작하지 않음
                        if (focusState.current.mode === 'focusing' || focusState.current.mode === 'focused') {
                            dlog('Already focusing/focused -> ignore'); return;
                        }
                        if (!globeRef.current) {
                            dlog('Globe ref missing'); return;
                        }
                        // 목표 회전 계산: 한국을 위(북쪽) 방향으로 보내 지평선 느낌

                        if (info.isKorea) {
                            const base = getGlobeRotationForLatLon(info.latitude, info.longitude);
                            // const targetRotY = initialBaseRotation.rotationY - rotationDelta.y; // 현재 회전 변화 반영
                            // const targetRotX = initialBaseRotation.rotationX; // 현재 회전 변화 반영
                            const targetRotY = initialBaseRotation.rotationY - rotationDelta.y; // 현재 회전 변화 반영
                            const targetRotX = initialBaseRotation.rotationX + rotationDelta.x; // 현재 회전 변화 반영
                            dlog('Focus start', {
                                baseRotX: base.rotationX.toFixed(4), baseRotY: base.rotationY.toFixed(4),
                                targetRotX: targetRotX.toFixed(4), targetRotY: targetRotY.toFixed(4)
                            });
                            // 지구 중심 위치와 카메라 거리 측정
                            const globeCenter = globeRef.current.getWorldPosition(new THREE.Vector3());
                            const cam = sceneCameraRef.current;
                            const camZ = cam ? cam.position.z : 0;
                            const originalDistance = cam ? cam.position.distanceTo(globeCenter) : 4;
                            focusState.current = {
                                mode: 'focusing',
                                progress: 0,
                                startRotX: globeRef.current.rotation.x,
                                startRotY: globeRef.current.rotation.y,
                                startZ: camZ,
                                originalDistance,
                                targetRotX,
                                targetRotY
                            };
                            setFocusMode('focusing');
                        }
                    }}
                    externalRef={globeRef}
                />
                {/* 카메라 객체를 상위 ref에 저장 */}
                <CaptureCamera onCapture={(cam) => { sceneCameraRef.current = cam; }} />
                <OrbitControls ref={controlsRef} enablePan={false} enableRotate={focusMode === 'idle'} enableZoom={focusMode === 'idle'} />
                {/* 포커싱 애니메이션 */}
                <FocusAnimator globeRef={globeRef} focusStateRef={focusState} setFocusMode={setFocusMode} />
                {/* 회전 변화 추적기 */}
                <RotationTracker
                    globeRef={globeRef}
                    controlsRef={controlsRef}
                    initialMeshRotation={{ x: initialBaseRotation.rotationX, y: initialBaseRotation.rotationY }}
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
                        const preservedStartZ = focusState.current.startZ ?? (sceneCameraRef.current ? sceneCameraRef.current.position.z : 4);
                        focusState.current = {
                            mode: 'unfocusing',
                            progress: 0,
                            startRotX: globeRef.current.rotation.x,
                            startRotY: globeRef.current.rotation.y,
                            startZ: preservedStartZ,
                            originalDistance: focusState.current.originalDistance,
                            targetRotX: initialBaseRotation.rotationX,
                            targetRotY: initialBaseRotation.rotationY
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
            {/* 축 표시 토글 버튼 */}
            <button
                onClick={() => setShowAxes(v => !v)}
                style={{
                    position: 'absolute',
                    bottom: 16,
                    left: 16,
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
            >{showAxes ? '축 숨기기' : '축 보이기'}</button>
            {error && (
                <div style={{ position: 'absolute', top: 8, left: 8, color: 'red', fontSize: 12, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.7)', padding: '4px 8px', borderRadius: '4px' }}>Error: {error}</div>
            )}
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


