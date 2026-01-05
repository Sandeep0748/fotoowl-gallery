import { db } from "../../services/instantdb";
import { getUserColor } from "../../utils/userColors";
import { fetchImages } from "../../services/unsplash";
import { useUserStore } from "../../store/userStore";
import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

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
  });

  const feedItems = data?.feed || [];

  /* -------------------- NEW ITEM ANIMATION -------------------- */
  useEffect(() => {
    if (!previousItemsRef.current.length) {
      previousItemsRef.current = feedItems;
      return;
    }

    const previousIds = new Set(
      previousItemsRef.current.map((item) => item.id)
    );

    const newIds = feedItems
      .filter((item) => !previousIds.has(item.id))
      .map((item) => item.id);

    if (newIds.length) {
      setAnimatingItems(new Set(newIds));
      setTimeout(() => setAnimatingItems(new Set()), 500);
    }

    previousItemsRef.current = feedItems;
  }, [feedItems]);

  /* -------------------- IMAGE CACHE -------------------- */
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

  const imagesMap = useMemo(
    () => new Map((imagesData || []).map((img) => [String(img.id), img])),
    [imagesData]
  );

  /* -------------------- HANDLERS -------------------- */
  const handleFeedItemClick = (item) => {
    if (!item.imageId) return;
    const image = imagesMap.get(String(item.imageId));
    if (image) setSelectedImage(image);
  };

  const handleDeleteFeedItem = async (item) => {
    if (item.userId !== userId) return;
    await db.transact([db.tx.feed[item.id].delete()]);
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
          commented{" "}
          <span className="italic text-gray-600">“{item.text}”</span>
        </>
      );
    }
    return null;
  };

  /* -------------------- UI -------------------- */
  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="px-4 py-3 border-b bg-white sticky top-0 z-10">
        <h2 className="text-lg font-semibold">Live Feed</h2>
        <p className="text-xs text-gray-500">Real-time image activity</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <p className="text-center text-gray-400">Loading activity…</p>
        ) : feedItems.length === 0 ? (
          <p className="text-center text-gray-400 mt-10">
            No activity yet 👀
          </p>
        ) : (
          feedItems.map((item) => (
            <div
              key={item.id}
              onClick={() => handleFeedItemClick(item)}
              className={`bg-white rounded-xl border p-3 flex gap-3 cursor-pointer transition ${
                animatingItems.has(item.id) ? "animate-fade-in" : ""
              }`}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold"
                style={{ backgroundColor: getUserColor(item.userId) }}
              >
                {item.username?.[0]?.toUpperCase() || "U"}
              </div>

              <div className="flex-1 text-sm text-gray-700">
                <span className="font-semibold">
                  {item.username || "Someone"}
                </span>{" "}
                {renderMessage(item)}

                <div className="text-xs text-gray-400 mt-1 flex gap-2">
                  <span>
                    {new Date(item.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>

                  {item.userId === userId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFeedItem(item);
                      }}
                      className="text-red-500"
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
