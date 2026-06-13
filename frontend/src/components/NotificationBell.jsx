// AI-USAGE SUMMARY
// Tools: Claude Code (Opus 4.8)
// Overall AI Contribution: ~90%
// AI-Assisted Areas: The notification bell (#SCRUM-76) — fetches the aggregated
//   feed (new messages / appointments / labs), shows an unread badge, and opens
//   a dropdown of recent notifications. "Seen" state is tracked in localStorage
//   so the badge clears when the user opens the bell; clicking an item navigates
//   to the relevant page. Polls every 30s and closes on outside-click / Escape.
// Human Contributions: UX of the bell + which events surface; verification.
// Notes: Validated via `npm run build`, jest, and manual testing.
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, MessageSquare, Calendar, Activity } from "lucide-react";
import { notificationsApi } from "../lib/notificationsApi";
import { useMessages } from "../messages/MessagesProvider";
import "./NotificationBell.css";

const SEEN_KEY = "healthnest.notificationsSeenAt";
const POLL_MS = 30000;

const ICONS = {
  message: MessageSquare,
  appointment: Calendar,
  lab: Activity,
};

function readSeenAt() {
  const v = Number(localStorage.getItem(SEEN_KEY));
  return Number.isFinite(v) ? v : 0;
}

function relativeTime(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [seenAt, setSeenAt] = useState(readSeenAt);
  const wrapRef = useRef(null);
  // Monotonic nonce so repeat clicks on the same nav target still re-trigger the
  // destination view (e.g. opening labs twice while already on the dashboard).
  const navSeqRef = useRef(0);
  const { openThread, openDrawer } = useMessages();

  const load = useCallback(() => {
    notificationsApi
      .getNotifications()
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  // Close on outside-click / Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = items.filter(
    (n) => new Date(n.created_at).getTime() > seenAt,
  ).length;

  const toggle = () => {
    setOpen((wasOpen) => {
      const next = !wasOpen;
      if (next) {
        // Mark everything seen the moment the panel opens.
        const now = Date.now();
        localStorage.setItem(SEEN_KEY, String(now));
        setSeenAt(now);
      }
      return next;
    });
  };

  const onItem = (n) => {
    setOpen(false);
    if (n.contact_id) {
      // Open that conversation in the global messaging drawer.
      openThread?.(n.contact_id);
      openDrawer?.();
    } else if (n.nav) {
      // Let App route this (it can set pageData, e.g. the labs view).
      navSeqRef.current += 1;
      window.dispatchEvent(
        new CustomEvent("hn:navigate", {
          detail: { page: n.nav, data: { _nav: navSeqRef.current } },
        }),
      );
    }
  };

  return (
    <div className="nb-wrap" ref={wrapRef}>
      <button
        type="button"
        className="topnav-icon-btn"
        aria-label={unread > 0 ? `Notifications (${unread} new)` : "Notifications"}
        aria-expanded={open}
        onClick={toggle}
      >
        <Bell size={20} />
        {unread > 0 && <span className="nb-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="nb-panel">
          <div className="nb-panel-head">Notifications</div>
          {items.length === 0 ? (
            <p className="nb-empty">You're all caught up.</p>
          ) : (
            <ul className="nb-list">
              {items.map((n) => {
                const Icon = ICONS[n.type] || Bell;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      className="nb-item"
                      onClick={() => onItem(n)}
                    >
                      <span className={`nb-item-icon nb-item-icon--${n.type}`}>
                        <Icon size={15} />
                      </span>
                      <span className="nb-item-text">
                        <span className="nb-item-title">{n.title}</span>
                        {n.body && <span className="nb-item-body">{n.body}</span>}
                        <span className="nb-item-time">
                          {relativeTime(n.created_at)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
