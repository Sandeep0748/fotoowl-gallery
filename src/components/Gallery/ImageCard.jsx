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

  /* -------------------- REACTIONS QUERY ONLY -------------------- */
  const { data, isLoading, error } = db.useQuery({
    reactions: {
      where: { imageId },
      $: { order: { createdAt: "desc" } },
    },
  });

  useEffect(() => {
    if (error) console.error("Reaction load error:", error);
  }, [error]);

  const reactions = data?.reactions || [];

  /* -------------------- GROUP REACTIONS -------------------- */
  const reactionGroups = useMemo(() => {
    const groups = {};
    reactions.forEach((r) => {
      if (!groups[r.emoji]) groups[r.emoji] = [];
      groups[r.emoji].push(r);
    });
    return groups;
  }, [reactions]);

  /* -------------------- ADD / REMOVE REACTION -------------------- */
  const addReaction = useCallback(
    async (emoji) => {
      if (reactionLock.current) return;
      reactionLock.current = true;

      try {
        const existing = reactions.find(
          (r) => r.userId === userId && r.emoji === emoji
        );

        const now = Date.now();

        // REMOVE
        if (existing) {
          await db.transact([
            db.tx.reactions[existing.id].delete(),
            db.tx.feed[id()].update({
              type: "reaction",
              action: "delete",
              reactionId: existing.id,
              imageId,
              emoji,
              userId,
              username,
              createdAt: now,
            }),
          ]);
          return;
        }

        // ADD
        const reactionId = id();

        await db.transact([
          db.tx.reactions[reactionId].update({
            imageId,
            emoji,
            userId,
            username,
            createdAt: now,
          }),
          db.tx.feed[id()].update({
            type: "reaction",
            action: "add",
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
      } finally {
        reactionLock.current = false;
      }
    },
    [reactions, userId, username, imageId]
  );

  /* -------------------- TOP EMOJIS -------------------- */
  const topEmojis = Object.entries(reactionGroups)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3);

  /* -------------------- UI -------------------- */
  return (
    <div className="group rounded-xl overflow-hidden bg-white border shadow-sm hover:shadow-xl transition">
      {/* IMAGE */}
      <div onClick={onImageClick} className="relative cursor-pointer">
        {imageLoading && (
          <div className="w-full h-56 bg-gray-200 animate-pulse flex items-center justify-center">
            Loading…
          </div>
        )}

        {imageError && (
          <div className="w-full h-56 bg-gray-200 flex items-center justify-center">
            Failed to load
          </div>
        )}

        <img
          src={image.urls.small}
          alt={image.alt_description || "Gallery image"}
          className={`w-full h-56 object-cover transition ${
            imageLoading || imageError ? "hidden" : ""
          }`}
          onLoad={() => setImageLoading(false)}
          onError={() => {
            setImageLoading(false);
            setImageError(true);
          }}
        />
      </div>

      {/* REACTIONS */}
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {(topEmojis.length ? topEmojis : DEFAULT_EMOJIS.map(e => [e, []]))
            .map(([emoji, list]) => {
              const reacted = list.some(r => r.userId === userId);

              return (
                <button
                  key={emoji}
                  disabled={isLoading}
                  onClick={(e) => {
                    e.stopPropagation();
                    addReaction(emoji);
                  }}
                  className={`px-2 py-1 rounded-full border text-sm ${
                    reacted
                      ? "bg-blue-100 border-blue-400"
                      : "bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  <span className="text-lg">{emoji}</span>
                  {list.length > 0 && (
                    <span className="ml-1 text-xs">{list.length}</span>
                  )}
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
};

export default ImageCard;
