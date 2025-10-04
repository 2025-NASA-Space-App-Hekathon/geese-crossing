"use client";
import React, { useEffect, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
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

export default function EarthGlobe() {
    const DEBUG = true; // 디버그 로깅 토글
    const dlog = (...args: any[]) => { if (DEBUG) console.log('[EarthGlobe]', ...args); };

    const [texture, setTexture] = useState<THREE.Texture | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [heightMap, setHeightMap] = useState<THREE.Texture | null>(null);
    const [clickInfo, setClickInfo] = useState<ClickInfo | null>(null);
    const globeRef = useRef<THREE.Mesh | null>(null);
    // mode: 'idle' | 'focusing' | 'focused' | 'unfocusing'
    const focusState = useRef<{ mode: string; progress: number; startRotX?: number; startRotY?: number; targetRotX?: number; targetRotY?: number }>({ mode: 'idle', progress: 0 });
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
        loadGeoTiffHeightMap('/earth.tif', { invert: true })
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
                <CameraSetup onReady={(camera) => { /* reserved for future */ }} />
                <ambientLight intensity={0.3} />
                <CameraFollowingLight />
                <EarthMesh
                    texture={texture}
                    heightMap={heightMap}
                    autoRotate={false}
                    rotationSpeed={0.01}
                    onLocationClick={(info) => {
                        setClickInfo(info);
                        dlog('Click', { lat: info.latitude.toFixed(3), lon: info.longitude.toFixed(3), isKorea: info.isKorea, currentMode: focusState.current.mode });
                        // Korea 클릭시에만 포커스. 다른 지역 클릭은 무시 (정보 패널만 업데이트 가능)
                        // if (!info.isKorea) {
                        //     dlog('Non-Korea click -> no focus action'); 
                        //     return;
                        // }
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
                            const liftAngle = 0.9; // 조정 가능 (라디안)
                            const targetRotX = base.rotationX - liftAngle;
                            const targetRotY = base.rotationY;
                            dlog('Focus start', {
                                baseRotX: base.rotationX.toFixed(4), baseRotY: base.rotationY.toFixed(4),
                                targetRotX: targetRotX.toFixed(4), targetRotY: targetRotY.toFixed(4), liftAngle
                            });
                            focusState.current = {
                                mode: 'focusing',
                                progress: 0,
                                startRotX: globeRef.current.rotation.x,
                                startRotY: globeRef.current.rotation.y,
                                targetRotX,
                                targetRotY
                            };
                            setFocusMode('focusing');
                        }
                    }}
                    externalRef={globeRef}
                />
                <OrbitControls enablePan={false} enableRotate={focusMode === 'idle'} enableZoom={focusMode === 'idle'} />
                {/* 포커싱 애니메이션 */}
                <FocusAnimator globeRef={globeRef} focusStateRef={focusState} setFocusMode={setFocusMode} />
            </Canvas>
            <ClickInfoPanel info={clickInfo} onClose={() => setClickInfo(null)} />
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
            {error && (
                <div style={{ position: 'absolute', top: 8, left: 8, color: 'red', fontSize: 12, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.7)', padding: '4px 8px', borderRadius: '4px' }}>Error: {error}</div>
            )}
        </Box>
    );
}

// FocusAnimator: 한국 클릭 시 카메라 줌 + 구 살짝 아래로 이동
function FocusAnimator({ globeRef, focusStateRef, setFocusMode }: {
    globeRef: React.RefObject<THREE.Mesh | null>;
    focusStateRef: React.MutableRefObject<{ mode: string; progress: number; startRotX?: number; startRotY?: number; targetRotX?: number; targetRotY?: number; }>;
    setFocusMode: React.Dispatch<React.SetStateAction<'idle' | 'focusing' | 'focused' | 'unfocusing'>>;
}) {
    const { camera } = useThree();
    const DEBUG = true;
    const dlog = (...args: any[]) => { if (DEBUG) console.log('[FocusAnimator]', ...args); };
    const lastStepRef = useRef<number>(-1);
    const lastModeRef = useRef<string>('idle');
    useFrame((_, delta: number) => {
        const st = focusStateRef.current;
        if (st.mode === 'idle') return;
        const duration = 1.1; // 초
        st.progress += delta / duration;
        const tRaw = Math.min(1, st.progress);
        const ease = (x: number) => x * x * (3 - 2 * x); // smoothstep
        const k = ease(tRaw);

        const startZ = 3;
        const focusZ = 1.5; // 더 가까이
        const startGlobeY = 0;
        const focusGlobeY = -1.5; // 지구 1/3 정도만 위로 보이게 더 내림

        const g = globeRef.current;

        const stepPct = Math.floor(tRaw * 100);
        if (lastModeRef.current !== st.mode) {
            dlog('Mode change', { from: lastModeRef.current, to: st.mode });
            lastModeRef.current = st.mode;
        }
        if (stepPct % 10 === 0 && stepPct !== lastStepRef.current) {
            lastStepRef.current = stepPct;
            const gpos = g ? { y: g.position.y.toFixed(3) } : {};
            dlog('Progress', { mode: st.mode, pct: stepPct, k: k.toFixed(3), camZ: camera.position.z.toFixed(3), globeY: gpos });
        }

        if (st.mode === 'focusing') {
            if (g && st.startRotX !== undefined && st.targetRotX !== undefined) {
                const rotX = st.startRotX + (st.targetRotX - st.startRotX) * k;
                const rotY = st.startRotY! + (st.targetRotY! - st.startRotY!) * k;
                g.rotation.x = rotX;
                g.rotation.y = rotY;
            }
            camera.position.z = startZ + (focusZ - startZ) * k;
            if (g) g.position.y = startGlobeY + (focusGlobeY - startGlobeY) * k;
            if (tRaw >= 1) { st.mode = 'focused'; st.progress = 0; setFocusMode('focused'); dlog('Focus complete'); }
        } else if (st.mode === 'unfocusing') {
            if (g && st.startRotX !== undefined && st.targetRotX !== undefined) {
                const rotX = st.startRotX + (st.targetRotX - st.startRotX) * k;
                const rotY = st.startRotY! + (st.targetRotY! - st.startRotY!) * k;
                g.rotation.x = rotX;
                g.rotation.y = rotY;
            }
            // 역방향 (k 대신 (1-k))
            camera.position.z = focusZ + (startZ - focusZ) * k;
            if (g) g.position.y = focusGlobeY + (0 - focusGlobeY) * k;
            if (tRaw >= 1) { st.mode = 'idle'; st.progress = 0; setFocusMode('idle'); dlog('Unfocus complete'); }
        } else if (st.mode === 'focused') {
            // 유지 상태
            camera.position.z = focusZ;
            if (g) g.position.y = focusGlobeY;
        }
        camera.updateProjectionMatrix();
    });
    return null;
}
