import { init, id } from "@instantdb/react";

const appId = import.meta.env.VITE_INSTANT_APP_ID;

if (!appId) {
  console.error("VITE_INSTANT_APP_ID is not set in environment variables!");
  console.error("Please add VITE_INSTANT_APP_ID to your .env file");
}

export const db = init({
  appId: appId || "",
});

// Export id function for generating unique IDs
export { id };

// Connection status tracking
let connectionStatus = 'connecting';
let statusListeners = new Set();

export const getConnectionStatus = () => connectionStatus;

export const subscribeToConnectionStatus = (callback) => {
  statusListeners.add(callback);
  return () => statusListeners.delete(callback);
};

const updateConnectionStatus = (status) => {
  connectionStatus = status;
  statusListeners.forEach(callback => callback(status));
};

// Monitor connection status
if (appId) {
  // InstantDB provides real-time updates, so we can assume connected when queries work
  // For now, we'll set as connected after initialization
  updateConnectionStatus('connected');

  console.log("InstantDB initialized with App ID:", appId.substring(0, 8) + "...");
  console.log("Data will persist automatically - reactions, comments, and feed are saved to database");
} else {
  updateConnectionStatus('disconnected');
  console.warn("InstantDB initialized without App ID - real-time features will not work!");
}
