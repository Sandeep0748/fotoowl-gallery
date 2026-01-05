import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db, markActivity, getConnectionStatus, subscribeToConnectionStatus, subscribeToGlobalRefresh } from "../../services/instantdb";
import { getUserColor } from "../../utils/userColors";
import { fetchImages } from "../../services/unsplash";
import { useUserStore } from "../../store/userStore";
import { useMemo, useState, useEffect, useRef } from "react";

const Feed = () => {
  const { setSelectedImage, userId } = useUserStore();
  const [animatingItems, setAnimatingItems] = useState(new Set());
  const [connectionStatus, setConnectionStatus] = useState(getConnectionStatus());
  const previousItemsRef = useRef([]);
  const queryClient = useQueryClient();

  // Monitor connection status
  useEffect(() => {
    const unsubscribe = subscribeToConnectionStatus(setConnectionStatus);
    return unsubscribe;
  }, []);

  // Listen for global refresh triggers
  useEffect(() => {
    const unsubscribe = subscribeToGlobalRefresh(() => {
      console.log("Feed: Received global refresh trigger");
      // Since we removed polling, we rely on real-time updates
      // But we can invalidate React Query cache as backup
      queryClient.invalidateQueries({ queryKey: ['instantdb'] });
    });
    return unsubscribe;
  }, [queryClient]);

  // Listen for storage events (backup communication mechanism)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'feed-refresh') {
        console.log("Feed: Received storage refresh event");
        queryClient.invalidateQueries({ queryKey: ['instantdb'] });
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [queryClient]);

  /* -------------------- REAL-TIME FEED -------------------- */
  const { data, isLoading } = db.useQuery({
    feed: {},
  });

  const feedItems = useMemo(() => {
    const items = data?.feed || [];
    return items
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50);
  }, [data]);

  // Detect new items and animate them
  useEffect(() => {
    const previousIds = new Set(previousItemsRef.current.map(item => item.id));
    
    const newIds = feedItems
      .filter(item => !previousIds.has(item.id))
      .map(item => item.id);
    
    if (newIds.length > 0 && previousItemsRef.current.length > 0) { // Avoid animating on initial load
      setAnimatingItems(new Set(newIds));
      // Remove animation after it completes
      setTimeout(() => {
        setAnimatingItems(new Set());
      }, 500);
    }
    
    // Mark activity when we receive new feed items (real-time updates)
    if (newIds.length > 0) {
      markActivity();
    }
    
    previousItemsRef.current = feedItems;
  }, [feedItems]);

  /* -------------------- IMAGE CACHE (FOR MODAL) -------------------- */
  const { data: imagesData } = useQuery({
    queryKey: ["images", "feed-cache"],
    queryFn: async () => {
      const pages = await Promise.all([
        fetchImages(1),
        fetchImages(2),
        fetchImages(3),
      ]);
      return pages.flat();
    },
    staleTime: 5 * 60 * 1000,
  });

  const imagesMap = useMemo(() => {
    return new Map(
      (imagesData || []).map((img) => [String(img.id), img])
    );
  }, [imagesData]);

  /* -------------------- HANDLERS -------------------- */
  const handleFeedItemClick = (item) => {
    if (!item.imageId) return;

    const image = imagesMap.get(String(item.imageId));
    if (image) {
      setSelectedImage(image);
    }
  };

  const handleDeleteFeedItem = async (item) => {
    if (item.userId !== userId) return;

    const deletes = [db.tx.feed[item.id].delete()];

    if (item.type === "reaction" && item.reactionId) {
      deletes.push(db.tx.reactions[item.reactionId].delete());
    } else if (item.type === "comment" && item.commentId) {
      deletes.push(db.tx.comments[item.commentId].delete());
    }

    await db.transact(deletes);
  };

  const renderMessage = (item) => {
    if (item.type === "reaction") {
      return (
        <>
          reacted <span className="text-lg">{item.emoji}</span> to an image
        </>
      );
    }

    if (item.type === "comment") {
      return (
        <>
          commented
          <span className="ml-1 italic text-gray-600">
            “{item.text}”
          </span>
        </>
      );
    }

    return null;
  };

  /* -------------------- UI -------------------- */
  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* HEADER */}
      <div className="px-4 py-3 border-b bg-white sticky top-0 z-10">
        <h2 className="text-lg font-semibold">Live Feed</h2>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Real-time image activity
          </p>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500' :
              connectionStatus === 'connecting' ? 'bg-yellow-500' :
              'bg-red-500'
            }`}></div>
            <span className="text-xs text-gray-500">
              {connectionStatus === 'connected' ? 'Live' :
               connectionStatus === 'connecting' ? 'Connecting...' :
               'Offline'}
            </span>
            <button
              onClick={() => {
                console.log("Manual refresh triggered");
                queryClient.invalidateQueries({ queryKey: ['instantdb'] });
              }}
              className="text-xs bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600"
              title="Refresh feed manually"
            >
              ↻
            </button>
            {connectionStatus === 'disconnected' && (
              <button
                onClick={() => window.location.reload()}
                className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
              >
                Reload Page
              </button>
            )}
          </div>
        </div>
      </div>

      {/* FEED */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <p className="text-center text-gray-400">
            Loading activity…
          </p>
        ) : feedItems.length === 0 ? (
          <div className="text-center text-gray-400 mt-10">
            No activity yet 👀
          </div>
        ) : (
          feedItems.map((item) => (
            <div
              key={item.id}
              onClick={() => handleFeedItemClick(item)}
              className={`bg-white rounded-xl border p-3 flex gap-3 items-start shadow-sm hover:shadow-md transition cursor-pointer ${
                animatingItems.has(item.id) ? 'animate-fade-in' : ''
              }`}
            >
              {/* AVATAR */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
                style={{
                  backgroundColor: getUserColor(item.userId),
                }}
              >
                {item.username?.[0]?.toUpperCase() || "U"}
              </div>

              {/* CONTENT */}
              <div className="flex-1 text-sm text-gray-700">
                <span className="font-semibold">
                  {item.username || "Someone"}
                </span>{" "}
                {renderMessage(item)}

                <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                  <span>
                    {new Date(item.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>

                  {item.imageId && (
                    <span className="text-blue-500">
                      • View image
                    </span>
                  )}

                  {item.userId === userId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFeedItem(item);
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Feed;
