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

// Precipitation / scalar field overlay loader: maps first band to color+alpha
export interface PrecipColorStop { value: number; color: string; alpha?: number } // value: normalized 0..1 after (optional) invert
export interface PrecipTextureOptions {
    invert?: boolean;
    maxAlpha?: number; // 최대 불투명도 (0~1)
    colorStops?: PrecipColorStop[]; // 구간별 색 적용. value 오름차순 필요 (0..1)
}
function parseHexColor(hex: string): [number, number, number] {
    let h = hex.trim();
    if (h.startsWith('#')) h = h.slice(1);
    if (h.length === 3) {
        const r = parseInt(h[0] + h[0], 16);
        const g = parseInt(h[1] + h[1], 16);
        const b = parseInt(h[2] + h[2], 16);
        return [r, g, b];
    } else if (h.length === 6) {
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        return [r, g, b];
    }
    return [255, 0, 255];
}
function pickColorFromStops(val: number, stops: PrecipColorStop[], maxAlpha: number): { r: number; g: number; b: number; a: number } {
    if (!stops.length) return { r: 255, g: 0, b: 255, a: Math.round(0.5 * maxAlpha * 255) };
    let chosen = stops[0];
    for (let i = 0; i < stops.length; i++) {
        if (val >= stops[i].value) chosen = stops[i]; else break;
    }
    const [r, g, b] = parseHexColor(chosen.color);
    const a = Math.round((chosen.alpha !== undefined ? chosen.alpha : maxAlpha) * 255);
    return { r, g, b, a };
}
export async function loadGeoTiffPrecipTexture(url: string, opts: PrecipTextureOptions = {}): Promise<THREE.Texture> {
    const { invert = false, maxAlpha = 0.7, colorStops } = opts;
    const tiff = await fromUrl(url);
    const image = await tiff.getImage();
    const width = image.getWidth();
    const height = image.getHeight();
    const raster = await image.readRasters({ interleave: false, samples: [0] }) as any; // first band only
    const band = raster[0] as ArrayLike<number> | Uint8Array;
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < band.length; i++) { const v = band[i]!; if (v < min) min = v; if (v > max) max = v; }
    const range = max - min || 1;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0, j = 0; i < band.length; i++, j += 4) {
        let norm = (band[i]! - min) / range; // 0..1 normalized
        if (invert) norm = 1 - norm;
        norm = Math.min(1, Math.max(0, norm));
        if (colorStops && colorStops.length) {
            const { r, g, b, a } = pickColorFromStops(norm, colorStops, maxAlpha);
            data[j] = r; data[j + 1] = g; data[j + 2] = b; data[j + 3] = a;
        } else {
            const e = Math.pow(norm, 1.1);
            let r: number, g: number, b: number;
            if (e < 0.3) {
                const k = e / 0.3; r = 0; g = 32 * (1 - k) + 80 * k; b = 128 * (1 - k) + 180 * k;
            } else if (e < 0.6) {
                const k = (e - 0.3) / 0.3; r = 0; g = 80 * (1 - k) + 200 * k; b = 180 * (1 - k) + 255 * k;
            } else {
                const k = (e - 0.6) / 0.4; r = 0 * (1 - k) + 255 * k; g = 200 * (1 - k) + 255 * k; b = 255;
            }
            const alpha = Math.min(255, Math.round(Math.pow(e, 1.05) * maxAlpha * 255));
            data[j] = r; data[j + 1] = g; data[j + 2] = b; data[j + 3] = alpha;
        }
    }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx!.createImageData(width, height);
    imageData.data.set(data); ctx!.putImageData(imageData, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace; // treat colors as display
    tex.needsUpdate = true;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

// Extended loader returning both the colored texture AND the normalized scalar band for sampling.
// This lets click handlers map lat/lon -> pixel (x,y) -> precipitation value without reverse color lookup.
export interface PrecipMetaDataset {
    texture: THREE.Texture;          // colored overlay texture (already mapped via stops)
    width: number;                   // raster width
    height: number;                  // raster height
    normalized: Float32Array;        // per-pixel normalized (0..1) precipitation values
    min: number;                     // original band min (before normalization)
    max: number;                     // original band max (before normalization)
    colorStops?: PrecipColorStop[];  // stops used (for UI / legend reference)
}

export async function loadGeoTiffPrecipDataset(url: string, opts: PrecipTextureOptions = {}): Promise<PrecipMetaDataset> {
    const { invert = false, maxAlpha = 0.7, colorStops } = opts;
    const tiff = await fromUrl(url);
    const image = await tiff.getImage();
    const width = image.getWidth();
    const height = image.getHeight();
    const raster = await image.readRasters({ interleave: false, samples: [0] }) as any; // first band
    const band = raster[0] as ArrayLike<number> | Uint8Array;
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < band.length; i++) { const v = band[i]!; if (v < min) min = v; if (v > max) max = v; }
    const range = max - min || 1;
    const normalized = new Float32Array(band.length);
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0, j = 0; i < band.length; i++, j += 4) {
        let norm = (band[i]! - min) / range; // 0..1
        if (invert) norm = 1 - norm;
        norm = Math.min(1, Math.max(0, norm));
        normalized[i] = norm;
        if (colorStops && colorStops.length) {
            const { r, g, b, a } = pickColorFromStops(norm, colorStops, maxAlpha);
            data[j] = r; data[j + 1] = g; data[j + 2] = b; data[j + 3] = a;
        } else {
            const e = Math.pow(norm, 1.1);
            let r: number, g: number, b: number;
            if (e < 0.3) {
                const k = e / 0.3; r = 0; g = 32 * (1 - k) + 80 * k; b = 128 * (1 - k) + 180 * k;
            } else if (e < 0.6) {
                const k = (e - 0.3) / 0.3; r = 0; g = 80 * (1 - k) + 200 * k; b = 180 * (1 - k) + 255 * k;
            } else {
                const k = (e - 0.6) / 0.4; r = 0 * (1 - k) + 255 * k; g = 200 * (1 - k) + 255 * k; b = 255;
            }
            const alpha = Math.min(255, Math.round(Math.pow(e, 1.05) * maxAlpha * 255));
            data[j] = r; data[j + 1] = g; data[j + 2] = b; data[j + 3] = alpha;
        }
    }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx!.createImageData(width, height);
    imageData.data.set(data); ctx!.putImageData(imageData, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return { texture: tex, width, height, normalized, min, max, colorStops };
}

// Single-band mask loader: non-zero => specified color (with optional intensity-based alpha), zero => transparent
export interface MaskTextureOptions {
    threshold?: number;      // value > threshold considered 'on'
    color?: string;          // hex color for mask (default: '#ff8c00')
    maxAlpha?: number;       // alpha for 'on' pixels (0..1) (default 0.85)
    scaleAlphaByValue?: boolean; // if true, alpha = (value/max) * maxAlpha
}
function parseHexToRGB(hex: string): [number, number, number] {
    let h = hex.replace('#', '').trim();
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    if (h.length !== 6) return [255, 140, 0];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
export async function loadGeoTiffMaskTexture(url: string, opts: MaskTextureOptions = {}): Promise<THREE.Texture> {
    const { threshold = 0, color = '#ff8c00', maxAlpha = 0.85, scaleAlphaByValue = false } = opts;
    const tiff = await fromUrl(url);
    const image = await tiff.getImage();
    const width = image.getWidth();
    const height = image.getHeight();
    const raster = await image.readRasters({ interleave: false, samples: [0] }) as any;
    const band = raster[0] as ArrayLike<number> | Uint8Array;
    // compute max for scaling if requested
    let max = 0;
    if (scaleAlphaByValue) {
        for (let i = 0; i < band.length; i++) { const v = band[i]!; if (v > max) max = v; }
        if (max === 0) max = 1; // avoid div by 0
    }
    const [r, g, b] = parseHexToRGB(color);
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0, j = 0; i < band.length; i++, j += 4) {
        const v = band[i]!;
        if (v > threshold) {
            let a = maxAlpha;
            if (scaleAlphaByValue) a = Math.min(1, (v / max) * maxAlpha);
            data[j] = r; data[j + 1] = g; data[j + 2] = b; data[j + 3] = Math.round(a * 255);
        } else {
            data[j] = 0; data[j + 1] = 0; data[j + 2] = 0; data[j + 3] = 0; // fully transparent
        }
    }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx!.createImageData(width, height);
    imageData.data.set(data); ctx!.putImageData(imageData, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.minFilter = THREE.LinearFilter;
    return tex;
}

// Generic single-band dataset loader (no color mapping) for sampling raw values (e.g., mountains.tif)
export interface SingleBandDataset {
    width: number;
    height: number;
    data: Float32Array; // raw (converted to float)
    min: number;
    max: number;
}
export async function loadGeoTiffSingleBand(url: string): Promise<SingleBandDataset> {
    const tiff = await fromUrl(url);
    const image = await tiff.getImage();
    const width = image.getWidth();
    const height = image.getHeight();
    const raster = await image.readRasters({ interleave: false, samples: [0] }) as any;
    const band = raster[0] as ArrayLike<number> | Uint8Array;
    const data = new Float32Array(band.length);
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < band.length; i++) { const v = Number(band[i]!); data[i] = v; if (v < min) min = v; if (v > max) max = v; }
    if (min === Infinity) { min = 0; max = 0; }
    return { width, height, data, min, max };
}
