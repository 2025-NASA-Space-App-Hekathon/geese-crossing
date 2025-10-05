import { create } from 'zustand';

interface UIState {
  showMountainsMask: boolean;
  setShowMountainsMask: (value: boolean) => void;
  toggleMountainsMask: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  showMountainsMask: true,
  setShowMountainsMask: (value: boolean) => set({ showMountainsMask: value }),
  toggleMountainsMask: () => set((s) => ({ showMountainsMask: !s.showMountainsMask })),
}));
