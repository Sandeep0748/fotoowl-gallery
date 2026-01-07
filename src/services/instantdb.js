import { init, id } from "@instantdb/react";

const appId = import.meta.env.VITE_INSTANT_APP_ID;

if (!appId) {
  console.error("VITE_INSTANT_APP_ID is not set in environment variables!");
  console.error("Please add VITE_INSTANT_APP_ID to your .env file");
}

export const db = init({
  appId: appId || "",
});

// Export id helper
export { id };

/* ---------------- CONNECTION STATUS ---------------- */

let connectionStatus = "connecting";
let statusListeners = new Set();

export const getConnectionStatus = () => connectionStatus;

export const subscribeToConnectionStatus = (callback) => {
  statusListeners.add(callback);
  return () => statusListeners.delete(callback);
};

const updateConnectionStatus = (status) => {
  if (connectionStatus !== status) {
    console.log(`InstantDB status: ${connectionStatus} → ${status}`);
    connectionStatus = status;
    statusListeners.forEach((cb) => cb(status));
  }
};

/* ---------------- ACTIVITY TRACKING ---------------- */

// Call this whenever real-time data is received
export const markActivity = () => {
  updateConnectionStatus("connected");
};

/* ---------------- GLOBAL REFRESH ---------------- */

let refreshListeners = new Set();

export const triggerGlobalRefresh = () => {
  console.log("🔄 Global refresh triggered:", refreshListeners.size);
  refreshListeners.forEach((cb) => {
    try {
      cb();
    } catch (error) {
      console.error("Error in refresh listener:", error);
    }
  });
};

export const subscribeToGlobalRefresh = (callback) => {
  refreshListeners.add(callback);
  return () => refreshListeners.delete(callback);
};

/* ---------------- INIT ---------------- */

if (appId) {
  updateConnectionStatus("connecting");

  setTimeout(() => {
    try {
      db.useQuery({ feed: { $: { limit: 1 } } });
      updateConnectionStatus("connected");
      console.log(
        "InstantDB initialized:",
        appId.substring(0, 8) + "..."
      );
    } catch (error) {
      console.error("InstantDB initialization error:", error);
    }
  }, 1000);
} else {
  console.warn("InstantDB initialized without App ID");
}
