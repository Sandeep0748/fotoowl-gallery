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

// Heartbeat mechanism to test real-time connectivity
let heartbeatInterval = null;

const startHeartbeat = () => {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  
  heartbeatInterval = setInterval(() => {
    // Send a test transaction to check if real-time is working
    const testId = `heartbeat-${Date.now()}`;
    try {
      // This is a no-op transaction that should trigger real-time updates if working
      db.transact([
        db.tx.feed[testId].update({
          type: "heartbeat",
          userId: "system",
          username: "System",
          createdAt: Date.now(),
        }),
      ]).then(() => {
        // Clean up the heartbeat entry after a short delay
        setTimeout(() => {
          db.transact([db.tx.feed[testId].delete()]).catch(() => {});
        }, 1000);
      }).catch(() => {
        // If transaction fails, mark as disconnected
        updateConnectionStatus('disconnected');
      });
    } catch (error) {
      updateConnectionStatus('disconnected');
    }
  }, 20000); // Send heartbeat every 20 seconds
};

// Global refresh trigger for manual updates
let refreshListeners = new Set();

export const triggerGlobalRefresh = () => {
  console.log("🔄 Global refresh triggered - notifying", refreshListeners.size, "listeners");
  refreshListeners.forEach(callback => {
    try {
      callback();
    } catch (error) {
      console.error("Error in refresh listener:", error);
    }
  });
};

export const subscribeToGlobalRefresh = (callback) => {
  refreshListeners.add(callback);
  return () => refreshListeners.delete(callback);
};

// Initialize connection monitoring
if (appId) {
  updateConnectionStatus('connecting');

  // Set up periodic connection checks
  setInterval(monitorActivity, 10000); // Check every 10 seconds

  // Start heartbeat to test real-time connectivity
  startHeartbeat();

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
