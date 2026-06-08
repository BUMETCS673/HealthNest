import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { getSupabaseClient, setRealtimeAuth } from "../lib/supabaseClient";
import { authApi } from "../lib/authApi";
import { messagesApi } from "../lib/messagesApi";

const MessagesContext = createContext(null);

const DEFAULT_MESSAGES = {
  contacts: [],
  activeContactId: null,
  thread: [],
  unreadCount: 0,
  unreadByContact: {},
  openThread: () => {},
  closeThread: () => {},
  send: async () => {},
  loadContacts: () => {},
  drawerOpen: false,
  openDrawer: () => {},
  closeDrawer: () => {},
};

// Falls back to a safe no-op shape when there's no provider (a component
// rendered outside MessagesProvider, or a unit test), so nav badges still work.
export const useMessages = () =>
  useContext(MessagesContext) ?? DEFAULT_MESSAGES;

export default function MessagesProvider({ session, children }) {
  const [contacts, setContacts] = useState([]);
  const [activeContactId, setActiveContactId] = useState(null);
  const [thread, setThread] = useState([]);
  const [unreadByContact, setUnreadByContact] = useState({});
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Keep a ref of the open contact so the subscription callback reads the
  // current value without needing to resubscribe every time it changes.
  const activeContactIdRef = useRef(null);
  useEffect(() => {
    activeContactIdRef.current = activeContactId;
  }, [activeContactId]);

  const unreadCount = Object.values(unreadByContact).reduce((a, b) => a + b, 0);

  // Load the care-team contacts once we have a session.
  const loadContacts = useCallback(async () => {
    try {
      setContacts(await messagesApi.getContacts());
    } catch {
      setContacts([]);
    }
  }, []);

  // Pull authoritative unread counts from the server. Seeds the badge on load
  // and reconciles any Realtime events that were missed or arrived early.
  const refreshUnread = useCallback(async () => {
    try {
      const counts = (await messagesApi.getUnreadCounts()) || {};
      const active = activeContactIdRef.current;
      if (active) counts[active] = 0; // the open conversation is always read
      setUnreadByContact(counts);
    } catch {
      /* keep current counts on failure */
    }
  }, []);

  useEffect(() => {
    if (!session?.access_token) return undefined;

    queueMicrotask(() => {
      void loadContacts();
    });

    queueMicrotask(() => {
      void refreshUnread();
    });

    // Reconcile on tab focus and on a short interval, so the badge stays correct
    // even if a Realtime event is dropped or fires before the socket connects.
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshUnread();
    };
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(refreshUnread, 15000);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, [session?.access_token, loadContacts, refreshUnread]);

  // Effect A — Realtime subscription (sets the initial token, then subscribes).
  useEffect(() => {
    const myId = session?.user?.id;
    if (!session?.access_token || !myId) return undefined;

    let channel = null;
    let client = null;
    let cancelled = false;

    (async () => {
      client = await getSupabaseClient();
      if (cancelled) return;
      client.realtime.setAuth(session.access_token);

      channel = client
        .channel("messages-inbound")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `recipient_id=eq.${myId}`,
          },
          (payload) => {
            const msg = payload.new;
            if (activeContactIdRef.current === msg.sender_id) {
              setThread((prev) => [...prev, msg]); // relay
              messagesApi.markThreadRead(msg.sender_id);
            } else {
              setUnreadByContact((prev) => ({
                ...prev,
                [msg.sender_id]: (prev[msg.sender_id] || 0) + 1,
              })); // notify
            }
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel && client) client.removeChannel(channel);
    };
  }, [session?.access_token, session?.user?.id]);

  // Effect B — keep the socket's token fresh on refresh / sign-out.
  useEffect(() => {
    const unsub = authApi.onAuthStateChange((s) => {
      setRealtimeAuth(s?.access_token ?? null);
    });
    return unsub;
  }, []);

  // Open a conversation: load history, clear its unread, mark read.
  const openThread = useCallback(async (contactId) => {
    setActiveContactId(contactId);
    setUnreadByContact((prev) => ({ ...prev, [contactId]: 0 }));
    try {
      setThread(await messagesApi.getThread(contactId));
      await messagesApi.markThreadRead(contactId);
    } catch {
      setThread([]);
    }
  }, []);

  // Leave the conversation view (e.g. navigating away from Messages). Clearing
  // the active contact means incoming messages bump the unread badge instead of
  // being silently relayed + marked read while nothing is on screen.
  const closeThread = useCallback(() => {
    setActiveContactId(null);
    setThread([]);
  }, []);

  // Send to the open contact and optimistically append to my own view.
  const send = useCallback(async (body) => {
    const contactId = activeContactIdRef.current;
    const text = (body || "").trim();
    if (!contactId || !text) return;
    const sent = await messagesApi.sendMessage(contactId, text);
    setThread((prev) => [...prev, sent]);
  }, []);

  return (
    <MessagesContext.Provider
      value={{
        contacts,
        activeContactId,
        thread,
        unreadCount,
        unreadByContact,
        openThread,
        closeThread,
        send,
        loadContacts,
        drawerOpen,
        openDrawer,
        closeDrawer,
      }}
    >
      {children}
    </MessagesContext.Provider>
  );
}
