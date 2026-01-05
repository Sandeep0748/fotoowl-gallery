import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { db, id, markActivity, getConnectionStatus, subscribeToConnectionStatus, triggerGlobalRefresh } from "../../services/instantdb";
import { useUserStore } from "../../store/userStore";
import EmojiPicker from "../EmojiPicker/EmojiPicker";
import { getUserColor } from "../../utils/userColors";

const ImageModal = ({ image, onClose }) => {
  const { userId, username } = useUserStore();

  const [commentText, setCommentText] = useState("");
  const [optimisticComments, setOptimisticComments] = useState([]);
  const [reactionFeedback, setReactionFeedback] = useState(null);
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(getConnectionStatus());

  const reactionLock = useRef(false);
  const imageId = String(image.id);

  // Monitor connection status
  useEffect(() => {
    const unsubscribe = subscribeToConnectionStatus(setConnectionStatus);
    return unsubscribe;
  }, []);

  /* -------------------- QUERY -------------------- */
  const { data, isLoading } = db.useQuery({
    reactions: {
      where: { imageId },
      $: { order: { createdAt: "desc" } },
    },
    comments: {
      where: { imageId },
      $: { order: { createdAt: "asc" } },
    },
    feed: {},
  }, {
    // Aggressive polling when disconnected to ensure updates are seen
    refetchInterval: connectionStatus === 'connected' ? 15000 : 3000,
  });

  const reactions = useMemo(() => data?.reactions || [], [data]);
  const comments = useMemo(() => data?.comments || [], [data]);
  const feed = useMemo(() => data?.feed || [], [data]);

  // Mark activity when real-time data updates
  useEffect(() => {
    if (reactions.length > 0 || comments.length > 0) {
      markActivity();
    }
  }, [reactions.length, comments.length]);

  /* -------------------- REACTION GROUPING -------------------- */
  const reactionGroups = useMemo(() => {
    const map = {};
    reactions.forEach((r) => {
      if (!map[r.emoji]) map[r.emoji] = [];
      map[r.emoji].push(r);
    });
    return map;
  }, [reactions]);

  /* -------------------- OPTIMISTIC COMMENTS MERGE -------------------- */
  const mergedComments = useMemo(() => {
    const filteredOptimistic = optimisticComments.filter(
      (opt) =>
        !comments.some(
          (real) =>
            real.text === opt.text &&
            real.userId === opt.userId &&
            Math.abs(real.createdAt - opt.createdAt) < 4000
        )
    );
    return [...comments, ...filteredOptimistic].sort(
      (a, b) => a.createdAt - b.createdAt
    );
  }, [comments, optimisticComments]);

  // Clean up optimistic comments that have been synced
  useEffect(() => {
    const cleanup = setInterval(() => {
      setOptimisticComments((prev) =>
        prev.filter((opt) => {
          const hasRealComment = comments.some(
            (real) =>
              real.text === opt.text &&
              real.userId === opt.userId &&
              Math.abs(real.createdAt - opt.createdAt) < 4000
          );
          // Keep optimistic comment for at least 2 seconds, or until real comment arrives
          return Date.now() - opt.createdAt < 2000 || !hasRealComment;
        })
      );
    }, 500);

    return () => clearInterval(cleanup);
  }, [comments]);

  /* -------------------- ADD / REMOVE REACTION -------------------- */
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

        if (existing) {
          const feedItem = feed.find(
            (f) => f.reactionId === existing.id
          );

          await db.transact([
            db.tx.reactions[existing.id].delete(),
            feedItem && db.tx.feed[feedItem.id].delete(),
          ]);

          setReactionFeedback({ emoji, action: "removed" });
          // Trigger global refresh to update feed immediately
          triggerGlobalRefresh();
          return;
        }

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

        setReactionFeedback({ emoji, action: "added" });
        // Trigger global refresh to update feed immediately
        triggerGlobalRefresh();
      } catch (err) {
        console.error("Reaction error:", err);
        setReactionFeedback({ emoji, action: "error" });
      } finally {
        setTimeout(() => setReactionFeedback(null), 1500);
        reactionLock.current = false;
      }
    },
    [reactions, feed, imageId, userId, username]
  );

  /* -------------------- ADD COMMENT -------------------- */
  const addComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || isCommentSubmitting) return;

    const text = commentText.trim();
    const now = Date.now();
    const tempId = `temp-${now}`;

    setOptimisticComments((p) => [
      ...p,
      {
        id: tempId,
        imageId,
        text,
        userId,
        username,
        createdAt: now,
        isOptimistic: true,
      },
    ]);

    setCommentText("");
    setIsCommentSubmitting(true);

    try {
      const commentId = id();
      const feedId = id();
      await db.transact([
        db.tx.comments[commentId].update({
          imageId,
          text,
          userId,
          username,
          createdAt: now,
        }),
        db.tx.feed[feedId].update({
          type: "comment",
          commentId,
          imageId,
          text,
          userId,
          username,
          createdAt: now,
        }),
      ]);
      // Trigger global refresh to update feed immediately
      triggerGlobalRefresh();
    } finally {
      setIsCommentSubmitting(false);
    }
  };

  /* -------------------- DELETE COMMENT -------------------- */
  const deleteComment = async (commentId) => {
    // Find the corresponding feed item
    const feedItem = feed.find((f) => f.commentId === commentId);

    // Delete both comment and feed item in a transaction
    const deletes = [db.tx.comments[commentId].delete()];
    if (feedItem) {
      deletes.push(db.tx.feed[feedItem.id].delete());
    }

    await db.transact(deletes);
    // Trigger global refresh to update feed immediately
    triggerGlobalRefresh();
  };

  /* -------------------- ESC KEY -------------------- */
  useEffect(() => {
    const fn = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", fn);
      document.body.style.overflow = "auto";
    };
  }, [onClose]);

  /* -------------------- UI -------------------- */
  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b flex justify-between items-center">
          <div>
            <h2 className="font-semibold text-lg">Image Details</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' :
                connectionStatus === 'connecting' ? 'bg-yellow-500' :
                'bg-red-500'
              }`}></div>
              <span className="text-xs text-gray-500">
                {connectionStatus === 'connected' ? 'Real-time active' :
                 connectionStatus === 'connecting' ? 'Connecting...' :
                 'Offline mode'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-xl">×</button>
        </div>

        <div className="grid md:grid-cols-2 gap-4 p-4 overflow-y-auto">
          {/* IMAGE + REACTIONS */}
          <div className="space-y-4">
            <img
              src={image.urls.regular || image.urls.small}
              alt=""
              className="rounded-lg"
            />

            <div>
              <h3 className="font-semibold mb-2">Reactions</h3>
              <div className="flex flex-wrap gap-2 mb-2">
                {Object.entries(reactionGroups).map(([emoji, list]) => {
                  const mine = list.find((r) => r.userId === userId);
                  return (
                    <div
                      key={emoji}
                      className="flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full animate-pop"
                    >
                      <span
                        className="text-lg"
                        style={{ color: mine && getUserColor(userId) }}
                      >
                        {emoji}
                      </span>
                      <span className="text-sm">{list.length}</span>
                      {mine && (
                        <button
                          onClick={() => addReaction(emoji)}
                          className="text-xs text-red-500 ml-1"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <EmojiPicker onEmojiSelect={addReaction} />

              {reactionFeedback && (
                <p className={`text-sm mt-1 ${
                  reactionFeedback.action === "error" 
                    ? "text-red-600" 
                    : "text-green-600"
                }`}>
                  {reactionFeedback.action === "added"
                    ? `Added ${reactionFeedback.emoji}`
                    : reactionFeedback.action === "removed"
                    ? `Removed ${reactionFeedback.emoji}`
                    : "Failed to update reaction"}
                </p>
              )}
            </div>
          </div>

          {/* COMMENTS */}
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold">
                Comments ({mergedComments.length})
              </h3>
              {connectionStatus === 'disconnected' && (
                <p className="text-xs text-orange-600 mt-1">
                  ⚠️ Offline mode - changes may not sync in real-time
                </p>
              )}
            </div>

            <form onSubmit={addComment}>
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows="3"
                className="w-full border rounded p-2"
                placeholder="Add a comment…"
              />
              <button
                disabled={isCommentSubmitting}
                className="mt-2 bg-blue-500 text-white px-4 py-1 rounded"
              >
                {isCommentSubmitting ? "Posting..." : "Post"}
              </button>
            </form>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {isLoading && <p className="text-sm text-gray-400">Loading…</p>}

              {mergedComments.map((c) => (
                <div
                  key={c.id}
                  className={`p-3 rounded bg-gray-50 ${
                    c.isOptimistic && "opacity-70 animate-pulse"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold">
                      {c.username}
                    </span>
                    {c.userId === userId && !c.isOptimistic && (
                      <button
                        onClick={() => deleteComment(c.id)}
                        className="text-xs text-red-500"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <p className="text-sm">{c.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageModal;
