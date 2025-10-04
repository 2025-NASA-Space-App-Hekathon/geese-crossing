import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";

// FocusAnimator: 한국 클릭 시 카메라 줌 + 구 살짝 아래로 이동
export default function FocusAnimator({ globeRef, focusStateRef, setFocusMode }: {
    globeRef: React.RefObject<THREE.Mesh | null>;
    focusStateRef: React.MutableRefObject<{
        mode: string;
        progress: number;
        startRotX?: number;
        startRotY?: number;
        originalDistance?: number; // 실제 시작 거리
        targetRotX?: number;
        targetRotY?: number;
    }>;
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

        const targetDistance = 2; // 지구 중심과 목표 거리 (조정 가능)
        const startGlobeY = 0;
        const focusGlobeY = -1.5; // 지구 1/3 정도만 위로 보이게 더 내림

        const g = globeRef.current;

        if (lastModeRef.current !== st.mode) {
            dlog('Mode change', { from: lastModeRef.current, to: st.mode });
            lastModeRef.current = st.mode;
        }
        // const stepPct = Math.floor(tRaw * 100);
        // if (stepPct % 10 === 0 && stepPct !== lastStepRef.current) {
        //     lastStepRef.current = stepPct;
        //     const gpos = g ? { y: g.position.y.toFixed(3) } : {};
        //     dlog('Progress', { mode: st.mode, pct: stepPct, k: k.toFixed(3), camZ: camera.position.z.toFixed(3), globeY: gpos });
        // }

        if (!g) return;
        if (st.mode === 'focusing') {
            const srx = st.startRotX ?? g.rotation.x;
            const sry = st.startRotY ?? g.rotation.y;
            const startDistance = st.originalDistance ?? camera.position.length();
            const trgx = st.targetRotX ?? srx;
            const trgy = st.targetRotY ?? sry;

            g.rotation.x = srx + (trgx - srx) * k;
            g.rotation.y = sry + (trgy - sry) * k;
            // 카메라 방향 유지한 채 거리만 보간 (카메라가 원점 바라본다고 가정)
            const dir = camera.position.clone().normalize();
            const newDistance = startDistance + (targetDistance - startDistance) * k;
            camera.position.copy(dir.multiplyScalar(newDistance));
            // g.position.y = startGlobeY + (focusGlobeY - startGlobeY) * k;

            if (tRaw >= 1) {
                st.mode = 'focused';
                st.progress = 0;
                setFocusMode('focused');
                dlog('Focus complete');
            }
        } else if (st.mode === 'unfocusing') {
            const srx = st.startRotX ?? g.rotation.x;
            const sry = st.startRotY ?? g.rotation.y;
            const startDistance = st.originalDistance ?? camera.position.length();
            const trgx = st.targetRotX ?? srx;
            const trgy = st.targetRotY ?? sry;

            g.rotation.x = srx + (trgx - srx) * k;
            g.rotation.y = sry + (trgy - sry) * k;
            const dir = camera.position.clone().normalize();
            // 역방향: targetDistance -> startDistance 로 이동
            const newDistance = targetDistance + (startDistance - targetDistance) * k;
            camera.position.copy(dir.multiplyScalar(newDistance));
            // g.position.y = focusGlobeY + (startGlobeY - focusGlobeY) * k;

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
            // if (g) g.position.y = focusGlobeY;
        }
        camera.updateProjectionMatrix();
    });
    return null;
}