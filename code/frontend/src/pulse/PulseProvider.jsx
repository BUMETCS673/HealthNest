/**
 * AI-USAGE SUMMARY
 * Tools: Opus 4.7
 * Overall AI Contribution: ~65%
 * AI-Assisted Areas: Drafted the context shape (open/close drawer, active conversation id, send + stream callbacks) so drawer and workspace share one source of truth.
 * Human Contributions: Designed the optimistic-message lifecycle (user turn is appended immediately, assistant turn is appended with empty content then mutated by streaming deltas) so the drawer feels instant; the same store powers both drawer and full workspace so 'Open workspace' is a free promotion.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { pulseApi } from "../lib/pulseApi";

const PulseContext = createContext(null);

export function usePulse() {
  const ctx = useContext(PulseContext);
  if (!ctx) throw new Error("usePulse must be used inside <PulseProvider>");
  return ctx;
}

function makeOptimisticMessage(role, extra = {}) {
  return {
    id: `local-${Math.random().toString(36).slice(2)}`,
    role,
    content: "",
    skill_outputs: null,
    citations: null,
    created_at: new Date().toISOString(),
    ...extra,
  };
}

export default function PulseProvider({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingId, setStreamingId] = useState(null);
  const [error, setError] = useState(null);
  const streamControllerRef = useRef(null);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const refreshConversations = useCallback(async () => {
    try {
      const rows = await pulseApi.listConversations();
      setConversations(rows || []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const loadConversation = useCallback(async (id) => {
    if (!id) return;
    try {
      const detail = await pulseApi.getConversation(id);
      setActiveId(detail.id);
      setMessages(detail.messages || []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const ensureConversation = useCallback(async () => {
    if (activeId) return activeId;
    const created = await pulseApi.createConversation({});
    setActiveId(created.id);
    setConversations((prev) => [created, ...prev]);
    return created.id;
  }, [activeId]);

  const newConversation = useCallback(async () => {
    const created = await pulseApi.createConversation({});
    setActiveId(created.id);
    setMessages([]);
    setConversations((prev) => [created, ...prev]);
    return created.id;
  }, []);

  const send = useCallback(
    async (text) => {
      const trimmed = (text || "").trim();
      if (!trimmed || streaming) return;
      setError(null);
      setStreaming(true);

      const convId = await ensureConversation();
      const userMsg = makeOptimisticMessage("user", { content: trimmed });
      const assistantMsg = makeOptimisticMessage("assistant");
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setStreamingId(assistantMsg.id);

      const controller = new AbortController();
      streamControllerRef.current = controller;

      await pulseApi.streamMessage(convId, trimmed, {
        signal: controller.signal,
        onDelta: (text) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: (m.content || "") + text }
                : m
            )
          );
        },
        onSkillOutput: (sk) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? {
                    ...m,
                    skill_outputs: [...(m.skill_outputs || []), sk],
                  }
                : m
            )
          );
        },
        onCitation: (cite) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, citations: [...(m.citations || []), cite] }
                : m
            )
          );
        },
        onDone: () => {
          setStreaming(false);
          setStreamingId(null);
          streamControllerRef.current = null;
          refreshConversations();
        },
        onError: (err) => {
          setError(err.message);
          setStreaming(false);
          setStreamingId(null);
          streamControllerRef.current = null;
        },
      });
    },
    [ensureConversation, refreshConversations, streaming]
  );

  useEffect(() => {
    let alive = true;
    pulseApi
      .listConversations()
      .then((rows) => {
        if (alive) setConversations(rows || []);
      })
      .catch((err) => {
        if (alive) setError(err.message);
      });
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      drawerOpen,
      openDrawer,
      closeDrawer,
      conversations,
      activeId,
      messages,
      streaming,
      streamingId,
      error,
      send,
      loadConversation,
      newConversation,
      refreshConversations,
    }),
    [
      drawerOpen,
      openDrawer,
      closeDrawer,
      conversations,
      activeId,
      messages,
      streaming,
      streamingId,
      error,
      send,
      loadConversation,
      newConversation,
      refreshConversations,
    ]
  );

  return (
    <PulseContext.Provider value={value}>{children}</PulseContext.Provider>
  );
}
