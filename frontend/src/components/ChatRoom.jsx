import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { useChatSocket } from "../hooks/useChatSocket.js";
import { HashIcon, MenuIcon, SendIcon, UsersIcon } from "./Icons.jsx";
import MessageList from "./MessageList.jsx";
import OnlinePanel from "./OnlinePanel.jsx";

const PAGE_SIZE = 50;
const MAX_MESSAGE_LENGTH = 2000;

const toMessageItem = (message) => ({ kind: "message", key: `m-${message.id}`, message });

let systemItemCounter = 0;
const toSystemItem = (text) => ({ kind: "system", key: `s-${(systemItemCounter += 1)}`, text });

const STATUS_STYLES = {
  open: { label: "Connected", dot: "bg-emerald-500" },
  connecting: { label: "Connecting…", dot: "bg-brand-300 animate-pulse" },
  closed: { label: "Reconnecting…", dot: "bg-red-500 animate-pulse" },
};

export default function ChatRoom({ room, token, user, onOpenSidebar }) {
  const [items, setItems] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [errorNotice, setErrorNotice] = useState("");
  const [showOnlineMobile, setShowOnlineMobile] = useState(false);
  const textareaRef = useRef(null);

  // Runs on every (re)connect so messages missed while offline are filled in
  const loadLatest = useCallback(async () => {
    const history = await api.roomMessages(token, room.id);
    const newestHistoryId = history.at(-1)?.id ?? 0;
    setItems((previousItems) => {
      const arrivedSinceFetch = previousItems.filter(
        (item) => item.kind === "message" && item.message.id > newestHistoryId
      );
      return [...history.map(toMessageItem), ...arrivedSinceFetch];
    });
    setHasOlder(history.length === PAGE_SIZE);
  }, [room.id, token]);

  const handleSocketEvent = useCallback(
    (event) => {
      switch (event.type) {
        case "presence":
          setOnlineUsers(event.online_users);
          loadLatest().catch(() => setErrorNotice("Couldn't load message history"));
          break;
        case "message":
          setItems((previousItems) =>
            previousItems.some((item) => item.key === `m-${event.message.id}`)
              ? previousItems
              : [...previousItems, toMessageItem(event.message)]
          );
          break;
        case "user_joined":
        case "user_left":
          setOnlineUsers(event.online_users);
          if (event.user.id !== user.id) {
            const verb = event.type === "user_joined" ? "joined" : "left";
            setItems((previousItems) => [...previousItems, toSystemItem(`${event.user.username} ${verb} the room`)]);
          }
          break;
        case "error":
          setErrorNotice(event.detail);
          break;
        default:
          break;
      }
    },
    [loadLatest, user.id]
  );

  const { status, sendMessage } = useChatSocket({ roomId: room.id, token, onEvent: handleSocketEvent });

  useEffect(() => {
    if (!errorNotice) return undefined;
    const timer = setTimeout(() => setErrorNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [errorNotice]);

  useEffect(() => {
    const textarea = textareaRef.current;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [draft]);

  async function loadOlder() {
    const oldestMessage = items.find((item) => item.kind === "message")?.message;
    if (!oldestMessage) return;
    setLoadingOlder(true);
    try {
      const olderMessages = await api.roomMessages(token, room.id, oldestMessage.id);
      setItems((previousItems) => [...olderMessages.map(toMessageItem), ...previousItems]);
      setHasOlder(olderMessages.length === PAGE_SIZE);
    } catch {
      setErrorNotice("Couldn't load older messages");
    } finally {
      setLoadingOlder(false);
    }
  }

  function submitDraft() {
    const content = draft.trim();
    if (!content) return;
    if (sendMessage(content)) setDraft("");
    else setErrorNotice("Not connected — message not sent");
  }

  function handleKeyDown(event) {
    // Enter sends; Shift+Enter inserts a newline
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submitDraft();
    }
  }

  const statusStyle = STATUS_STYLES[status];

  return (
    <div className="flex h-full min-w-0">
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-brand-100 bg-white px-5 py-3.5">
          <button
            onClick={onOpenSidebar}
            className="rounded-md p-1.5 text-brand-800 hover:bg-brand-50 md:hidden"
          >
            <MenuIcon />
          </button>
          <HashIcon className="h-5 w-5 text-brand-400" />
          <h2 className="truncate text-base font-semibold text-brand-900">{room.name}</h2>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex">
              <span className={`h-2 w-2 rounded-full ${statusStyle.dot}`} />
              {statusStyle.label}
            </span>
            <button
              onClick={() => setShowOnlineMobile((value) => !value)}
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm text-brand-800 hover:bg-brand-50 lg:hidden"
            >
              <UsersIcon className="h-4 w-4" />
              {onlineUsers.length}
            </button>
          </div>
        </header>

        <MessageList
          items={items}
          currentUserId={user.id}
          hasOlder={hasOlder}
          loadingOlder={loadingOlder}
          onLoadOlder={loadOlder}
        />

        {errorNotice && (
          <div className="mx-4 mb-2 rounded-full bg-red-50 px-4 py-2 text-sm text-red-700">
            {errorNotice}
          </div>
        )}

        <div className="border-t border-brand-100 bg-white px-5 py-3">
          <div className="flex items-end gap-2 rounded-3xl border border-brand-200 bg-brand-50/60 py-1.5 pl-5 pr-1.5 transition focus-within:border-brand-700 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-700/15">
            <textarea
              ref={textareaRef}
              rows={1}
              value={draft}
              maxLength={MAX_MESSAGE_LENGTH}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message #${room.name}`}
              className="max-h-40 flex-1 resize-none bg-transparent py-1.5 text-[15px] outline-none placeholder:text-slate-400"
            />
            <button
              onClick={submitDraft}
              disabled={!draft.trim() || status !== "open"}
              className="primary-button p-2.5"
              title="Send (Enter)"
            >
              <SendIcon className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1.5 hidden px-5 text-[11px] text-slate-400 sm:block">
            <kbd className="font-sans font-semibold">Enter</kbd> to send ·{" "}
            <kbd className="font-sans font-semibold">Shift + Enter</kbd> for a new line
          </p>
        </div>
      </section>

      <aside className="hidden w-60 shrink-0 lg:block">
        <OnlinePanel onlineUsers={onlineUsers} currentUserId={user.id} />
      </aside>

      {showOnlineMobile && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setShowOnlineMobile(false)}>
          <div className="absolute inset-0 bg-brand-950/50" />
          <div className="absolute inset-y-0 right-0 w-64" onClick={(event) => event.stopPropagation()}>
            <OnlinePanel onlineUsers={onlineUsers} currentUserId={user.id} />
          </div>
        </div>
      )}
    </div>
  );
}
