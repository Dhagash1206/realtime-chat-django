import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { api } from "../api.js";

const MAX_RECONNECT_DELAY_MS = 10000;

export function useChatSocket({ roomId, token, onEvent, onUnauthorized }) {
  const [status, setStatus] = useState("connecting");
  const socketRef = useRef(null);
  // Kept in refs so new handler functions on each render don't tear down the socket
  const onEventRef = useRef(onEvent);
  const onUnauthorizedRef = useRef(onUnauthorized);
  useLayoutEffect(() => {
    onEventRef.current = onEvent;
    onUnauthorizedRef.current = onUnauthorized;
  });

  useEffect(() => {
    if (!roomId || !token) return undefined;
    let reconnectTimer;
    let attempt = 0;
    let disposed = false;

    function scheduleReconnect() {
      if (disposed) return;
      setStatus("closed");
      const delay = Math.min(1000 * 2 ** attempt, MAX_RECONNECT_DELAY_MS);
      attempt += 1;
      reconnectTimer = setTimeout(connect, delay);
    }

    async function connect() {
      setStatus("connecting");
      let ticket;
      try {
        // A fresh single-use ticket per attempt keeps the long-lived token out of the socket URL
        ({ ticket } = await api.socketTicket(token));
      } catch (error) {
        if (error.status === 401) onUnauthorizedRef.current?.();
        else scheduleReconnect();
        return;
      }
      if (disposed) return;

      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const socket = new WebSocket(`${protocol}://${window.location.host}/ws/rooms/${roomId}/?ticket=${ticket}`);
      socketRef.current = socket;
      socket.onopen = () => {
        attempt = 0;
        setStatus("open");
      };
      socket.onmessage = (event) => onEventRef.current(JSON.parse(event.data));
      socket.onclose = scheduleReconnect;
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
