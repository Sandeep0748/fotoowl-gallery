// Generate a consistent color based on userId
export const getUserColor = (userId) => {
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
  if (!userId) return colors[0];
  // Generate consistent color from userId
  const hash = userId.split("").reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  return colors[Math.abs(hash) % colors.length];
};

