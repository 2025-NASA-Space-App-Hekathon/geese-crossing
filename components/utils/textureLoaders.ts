import * as THREE from 'three';
import { fromUrl } from 'geotiff';

export async function loadStandardImage(url: string): Promise<THREE.Texture> {
    return await new Promise((resolve, reject) => {
        const loader = new THREE.TextureLoader();
        loader.load(url, tex => { tex.colorSpace = THREE.SRGBColorSpace; resolve(tex); }, undefined, err => reject(err));
    });
}

// General GeoTIFF -> RGBA texture (for color map)
export async function loadGeoTiffToTexture(url: string): Promise<THREE.Texture> {
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
        data = new Uint8ClampedArray(raster); // assume already RGBA
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
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
}

// Height map loader: produce a single channel (R) gradient based on first band or luminance, no sRGB conversion (linear)
export interface HeightMapOptions {
    invert?: boolean; // invert heights (useful if dataset is reversed)
    exaggeration?: number; // future use (not baked into texture now)
}

export async function loadGeoTiffHeightMap(url: string, opts: HeightMapOptions = {}): Promise<THREE.Texture> {
    const tiff = await fromUrl(url);
    const image = await tiff.getImage();
    const width = image.getWidth();
    const height = image.getHeight();
    // Read first band only for speed
    const raster = await image.readRasters({ interleave: false, samples: [0] }) as any;
    const band = raster[0] as ArrayLike<number> | Uint8Array;
    // Determine min/max for normalization (avoid huge spikes if values are real elevation)
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < band.length; i++) { const v = band[i]!; if (v < min) min = v; if (v > max) max = v; }
    const range = max - min || 1;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0, j = 0; i < band.length; i++, j += 4) {
        let norm = (band[i]! - min) / range; // 0..1
        if (opts.invert) norm = 1 - norm;
        const val = Math.round(norm * 255);
        data[j] = val; data[j + 1] = val; data[j + 2] = val; data[j + 3] = 255;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx!.createImageData(width, height);
    imageData.data.set(data); ctx!.putImageData(imageData, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    // Height map should stay linear; do not set sRGB
    tex.needsUpdate = true;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
}
