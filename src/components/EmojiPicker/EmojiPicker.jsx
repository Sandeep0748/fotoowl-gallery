import { useState, useRef, useEffect, useCallback } from "react";

const EMOJI_LIST = [
  "❤️", "🔥", "😍", "😊", "👍", "👏",
  "🎉", "💯", "✨", "🌟", "😎", "🤩",
  "💪", "🙌", "😮", "😢", "😂", "🥰",
];

const EmojiPicker = ({ onEmojiSelect, className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef(null);

  // CLOSE HANDLERS
  const closePicker = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        closePicker();
      }
    };

    const handleEscape = (e) => {
      if (e.key === "Escape") {
        closePicker();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, closePicker]);

  // EMOJI CLICK
  const handleEmojiClick = (emoji) => {
    onEmojiSelect?.(emoji);
    closePicker();
  };

  // UI
  return (
    <div ref={pickerRef} className={`relative inline-block ${className}`}>
      {/* TOGGLE BUTTON */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="px-3 py-1.5 text-lg bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Open emoji picker"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        😀
      </button>

      {/* PICKER */}
      {isOpen && (
        <div
          className="absolute bottom-full left-0 mb-2 bg-white border rounded-lg shadow-lg p-2 z-50 w-64 animate-fadeIn"
          role="menu"
          aria-label="Emoji picker"
        >
          <div className="grid grid-cols-6 gap-1">
            {EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleEmojiClick(emoji)}
                className="text-2xl rounded p-1 hover:bg-gray-100 transition focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label={`Select ${emoji}`}
                role="menuitem"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmojiPicker;
