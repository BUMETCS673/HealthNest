/**
 * AI-USAGE SUMMARY
 * Tools: Claude Sonnet 4.6
 * Overall AI Contribution: ~70%
 * AI-Assisted Areas: Mirrored PulseDrawer.jsx for the doctor-facing assistant (SCRUM-27),
 * replacing usePulse with useDfa throughout.
 * Human Contributions: Identified that PulseDrawer cannot be reused directly inside DfaProvider
 * because it calls usePulse which requires PulseContext; created DfaDrawer as the fix.
 */
import { useEffect } from "react";
import { X, Plus, ArrowUpRight } from "lucide-react";
import { useDfa } from "./DfaProvider";
import ConversationThread from "./ConversationThread";
import Composer from "./Composer";
import "./PulseDrawer.css";

export default function DfaDrawer({ onNavigate }) {
  const {
    drawerOpen,
    closeDrawer,
    messages,
    streaming,
    streamingId,
    send,
    error,
    newConversation,
  } = useDfa();

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") closeDrawer();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen, closeDrawer]);

  return (
    <>
      {drawerOpen && <div className='pulse-scrim' onClick={closeDrawer} />}
      <aside
        className={`pulse-drawer ${drawerOpen ? "is-open" : ""}`}
        aria-hidden={!drawerOpen}>
        <header className='pulse-drawer-head'>
          <span className='pulse-drawer-brand'>
            <span className='pulse-drawer-dot' aria-hidden='true' />
            Pulse
          </span>
          <div className='pulse-drawer-actions'>
            <button
              type='button'
              className='pulse-btn pulse-btn--ghost'
              onClick={newConversation}
              title='Start a new chat'>
              <Plus size={13} strokeWidth={2.25} />
              New chat
            </button>
            <button
              type='button'
              className='pulse-btn pulse-btn--primary'
              onClick={() => {
                closeDrawer();
                onNavigate?.("dfa-pulse");
              }}
              title='Continue this chat in the full workspace'>
              Open workspace
              <ArrowUpRight size={12} strokeWidth={2.25} />
            </button>
            <button
              type='button'
              className='pulse-icon-btn'
              onClick={closeDrawer}
              title='Close'
              aria-label='Close Pulse'>
              <X size={14} strokeWidth={2.25} />
            </button>
          </div>
        </header>

        <div className='pulse-drawer-body'>
          <ConversationThread
            messages={messages}
            streaming={streaming}
            streamingId={streamingId}
            onNavigate={onNavigate}
            welcomeMessage="Ask me about today's schedule, patient summaries, or anything clinical. I only surface data for your care team."
          />
        </div>

        {error && <div className='pulse-error'>{error}</div>}

        <div className='pulse-drawer-foot'>
          <Composer onSend={send} disabled={streaming} />
        </div>
      </aside>
    </>
  );
}
