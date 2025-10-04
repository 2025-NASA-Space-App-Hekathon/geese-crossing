<div align="center">

# Geese Crossing 🌍

Interactive globe with mountain GeoTIFF data, quaternion focus rotation, and adaptive overlays (Next.js 14 + React Three Fiber + Mantine 7).

</div>

---

## ✨ Features

| Feature               | Description                                                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Mountain click focus  | Click a mountain pixel (value > 0 in `mountains.tif`) → globe rotates so (Earth Center → Click → Camera) are collinear |
| Quaternion focus      | Minimal rotation via `setFromUnitVectors` + SLERP animation (no gimbal artifacts)                                      |
| Height displacement   | Elevation texture (`earth.tif`) displaces sphere surface (adjustable exaggeration)                                     |
| Mountain mask overlay | Semi‑transparent double‑sided mask with back hemisphere dimming                                                        |
| Mountain range paths  | Polyline ranges + canvas sprite labels with highlight state                                                            |
| Day/Night theme       | Mantine color scheme drives day/night base texture switching                                                           |
| State management      | `zustand` for selected range & UI state                                                                                |
| Debug gating          | Central debug flag + lightweight logging helper                                                                        |

---

## 🚀 Quick Start

```bash
npm install
npm run dev
# http://localhost:3000
```

Production build:

```bash
npm run build
npm start
```

Node 18+ recommended.

---

## 📁 Structure

```
app/                      Next.js App Router entry
components/
  atoms/                  Small reusable pieces (light, focus animator)
  molecules/              UI fragments (panels, info boxes)
  organisms/              Globe, overlays, mountain ranges
  store/                  Zustand global store
  utils/                  Math, GeoTIFF loaders, debug helpers
public/                   Textures & GeoTIFF assets
```

Key modules:

- `EarthGlobe.tsx` : scene composition, click → focus flow
- `EarthMesh.tsx` : sphere mesh + raycast + per‑click local vector derivation
- `FocusAnimator.tsx` : quaternion SLERP rotation + camera distance easing
- `globeMath.ts` : `computePointFocusRotation()` (localPoint → cameraDir)
- `textureLoaders.ts` : CanvasTexture generation from GeoTIFF
- `debugConfig.ts` : `isDebug()`, `dlog()`, runtime override

---

## 🔄 Click → Focus Pipeline

1. Raycast hit on sphere ⇒ world point & UV
2. Invert current globe quaternion ⇒ pre‑rotation local point
3. Sample `mountains.tif` single band (value ≤ 0 aborts)
4. Compute cameraDir = (cameraPosition − earthCenter).normalize()
5. `computePointFocusRotation(localPoint, cameraDir)` → { rotationX, rotationY, quaternion }
6. `startFocus(..., quaternion)` → SLERP animation to target orientation

Mathematical target: find minimal R so `R * localPoint = cameraDir`.

---

## 🧮 Math Notes

Quaternion minimal rotation:

```
q = setFromUnitVectors(from, to)
```

Antiparallel safeguard (dot ≈ -1) picks an orthogonal axis and applies π rotation. Euler angles only used for legacy fallback & logging.

---

## 🐞 Debug

Environment variable:
| Var | Purpose | Default |
|-----|---------|---------|
| `NEXT_PUBLIC_DEBUG` | Enable debug logs / panel | false |

Runtime toggle in DevTools:

```js
window.__GLOBE_DEBUG__ = true;
```

Use in code:

```ts
import { dlog } from "@/components/utils/debugConfig";
dlog("mountain value", val);
```

---

## ⚙️ Performance (Current & Planned)

Implemented:

1. Quaternion SLERP (reduced angle computations & no cumulative drift)
2. Centralized conditional logging
3. Reused temp quaternions to reduce GC churn
4. Adjustable sphere segment count (Earth + mask)
5. Disabled tone mapping on mask material
6. Max anisotropy applied to base texture

Next candidates:

1. Merge mountain polylines into a single indexed geometry
2. Web Worker for GeoTIFF decoding (off main thread)
3. KTX2 compressed textures for faster cold loads
4. Dynamic label resolution based on distance
5. Normal map derivation to drop geometry segments further

See `OPTIMIZATION_NOTES.md` for a living list.

---

## 🔐 Environment & Config

| Area      | Notes                                                          |
| --------- | -------------------------------------------------------------- |
| Textures  | Day/Night JPG; replace with KTX2 for production scale          |
| GeoTIFF   | Single band read for mountains; normalization done client‑side |
| HeightMap | Linear (no sRGB). Wrap = Repeat for potential future UV shifts |

---

## 🧪 Testing Ideas (Not yet implemented)

- Assert collinearity angle deviation < 0.5° after focus
- Unit test GeoTIFF min/max normalization path
- Snapshot focus state transitions (idle → focusing → focused)
- Raycast regression for various camera polar angles

---

## 📦 Dependencies

| Package                                        | Role                     |
| ---------------------------------------------- | ------------------------ |
| next / react / react-dom                       | App framework            |
| three / @react-three/fiber / @react-three/drei | 3D runtime               |
| geotiff                                        | GeoTIFF parsing          |
| zustand                                        | Lightweight global state |
| mantine                                        | UI components & theming  |

---

## 🛠 Maintenance Cheatsheet

| Issue           | Check                                        |
| --------------- | -------------------------------------------- |
| Blur textures   | Confirm anisotropy & mipmaps                 |
| Click ignored   | Mountain value <= 0 or UV clamp              |
| Mis-rotation    | localPoint computed with inverse quaternion? |
| Jitter in focus | Ensure only one focus animation active       |
| Overdraw        | Mask depthTest=false (expected)              |

---

## 📄 License

Add a LICENSE file (MIT/Apache-2.0) before public distribution.

---

## 🤝 Contributing

1. Fork & branch (`feat/your-feature`)
2. Run dev & test your change
3. Update README / notes if behavior changes

---

Happy mapping & mountain focusing! 🛰️
