/**
 * AI-USAGE SUMMARY
 * Tools: Opus 4.7
 * Overall AI Contribution: ~55%
 * AI-Assisted Areas: Drafted the auto-grow textarea logic and the ⌘↩ / Ctrl↩ send shortcut.
 * Human Contributions: Removed the suggested-prompt chips in favor of a clean composer-only surface so the experience reads enterprise instead of consumer-chatbot; capped the textarea at 6 rows and only enables the scrollbar once content actually exceeds the cap so empty input never shows a stray scrollbar.
 */
import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

const MAX_HEIGHT = 144;

export default function Composer({ onSend, disabled }) {
  const [value, setValue] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, MAX_HEIGHT);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    setValue("");
    onSend(text);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="pulse-composer">
      <div className="pulse-composer-row">
        <textarea
          ref={ref}
          className="pulse-composer-input"
          placeholder="Message Pulse"
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
        />
        <button
          type="button"
          className="pulse-composer-send"
          onClick={submit}
          disabled={disabled || !value.trim()}
          aria-label="Send message"
        >
          <ArrowUp size={15} strokeWidth={2.5} />
        </button>
      </div>
      <p className="pulse-composer-hint">
        Scoped to your records. Press Enter to send, Shift+Enter for a new line.
      </p>
    </div>
  );
}
