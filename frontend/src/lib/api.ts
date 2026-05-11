const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = {
  async get(path: string) {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
  },
  async post(path: string, body?: any) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
  },
  wsUrl(path: string) {
    const wsBase = API_BASE.replace("http", "ws");
    return `${wsBase}${path}`;
  },
};
