import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { db, id } from "../../services/instantdb";
import { useUserStore } from "../../store/userStore";

const DEFAULT_EMOJIS = ["❤️", "🔥", "😂"];

const ImageCard = ({ image, onImageClick }) => {
  const { userId, username } = useUserStore();

  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const reactionLock = useRef(false);

  const imageId = String(image.id);

  // QUERY
  const { data, isLoading, error } = db.useQuery({
    reactions: {
      where: { imageId },
      $: { order: { createdAt: "desc" } },
    },
    feed: {},
  });

  useEffect(() => {
    if (error) console.error("Reaction load error:", error);
  }, [error]);

  const reactions = useMemo(() => data?.reactions || [], [data]);
  const feed = useMemo(() => data?.feed || [], [data]);

  // GROUP REACTIONS
  const reactionGroups = useMemo(() => {
    const groups = {};
    reactions.forEach((r) => {
      if (!groups[r.emoji]) groups[r.emoji] = [];
      groups[r.emoji].push(r);
    });
    return groups;
  }, [reactions]);

  // ADD / REMOVE REACTION
  const addReaction = useCallback(
    async (emoji) => {
      if (reactionLock.current) return;
      reactionLock.current = true;

      try {
        // Re-query current reactions to handle concurrent changes
        const currentReactions = reactions.filter(r => r.imageId === imageId);
        const existing = currentReactions.find(
          (r) => r.userId === userId && r.emoji === emoji
        );

        // REMOVE reaction
        if (existing) {
          const feedItem = feed.find(
            (f) => f.reactionId === existing.id
          );

          await db.transact([
            db.tx.reactions[existing.id].delete(),
            feedItem && db.tx.feed[feedItem.id].delete(),
          ]);

          return;
        }

        // ADD reaction
        const reactionId = id();
        const feedId = id();
        const now = Date.now();

        await db.transact([
          db.tx.reactions[reactionId].update({
            imageId,
            emoji,
            userId,
            username,
            createdAt: now,
          }),
          db.tx.feed[feedId].update({
            type: "reaction",
            reactionId,
            imageId,
            emoji,
            userId,
            username,
            createdAt: now,
          }),
        ]);
      } catch (err) {
        console.error("Reaction error:", err);
        // Could add user feedback here for failed operations
      } finally {
        reactionLock.current = false;
      }
    },
    [reactions, feed, userId, username, imageId]
  );

  // TOP EMOJIS
  const topEmojis = Object.entries(reactionGroups)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3);

  // UI
  return (
    <div className="group rounded-xl overflow-hidden bg-white border border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300">
      
      {/* IMAGE */}
      <div onClick={onImageClick} className="relative cursor-pointer">
        {imageLoading && (
          <div className="w-full h-56 bg-gray-200 animate-pulse flex items-center justify-center">
            <span className="text-gray-400 text-sm">Loading...</span>
          </div>
        )}

        {imageError && (
          <div className="w-full h-56 bg-gray-200 flex items-center justify-center">
            <span className="text-gray-400 text-sm">Failed to load</span>
          </div>
        )}

        <img
          src={image.urls.small}
          alt={image.alt_description || "Gallery image"}
          className={`w-full h-56 object-cover transition-transform duration-300 group-hover:scale-105 ${
            imageLoading || imageError ? "hidden" : ""
          }`}
          onLoad={() => setImageLoading(false)}
          onError={() => {
            setImageLoading(false);
            setImageError(true);
          }}
        />

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
          <span className="text-white text-sm opacity-0 group-hover:opacity-100">
            View Image
          </span>
        </div>
      </div>

      {/* REACTIONS */}
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {topEmojis.length > 0
            ? topEmojis.map(([emoji, list]) => {
                const reacted = list.some(
                  (r) => r.userId === userId
                );

                return (
                  <button
                    key={emoji}
                    disabled={isLoading}
                    onClick={(e) => {
                      e.stopPropagation();
                      addReaction(emoji);
                    }}
                    className={`flex items-center gap-1 px-2 py-1 rounded-full border text-sm transition
                      ${
                        reacted
                          ? "bg-blue-100 border-blue-400"
                          : "bg-gray-100 border-gray-300 hover:bg-gray-200"
                      }`}
                  >
                    <span className="text-lg">{emoji}</span>
                    <span className="text-xs font-medium">
                      {list.length}
                    </span>
                  </button>
                );
              })
            : DEFAULT_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={(e) => {
                    e.stopPropagation();
                    addReaction(emoji);
                  }}
                  className="px-2 py-1 bg-gray-100 rounded-full hover:bg-gray-200 text-lg"
                >
                  {emoji}
                </button>
              ))}
        </div>

        {reactions.length > 0 && (
          <span className="text-xs text-gray-500">
            {reactions.length}
          </span>
        )}
      </div>
    </div>
  );
};

export default ImageCard;
