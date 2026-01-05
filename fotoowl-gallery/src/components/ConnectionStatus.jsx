import { useState, useEffect } from 'react';
import { subscribeToConnectionStatus, getConnectionStatus } from '../services/instantdb';

const ConnectionStatus = () => {
  const [status, setStatus] = useState(getConnectionStatus());

  useEffect(() => {
    const unsubscribe = subscribeToConnectionStatus(setStatus);
    return unsubscribe;
  }, []);

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'disconnected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connected': return 'Real-time connected';
      case 'connecting': return 'Connecting...';
      case 'disconnected': return 'Disconnected';
      default: return 'Unknown';
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1 text-xs text-gray-600">
      <div className={`w-2 h-2 rounded-full ${getStatusColor()}`}></div>
      <span>{getStatusText()}</span>
    </div>
  );
};

export default ConnectionStatus;