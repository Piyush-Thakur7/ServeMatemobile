/**
 * ServeMATE legacy compatibility shim.
 * The production UI uses frontendIntegration.js. This file intentionally avoids
 * demo data and delegates to the live API when older pages still reference API.
 */
(function () {
  const BASE = window.SERVEMATE_API_BASE_URL || "https://servemate.onrender.com/api";
  const TOKEN_KEY = "servemate_token";
  const USER_KEY = "servemate_user";

  const getToken = () => localStorage.getItem(TOKEN_KEY) || localStorage.getItem("sm_token");
  const setToken = (token) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem("sm_token", token);
  };
  const setUser = (user) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem("sm_user", JSON.stringify(user));
  };
  const clearSession = () => {
    [TOKEN_KEY, USER_KEY, "sm_token", "sm_user"].forEach((key) => localStorage.removeItem(key));
  };

  async function request(path, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${BASE}${path}`, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  window.API = {
    request,
    isLoggedIn: () => Boolean(getToken()),
    currentUser: () => JSON.parse(localStorage.getItem(USER_KEY) || localStorage.getItem("sm_user") || "null"),
    async register(name, email, password, username) {
      const data = await request("/auth/register", { method: "POST", body: JSON.stringify({ name, username, email, password }) });
      if (data.token) setToken(data.token);
      if (data.user) setUser(data.user);
      return data;
    },
    async login(email, password) {
      const data = await request("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      if (data.token) setToken(data.token);
      if (data.user) setUser(data.user);
      return data;
    },
    async me() { return request("/auth/me"); },
    logout() { clearSession(); location.reload(); },
    async getCauses() { return request("/causes"); },
    async dashboard() { return request("/dashboard"); },
    async tokenHistory() { return request("/tokens/history"); },
    async leaderboard() { return request("/leaderboard/donors"); },
    async ngos() { return request("/ngos"); },
    async contact(form) { return request("/contact", { method: "POST", body: JSON.stringify(form) }); },
    async ngoRegister(form) { return request("/auth/ngo/register", { method: "POST", body: JSON.stringify(form) }); },
    async createTokenOrder(amount) { return request("/tokens/order", { method: "POST", body: JSON.stringify({ amount }) }); },
    async verifyTokenPayment(payload) { return request("/tokens/verify", { method: "POST", body: JSON.stringify(payload) }); },
    async contribute(causeId, amount) { return request("/contribute", { method: "POST", body: JSON.stringify({ causeId, amount }) }); }
  };
})();
