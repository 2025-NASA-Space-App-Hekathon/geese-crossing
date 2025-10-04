# Optimization Notes

Summary of applied and recommended optimizations.

## Applied

1. Quaternion-based focus rotation + SLERP for minimal math each frame.
2. Removed multi-strategy rotation comparisons and heavy console logging in hot paths.
3. Centralized debug gating with `debugConfig.ts` (lazy logging only when enabled).
4. Lowered sphere segments for overlay/earth can be tuned (currently 96). Consider dynamic LOD if necessary.

## Low Hanging Fruit (Recommended Next)

1. Texture Anisotropy: Set `renderer.capabilities.getMaxAnisotropy()` on main color map for sharper visuals at angle.
2. Instancing Mountain lines (merge into a single `BufferGeometry` with index) to reduce draw calls if dataset becomes large.
3. Offscreen Canvas (createImageBitmap) for GeoTIFF conversions to avoid blocking main thread (wrap in `requestIdleCallback`).
4. Memoize expensive lat/lon conversions if doing bulk operations (currently per click only, so low priority).
5. Use `React.Suspense` + `useLoader` for textures to leverage R3F caching instead of manual `TextureLoader`.

## Profiling Tips

Run Chrome Performance with WebGL Insight. Look at:

- Draw calls (aim < 200 for smooth mobile)
- Shader compile stalls (first interaction)
- CPU scripting time (should remain low; main cost is raycast + OrbitControls)

## Possible Future Enhancements

1. GPU Height Displacement: Bake normal map to improve lighting with lower geometry segments.
2. Switch mountain mask to single channel `RedFormat` + custom shader to save bandwidth.
3. Migrate color map to KTX2 compressed texture (BasisU) for faster load.

---

Generated automatically; adjust as project evolves.
