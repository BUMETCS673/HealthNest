/**
 * AI-USAGE SUMMARY
 * Tools: Opus 4.7
 * Overall AI Contribution: ~60%
 * AI-Assisted Areas: Drafted the slide-in drawer shell, the scrim overlay, and the Escape-key dismiss.
 * Human Contributions: Decided the drawer mounts unconditionally and animates via the `is-open` class so React state changes never have to remount the conversation tree — protects scroll position and streaming continuity when the user closes + reopens mid-stream.
 */
import { useEffect } from "react";
import { X, ArrowUpRight, Plus, MessageCircleQuestion } from "lucide-react";
import { usePulse } from "./PulseProvider";
import ConversationThread from "./ConversationThread";
import Composer from "./Composer";
import "./PulseDrawer.css";

export default function PulseDrawer({
  onOpenWorkspace,
  onNavigate,
  hideLauncher = false,
}) {
  const {
    drawerOpen,
    openDrawer,
    closeDrawer,
    messages,
    streaming,
    streamingId,
    send,
    error,
    newConversation,
  } = usePulse();

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
      {/* Floating launcher (bottom-right), shown on every patient page.
          Hidden in the full Pulse workspace and while the drawer is open. */}
      {!hideLauncher && !drawerOpen && (
        <button
          type="button"
          className="pulse-fab"
          onClick={openDrawer}
          aria-label="Open Pulse AI"
          title="Pulse AI"
        >
          <MessageCircleQuestion size={25} />
        </button>
      )}

      {/* No scrim: the page (and the messages drawer on the other side)
          stays interactive while Pulse is open. */}
      <aside
        className={`pulse-drawer ${drawerOpen ? "is-open" : ""}`}
        aria-hidden={!drawerOpen}
      >
        <header className="pulse-drawer-head">
          <span className="pulse-drawer-brand">
            <span className="pulse-drawer-dot" aria-hidden="true" />
            Pulse
          </span>
          <div className="pulse-drawer-actions">
            <button
              type="button"
              className="pulse-btn pulse-btn--ghost"
              onClick={newConversation}
              title="Start a new chat"
            >
              <Plus size={13} strokeWidth={2.25} />
              New chat
            </button>
            <button
              type="button"
              className="pulse-btn pulse-btn--primary"
              onClick={() => {
                closeDrawer();
                onOpenWorkspace?.();
              }}
              title="Continue this chat in the full workspace"
            >
              Open workspace
              <ArrowUpRight size={12} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              className="pulse-icon-btn"
              onClick={closeDrawer}
              title="Close"
              aria-label="Close Pulse"
            >
              <X size={14} strokeWidth={2.25} />
            </button>
          </div>
        </header>

        <div className="pulse-drawer-body">
          <ConversationThread
            messages={messages}
            streaming={streaming}
            streamingId={streamingId}
            onNavigate={onNavigate}
          />
        </div>

        {error && <div className="pulse-error">{error}</div>}

        <div className="pulse-drawer-foot">
          <Composer onSend={send} disabled={streaming} />
        </div>
      </aside>
    </>
  );
}
