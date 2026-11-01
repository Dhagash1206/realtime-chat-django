import { useState } from "react";
import Avatar from "./Avatar.jsx";
import { ChatBubbleIcon, HashIcon, LogoutIcon, PlusIcon } from "./Icons.jsx";

export default function Sidebar({ user, rooms, activeRoomId, onSelectRoom, onCreateRoom, onLogout }) {
  const [isCreating, setIsCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [createError, setCreateError] = useState("");

  async function handleCreate(event) {
    event.preventDefault();
    try {
      await onCreateRoom(newRoomName.trim());
      setNewRoomName("");
      setIsCreating(false);
      setCreateError("");
    } catch (error) {
      setCreateError(error.message);
    }
  }

  return (
    <div className="flex h-full flex-col bg-brand-900 text-brand-200">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white">
          <ChatBubbleIcon className="h-4 w-4" />
        </div>
        <span className="text-base font-bold tracking-tight text-white">Chatter</span>
      </div>

      <div className="flex items-center justify-between px-5 pb-2 pt-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-brand-400">Rooms</span>
        <button
          onClick={() => setIsCreating((value) => !value)}
          className="rounded-md p-1 text-brand-300 transition hover:bg-white/10 hover:text-white"
          title="Create room"
        >
          <PlusIcon />
        </button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} className="px-3 pb-2">
          <input
            autoFocus
            value={newRoomName}
            onChange={(event) => setNewRoomName(event.target.value)}
            placeholder="New room name"
            maxLength={100}
            required
            className="w-full rounded-full bg-white/10 px-4 py-2 text-sm text-white placeholder-brand-300 outline-none focus:ring-2 focus:ring-cream/60"
          />
          {createError && <p className="mt-1 px-2 text-xs text-red-300">{createError}</p>}
        </form>
      )}

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {rooms.length === 0 && <p className="px-2 py-4 text-sm text-brand-400">No rooms yet. Create one.</p>}
        {rooms.map((room) => {
          const isActive = room.id === activeRoomId;
          return (
            <button
              key={room.id}
              onClick={() => onSelectRoom(room.id)}
              className={`relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${
                isActive ? "bg-white/10 font-medium text-white" : "hover:bg-white/5 hover:text-white"
              }`}
            >
              {isActive && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-cream" />}
              <HashIcon className="h-4 w-4 shrink-0 opacity-60" />
              <span className="truncate">{room.name}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-3 border-t border-white/10 px-5 py-4">
        <Avatar name={user.username} size="sm" inverted />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{user.username}</p>
          <p className="text-xs text-brand-400">Online</p>
        </div>
        <button
          onClick={onLogout}
          className="rounded-md p-1.5 text-brand-300 transition hover:bg-white/10 hover:text-white"
          title="Log out"
        >
          <LogoutIcon />
        </button>
      </div>
    </div>
  );
}
