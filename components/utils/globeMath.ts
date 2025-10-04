import * as THREE from 'three';

// Longitude texture shift (observed map offset)
export const LONGITUDE_TEXTURE_SHIFT_DEG = 90;

export function normalizeLongitude(lon: number) {
    let r = lon;
    while (r > 180) r -= 360;
    while (r < -180) r += 360;
    return r;
}

export function cartesianToLatLon(position: THREE.Vector3) {
    const p = position.clone().normalize();
    const latitude = THREE.MathUtils.radToDeg(Math.asin(p.y));
    const rawLongitude = THREE.MathUtils.radToDeg(Math.atan2(p.x, p.z));
    const longitude = normalizeLongitude(rawLongitude - LONGITUDE_TEXTURE_SHIFT_DEG);
    return { latitude, longitude };
}

export function getGlobeRotationForLatLon(latitude: number, longitude: number) {
    const rawLon = longitude + LONGITUDE_TEXTURE_SHIFT_DEG;
    return {
        rotationY: -THREE.MathUtils.degToRad(rawLon),
        rotationX: THREE.MathUtils.degToRad(latitude)
    };
}

export interface ClickInfo {
    latitude: number;
    longitude: number;
    isKorea: boolean;
    timestamp: number;
}

export function isInSouthKorea(lat: number, lon: number): boolean {
    const minLat = 32.5;
    const maxLat = 39.0;
    const minLon = 124.0;
    const maxLon = 132.0;
    return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
}
