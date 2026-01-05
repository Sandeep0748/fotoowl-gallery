import { useQuery } from "@tanstack/react-query";
import { db } from "../../services/instantdb";
import { getUserColor } from "../../utils/userColors";
import { fetchImages } from "../../services/unsplash";
import { useUserStore } from "../../store/userStore";
import { useMemo, useState, useEffect, useRef } from "react";

const Feed = () => {
  const { setSelectedImage, userId } = useUserStore();
  const [animatingItems, setAnimatingItems] = useState(new Set());
  const previousItemsRef = useRef([]);

  /* -------------------- REAL-TIME FEED -------------------- */
  const { data, isLoading } = db.useQuery({
    feed: {
      $: {
        order: { createdAt: "desc" },
        limit: 50,
      },
    },
  }, {
    refetchInterval: 5000, // Poll every 5 seconds as fallback for real-time issues
  });

  const feedItems = useMemo(() => data?.feed || [], [data]);

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
        <p className="text-xs text-gray-500">
          Real-time image activity
        </p>
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
