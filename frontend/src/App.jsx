import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";
import AuthScreen from "./components/AuthScreen.jsx";
import ChatRoom from "./components/ChatRoom.jsx";
import { ChatBubbleIcon, MenuIcon } from "./components/Icons.jsx";
import Sidebar from "./components/Sidebar.jsx";

const TOKEN_STORAGE_KEY = "chat.token";
const ROOM_STORAGE_KEY = "chat.activeRoomId";
const ROOM_REFRESH_MS = 15000;

// localStorage can throw in private mode or when storage is blocked
const storage = {
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
};

export default function App() {
  const [token, setToken] = useState(() => storage.get(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(() => Number(storage.get(ROOM_STORAGE_KEY)) || null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(Boolean(token));

  const logout = useCallback(() => {
    storage.set(TOKEN_STORAGE_KEY, null);
    setToken(null);
    setUser(null);
    setRooms([]);
  }, []);

  useEffect(() => {
    if (!token || user) return;
    api
      .me(token)
      .then(setUser)
      .catch(logout)
      .finally(() => setIsRestoringSession(false));
  }, [token, user, logout]);

  const refreshRooms = useCallback(async () => {
    try {
      setRooms(await api.listRooms(token));
    } catch (error) {
      if (error.status === 401) logout();
    }
  }, [token, logout]);

  useEffect(() => {
    if (!user) return undefined;
    refreshRooms();
    const interval = setInterval(refreshRooms, ROOM_REFRESH_MS);
    return () => clearInterval(interval);
  }, [user, refreshRooms]);

  // Fall back to the first room if the remembered one no longer exists
  useEffect(() => {
    if (rooms.length && !rooms.some((room) => room.id === activeRoomId)) setActiveRoomId(rooms[0].id);
  }, [rooms, activeRoomId]);

  useEffect(() => {
    if (activeRoomId) storage.set(ROOM_STORAGE_KEY, String(activeRoomId));
  }, [activeRoomId]);

  function handleAuthenticated(newToken, authenticatedUser) {
    storage.set(TOKEN_STORAGE_KEY, newToken);
    setToken(newToken);
    setUser(authenticatedUser);
  }

  async function createRoom(name) {
    const room = await api.createRoom(token, name);
    await refreshRooms();
    selectRoom(room.id);
  }

  function selectRoom(roomId) {
    setActiveRoomId(roomId);
    setIsSidebarOpen(false);
  }

  if (isRestoringSession) {
    return <div className="flex h-full items-center justify-center bg-brand-900 text-brand-200">Loading…</div>;
  }
  if (!token || !user) return <AuthScreen onAuthenticated={handleAuthenticated} />;

  const activeRoom = rooms.find((room) => room.id === activeRoomId);

  return (
    <div className="flex h-full">
      {isSidebarOpen && (
        <div className="fixed inset-0 z-30 bg-brand-950/50 md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 transition-transform md:static md:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar
          user={user}
          rooms={rooms}
          activeRoomId={activeRoomId}
          onSelectRoom={selectRoom}
          onCreateRoom={createRoom}
          onLogout={logout}
        />
      </aside>

      <main className="min-w-0 flex-1">
        {activeRoom ? (
          <ChatRoom
            key={activeRoom.id}
            room={activeRoom}
            token={token}
            user={user}
            onOpenSidebar={() => setIsSidebarOpen(true)}
          />
        ) : (
          <div className="flex h-full flex-col">
            <div className="p-3 md:hidden">
              <button onClick={() => setIsSidebarOpen(true)} className="rounded-md p-1.5 text-brand-800">
                <MenuIcon />
              </button>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-slate-500">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-800">
                <ChatBubbleIcon className="h-6 w-6" />
              </div>
              <p className="text-lg font-semibold text-brand-900">No room selected</p>
              <p className="text-sm">Create a room from the sidebar to get started.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
