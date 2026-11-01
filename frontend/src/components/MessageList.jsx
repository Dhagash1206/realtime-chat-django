import { useEffect, useLayoutEffect, useRef } from "react";
import Avatar from "./Avatar.jsx";

const GROUP_WINDOW_MS = 5 * 60 * 1000;
const NEAR_BOTTOM_PX = 120;

const formatTime = (date) => date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function formatDay(date) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

function DayDivider({ label }) {
  return (
    <div className="my-4 flex items-center gap-3">
      <div className="h-px flex-1 bg-brand-100" />
      <span className="rounded-full bg-white px-3 py-0.5 text-[11px] font-medium uppercase tracking-wider text-slate-400 ring-1 ring-brand-100">{label}</span>
      <div className="h-px flex-1 bg-brand-100" />
    </div>
  );
}

function MessageRow({ message, isOwn, showHeader }) {
  const sentAt = new Date(message.created_at);
  return (
    <div className={`flex gap-2.5 ${isOwn ? "flex-row-reverse" : ""} ${showHeader ? "mt-3" : "mt-0.5"}`}>
      <div className="w-9 shrink-0">{showHeader && !isOwn && <Avatar name={message.user.username} />}</div>
      <div className={`flex max-w-[75%] flex-col ${isOwn ? "items-end" : "items-start"}`}>
        {showHeader && (
          <div className={`mb-1 flex items-baseline gap-2 text-xs ${isOwn ? "flex-row-reverse" : ""}`}>
            <span className="font-semibold text-brand-900">
              {isOwn ? "You" : message.user.username}
            </span>
            <span className="text-slate-400">{formatTime(sentAt)}</span>
          </div>
        )}
        <div
          title={sentAt.toLocaleString()}
          className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-[15px] leading-relaxed ${
            isOwn
              ? "rounded-tr-md bg-brand-800 text-white"
              : "rounded-tl-md bg-white text-slate-800 ring-1 ring-brand-100"
          }`}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}

export default function MessageList({ items, isLoading, currentUserId, hasOlder, loadingOlder, onLoadOlder }) {
  const scrollRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const previousRef = useRef({ firstKey: null, lastKey: null, scrollHeight: 0 });

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const firstKey = items[0]?.key ?? null;
    const lastKey = items.at(-1)?.key ?? null;
    const previous = previousRef.current;
    const lastItem = items.at(-1);

    const olderMessagesPrepended = previous.firstKey && firstKey !== previous.firstKey && lastKey === previous.lastKey;
    if (olderMessagesPrepended) {
      // Keep the viewport on the message the user was reading
      container.scrollTop += container.scrollHeight - previous.scrollHeight;
    } else if (lastKey !== previous.lastKey) {
      const sentByMe = lastItem?.kind === "message" && lastItem.message.user.id === currentUserId;
      if (isNearBottomRef.current || sentByMe || !previous.lastKey) container.scrollTop = container.scrollHeight;
    }
    previousRef.current = { firstKey, lastKey, scrollHeight: container.scrollHeight };
  }, [items, currentUserId]);

  useEffect(() => {
    const container = scrollRef.current;
    const trackPosition = () => {
      isNearBottomRef.current = container.scrollHeight - container.scrollTop - container.clientHeight < NEAR_BOTTOM_PX;
    };
    container.addEventListener("scroll", trackPosition);
    return () => container.removeEventListener("scroll", trackPosition);
  }, []);

  let previousMessage = null;
  let previousDay = null;

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
      {hasOlder && (
        <div className="mb-2 flex justify-center">
          <button
            onClick={onLoadOlder}
            disabled={loadingOlder}
            className="rounded-full border border-brand-200 bg-white px-4 py-1.5 text-xs font-medium text-brand-800 transition hover:bg-brand-50 disabled:opacity-60"
          >
            {loadingOlder ? "Loading…" : "Load older messages"}
          </button>
        </div>
      )}

      {items.length === 0 && isLoading && (
        <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading messages…</div>
      )}

      {items.length === 0 && !isLoading && (
        <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
          <p className="text-lg font-semibold text-brand-900">No messages yet</p>
          <p className="text-sm">Say hello and get the conversation started.</p>
        </div>
      )}

      {items.map((item) => {
        if (item.kind === "system") {
          previousMessage = null;
          return (
            <div key={item.key} className="my-3 text-center text-xs text-slate-400">
              {item.text}
            </div>
          );
        }

        const { message } = item;
        const sentAt = new Date(message.created_at);
        const day = sentAt.toDateString();
        const showDivider = day !== previousDay;
        const showHeader =
          showDivider ||
          !previousMessage ||
          previousMessage.user.id !== message.user.id ||
          sentAt - new Date(previousMessage.created_at) > GROUP_WINDOW_MS;
        previousMessage = message;
        previousDay = day;

        return (
          <div key={item.key}>
            {showDivider && <DayDivider label={formatDay(sentAt)} />}
            <MessageRow message={message} isOwn={message.user.id === currentUserId} showHeader={showHeader} />
          </div>
        );
      })}
    </div>
  );
}
