"use client";
import { create } from 'zustand';
import * as THREE from 'three';

// Overlay record kept in store. Textures are loaded lazily (only when first made visible)
export interface OverlayRecord {
    id: string;
    name: string;
    path: string;        // public relative path
    extension: string;   // .png, .tif, ...
    color: string;       // assigned palette color (for mask style tiffs)
    opacity: number;     // 0..1 user adjustable
    visible: boolean;    // toggle on/off
    order: number;       // z / list ordering (small number rendered first)
    status: 'idle' | 'loading' | 'ready' | 'error';
    error?: string | null;
    texture: THREE.Texture | null; // always null until ready
    isMaskStyle: boolean; // whether we loaded via mask loader (tif) vs normal image
}

interface OverlayState {
    overlays: Record<string, OverlayRecord>;
    orderedIds: string[]; // maintained sorted by order
    palette: string[];
    // actions
    initialize: (items: { id: string; name: string; path: string; extension: string; }[]) => void;
    setVisibility: (id: string, visible: boolean) => void;
    toggleVisibility: (id: string) => void;
    setOpacity: (id: string, opacity: number) => void;
    setOrder: (id: string, newOrder: number) => void;
    registerTexture: (id: string, texture: THREE.Texture, isMaskStyle: boolean) => void;
    markLoading: (id: string) => void;
    markError: (id: string, error: string) => void;
    hideAll: () => void;
    showAll: () => void; // (lazy loads textures for all on)
    disposeAll: () => void;
    remove: (id: string) => void;
    clear: () => void;
}

export const useOverlayStore = create<OverlayState>((set, get) => ({
    overlays: {},
    orderedIds: [],
    palette: [
        '#37ff00ff', '#0088ffff', '#ff8800ff', '#ff0088ff', '#00ff88ff',
        '#ffffff88', '#88ff00ff', '#ff0088ff', '#0088ffff', '#ff8800ff',
        '#8800ffff', '#00ffffff', '#ffff00ff', '#ff4400ff', '#44ff00ff'
    ],
    initialize: (items) => set((state) => {
        const existing = { ...state.overlays };
        // keep existing entries (retain texture), add new, remove missing
        const next: Record<string, OverlayRecord> = {};
        let orderCounter = 0;
        const orderedIds: string[] = [];
        items.forEach((item, idx) => {
            const prev = existing[item.id];
            const color = state.palette[idx % state.palette.length];
            if (prev) {
                next[item.id] = { ...prev, name: item.name, path: item.path, extension: item.extension, color };
            } else {
                next[item.id] = {
                    id: item.id,
                    name: item.name,
                    path: item.path,
                    extension: item.extension,
                    color,
                    opacity: 0.9,
                    visible: false,
                    order: orderCounter,
                    status: 'idle',
                    error: null,
                    texture: null,
                    isMaskStyle: ['.tif', '.tiff'].includes(item.extension.toLowerCase())
                };
            }
            orderedIds.push(item.id);
            orderCounter++;
        });
        return { overlays: next, orderedIds };
    }),
    setVisibility: (id, visible) => set((state) => ({
        overlays: { ...state.overlays, [id]: state.overlays[id] ? { ...state.overlays[id], visible } : state.overlays[id] }
    })),
    toggleVisibility: (id) => set((state) => {
        const rec = state.overlays[id];
        if (!rec) return {} as any;
        return { overlays: { ...state.overlays, [id]: { ...rec, visible: !rec.visible } } };
    }),
    setOpacity: (id, opacity) => set((state) => {
        const rec = state.overlays[id]; if (!rec) return {} as any;
        return { overlays: { ...state.overlays, [id]: { ...rec, opacity } } };
    }),
    setOrder: (id, newOrder) => set((state) => {
        if (!state.overlays[id]) return {} as any;
        const overlays = { ...state.overlays, [id]: { ...state.overlays[id], order: newOrder } };
        const orderedIds = Object.values(overlays).sort((a, b) => a.order - b.order).map(o => o.id);
        return { overlays, orderedIds };
    }),
    registerTexture: (id, texture, isMaskStyle) => set((state) => {
        const rec = state.overlays[id]; if (!rec) return {} as any;
        return { overlays: { ...state.overlays, [id]: { ...rec, texture, status: 'ready', isMaskStyle } } };
    }),
    markLoading: (id) => set((state) => {
        const rec = state.overlays[id]; if (!rec) return {} as any;
        if (rec.status === 'ready') return {} as any;
        return { overlays: { ...state.overlays, [id]: { ...rec, status: 'loading', error: null } } };
    }),
    markError: (id, error) => set((state) => {
        const rec = state.overlays[id]; if (!rec) return {} as any;
        return { overlays: { ...state.overlays, [id]: { ...rec, status: 'error', error } } };
    }),
    hideAll: () => set((state) => {
        const overlays: Record<string, OverlayRecord> = {};
        Object.values(state.overlays).forEach(o => { overlays[o.id] = { ...o, visible: false }; });
        return { overlays };
    }),
    showAll: () => set((state) => {
        const overlays: Record<string, OverlayRecord> = {};
        Object.values(state.overlays).forEach(o => { overlays[o.id] = { ...o, visible: true }; });
        return { overlays };
    }),
    disposeAll: () => {
        const { overlays } = get();
        Object.values(overlays).forEach(o => { o.texture?.dispose(); });
        set({ overlays: {}, orderedIds: [] });
    },
    remove: (id) => set((state) => {
        const rec = state.overlays[id]; rec?.texture?.dispose();
        const overlays = { ...state.overlays }; delete overlays[id];
        const orderedIds = state.orderedIds.filter(x => x !== id);
        return { overlays, orderedIds };
    }),
    clear: () => {
        const { overlays } = get();
        Object.values(overlays).forEach(o => o.texture?.dispose());
        set({ overlays: {}, orderedIds: [] });
    }
}));

// Selectors / helpers
export const useOrderedOverlays = () => {
    return useOverlayStore((s) => s.orderedIds.map(id => s.overlays[id]).filter(Boolean));
};

export const useAnyOverlayVisible = () => {
    return useOverlayStore((s) => s.orderedIds.some(id => s.overlays[id]?.visible));
};

export const useOverlayActions = () => useOverlayStore((s) => ({
    initialize: s.initialize,
    toggleVisibility: s.toggleVisibility,
    setVisibility: s.setVisibility,
    setOpacity: s.setOpacity,
    registerTexture: s.registerTexture,
    markLoading: s.markLoading,
    markError: s.markError,
    hideAll: s.hideAll,
    showAll: s.showAll,
}));

