# Geese Crossing — Next.js 14.2.16 App Router + Mantine + Three.js

Starter template using the Next.js App Router (v14.2.16), Mantine 7, and a basic Three.js scene via `@react-three/fiber` + `@react-three/drei`.

## Quick start

```bash
npm install
npm run dev
```

Visit: http://localhost:3000

## Key files

- `app/layout.tsx` – Root layout with MantineProvider & ColorSchemeScript
- `app/page.tsx` – Demo page (color + wireframe controls)
- `components/ThreeScene.tsx` – Client component rendering rotating cube
- `app/globals.css` – Global CSS
- `tsconfig.json` / `next.config.js` – Configuration

## Mantine

Imported global styles via `@mantine/core/styles.css`. You can customize theme:

```tsx
<MantineProvider defaultColorScheme="dark" theme={{ primaryColor: "teal" }}>
  {children}
</MantineProvider>
```

## Three.js integration

- Uses `@react-three/fiber` (Canvas) + `@react-three/drei` (OrbitControls)
- Marked `components/ThreeScene.tsx` with `"use client"` to ensure it runs only on client.

## Next possible enhancements

- Add GLTF model loading (e.g., goose model) with `useGLTF`
- Add color scheme toggle & persistent storage
- Add Zustand for shared state between UI and scene
- Add SSR safe dynamic imports for heavier 3D assets

## License

Add a license file if distributing or submitting publicly.
