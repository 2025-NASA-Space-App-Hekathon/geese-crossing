"use client";
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Box, useComputedColorScheme } from '@mantine/core';
import EarthMesh from './EarthMesh';
import CameraSetup from '../../components/atoms/CameraSetup';
import CameraFollowingLight from '../../components/atoms/CameraFollowingLight';
import ClickInfoPanel from '../../components/molecules/ClickInfoPanel';
import { ClickInfo } from '../../components/utils/globeMath';
import { fromUrl } from 'geotiff';

async function loadStandardImage(url: string): Promise<THREE.Texture> {
    return await new Promise((resolve, reject) => {
        const loader = new THREE.TextureLoader();
        loader.load(url, tex => { tex.colorSpace = THREE.SRGBColorSpace; resolve(tex); }, undefined, err => reject(err));
    });
}

async function loadGeoTiffToTexture(url: string): Promise<THREE.Texture> {
    const tiff = await fromUrl(url);
    const image = await tiff.getImage();
    const width = image.getWidth();
    const height = image.getHeight();
    const rasterAny = await image.readRasters({ interleave: true });
    const raster: Uint8Array = rasterAny instanceof Uint8Array ? rasterAny : new Uint8Array(rasterAny as ArrayLike<number>);
    let data: Uint8ClampedArray;
    const samplesPerPixel: number = (image as any).samplesPerPixel || 3;
    if (samplesPerPixel === 3) {
        data = new Uint8ClampedArray(width * height * 4);
        for (let i = 0, j = 0; i < raster.length; i += 3, j += 4) {
            data[j] = raster[i]!; data[j + 1] = raster[i + 1]!; data[j + 2] = raster[i + 2]!; data[j + 3] = 255;
        }
    } else if (samplesPerPixel === 4) {
        data = new Uint8ClampedArray(raster);
    } else if (samplesPerPixel === 1) {
        data = new Uint8ClampedArray(width * height * 4);
        for (let i = 0, j = 0; i < raster.length; i++, j += 4) { const v = raster[i]!; data[j] = v; data[j + 1] = v; data[j + 2] = v; data[j + 3] = 255; }
    } else {
        data = new Uint8ClampedArray(width * height * 4);
        for (let j = 0; j < data.length; j += 4) { data[j] = 255; data[j + 1] = 0; data[j + 2] = 255; data[j + 3] = 255; }
    }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx!.createImageData(width, height);
    imageData.data.set(data); ctx!.putImageData(imageData, 0, 0);
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true; return tex;
}

export default function EarthGlobe() {
    const [texture, setTexture] = useState<THREE.Texture | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [clickInfo, setClickInfo] = useState<ClickInfo | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });
    const url = computedColorScheme === 'light' ? '/earth_daymap.jpg' : '/earth_nightmap.jpg';

    useEffect(() => {
        let cancelled = false;
        const lower = url.toLowerCase();
        const isTiff = lower.endsWith('.tif') || lower.endsWith('.tiff');
        (isTiff ? loadGeoTiffToTexture(url) : loadStandardImage(url))
            .then(tex => { if (!cancelled) setTexture(tex); })
            .catch(e => { if (!cancelled) setError(e.message); });
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
        <Box ref={containerRef} className="three-canvas-container" pos="absolute" top={0} left={0} right={0} bottom={0} w="100%" h="100%" style={{ overflow: 'hidden' }}>
            <Canvas camera={{ position: [0, 0, 4] }} style={{ width: '100%', height: '100%', display: 'block' }} dpr={[1, 2]} gl={{ antialias: true, alpha: false, preserveDrawingBuffer: false }} resize={{ scroll: false, debounce: { scroll: 50, resize: 0 } }}>
                <CameraSetup />
                <ambientLight intensity={0.3} />
                <CameraFollowingLight />
                <EarthMesh texture={texture} autoRotate={false} rotationSpeed={0.01} onLocationClick={setClickInfo} />
                <OrbitControls enablePan={false} />
            </Canvas>
            <ClickInfoPanel info={clickInfo} onClose={() => setClickInfo(null)} />
            {error && (
                <div style={{ position: 'absolute', top: 8, left: 8, color: 'red', fontSize: 12, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.7)', padding: '4px 8px', borderRadius: '4px' }}>Error: {error}</div>
            )}
        </Box>
    );
}
