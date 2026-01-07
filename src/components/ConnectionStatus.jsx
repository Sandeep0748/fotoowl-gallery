import { useState, useEffect } from "react";
import {
  subscribeToConnectionStatus,
  getConnectionStatus,
} from "../services/instantdb";

const ConnectionStatus = () => {
  const [status, setStatus] = useState(getConnectionStatus());

  useEffect(() => {
    const unsubscribe = subscribeToConnectionStatus(setStatus);
    return unsubscribe;
  }, []);

  const getStatusColor = () => {
    if (status === "connected") return "bg-green-500";
    if (status === "connecting") return "bg-yellow-500";
    return "bg-gray-400";
  };

  const getStatusText = () => {
    if (status === "connected") return "Real-time connected";
    if (status === "connecting") return "Connecting…";
    return "";
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1 text-xs text-gray-600">
      <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
      <span>{getStatusText()}</span>
    </div>
  );
};

export default ConnectionStatus;
