"use client";
import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { loadGeoTiffMaskTexture, loadStandardImage } from '../utils/textureLoaders';

interface OverlayData {
    id: string;
    name: string;
    texture: THREE.Texture | null;
    visible: boolean;
    opacity: number;
    color: string;
}

interface OverlayManagerProps {
    folderPath: string;
    globeRef: React.RefObject<THREE.Mesh | null>;
    segments?: number;
    onOverlaysChange?: (overlays: OverlayData[]) => void;
    selectedOverlayId?: string | null;
    onOverlaySelect?: (id: string | null) => void;
    onLoadingChange?: (loading: boolean) => void;
    onErrorChange?: (error: string | null) => void;
}

export default function OverlayManager({ folderPath, globeRef, segments = 96, onOverlaysChange, selectedOverlayId, onOverlaySelect, onLoadingChange, onErrorChange }: OverlayManagerProps) {
    const [overlays, setOverlays] = useState<OverlayData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const overlayRefs = useRef<{ [key: string]: THREE.Mesh | null }>({});

    // 오버레이 목록 로드
    useEffect(() => {
        loadOverlayList();
    }, [folderPath]);

    const loadOverlayList = async () => {
        setLoading(true);
        setError(null);
        onLoadingChange?.(true);
        onErrorChange?.(null);
        
        try {
            // API에서 폴더 내 이미지 목록 가져오기
            const response = await fetch(`/api/overlays?folder=${encodeURIComponent(folderPath)}`);
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to load overlay list');
            }
            
            // 기본 색상 팔레트
            const colorPalette = [
                '#37ff00ff', '#0088ffff', '#ff8800ff', '#ff0088ff', '#00ff88ff',
                '#ffffff88', '#88ff00ff', '#ff0088ff', '#0088ffff', '#ff8800ff',
                '#8800ffff', '#00ffffff', '#ffff00ff', '#ff4400ff', '#44ff00ff'
            ];
            
            const overlayPromises = data.files.map(async (file: any, index: number) => {
                try {
                    let texture: THREE.Texture;
                    
                    // 파일 확장자에 따라 적절한 로더 선택
                    const ext = file.extension.toLowerCase();
                    if (ext === '.tif' || ext === '.tiff') {
                        // GeoTIFF 파일은 마스크 텍스처로 로드
                        texture = await loadGeoTiffMaskTexture(
                            file.path, 
                            { 
                                threshold: 0, 
                                color: colorPalette[index % colorPalette.length], 
                                maxAlpha: 0.8, 
                                scaleAlphaByValue: true 
                            }
                        );
                    } else {
                        // 일반 이미지 파일은 표준 로더로 로드
                        texture = await loadStandardImage(file.path);
                        // 투명도 적용을 위해 색상 조정
                        texture.colorSpace = THREE.SRGBColorSpace;
                        texture.needsUpdate = true;
                    }
                    
                    return {
                        id: file.id,
                        name: file.name,
                        texture,
                        visible: false,
                        opacity: 0.8,
                        color: colorPalette[index % colorPalette.length]
                    };
                } catch (err) {
                    console.warn(`Failed to load ${file.name}:`, err);
                    return {
                        id: file.id,
                        name: file.name,
                        texture: null,
                        visible: false,
                        opacity: 0.8,
                        color: colorPalette[index % colorPalette.length]
                    };
                }
            });

            const loadedOverlays = await Promise.all(overlayPromises);
            setOverlays(loadedOverlays);
            onOverlaysChange?.(loadedOverlays);
            onLoadingChange?.(false);
            
        } catch (err) {
            const errorMsg = `Failed to load overlays: ${err}`;
            setError(errorMsg);
            onErrorChange?.(errorMsg);
        } finally {
            setLoading(false);
            onLoadingChange?.(false);
        }
    };

    // 오버레이 상태 업데이트 (외부에서 호출)
    const updateOverlay = (id: string, updates: Partial<OverlayData>) => {
        setOverlays(prev => {
            const updated = prev.map(overlay => 
                overlay.id === id 
                    ? { ...overlay, ...updates }
                    : overlay
            );
            onOverlaysChange?.(updated);
            return updated;
        });
    };

    // 선택된 오버레이만 렌더링 (단일 오버레이 시스템)
    const renderSelectedOverlay = () => {
        if (!selectedOverlayId) return null;
        
        const selectedOverlay = overlays.find(overlay => overlay.id === selectedOverlayId);
        if (!selectedOverlay || !selectedOverlay.texture) return null;

        return (
            <OverlayMesh
                key={selectedOverlay.id}
                texture={selectedOverlay.texture}
                opacity={0.9} // 거의 불투명하게
                color={selectedOverlay.color}
                globeRef={globeRef}
                segments={segments}
                ref={(ref) => { 
                    if (ref) {
                        overlayRefs.current[selectedOverlay.id] = ref; 
                    }
                }}
            />
        );
    };

    return (
        <>
            {/* 선택된 오버레이만 렌더링 */}
            {renderSelectedOverlay()}
        </>
    );
}

// 개별 오버레이 메시 컴포넌트
const OverlayMesh = React.forwardRef<THREE.Mesh, {
    texture: THREE.Texture;
    opacity: number;
    color: string;
    globeRef: React.RefObject<THREE.Mesh | null>;
    segments: number;
}>(({ texture, opacity, color, globeRef, segments }, ref) => {
    useFrame(() => {
        if (globeRef.current && ref && typeof ref !== 'function' && ref.current) {
            // 지구본과 동일한 회전 적용
            ref.current.quaternion.copy(globeRef.current.quaternion);
        }
    });

    const material = React.useMemo(() => {
        const mat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false, // 깊이 버퍼에 쓰지 않음
            depthTest: true, // 깊이 테스트 활성화
            opacity,
            side: THREE.FrontSide, // 한쪽 면만
            toneMapped: false,
            alphaTest: 0.1,
            blending: THREE.NormalBlending
        });
        return mat;
    }, [texture, opacity]);

    return (
        <mesh ref={ref} renderOrder={100}>
            <sphereGeometry args={[1.51, segments, segments]} />
            <primitive object={material} attach="material" />
        </mesh>
    );
});

// 오버레이 데이터 타입 export
export type { OverlayData };
