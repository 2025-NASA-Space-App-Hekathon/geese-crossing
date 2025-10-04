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
    mountainsValue?: number; // raw mountains.tif value at click
    mountainsPixelX?: number; // pixel x in mountains.tif
    mountainsPixelY?: number; // pixel y in mountains.tif
    localVector?: { x: number; y: number; z: number }; // normalized local sphere vector (before globe rotation application)
}

export function isInSouthKorea(lat: number, lon: number): boolean {
    const minLat = 32.5;
    const maxLat = 39.0;
    const minLon = 124.0;
    const maxLon = 132.0;
    return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
}

/**
 * 클릭한 지점이 카메라 정면으로 오도록 하는 정확한 회전 계산
 * 핵심: 클릭한 지점 벡터를 (0, 0, -1) 방향으로 회전시키는 것
 * @param clickPoint 클릭한 지점의 로컬 좌표 (구 표면의 벡터)
 * @returns 필요한 X, Y 회전 각도 (라디안)
 */
/**
 * 클릭한 지점(localPoint)이 카메라 방향(cameraDir)과 정확히 일직선이 되도록
 * 구(지구) 자체의 절대 회전(X,Y Euler) 값을 계산.
 * - localPoint: "아직 회전 적용 전" 구 표면상의 단위 벡터 (EarthMesh에서 역회전 적용 후 전달)
 * - cameraDir: 지구 중심에서 카메라를 향하는 단위 벡터 (world space에서 earthCenter->cameraPosition 반대)
 *
 * 수학적 목표: R * localPoint = cameraDir  (R: 우리가 설정할 globe.rotation)
 * 여기서 R 은 setFromUnitVectors(localPoint, cameraDir) 로 얻은 최소 회전 쿼터니언.
 * Z(roll) 성분은 시각적으로 중요하지 않으므로 Euler 변환 후 z 는 무시.
 */
export function computePointFocusRotation(localPoint: THREE.Vector3, cameraDir: THREE.Vector3): { rotationX: number; rotationY: number; quaternion: THREE.Quaternion } {
    const from = localPoint.clone().normalize();
    const to = cameraDir.clone().normalize();

    // 특이 케이스: 정반대 (dot = -1) 인 경우 임의의 직교축으로 180도 회전
    const dot = from.dot(to);
    let quaternion: THREE.Quaternion;
    if (dot < -0.999999) {
        // from 과 가장 직교에 가까운 축 선택
        const axis = new THREE.Vector3(1, 0, 0).cross(from).length() > 0.1
            ? new THREE.Vector3(1, 0, 0)
            : new THREE.Vector3(0, 1, 0);
        quaternion = new THREE.Quaternion().setFromAxisAngle(axis.cross(from).normalize(), Math.PI);
    } else {
        quaternion = new THREE.Quaternion().setFromUnitVectors(from, to);
    }

    const euler = new THREE.Euler().setFromQuaternion(quaternion, 'YXZ');
    return { rotationX: euler.x, rotationY: euler.y, quaternion };
}

/**
 * 세 점이 일직선을 이루는지 검증하는 함수
 * @param point1 첫 번째 점 (지구 중심)
 * @param point2 두 번째 점 (클릭한 지점)
 * @param point3 세 번째 점 (카메라 위치)
 * @returns 검증 결과와 세부 정보
 */
export function verifyCollinearity(
    point1: THREE.Vector3,
    point2: THREE.Vector3,
    point3: THREE.Vector3
): {
    isCollinear: boolean;
    crossProductMagnitude: number;
    angleDeviation: number;
    details: {
        vector12: THREE.Vector3;
        vector13: THREE.Vector3;
        crossProduct: THREE.Vector3;
        dotProduct: number;
        angleBetweenVectors: number;
    };
} {
    // 벡터 계산
    const vector12 = point2.clone().sub(point1); // 지구 중심 -> 클릭 지점
    const vector13 = point3.clone().sub(point1); // 지구 중심 -> 카메라

    // 외적 계산 (외적의 크기가 0에 가까우면 일직선)
    const crossProduct = vector12.clone().cross(vector13);
    const crossProductMagnitude = crossProduct.length();

    // 내적으로 각도 계산
    const dotProduct = vector12.normalize().dot(vector13.normalize());
    const angleBetweenVectors = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
    const angleDeviation = Math.abs(angleBetweenVectors); // 0도 또는 180도에서의 편차

    // 일직선 판정 (각도 편차가 1도 미만이면 일직선으로 간주)
    const isCollinear = angleDeviation < THREE.MathUtils.degToRad(1) ||
        Math.abs(angleDeviation - Math.PI) < THREE.MathUtils.degToRad(1);

    return {
        isCollinear,
        crossProductMagnitude,
        angleDeviation: THREE.MathUtils.radToDeg(angleDeviation),
        details: {
            vector12: vector12.clone(),
            vector13: vector13.clone(),
            crossProduct,
            dotProduct,
            angleBetweenVectors: THREE.MathUtils.radToDeg(angleBetweenVectors)
        }
    };
}
