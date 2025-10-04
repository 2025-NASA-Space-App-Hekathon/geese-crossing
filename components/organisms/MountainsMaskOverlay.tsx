"use client";
import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface Props {
    texture: THREE.Texture | null;
    radius?: number;
    visible?: boolean;
    opacity?: number; // global multiplier
    elevation?: number; // offset above sphere
    colorize?: boolean; // (reserved) keep texture colors
    blending?: 'normal' | 'additive';
    backBrightness?: number; // 0~1 brightness multiplier for far (back) side (default 0.5)
    followRef?: React.RefObject<THREE.Object3D | null>; // if provided, copy its rotation each frame
    segments?: number; // geometry segments (default 96)
}

export default function MountainsMaskOverlay({
    texture,
    radius = 1.5,
    visible = true,
    opacity = 1.0,
    elevation = 0.0025,
    colorize = true,
    blending = 'normal',
    backBrightness = 0.5,
    followRef,
    segments = 96
}: Props) {
    const selfRef = useRef<THREE.Mesh | null>(null);
    useFrame(() => {
        if (followRef?.current && selfRef.current) {
            // Copy rotation (quaternion) so mask tracks globe orientation
            selfRef.current.quaternion.copy(followRef.current.quaternion);
        }
    });
    const material = useMemo(() => {
        if (!texture) return null;
        const mat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            depthTest: false, // disable depth test so we can see through earth
            opacity,
            side: THREE.DoubleSide, // render both hemispheres
            blending: blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
            toneMapped: false // skip tone mapping pass
        });
        // Inject shader code to dim back hemisphere (gl_FrontFacing false)
        mat.onBeforeCompile = (shader) => {
            // pass brightness uniform
            shader.uniforms.uBackBrightness = { value: backBrightness };
            shader.fragmentShader = shader.fragmentShader.replace(
                'void main() {',
                `uniform float uBackBrightness;\nvoid main() {`
            ).replace(
                '#include <output_fragment>',
                `#ifdef OPAQUE\n	gl_FragColor = vec4( diffuseColor.rgb, 1.0 );\n#else\n	gl_FragColor = vec4( diffuseColor.rgb, diffuseColor.a );\n#endif\n#if defined( USE_TRANSMISSION )\n	gl_FragColor.a *= transmissionAlpha + 0.1;\n#endif\n// Apply map, vertex colors, fog etc (already done prior).\n// At this point, outgoing color is in gl_FragColor\nfloat brightness = gl_FrontFacing ? 1.0 : uBackBrightness;\n// Only scale RGB, keep alpha same so transparency unchanged\ngl_FragColor.rgb *= brightness;\n#include <tonemapping_fragment>\n#include <encodings_fragment>\n`
            );
        };
        return mat;
    }, [texture, opacity, blending, backBrightness]);

    if (!texture || !material) return null;
    return (
        <mesh ref={selfRef} visible={visible} renderOrder={9}>
            <sphereGeometry args={[radius + elevation, segments, segments]} />
            <primitive object={material} attach="material" />
        </mesh>
    );
}
