"use client";
import React, { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGlobeRotationForLatLon, computePointFocusRotation, verifyCollinearity } from '../../components/utils/globeMath';
import { dlog, isDebug } from '../../components/utils/debugConfig';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Box, useComputedColorScheme } from '@mantine/core';
import EarthMesh from './EarthMesh';
import CameraFollowingLight from '../../components/atoms/CameraFollowingLight';
import ClickInfoPanel from '../../components/molecules/ClickInfoPanel';
import { ClickInfo } from '../../components/utils/globeMath';
import { loadGeoTiffToTexture, loadStandardImage, loadGeoTiffHeightMap, loadGeoTiffMaskTexture, loadGeoTiffSingleBand, SingleBandDataset } from '../../components/utils/textureLoaders';
import { LONGITUDE_TEXTURE_SHIFT_DEG } from '../../components/utils/globeMath';
import MountainsMaskOverlay from './MountainsMaskOverlay';
import FocusAnimator from '../atoms/FocusAnimator';
import MountainRanges from './MountainRanges';
import { useMountainStore } from '../../components/store/mountainStore';
import { useMemo } from 'react';

export default function EarthGlobe() {
    const DEBUG = isDebug();

    // 디버그 모드 활성화를 위한 전역 설정
    useEffect(() => {
        if (typeof window !== 'undefined') {
            (window as any).__GLOBE_DEBUG__ = true; // 디버그 모드 활성화
            dlog('EarthGlobe debug mode active');
        }
    }, []);

    const USE_ROTATION_DELTA_COMPENSATION = true; // 기존 보상 여부
    const ALWAYS_CANONICAL_KOREA_VIEW = true; // 한국 포커스 결과 항상 동일화

    const [texture, setTexture] = useState<THREE.Texture | null>(null);
    const [error, setError] = useState<string | null>(null);
    // Precipitation overlay removed per user request
    const [heightMap, setHeightMap] = useState<THREE.Texture | null>(null);
    const [mountainsMask, setMountainsMask] = useState<THREE.Texture | null>(null);
    const [showMountainsMask, setShowMountainsMask] = useState(true);
    const [mountainsBand, setMountainsBand] = useState<SingleBandDataset | null>(null);
    const [mountainsLoadStatus, setMountainsLoadStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
    const [mountainsLoadError, setMountainsLoadError] = useState<string | null>(null);
    const [clickInfo, setClickInfo] = useState<ClickInfo | null>(null);
    const globeRef = useRef<THREE.Mesh | null>(null);
    const [rotationDelta, setRotationDelta] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const focusState = useRef<{ mode: string; progress: number; startRotX?: number; startRotY?: number; targetRotX?: number; targetRotY?: number; originalDistance?: number; startQuat?: THREE.Quaternion; targetQuat?: THREE.Quaternion; }>({ mode: 'idle', progress: 0 });
    const [focusMode, setFocusMode] = useState<'idle' | 'focusing' | 'focused' | 'unfocusing'>('idle');
    const koreaBaseRotationRef = useRef(getGlobeRotationForLatLon(37.5, 127));

    const normalizeAngle = (a: number) => { const TWO = Math.PI * 2; return ((a + Math.PI) % TWO + TWO) % TWO - Math.PI; };
    const shortest = (from: number, to: number) => { let diff = normalizeAngle(to - from); return from + diff; };

    // General point focus target (latitude, longitude) with optional rotation delta compensation
    const computeTargetForLatLon = (latitude: number, longitude: number) => {
        const base = getGlobeRotationForLatLon(latitude, longitude);
        if (USE_ROTATION_DELTA_COMPENSATION) {
            return {
                targetRotX: base.rotationX + rotationDelta.x,
                targetRotY: base.rotationY - rotationDelta.y
            };
        }
        return { targetRotX: base.rotationX, targetRotY: base.rotationY };
    };

    // Vector 기반 정밀 회전: globe 회전 결과로 v 가 +Z 방향(카메라 정면)에 오도록 하는 Euler (X,Y) 계산
    // 조건: R * v = (0,0,1). 순서: Y 회전으로 경도 보정 -> X 회전으로 위도 보정
    const computeTargetForVector = (v: THREE.Vector3) => {
        const vn = v.clone().normalize();
        // 경도 (lon) = atan2(x, z)
        const lon = Math.atan2(vn.x, vn.z); // 회전 전 경도
        // 위도 (lat) = asin(y)
        const lat = Math.asin(vn.y);
        // 목표 회전: Y 축 -lon, X 축 -lat (이 순서로 적용되는 Euler XYZ 기준)
        const targetRotY = -lon; // 카메라 정면으로 경도 정렬
        const targetRotX = -lat; // 위/아래 정렬
        return { targetRotX, targetRotY };
    };

    const startFocus = (targetRotX: number, targetRotY: number, targetQuaternion?: THREE.Quaternion) => {
        if (!globeRef.current) return;
        const globe = globeRef.current;
        const curX = globe.rotation.x;
        const curY = globe.rotation.y;
        const diffX = normalizeAngle(targetRotX - curX);
        const diffY = normalizeAngle(targetRotY - curY);
        const angleDist = Math.sqrt(diffX * diffX + diffY * diffY);
        if (focusState.current.mode === 'focusing') return;
        if (focusState.current.mode === 'focused' && angleDist < 0.002 && !targetQuaternion) return;
        const adjTargetX = shortest(curX, targetRotX);
        const adjTargetY = shortest(curY, targetRotY);
        const globeCenter = globe.getWorldPosition(new THREE.Vector3());
        const cam = sceneCameraRef.current;
        const originalDistance = cam ? cam.position.distanceTo(globeCenter) : 4;
        focusState.current = {
            mode: 'focusing',
            progress: 0,
            startRotX: curX,
            startRotY: curY,
            originalDistance,
            targetRotX: adjTargetX,
            targetRotY: adjTargetY,
            startQuat: globe.quaternion.clone(),
            targetQuat: targetQuaternion ? targetQuaternion.clone() : undefined
        };
        setFocusMode('focusing');
        dlog('Focus start', { curX: curX.toFixed(3), curY: curY.toFixed(3), targetRotX: adjTargetX.toFixed(3), targetRotY: adjTargetY.toFixed(3), usingQuat: !!targetQuaternion });
    };

    const computeKoreaTarget = () => {
        const base = koreaBaseRotationRef.current;
        if (ALWAYS_CANONICAL_KOREA_VIEW) return { targetRotX: base.rotationX, targetRotY: base.rotationY };
        if (USE_ROTATION_DELTA_COMPENSATION) return { targetRotY: base.rotationY - rotationDelta.y, targetRotX: base.rotationX + rotationDelta.x };
        return { targetRotX: base.rotationX, targetRotY: base.rotationY };
    };

    const containerRef = useRef<HTMLDivElement>(null);
    const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });
    const url = computedColorScheme === 'light' ? '/earth_daymap.jpg' : '/earth_nightmap.jpg';
    // const url = "mountains.tif";

    useEffect(() => {
        let cancelled = false;
        const startedAt = performance.now();
        const lower = url.toLowerCase();
        const isTiff = lower.endsWith('.tif') || lower.endsWith('.tiff');
        (isTiff ? loadGeoTiffToTexture(url) : loadStandardImage(url))
            .then(tex => { if (!cancelled) setTexture(tex); })
            .catch(e => { if (!cancelled) setError(e.message); });
        loadGeoTiffHeightMap('/earth.tif', { invert: true })
            .then(h => { if (!cancelled) setHeightMap(h); })
            .catch(() => { });
        // Load mountains mask (non-zero -> colored overlay)
        setMountainsLoadStatus('loading');
        loadGeoTiffMaskTexture('/mountains.tif', { threshold: 0, color: '#37ff00ff', maxAlpha: 1, scaleAlphaByValue: true })
            .then(tex => { if (!cancelled) setMountainsMask(tex); })
            .catch(err => { if (!cancelled) console.warn('mountains.tif load fail', err); });
        loadGeoTiffSingleBand('/mountains.tif')
            .then(ds => { if (!cancelled) { setMountainsBand(ds); setMountainsLoadStatus('ok'); setMountainsLoadError(null); dlog('Mountains single band loaded', { w: ds.width, h: ds.height, min: ds.min, max: ds.max }); } })
            .catch(err => { if (!cancelled) { console.warn('mountains single band load fail', err); setMountainsLoadStatus('error'); setMountainsLoadError(String(err)); } });
        return () => { cancelled = true; };
    }, [url]);

    // If user clicked before dataset loaded, retroactively fill mountainsValue once available
    useEffect(() => {
        if (!mountainsBand || !clickInfo || clickInfo.mountainsValue !== undefined) return;
        const { latitude, longitude } = clickInfo;
        const rawLon = longitude + LONGITUDE_TEXTURE_SHIFT_DEG;
        let normLon = rawLon; while (normLon < -180) normLon += 360; while (normLon > 180) normLon -= 360;
        const u = (normLon + 180) / 360;
        const v = 1 - ((latitude + 90) / 180);
        const px = Math.min(mountainsBand.width - 1, Math.max(0, Math.round(u * (mountainsBand.width - 1))));
        const py = Math.min(mountainsBand.height - 1, Math.max(0, Math.round(v * (mountainsBand.height - 1))));
        const idx = py * mountainsBand.width + px;
        const val = mountainsBand.data[idx];
        setClickInfo({ ...clickInfo, mountainsValue: val });
    }, [mountainsBand, clickInfo]);

    // Precipitation dataset loading removed

    useEffect(() => {
        const handleResize = () => {
            if (!containerRef.current) return;
            const canvas = containerRef.current.querySelector('canvas');
            if (!canvas) return;
            const { clientWidth, clientHeight } = containerRef.current;
            canvas.style.width = clientWidth + 'px';
            canvas.style.height = clientHeight + 'px';
        };
        window.addEventListener('resize', handleResize);
        setTimeout(handleResize, 100);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const controlsRef = useRef<any>(null);
    const { setSelected: setSelectedMountain } = useMountainStore();
    const sceneCameraRef = useRef<THREE.Camera | null>(null);
    const [showMountains, setShowMountains] = useState(true);
    const [showMountainLabels, setShowMountainLabels] = useState(true);
    const [resetVirtualRotKey, setResetVirtualRotKey] = useState(0);

    // Apply anisotropy when texture becomes available
    const AnisotropySetter = () => {
        const { gl } = useThree();
        useEffect(() => {
            if (texture) {
                const maxAniso = gl.capabilities.getMaxAnisotropy();
                if (texture.anisotropy !== maxAniso) {
                    texture.anisotropy = maxAniso;
                    texture.needsUpdate = true;
                    dlog('Applied anisotropy', maxAniso);
                }
            }
        }, [texture, gl]);
        return null;
    };

    return (
        <Box ref={containerRef} className="three-canvas-container" pos="absolute" top={0} left={0} right={0} bottom={0} w="100%" h="100%" style={{ overflow: 'hidden' }}>
            <Canvas camera={{ position: [0, 0, 4] }} style={{ width: '100%', height: '100%', display: 'block' }} dpr={Math.min(1.5, typeof window !== 'undefined' ? window.devicePixelRatio : 1)} gl={{ antialias: true, alpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' }} resize={{ scroll: false, debounce: { scroll: 50, resize: 0 } }}>
                <AnisotropySetter />
                <ambientLight intensity={0.3} />
                <CameraFollowingLight />
                <EarthMesh
                    texture={texture}
                    heightMap={heightMap}
                    autoRotate={false}
                    rotationSpeed={0.01}
                    onLocationClick={(info) => {
                        setClickInfo(info);
                        // 새 규칙: mountains.tif 값이 0보다 큰 지점을 클릭하면 해당 지점으로 포커싱
                        if (info.mountainsValue !== undefined && info.mountainsValue > 0) {
                            if (globeRef.current && info.localVector && sceneCameraRef.current) {
                                // 세 점의 좌표를 월드 좌표계에서 계산
                                const earthCenter = globeRef.current.getWorldPosition(new THREE.Vector3());
                                const cameraPosition = sceneCameraRef.current.position.clone();
                                const localPoint = new THREE.Vector3(
                                    info.localVector.x,
                                    info.localVector.y,
                                    info.localVector.z
                                );
                                const worldClickPoint = localPoint.clone().add(earthCenter);

                                // 회전 전 세 점의 일직선 상태 확인
                                const beforeRotationCheck = verifyCollinearity(earthCenter, worldClickPoint, cameraPosition);

                                if (DEBUG) {
                                    dlog('Click vectors', {
                                        earthCenter: earthCenter.toArray().map(n => n.toFixed(3)),
                                        worldClickPoint: worldClickPoint.toArray().map(n => n.toFixed(3)),
                                        camera: cameraPosition.toArray().map(n => n.toFixed(3)),
                                        preCollinear: beforeRotationCheck
                                    });
                                }

                                // 카메라 방향 (지구 중심 -> 카메라)의 반대가 아니라 실제 우리가 바라보는 방향은
                                // 카메라가 (0,0,4)에서 원점을 보니 지구 중심에서 카메라를 향하는 벡터는 center->camera.
                                // 우리가 localPoint를 cameraDir 에 맞추고 싶으므로 to = cameraDir = (카메라 위치 - 지구중심).normalize()
                                const cameraDir = cameraPosition.clone().sub(earthCenter).normalize();
                                const { rotationX, rotationY, quaternion } = computePointFocusRotation(localPoint, cameraDir);

                                DEBUG && dlog('Quaternion rotation', { rotationX: rotationX.toFixed(4), rotationY: rotationY.toFixed(4) });
                                startFocus(rotationX, rotationY, quaternion);
                            } else {
                                // fallback: 위/경도 방식
                                const base = getGlobeRotationForLatLon(info.latitude, info.longitude);
                                startFocus(base.rotationX, base.rotationY);
                            }
                        } else {
                            dlog('Click ignored - not a mountain area', { mountainsValue: info.mountainsValue });
                        }
                    }}
                    externalRef={globeRef}
                    mountainsDataset={mountainsBand}
                />
                <CaptureCamera onCapture={(cam) => { sceneCameraRef.current = cam; }} />
                <OrbitControls ref={controlsRef} enablePan={false} enableRotate={focusMode === 'idle'} enableZoom={focusMode === 'idle'} />
                <FocusAnimator globeRef={globeRef} focusStateRef={focusState} setFocusMode={setFocusMode} />
                {/* Rotation tracker */}
                <RotationTracker globeRef={globeRef} controlsRef={controlsRef} initialMeshRotation={{ x: 0, y: 0 }} resetKey={resetVirtualRotKey} onDelta={(d) => setRotationDelta(d)} />
                <MountainsMaskOverlay texture={mountainsMask} visible={showMountainsMask} radius={1.5} elevation={0.003} opacity={1.0} followRef={globeRef} />
            </Canvas>
            {(focusMode === 'focused' || focusMode === 'focusing') && (
                <button
                    onClick={() => {
                        if (!globeRef.current) return;
                        if (focusState.current.mode === 'unfocusing') return;
                        focusState.current = { mode: 'unfocusing', progress: 0, startRotX: globeRef.current.rotation.x, startRotY: globeRef.current.rotation.y, originalDistance: focusState.current.originalDistance, targetRotX: globeRef.current.rotation.x, targetRotY: globeRef.current.rotation.y };
                        setFocusMode('unfocusing');
                        setSelectedMountain(null);
                    }}
                    style={{ position: 'absolute', bottom: 16, left: 16, zIndex: 1100, background: 'rgba(0,0,0,0.55)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', backdropFilter: 'blur(4px)' }}
                >축소</button>
            )}
            {error && (<div style={{ position: 'absolute', top: 8, left: 8, color: 'red', fontSize: 12, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.7)', padding: '4px 8px', borderRadius: '4px' }}>Error: {error}</div>)}
            {focusMode === 'idle' && (
                <button
                    onClick={() => {
                        const { targetRotX, targetRotY } = computeKoreaTarget();
                        if (ALWAYS_CANONICAL_KOREA_VIEW) {
                            if (sceneCameraRef.current) {
                                sceneCameraRef.current.position.set(0, 0, 4);
                                if ('lookAt' in sceneCameraRef.current) (sceneCameraRef.current as any).lookAt(0, 0, 0);
                            }
                            setResetVirtualRotKey(k => k + 1);
                        }
                        startFocus(targetRotX, targetRotY);
                    }}
                    style={{ position: 'absolute', bottom: 16, left: 16, zIndex: 1100, background: 'rgba(0,0,0,0.55)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', backdropFilter: 'blur(4px)' }}
                >한국 포커스</button>
            )}
            {DEBUG && (
                <div style={{ position: 'absolute', bottom: 16, right: 16, zIndex: 1200, background: 'rgba(0,0,0,0.55)', color: '#fff', padding: '8px 10px', fontSize: 11, lineHeight: 1.4, borderRadius: 6, fontFamily: 'monospace' }}>
                    <div style={{ opacity: 0.75 }}>FocusMode: {focusMode}</div>
                    <div>rotX: {globeRef.current?.rotation.x.toFixed(3)}</div>
                    <div>rotY: {globeRef.current?.rotation.y.toFixed(3)}</div>
                    <div>ΔX: {rotationDelta.x.toFixed(3)} ΔY: {rotationDelta.y.toFixed(3)}</div>
                    <div>Comp:{USE_ROTATION_DELTA_COMPENSATION ? 'on' : 'off'} Canon:{ALWAYS_CANONICAL_KOREA_VIEW ? 'on' : 'off'}</div>
                    <div>Mountains: {mountainsLoadStatus}{mountainsBand ? ` (${mountainsBand.width}x${mountainsBand.height})` : ''}</div>
                    {mountainsLoadError && <div style={{ color: '#f88' }}>Err:{mountainsLoadError.slice(0, 40)}</div>}
                </div>
            )}
            {mountainsLoadStatus === 'loading' && (
                <div style={{ position: 'absolute', top: 8, right: 16, background: 'rgba(0,0,0,0.55)', color: '#fff', padding: '6px 10px', fontSize: 12, borderRadius: 6, zIndex: 1100 }}>산 데이터 로딩중...</div>
            )}
            {mountainsLoadStatus === 'error' && (
                <div style={{ position: 'absolute', top: 8, right: 16, background: 'rgba(160,0,0,0.7)', color: '#fff', padding: '6px 10px', fontSize: 12, borderRadius: 6, zIndex: 1100 }}>산 데이터 오류</div>
            )}
            <button onClick={() => setShowMountains(v => !v)} style={{ position: 'absolute', bottom: 16, left: 300, zIndex: 1100, background: 'rgba(0,0,0,0.55)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, backdropFilter: 'blur(4px)' }}>{showMountains ? '산맥 숨기기' : '산맥 보이기'}</button>
            <button onClick={() => setShowMountainLabels(v => !v)} style={{ position: 'absolute', bottom: 16, left: 430, zIndex: 1100, background: 'rgba(0,0,0,0.55)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, backdropFilter: 'blur(4px)' }}>{showMountainLabels ? '라벨 숨기기' : '라벨 보이기'}</button>
            <button onClick={() => setShowMountainsMask(v => !v)} style={{ position: 'absolute', bottom: 16, left: 560, zIndex: 1100, background: 'rgba(0,0,0,0.55)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, backdropFilter: 'blur(4px)' }}>{showMountainsMask ? '산 마스크 숨기기' : '산 마스크 보이기'}</button>
            {showMountainsMask && mountainsMask && (
                <div style={{ position: 'absolute', bottom: 80, left: 560, zIndex: 1100, background: 'rgba(0,0,0,0.55)', padding: '10px 14px', borderRadius: 8, color: '#fff', fontSize: 11, lineHeight: 1.3, backdropFilter: 'blur(4px)', width: 140 }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>산 영역</div>
                    <div style={{ height: 10, borderRadius: 4, background: 'linear-gradient(to right, rgba(255,140,0,0.2), rgba(255,140,0,1))', marginBottom: 6 }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ opacity: 0.8 }}>낮음</span>
                        <span style={{ opacity: 0.8 }}>높음</span>
                    </div>
                </div>
            )}
            <ClickInfoPanel info={clickInfo} onClose={() => setClickInfo(null)} />
        </Box>
    );
}

function CaptureCamera({ onCapture }: { onCapture: (c: THREE.Camera) => void }) {
    const { camera } = useThree();
    useEffect(() => { onCapture(camera); }, [camera, onCapture]);
    return null;
}

function RotationTracker({ globeRef, controlsRef, initialMeshRotation, onDelta, resetKey }: { globeRef: React.RefObject<THREE.Mesh | null>; controlsRef: React.RefObject<any>; initialMeshRotation: { x: number; y: number }; onDelta: (d: { x: number; y: number }) => void; resetKey: number; }) {
    const lastSent = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const baseAnglesRef = useRef<{ azimuthal: number; polar: number } | null>(null);
    const norm = (r: number) => { const TWO = Math.PI * 2; return ((r + Math.PI) % TWO + TWO) % TWO - Math.PI; };
    // resetKey 변경 시 기준 초기화
    useEffect(() => { baseAnglesRef.current = null; lastSent.current = { x: 0, y: 0 }; onDelta({ x: 0, y: 0 }); }, [resetKey]);
    useFrame(() => {
        const ctrl = controlsRef.current; if (!ctrl) return;
        const azimuthal = typeof ctrl.getAzimuthalAngle === 'function' ? ctrl.getAzimuthalAngle() : (ctrl as any).azimuthalAngle || 0;
        const polar = typeof ctrl.getPolarAngle === 'function' ? ctrl.getPolarAngle() : (ctrl as any).polarAngle || 0;
        if (!baseAnglesRef.current) baseAnglesRef.current = { azimuthal, polar };
        const dazim = norm(azimuthal - baseAnglesRef.current.azimuthal);
        const dpolar = norm(polar - baseAnglesRef.current.polar);
        const dx = dpolar;
        const dy = -dazim;
        if (Math.abs(dx - lastSent.current.x) > 0.004 || Math.abs(dy - lastSent.current.y) > 0.004) {
            lastSent.current = { x: dx, y: dy };
            onDelta({ x: dx, y: dy });
        }
    });
    return null;
}


