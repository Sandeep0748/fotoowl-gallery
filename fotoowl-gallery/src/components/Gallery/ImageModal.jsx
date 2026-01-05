import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { db, id } from "../../services/instantdb";
import { useUserStore } from "../../store/userStore";
import EmojiPicker from "../EmojiPicker/EmojiPicker";
import { getUserColor } from "../../utils/userColors";

const ImageModal = ({ image, onClose }) => {
  const { userId, username } = useUserStore();

  const [commentText, setCommentText] = useState("");
  const [optimisticComments, setOptimisticComments] = useState([]);
  const [reactionFeedback, setReactionFeedback] = useState(null);
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false);

  const reactionLock = useRef(false);
  const imageId = String(image.id);

  /* -------------------- QUERIES (NO FEED HERE) -------------------- */
  const { data, isLoading } = db.useQuery({
    reactions: {
      where: { imageId },
      $: { order: { createdAt: "desc" } },
    },
    comments: {
      where: { imageId },
      $: { order: { createdAt: "asc" } },
    },
  });

  const reactions = data?.reactions || [];
  const comments = data?.comments || [];

  /* -------------------- REACTION GROUPING -------------------- */
  const reactionGroups = useMemo(() => {
    const map = {};
    reactions.forEach((r) => {
      if (!map[r.emoji]) map[r.emoji] = [];
      map[r.emoji].push(r);
    });
    return map;
  }, [reactions]);

  /* -------------------- OPTIMISTIC COMMENTS -------------------- */
  const mergedComments = useMemo(() => {
    const filtered = optimisticComments.filter(
      (opt) =>
        !comments.some(
          (real) =>
            real.text === opt.text &&
            real.userId === opt.userId &&
            Math.abs(real.createdAt - opt.createdAt) < 4000
        )
    );
    return [...comments, ...filtered].sort(
      (a, b) => a.createdAt - b.createdAt
    );
  }, [comments, optimisticComments]);

  /* -------------------- ADD / REMOVE REACTION -------------------- */
  const addReaction = useCallback(
    async (emoji) => {
      if (reactionLock.current) return;
      reactionLock.current = true;

      const now = Date.now();

      try {
        const existing = reactions.find(
          (r) => r.userId === userId && r.emoji === emoji
        );

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
      } finally {
        reactionLock.current = false;
      }
    },
    [reactions, userId, username, imageId]
  );

  /* -------------------- ADD COMMENT -------------------- */
  const addComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || isCommentSubmitting) return;

    const text = commentText.trim();
    const now = Date.now();
    setCommentText("");
    setIsCommentSubmitting(true);

    setOptimisticComments((p) => [
      ...p,
      {
        id: `temp-${now}`,
        text,
        userId,
        username,
        createdAt: now,
        isOptimistic: true,
      },
    ]);

    try {
      const commentId = id();
      await db.transact([
        db.tx.comments[commentId].update({
          imageId,
          text,
          userId,
          username,
          createdAt: now,
        }),
        db.tx.feed[id()].update({
          type: "comment",
          action: "add",
          commentId,
          imageId,
          text,
          userId,
          username,
          createdAt: now,
        }),
      ]);
    } finally {
      setIsCommentSubmitting(false);
    }
  };

  /* -------------------- DELETE COMMENT -------------------- */
  const deleteComment = async (commentId) => {
    const now = Date.now();
    await db.transact([
      db.tx.comments[commentId].delete(),
      db.tx.feed[id()].update({
        type: "comment",
        action: "delete",
        commentId,
        imageId,
        userId,
        username,
        createdAt: now,
      }),
    ]);
  };

  /* -------------------- ESC -------------------- */
  useEffect(() => {
    const fn = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", fn);
      document.body.style.overflow = "auto";
    };
  }, [onClose]);

  /* -------------------- UI (same as yours) -------------------- */
  // 🔥 UI tumhara bilkul sahi hai, change nahi kiya
  // (No need to repeat, paste your existing JSX here)
};

export default ImageModal;
