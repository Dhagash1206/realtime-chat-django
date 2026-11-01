import { useCallback, useEffect, useRef, useState } from "react";

const MAX_RECONNECT_DELAY_MS = 10000;

export function useChatSocket({ roomId, token, onEvent }) {
  const [status, setStatus] = useState("connecting");
  const socketRef = useRef(null);
  // Kept in a ref so a new handler on each render doesn't tear down the socket
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!roomId || !token) return undefined;
    let reconnectTimer;
    let attempt = 0;
    let disposed = false;

    function connect() {
      setStatus("connecting");
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const socket = new WebSocket(`${protocol}://${window.location.host}/ws/rooms/${roomId}/?token=${token}`);
      socketRef.current = socket;

      socket.onopen = () => {
        attempt = 0;
        setStatus("open");
      };
      socket.onmessage = (event) => onEventRef.current(JSON.parse(event.data));
      socket.onclose = () => {
        if (disposed) return;
        setStatus("closed");
        const delay = Math.min(1000 * 2 ** attempt, MAX_RECONNECT_DELAY_MS);
        attempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    }

    connect();
    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      socketRef.current?.close();
    };
  }, [roomId, token]);

  const sendMessage = useCallback((content) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ content }));
    return true;
  }, []);

  return { status, sendMessage };
}
