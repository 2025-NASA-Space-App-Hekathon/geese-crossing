import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from 'three';

// FocusAnimator: 한국 클릭 시 카메라 줌 + 구 살짝 아래로 이동
export default function FocusAnimator({ globeRef, focusStateRef, setFocusMode }: {
    globeRef: React.RefObject<THREE.Mesh | null>;
    focusStateRef: React.MutableRefObject<{
        mode: string;
        progress: number;
        startRotX?: number; // legacy euler path
        startRotY?: number; // legacy euler path
        originalDistance?: number;
        targetRotX?: number; // legacy euler path
        targetRotY?: number; // legacy euler path
        startQuat?: THREE.Quaternion; // quaternion animation start
        targetQuat?: THREE.Quaternion; // quaternion animation target
    }>;
    setFocusMode: React.Dispatch<React.SetStateAction<'idle' | 'focusing' | 'focused' | 'unfocusing'>>;
}) {
    const { camera } = useThree();
    const DEBUG = true;
    const dlog = (...args: any[]) => { if (DEBUG) console.log('[FocusAnimator]', ...args); };
    const lastStepRef = useRef<number>(-1);
    const lastModeRef = useRef<string>('idle');
    const tmpQuat = useRef(new THREE.Quaternion());
    useFrame((_, delta: number) => {
        const st = focusStateRef.current;
        if (st.mode === 'idle') return;
        const duration = 1.1; // 초
        st.progress += delta / duration;
        const tRaw = Math.min(1, st.progress);
        const ease = (x: number) => x * x * (3 - 2 * x); // smoothstep
        const k = ease(tRaw);

        const targetDistance = 2; // 지구 중심과 목표 거리 (조정 가능)
        const startGlobeY = 0;
        const focusGlobeY = -1.5; // 지구 1/3 정도만 위로 보이게 더 내림

        const g = globeRef.current;

        if (lastModeRef.current !== st.mode) {
            dlog('Mode change', { from: lastModeRef.current, to: st.mode });
            lastModeRef.current = st.mode;
        }
        const stepPct = Math.floor(tRaw * 100);
        if (stepPct % 10 === 0 && stepPct !== lastStepRef.current) {
            lastStepRef.current = stepPct;
            const gpos = g ? { y: g.position.y.toFixed(3) } : {};
            dlog('Progress', { mode: st.mode, pct: stepPct, k: k.toFixed(3), camZ: camera.position.z.toFixed(3), globeY: gpos });
        }

        if (!g) return;
        if (st.mode === 'focusing') {
            const startDistance = st.originalDistance ?? camera.position.length();
            if (st.startQuat && st.targetQuat) {
                // Reuse tmp quaternion to avoid GC churn
                tmpQuat.current.copy(st.startQuat).slerp(st.targetQuat, k);
                g.quaternion.copy(tmpQuat.current);
            } else {
                // Legacy Euler fallback
                const srx = st.startRotX ?? g.rotation.x;
                const sry = st.startRotY ?? g.rotation.y;
                const trgx = st.targetRotX ?? srx;
                const trgy = st.targetRotY ?? sry;
                g.rotation.x = srx + (trgx - srx) * k;
                g.rotation.y = sry + (trgy - sry) * k;
            }
            const dir = camera.position.clone().normalize();
            const newDistance = startDistance + (targetDistance - startDistance) * k;
            camera.position.copy(dir.multiplyScalar(newDistance));
            if (tRaw >= 1) {
                st.mode = 'focused';
                st.progress = 0;
                setFocusMode('focused');
                dlog('Focus complete');
            }
        } else if (st.mode === 'unfocusing') {
            if (st.startQuat && st.targetQuat) {
                tmpQuat.current.copy(st.startQuat).slerp(st.targetQuat, k);
                g.quaternion.copy(tmpQuat.current);
            } else {
                const srx = st.startRotX ?? g.rotation.x;
                const sry = st.startRotY ?? g.rotation.y;
                const trgx = 0;
                const trgy = 0;
                g.rotation.x = srx + (trgx - srx) * k;
                g.rotation.y = sry + (trgy - sry) * k;
            }
            const dir = camera.position.clone().normalize();
            const newDistance = targetDistance + (3 - targetDistance) * k;
            camera.position.copy(dir.multiplyScalar(newDistance));
            if (tRaw >= 1) {
                st.mode = 'idle';
                st.progress = 0;
                setFocusMode('idle');
                dlog('Unfocus complete');
            }
        } else if (st.mode === 'focused') {
            // 유지 상태
            // 유지 상태: targetDistance 유지
            const dir = camera.position.clone().normalize();
            camera.position.copy(dir.multiplyScalar(targetDistance));
            // g.position.y = focusGlobeY;
        }
        camera.updateProjectionMatrix();
    });
    return null;
}