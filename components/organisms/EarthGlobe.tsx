"use client";
import React, { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getGlobeRotationForLatLon, computePointFocusRotation, verifyCollinearity } from '../../components/utils/globeMath';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Box, useComputedColorScheme } from '@mantine/core';
import EarthMesh from './EarthMesh';
import CameraFollowingLight from '../../components/atoms/CameraFollowingLight';
import { ClickInfo } from '../../components/utils/globeMath';
import { loadGeoTiffToTexture, loadStandardImage, loadGeoTiffHeightMap, loadGeoTiffMaskTexture, loadGeoTiffSingleBand, SingleBandDataset } from '../../components/utils/textureLoaders';
import { LONGITUDE_TEXTURE_SHIFT_DEG } from '../../components/utils/globeMath';
import MountainsMaskOverlay from './MountainsMaskOverlay';
import OverlayManager from './OverlayManager';
import FocusAnimator from '../atoms/FocusAnimator';
import { useMountainStore } from '../../components/store/mountainStore';
import { useOrderedOverlays, useOverlayActions, useAnyOverlayVisible } from '../../components/store/overlayStore';

export default function EarthGlobe() {
    const [texture, setTexture] = useState<THREE.Texture | null>(null);
    const [error, setError] = useState<string | null>(null);
    // Precipitation overlay removed per user request
    const [heightMap, setHeightMap] = useState<THREE.Texture | null>(null);
    const [mountainsMask, setMountainsMask] = useState<THREE.Texture | null>(null);
    const [showMountainsMask, setShowMountainsMask] = useState(true);
    const [showEarthSurface, setShowEarthSurface] = useState(true);
    const [mountainsBand, setMountainsBand] = useState<SingleBandDataset | null>(null);
    const [mountainsLoadStatus, setMountainsLoadStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
    const [mountainsLoadError, setMountainsLoadError] = useState<string | null>(null);
    const [clickInfo, setClickInfo] = useState<ClickInfo | null>(null);
    const globeRef = useRef<THREE.Mesh | null>(null);
    const focusState = useRef<{ mode: string; progress: number; startRotX?: number; startRotY?: number; targetRotX?: number; targetRotY?: number; originalDistance?: number; startQuat?: THREE.Quaternion; targetQuat?: THREE.Quaternion; }>({ mode: 'idle', progress: 0 });
    const [focusMode, setFocusMode] = useState<'idle' | 'focusing' | 'focused' | 'unfocusing'>('idle');

    const normalizeAngle = (a: number) => { const TWO = Math.PI * 2; return ((a + Math.PI) % TWO + TWO) % TWO - Math.PI; };
    const shortest = (from: number, to: number) => { let diff = normalizeAngle(to - from); return from + diff; };

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
    };

    const containerRef = useRef<HTMLDivElement>(null);
    const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });
    const url = computedColorScheme === 'light' ? '/earth_daymap.jpg' : '/earth_nightmap.jpg';
    // const url = "mountains.tif";

    useEffect(() => {
        let cancelled = false;
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
            .then(ds => { if (!cancelled) { setMountainsBand(ds); setMountainsLoadStatus('ok'); setMountainsLoadError(null); } })
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
    const [showMountainLabels, setShowMountainLabels] = useState(true);
    const [resetVirtualRotKey, setResetVirtualRotKey] = useState(0);
    // Multi overlay store hooks
    const orderedOverlays = useOrderedOverlays();
    const anyOverlayVisible = useAnyOverlayVisible();
    const { toggleVisibility, setOpacity, hideAll, showAll } = useOverlayActions();

    // 오버레이가 선택되어도 지구 표면과 산 마스크는 계속 표시
    // useEffect(() => {
    //     setShowEarthSurface(!selectedOverlayId);
    //     setShowMountainsMask(!selectedOverlayId);
    // }, [selectedOverlayId]);

    // Apply anisotropy when texture becomes available
    const AnisotropySetter = () => {
        const { gl } = useThree();
        useEffect(() => {
            if (texture) {
                const maxAniso = gl.capabilities.getMaxAnisotropy();
                if (texture.anisotropy !== maxAniso) {
                    texture.anisotropy = maxAniso;
                    texture.needsUpdate = true;
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
                    heightMap={anyOverlayVisible ? null : heightMap}
                    autoRotate={false}
                    rotationSpeed={0.01}
                    visible={showEarthSurface}
                    onLocationClick={(info) => {
                        setClickInfo(info);
                        // 새 규칙: mountains.tif 값이 0보다 큰 지점을 클릭하면 해당 지점으로 포커싱
                        if (info.mountainsValue !== undefined && info.mountainsValue > 0) {
                            setSelectedMountain({
                                id: info.mountainsValue || 0,
                                metadata: {
                                    latitude: info.latitude,
                                    longitude: info.longitude,
                                },
                            });
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

                                // 카메라 방향 (지구 중심 -> 카메라)의 반대가 아니라 실제 우리가 바라보는 방향은
                                // 카메라가 (0,0,4)에서 원점을 보니 지구 중심에서 카메라를 향하는 벡터는 center->camera.
                                // 우리가 localPoint를 cameraDir 에 맞추고 싶으므로 to = cameraDir = (카메라 위치 - 지구중심).normalize()
                                const cameraDir = cameraPosition.clone().sub(earthCenter).normalize();
                                const { rotationX, rotationY, quaternion } = computePointFocusRotation(localPoint, cameraDir);

                                startFocus(rotationX, rotationY, quaternion);
                            } else {
                                // fallback: 위/경도 방식
                                const base = getGlobeRotationForLatLon(info.latitude, info.longitude);
                                startFocus(base.rotationX, base.rotationY);
                            }
                        }
                    }}
                    externalRef={globeRef}
                    mountainsDataset={mountainsBand}
                />
                <CaptureCamera onCapture={(cam) => { sceneCameraRef.current = cam; }} />
                <OrbitControls
                    ref={controlsRef}
                    enablePan={false}
                    enableRotate={focusMode === 'idle'}
                    enableZoom={focusMode === 'idle'}
                    minDistance={2.0}  // prevent getting inside the globe
                    maxDistance={8.0}  // optionally cap far zoom for UX
                />
                <FocusAnimator globeRef={globeRef} focusStateRef={focusState} setFocusMode={setFocusMode} />
                {/* Rotation tracker */}
                <RotationTracker
                    globeRef={globeRef}
                    controlsRef={controlsRef}
                    initialMeshRotation={{ x: 0, y: 0 }}
                    resetKey={resetVirtualRotKey}
                    onDelta={(d) => { }}
                />
                <MountainsMaskOverlay
                    texture={mountainsMask}
                    visible={showMountainsMask}
                    radius={1.504}
                    elevation={0.003}
                    opacity={1.0}
                    followRef={globeRef}
                />
                {/* 동적 오버레이 매니저 */}
                <OverlayManager
                    folderPath="/overlays"
                    globeRef={globeRef}
                    segments={96}
                />
            </Canvas>
            {(focusMode === 'focused' || focusMode === 'focusing') && (
                <button
                    onClick={() => {
                        if (!globeRef.current) return;
                        if (focusState.current.mode === 'unfocusing') return;
                        focusState.current = { mode: 'unfocusing', progress: 0, startRotX: globeRef.current.rotation.x, startRotY: globeRef.current.rotation.y, originalDistance: focusState.current.originalDistance, targetRotX: globeRef.current.rotation.x, targetRotY: globeRef.current.rotation.y };
                        setFocusMode('unfocusing');
                        setSelectedMountain({
                            id: 0,
                            metadata: null,
                        });
                    }}
                    style={{ position: 'absolute', bottom: 16, left: 16, zIndex: 1100, background: 'rgba(0,0,0,0.55)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', backdropFilter: 'blur(4px)' }}
                >축소</button>
            )}
            {error && (<div style={{ position: 'absolute', top: 8, left: 8, color: 'red', fontSize: 12, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.7)', padding: '4px 8px', borderRadius: '4px' }}>Error: {error}</div>)}
            {mountainsLoadStatus === 'loading' && (
                <div style={{ position: 'absolute', top: 76, right: 16, background: 'rgba(0,0,0,0.55)', color: '#fff', padding: '6px 10px', fontSize: 12, borderRadius: 6, zIndex: 1100 }}>산 데이터 로딩중...</div>
            )}
            {mountainsLoadStatus === 'error' && (
                <div style={{ position: 'absolute', top: 76, right: 16, background: 'rgba(160,0,0,0.7)', color: '#fff', padding: '6px 10px', fontSize: 12, borderRadius: 6, zIndex: 1100 }}>
                    산 데이터 오류: {mountainsLoadError || '알 수 없는 오류'}
                </div>
            )}
            <button onClick={() => setShowMountainLabels(v => !v)} style={{ position: 'absolute', bottom: 16, left: 430, zIndex: 1100, background: 'rgba(0,0,0,0.55)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, backdropFilter: 'blur(4px)' }}>{showMountainLabels ? '라벨 숨기기' : '라벨 보이기'}</button>
            <button onClick={() => setShowMountainsMask(v => !v)} style={{ position: 'absolute', bottom: 16, left: 560, zIndex: 1100, background: 'rgba(0,0,0,0.55)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12, backdropFilter: 'blur(4px)' }}>{showMountainsMask ? '산 마스크 숨기기' : '산 마스크 보이기'}</button>

            <MultiOverlayPanel
                overlays={orderedOverlays}
                anyVisible={anyOverlayVisible}
                onToggle={toggleVisibility}
                onOpacityChange={setOpacity}
                onShowAll={showAll}
                onHideAll={hideAll}
            />
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

// 단일 오버레이 선택 패널 컴포넌트
// Multi overlay control panel
function MultiOverlayPanel({ overlays, anyVisible, onToggle, onOpacityChange, onShowAll, onHideAll }: {
    overlays: ReturnType<typeof useOrderedOverlays>;
    anyVisible: boolean;
    onToggle: (id: string) => void;
    onOpacityChange: (id: string, value: number) => void;
    onShowAll: () => void;
    onHideAll: () => void;
}) {
    const [expanded, setExpanded] = useState(true);
    if (!overlays.length) return null;
    return (
        <div style={{
            position: 'absolute',
            top: 80,
            right: 20,
            background: 'rgba(0,0,0,0.90)',
            color: 'white',
            padding: '14px 16px',
            borderRadius: 12,
            minWidth: 300,
            maxHeight: '70vh',
            overflowY: 'auto',
            border: '1px solid rgba(0,255,120,0.4)',
            boxShadow: '0 4px 18px rgba(0,0,0,0.6)',
            fontSize: 12,
            zIndex: 2100
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ color: '#6effa8' }}>오버레이 ({overlays.length})</strong>
                <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setExpanded(e => !e)} style={btnStyle}>{expanded ? '접기' : '펼치기'}</button>
                    <button onClick={onShowAll} style={btnStyle}>모두 켜기</button>
                    <button onClick={onHideAll} style={btnStyle}>모두 끄기</button>
                </div>
            </div>
            {!expanded && (
                <div style={{ opacity: 0.7 }}>활성: {overlays.filter(o => o.visible).length}개</div>
            )}
            {expanded && overlays.map(o => (
                <div key={o.id} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    padding: '8px 10px',
                    marginBottom: 6,
                    borderRadius: 8,
                    background: o.visible ? 'rgba(0,255,120,0.12)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${o.visible ? 'rgba(0,255,140,0.6)' : 'rgba(255,255,255,0.15)'}`
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 14, height: 14, borderRadius: 4, background: o.color, boxShadow: '0 0 4px rgba(0,0,0,0.6)' }} />
                        <label style={{ flex: 1, cursor: 'pointer', fontWeight: 600 }} onClick={() => onToggle(o.id)}>{o.name}</label>
                        <input
                            type="checkbox"
                            checked={o.visible}
                            onChange={() => onToggle(o.id)}
                            style={{ cursor: 'pointer' }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                            type="range"
                            min={0.05}
                            max={1}
                            step={0.05}
                            value={o.opacity}
                            onChange={(e) => onOpacityChange(o.id, parseFloat(e.target.value))}
                            style={{ flex: 1 }}
                        />
                        <span style={{ width: 36, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{(o.opacity * 100).toFixed(0)}%</span>
                    </div>
                    <div style={{ fontSize: 10, opacity: 0.6 }}>
                        {o.status === 'idle' && !o.visible && '대기'}
                        {o.status === 'loading' && '로딩중...'}
                        {o.status === 'ready' && (o.visible ? '표시중' : '로드됨')}
                        {o.status === 'error' && <span style={{ color: '#ff6666' }}>오류</span>}
                    </div>
                </div>
            ))}
        </div>
    );
}

const btnStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.08)',
    color: 'white',
    border: '1px solid rgba(255,255,255,0.2)',
    padding: '4px 8px',
    fontSize: 10,
    borderRadius: 4,
    cursor: 'pointer'
};


