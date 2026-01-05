import { create } from "zustand";

// Generate a random color for the user
const generateUserColor = () => {
  const colors = [
    "#6366f1", // indigo
    "#8b5cf6", // purple
    "#ec4899", // pink
    "#f59e0b", // amber
    "#10b981", // emerald
    "#06b6d4", // cyan
    "#f97316", // orange
    "#84cc16", // lime
    "#14b8a6", // teal
    "#a855f7", // violet
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

// Zustand store for user state, selected image, and modal state
export const useUserStore = create((set) => ({
  // Current user
  userId: crypto.randomUUID(),
  username: `User${Math.floor(Math.random() * 1000)}`,
  userColor: generateUserColor(),

  // Selected image and modal state
  selectedImage: null,
  isModalOpen: false,

  // Actions
  setSelectedImage: (image) => set({ selectedImage: image, isModalOpen: !!image }),
  closeModal: () => set({ selectedImage: null, isModalOpen: false }),
}));
