/**
 * AI-USAGE SUMMARY
 * Tools: Opus 4.7
 * Overall AI Contribution: ~60%
 * AI-Assisted Areas: Drafted the role-based rendering split (bubble for the user turn, plain prose for the assistant turn), markdown rendering via react-markdown for the assistant side, and the blinking caret implemented as a CSS pseudo-element pinned to the last block of the prose during streaming.
 * Human Contributions: Chose to leave user turns as plain text (they shouldn't have markdown re-interpreted) and to wire the caret via CSS rather than React injection so streaming partial markdown (e.g. an unclosed "**") doesn't fight a manually-positioned caret element. Memoization preserved so only the actively-streaming turn re-renders per token.
 */
import { memo } from "react";
import ReactMarkdown from "react-markdown";
import { Activity, User as UserIcon } from "lucide-react";
import SkillResponseCard from "./SkillResponseCard";
import CitationChips from "./CitationChips";

function Paragraphs({ text }) {
  if (!text) return null;
  return text.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>);
}

function TypingDots() {
  return (
    <span className="pulse-typing-inline" aria-label="Pulse is thinking">
      <span /> <span /> <span />
    </span>
  );
}

const MD_COMPONENTS = {
  a: ({ href, children, ...rest }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  ),
};

function MessageBubbleImpl({ message, isStreaming, onNavigate }) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  const hasContent = !!message.content;

  return (
    <div className={`pulse-msg pulse-msg--${message.role}`}>
      <div className="pulse-msg-avatar">
        {isUser ? <UserIcon size={14} /> : <Activity size={14} strokeWidth={2.25} />}
      </div>
      <div className="pulse-msg-body">
        {/* User turn: plain text in a slate bubble (no markdown — user
            input shouldn't get re-interpreted). */}
        {isUser && hasContent && (
          <div className="pulse-msg-text">
            <Paragraphs text={message.content} />
          </div>
        )}

        {isAssistant && message.skill_outputs?.map((sk, i) => (
          <SkillResponseCard key={i} skillOutput={sk} onNavigate={onNavigate} />
        ))}

        {isAssistant && (
          <div
            className={`pulse-msg-prose ${isStreaming ? "pulse-msg-prose--streaming" : ""}`}
          >
            {hasContent ? (
              <ReactMarkdown components={MD_COMPONENTS}>
                {message.content}
              </ReactMarkdown>
            ) : (
              <TypingDots />
            )}
          </div>
        )}

        {message.citations?.length > 0 && (
          <CitationChips citations={message.citations} />
        )}
      </div>
    </div>
  );
}

const MessageBubble = memo(MessageBubbleImpl, (prev, next) => {
  if (prev.isStreaming !== next.isStreaming) return false;
  const a = prev.message;
  const b = next.message;
  if (a.id !== b.id) return false;
  if (a.content !== b.content) return false;
  if ((a.skill_outputs?.length || 0) !== (b.skill_outputs?.length || 0)) return false;
  if ((a.citations?.length || 0) !== (b.citations?.length || 0)) return false;
  return true;
});

export default MessageBubble;
