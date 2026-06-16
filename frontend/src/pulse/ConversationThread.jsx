/**
 * AI-USAGE SUMMARY
 * Tools: Opus 4.7
 * Overall AI Contribution: ~60%
 * AI-Assisted Areas: Drafted the auto-scroll-on-new-message effect, the streaming-aware scroll heuristic, and the empty-state placeholder.
 * Human Contributions: Designed the "follow the bottom only if the user is already near it" rule — once the user scrolls up to read history, streaming tokens stop yanking the viewport back. New-message arrivals still smooth-scroll into view; mid-stream deltas use instant scroll so the page doesn't fight rapid token updates.
 */
import { useEffect, useLayoutEffect, useRef } from "react";
import { Activity } from "lucide-react";
import MessageBubble from "./MessageBubble";

const STICK_THRESHOLD = 120;

function findScroller(node) {
  let p = node?.parentElement;
  while (p) {
    const oy = getComputedStyle(p).overflowY;
    if (oy === "auto" || oy === "scroll") return p;
    p = p.parentElement;
  }
  return null;
}

export default function ConversationThread({
  messages,
  streaming,
  streamingId,
  onNavigate,
  welcomeMessage,
}) {
  const endRef = useRef(null);
  const scrollerRef = useRef(null);
  const countRef = useRef(0);
  const lastContentLenRef = useRef(0);
  const userScrolledUpRef = useRef(false);

  useEffect(() => {
    scrollerRef.current = findScroller(endRef.current);
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return undefined;
    const onScroll = () => {
      const dist =
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
      userScrolledUpRef.current = dist > STICK_THRESHOLD;
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const count = messages.length;
    const last = messages[count - 1];
    const lastLen = last?.content?.length ?? 0;
    const newMessage = count !== countRef.current;
    const newContent = !newMessage && lastLen !== lastContentLenRef.current;

    if (newMessage) {
      userScrolledUpRef.current = false;
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
    } else if (newContent && !userScrolledUpRef.current) {
      scroller.scrollTop = scroller.scrollHeight;
    }

    countRef.current = count;
    lastContentLenRef.current = lastLen;
  }, [messages]);

  if (!messages?.length) {
    return (
      <div className='pulse-thread pulse-thread--empty'>
        <div className='pulse-empty-card'>
          <div className='pulse-empty-icon'>
            <Activity size={22} strokeWidth={2.25} />
          </div>
          <p className='pulse-empty-title'>Hi, I'm Pulse.</p>
          <p className='pulse-empty-sub'>
            {welcomeMessage ?? (
              <>
                Ask me about your upcoming appointments, lab results, or
                anything on your care plan. I only see <em>your</em> records.
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='pulse-thread'>
      {messages.map((m) => (
        <MessageBubble
          key={m.id}
          message={m}
          isStreaming={streaming && m.id === streamingId}
          onNavigate={onNavigate}
        />
      ))}
      <div ref={endRef} />
    </div>
  );
}
