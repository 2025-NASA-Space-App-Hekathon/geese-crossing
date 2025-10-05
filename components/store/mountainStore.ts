import { create } from 'zustand';

const mountainName = [
    null,
    "Andes",
    "Rocky Mountains",
    "Alps",
    "Himalaya",
    "Tien Shan",
    "Atlas",
    "Great-Dividing Range",
    "Japanese Alps",
    "Drakensberg",
    "Taebaek; 태백"
]

const resolveMountainName = (id: number): string | null => {
    const name = (mountainName as (string | null | undefined)[])[id];
    if (typeof name === 'string' && name.length > 0) return name;
    if (id > 0) return `Mountain ${id}`; // fallback label when id not in mapping
    return null;
}

interface SelectedMountainData {
    id: number;
    name: string | null;
    metadata: SelectedMetaData | null;
};

interface SelectedMetaData {
    latitude: number;
    longitude: number;
    // 데이터 추가 가능
}

interface HoveredMountainData {
    id: number;
    name: string | null;
    metadata: SelectedMetaData | null;
}

interface MountainState {
    selected: SelectedMountainData | null;
    hovered: HoveredMountainData | null;
    setSelected: (data: Pick<SelectedMountainData, "id" | "metadata">) => void;
    setHovered: (data: Pick<HoveredMountainData, "id" | "metadata"> | null) => void;
    clear: () => void;
}

export const useMountainStore = create<MountainState>((set) => ({
    selected: null,
    hovered: null,
    setSelected: (data) => set({
        selected: {
            id: data.id,
            name: resolveMountainName(data.id),
            metadata: data.metadata
        }
    }),
    setHovered: (data) => set({
        hovered: data ? {
            id: data.id,
            name: resolveMountainName(data.id),
            metadata: data.metadata ?? null
        } : null
    }),
    clear: () => set({ selected: null, hovered: null }),
}));
