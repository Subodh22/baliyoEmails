const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type RequestOptions = {
  method?: string;
  body?: unknown;
  workspaceId?: string;
  token?: string;
};

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, workspaceId, token } = opts;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (workspaceId) headers["x-workspace-id"] = workspaceId;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? "API error");
  }

  return res.json();
}

// ── Campaigns ─────────────────────────────────────────────────────────────────
export const api = {
  campaigns: {
    list: (workspaceId: string, token: string) =>
      request("/api/campaigns", { workspaceId, token }),
    get: (id: string, workspaceId: string, token: string) =>
      request(`/api/campaigns/${id}`, { workspaceId, token }),
    create: (data: unknown, workspaceId: string, token: string) =>
      request("/api/campaigns", { method: "POST", body: data, workspaceId, token }),
    update: (id: string, data: unknown, workspaceId: string, token: string) =>
      request(`/api/campaigns/${id}`, { method: "PATCH", body: data, workspaceId, token }),
    delete: (id: string, workspaceId: string, token: string) =>
      request(`/api/campaigns/${id}`, { method: "DELETE", workspaceId, token }),
    launch: (id: string, workspaceId: string, token: string) =>
      request(`/api/campaigns/${id}/launch`, { method: "POST", workspaceId, token }),
    pause: (id: string, workspaceId: string, token: string) =>
      request(`/api/campaigns/${id}/pause`, { method: "POST", workspaceId, token }),
    resume: (id: string, workspaceId: string, token: string) =>
      request(`/api/campaigns/${id}/resume`, { method: "POST", workspaceId, token }),
  },

  sequences: {
    list: (workspaceId: string, token: string) =>
      request("/api/sequences", { workspaceId, token }),
    get: (id: string, workspaceId: string, token: string) =>
      request(`/api/sequences/${id}`, { workspaceId, token }),
    create: (data: unknown, workspaceId: string, token: string) =>
      request("/api/sequences", { method: "POST", body: data, workspaceId, token }),
    update: (id: string, data: unknown, workspaceId: string, token: string) =>
      request(`/api/sequences/${id}`, { method: "PATCH", body: data, workspaceId, token }),
    delete: (id: string, workspaceId: string, token: string) =>
      request(`/api/sequences/${id}`, { method: "DELETE", workspaceId, token }),
  },

  leads: {
    list: (params: Record<string, string>, workspaceId: string, token: string) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/api/leads?${qs}`, { workspaceId, token });
    },
    get: (id: string, workspaceId: string, token: string) =>
      request(`/api/leads/${id}`, { workspaceId, token }),
    update: (id: string, data: unknown, workspaceId: string, token: string) =>
      request(`/api/leads/${id}`, { method: "PATCH", body: data, workspaceId, token }),
    delete: (id: string, workspaceId: string, token: string) =>
      request(`/api/leads/${id}`, { method: "DELETE", workspaceId, token }),
    blacklist: (data: unknown, workspaceId: string, token: string) =>
      request("/api/leads/blacklist", { method: "POST", body: data, workspaceId, token }),
  },

  accounts: {
    list: (workspaceId: string, token: string) =>
      request("/api/accounts", { workspaceId, token }),
    create: (data: unknown, workspaceId: string, token: string) =>
      request("/api/accounts", { method: "POST", body: data, workspaceId, token }),
    health: (id: string, workspaceId: string, token: string) =>
      request(`/api/accounts/${id}/health`, { workspaceId, token }),
    delete: (id: string, workspaceId: string, token: string) =>
      request(`/api/accounts/${id}`, { method: "DELETE", workspaceId, token }),
  },

  domains: {
    list: (workspaceId: string, token: string) =>
      request("/api/domains", { workspaceId, token }),
    create: (data: unknown, workspaceId: string, token: string) =>
      request("/api/domains", { method: "POST", body: data, workspaceId, token }),
    verify: (id: string, workspaceId: string, token: string) =>
      request(`/api/domains/${id}/verify`, { method: "POST", workspaceId, token }),
    delete: (id: string, workspaceId: string, token: string) =>
      request(`/api/domains/${id}`, { method: "DELETE", workspaceId, token }),
  },

  analytics: {
    overview: (workspaceId: string, token: string, days = "30") =>
      request(`/api/analytics/overview?days=${days}`, { workspaceId, token }),
    timeseries: (workspaceId: string, token: string, days = "30") =>
      request(`/api/analytics/timeseries?days=${days}`, { workspaceId, token }),
    campaign: (id: string, workspaceId: string, token: string) =>
      request(`/api/analytics/campaigns/${id}`, { workspaceId, token }),
  },

  inbox: {
    list: (params: Record<string, string>, workspaceId: string, token: string) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/api/inbox?${qs}`, { workspaceId, token });
    },
    update: (id: string, data: unknown, workspaceId: string, token: string) =>
      request(`/api/inbox/${id}`, { method: "PATCH", body: data, workspaceId, token }),
  },

  billing: {
    plans: () => request("/api/billing/plans"),
    subscription: (workspaceId: string, token: string) =>
      request("/api/billing/subscription", { workspaceId, token }),
    checkout: (data: unknown, workspaceId: string, token: string) =>
      request("/api/billing/checkout", { method: "POST", body: data, workspaceId, token }),
    portal: (workspaceId: string, token: string) =>
      request("/api/billing/portal", { method: "POST", workspaceId, token }),
  },

  apiKeys: {
    list: (workspaceId: string, token: string) =>
      request("/api/api-keys", { workspaceId, token }),
    create: (data: unknown, workspaceId: string, token: string) =>
      request("/api/api-keys", { method: "POST", body: data, workspaceId, token }),
    delete: (id: string, workspaceId: string, token: string) =>
      request(`/api/api-keys/${id}`, { method: "DELETE", workspaceId, token }),
  },
};
