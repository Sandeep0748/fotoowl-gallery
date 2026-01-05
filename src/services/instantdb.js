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

// Enhanced connection status tracking
let connectionStatus = 'connecting';
let statusListeners = new Set();
let lastActivity = Date.now();
let reconnectTimer = null;

export const getConnectionStatus = () => connectionStatus;

export const subscribeToConnectionStatus = (callback) => {
  statusListeners.add(callback);
  return () => statusListeners.delete(callback);
};

const updateConnectionStatus = (status) => {
  if (connectionStatus !== status) {
    console.log(`InstantDB connection status: ${connectionStatus} -> ${status}`);
    connectionStatus = status;
    statusListeners.forEach(callback => callback(status));
  }
};

// Monitor real-time activity
const monitorActivity = () => {
  const now = Date.now();
  if (now - lastActivity > 30000) { // 30 seconds without activity
    updateConnectionStatus('disconnected');
  } else if (connectionStatus === 'disconnected') {
    updateConnectionStatus('connected');
  }
};

// Activity tracker - call this when we receive real-time updates
export const markActivity = () => {
  lastActivity = Date.now();
  if (connectionStatus !== 'connected') {
    updateConnectionStatus('connected');
  }
};

// Initialize connection monitoring
if (appId) {
  updateConnectionStatus('connecting');

  // Set up periodic connection checks
  setInterval(monitorActivity, 10000); // Check every 10 seconds

  // Add a test query to verify connection
  setTimeout(() => {
    try {
      db.useQuery({ feed: { $: { limit: 1 } } });
      console.log("InstantDB initialized with App ID:", appId.substring(0, 8) + "...");
      console.log("Real-time features enabled - monitoring connection status");
    } catch (error) {
      console.error("InstantDB initialization error:", error);
      updateConnectionStatus('disconnected');
    }
  }, 1000);

} else {
  updateConnectionStatus('disconnected');
  console.warn("InstantDB initialized without App ID - real-time features will not work!");
}
