import { create } from 'zustand';

export interface SelectedMountain {
    name?: string;
    lat: number;
    lon: number;
    selectedAt: number;
}

interface MountainState {
    selected: SelectedMountain | null;
    setSelected: (m: SelectedMountain | null) => void;
    clear: () => void;
}

export const useMountainStore = create<MountainState>((set) => ({
    selected: null,
    setSelected: (m: SelectedMountain | null) => set({ selected: m }),
    clear: () => set({ selected: null })
}));
