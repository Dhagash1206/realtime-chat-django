import Avatar from "./Avatar.jsx";

export default function OnlinePanel({ onlineUsers, currentUserId }) {
  return (
    <div className="h-full overflow-y-auto border-l border-brand-100 bg-white px-5 py-5">
      <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
        Online · {onlineUsers.length}
      </h3>
      <ul className="space-y-3">
        {onlineUsers.map((onlineUser) => (
          <li key={onlineUser.id} className="flex items-center gap-3">
            <Avatar name={onlineUser.username} size="sm" online />
            <span className="truncate text-sm text-slate-700">
              {onlineUser.username}
              {onlineUser.id === currentUserId && <span className="ml-1 text-slate-400">(you)</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
