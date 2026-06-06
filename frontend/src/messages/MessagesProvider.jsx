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
  send: async () => {},
  loadContacts: () => {},
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

  useEffect(() => {
    if (session?.access_token) loadContacts();
  }, [session?.access_token, loadContacts]);

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
        send,
        loadContacts,
      }}
    >
      {children}
    </MessagesContext.Provider>
  );
}
