export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// DRF returns errors as {detail: "..."} or {field: ["..."]}; flatten either into one readable line
function describeError(body) {
  if (!body || typeof body !== "object") return "Something went wrong";
  if (body.detail) return body.detail;
  return Object.entries(body)
    .map(([field, problems]) => `${field}: ${[].concat(problems).join(" ")}`)
    .join(" · ");
}

export async function apiRequest(path, { token, method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Token ${token}`;

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(describeError(data), response.status);
  return data;
}

export const api = {
  register: (credentials) => apiRequest("/auth/register/", { method: "POST", body: credentials }),
  login: (credentials) => apiRequest("/auth/login/", { method: "POST", body: credentials }),
  me: (token) => apiRequest("/users/me/", { token }),
  listRooms: (token) => apiRequest("/rooms/", { token }),
  createRoom: (token, name) => apiRequest("/rooms/", { token, method: "POST", body: { name } }),
  roomMessages: (token, roomId, beforeId) =>
    apiRequest(`/rooms/${roomId}/messages/${beforeId ? `?before_id=${beforeId}` : ""}`, { token }),
};
