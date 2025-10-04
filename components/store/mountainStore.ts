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

interface MountainState {
    selected: SelectedMountainData | null;
    setSelected: (data: Pick<SelectedMountainData, "id" | "metadata">) => void;
    clear: () => void;
}

export const useMountainStore = create<MountainState>((set) => ({
    selected: null,
    setSelected: (data) => set({
        selected: {
            id: data.id,
            name: mountainName[data.id],
            metadata: data.metadata
        }
    }),
    clear: () => set({ selected: null }),
}));
