(function () {
  const API_BASE = window.SERVEMATE_API_BASE_URL ||
    (["localhost", "127.0.0.1"].includes(window.location.hostname) || window.location.port
      ? `${window.location.origin}/api`
      : "https://servemate.onrender.com/api");

  const tokenKey = "servemate_token";
  const userKey = "servemate_user";

  const state = {
    auth: { token: localStorage.getItem(tokenKey), user: readUser() },
    causes: [],
    leaderboard: { donors: [], ngos: [] },
    dashboard: null,
    payment: { lastDonation: null },
    modals: {},
    notifications: [],
  };

  const coreCauses = [
    {
      category: "trees",
      title: "Trees / Environment",
      eyebrow: "Environment",
      description: "Environmental restoration, tree plantation, survival proof, and verified green drives.",
      icon: "\u{1F333}",
      accent: "cause-green",
      empty: "New verified causes coming soon",
    },
    {
      category: "meals",
      title: "Meals / Hunger Relief",
      eyebrow: "Hunger Relief",
      description: "Food security campaigns, warm community kitchens, and hunger relief support.",
      icon: "\u{1F35B}",
      accent: "cause-warm",
      empty: "No community activity yet",
    },
    {
      category: "essentials",
      title: "Essentials / Emergency Support",
      eyebrow: "Emergency Support",
      description: "Emergency kits, hygiene essentials, and immediate relief for families facing crisis.",
      icon: "\u{1F9F0}",
      accent: "cause-relief",
      empty: "Be the first supporter",
    },
    {
      category: "ngo-support",
      title: "NGO Community Support",
      eyebrow: "Verified NGOs",
      description: "Operational support, proof uploads, volunteer tools, and community response for verified NGOs.",
      icon: "\u{1F91D}",
      accent: "cause-trust",
      empty: "New verified causes coming soon",
    },
  ];

  function readUser() {
    try {
      return JSON.parse(localStorage.getItem(userKey) || "null");
    } catch (_) {
      return null;
    }
  }

  function setSession(data) {
    if (data.token) {
      localStorage.setItem(tokenKey, data.token);
      state.auth.token = data.token;
    }
    if (data.user || data.ngo) {
      state.auth.user = data.user || data.ngo;
      localStorage.setItem(userKey, JSON.stringify(state.auth.user));
    }
    renderAuthShell();
  }

  function getToken() {
    return state.auth.token || localStorage.getItem(tokenKey);
  }

  async function request(path, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(data.error || data.message || "Request failed");
    return data;
  }

  function value(selector, root = document) {
    return root.querySelector(selector)?.value?.trim() || "";
  }

  function escapeHtml(input) {
    return String(input || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[char]));
  }

  function initials(name) {
    return String(name || "SM")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "SM";
  }

  function compactNumber(value, options = {}) {
    const n = Number(value || 0);
    const sign = n < 0 ? "-" : "";
    const abs = Math.abs(n);
    const prefix = options.money ? "Rs " : "";
    if (abs >= 1000000000) return `${sign}${prefix}${trim(abs / 1000000000)}B`;
    if (abs >= 1000000) return `${sign}${prefix}${trim(abs / 1000000)}M`;
    if (abs >= 1000) return `${sign}${prefix}${trim(abs / 1000)}K`;
    return `${sign}${prefix}${abs.toLocaleString("en-IN")}`;
  }

  function trim(value) {
    return value.toFixed(value >= 10 ? 0 : 1).replace(/\.0$/, "");
  }

  function money(amount) {
    return `Rs ${Number(amount || 0).toLocaleString("en-IN")}`;
  }

  function injectStyles() {
    if (document.getElementById("servemate-premium-runtime-css")) return;
    const style = document.createElement("style");
    style.id = "servemate-premium-runtime-css";
    style.textContent = `
      .premium-cause-card {
        min-height: 372px; border: 1px solid color-mix(in srgb, var(--border) 76%, transparent);
        border-radius: 22px; padding: 1.15rem; overflow: hidden; position: relative;
        background: linear-gradient(180deg, color-mix(in srgb, var(--card) 92%, transparent), var(--card));
        box-shadow: 0 24px 70px rgba(15,23,42,.09);
        transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease;
      }
      .premium-cause-card:hover { transform: translateY(-6px); box-shadow: 0 32px 90px rgba(15,23,42,.16); border-color: color-mix(in srgb, var(--blue) 34%, var(--border)); }
      .cause-visual { height: 138px; border-radius: 18px; position: relative; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem; isolation: isolate; overflow:hidden; }
      .cause-visual::before { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 28% 22%, rgba(255,255,255,.82), transparent 30%), linear-gradient(135deg, var(--c1), var(--c2)); z-index: -2; }
      .cause-visual::after { content: ""; position: absolute; inset: 12px; border: 1px solid rgba(255,255,255,.38); border-radius: 14px; z-index: -1; }
      .cause-visual .art { font-size: 3.2rem; filter: drop-shadow(0 12px 22px rgba(0,0,0,.18)); transform: translateZ(0); }
      .cause-green { --c1:#dcfce7; --c2:#16a34a; }
      .cause-warm { --c1:#ffedd5; --c2:#ea580c; }
      .cause-relief { --c1:#dbeafe; --c2:#2563eb; }
      .cause-trust { --c1:#ede9fe; --c2:#7c3aed; }
      .cause-chip, .rank-chip, .token-chip {
        display:inline-flex; align-items:center; gap:.35rem; border-radius:999px; padding:.35rem .65rem;
        font-size:.74rem; font-weight:800; border:1px solid rgba(255,255,255,.28);
        background: color-mix(in srgb, var(--card) 72%, transparent); box-shadow: inset 0 1px rgba(255,255,255,.35);
      }
      .token-chip { background: linear-gradient(135deg,#facc15,#f97316); color:#431407; border:0; box-shadow:0 12px 28px rgba(249,115,22,.24); }
      .cause-empty-state { margin-top: 1rem; border-radius: 16px; padding: .9rem; background: color-mix(in srgb, var(--bg2) 82%, transparent); border: 1px dashed var(--border); color: var(--text2); font-weight: 800; }
      .premium-progress { height: 11px; border-radius: 999px; overflow: hidden; background: var(--bg3); position: relative; }
      .premium-progress > span { display:block; height:100%; min-width: 0; border-radius: inherit; background: linear-gradient(90deg, var(--blue), var(--orange)); transition: width .65s ease; }
      .rank-chip { color: white; border: 0; text-shadow: 0 1px 12px rgba(0,0,0,.18); box-shadow: 0 10px 26px rgba(79,70,229,.24); }
      .lb-row { position: relative; overflow: hidden; }
      .lb-row::after { content:""; position:absolute; inset:0; background:linear-gradient(90deg, transparent, rgba(255,255,255,.08), transparent); transform:translateX(-120%); transition:transform .6s ease; pointer-events:none; }
      .lb-row:hover::after { transform:translateX(120%); }
      .empty-panel { padding: 1.5rem; border-radius: 18px; border: 1px dashed var(--border); background: color-mix(in srgb, var(--card) 78%, var(--bg2)); text-align: center; color: var(--text2); }
      .title-card { padding:1rem; border-radius:20px; color:#fff; position:relative; overflow:hidden; box-shadow:0 22px 70px rgba(79,70,229,.24); }
      .title-card::before { content:""; position:absolute; inset:-2px; background:linear-gradient(120deg, rgba(255,255,255,.42), transparent 34%, rgba(255,255,255,.24)); animation: sm-sheen 3s linear infinite; }
      .title-card > * { position:relative; }
      .sm-skeleton { opacity:.75; }
      @keyframes sm-sheen { from { transform: translateX(-80%); } to { transform: translateX(80%); } }
      @media (max-width: 720px) { .premium-cause-card { min-height: auto; } .cause-visual { height: 112px; } .lb-row { align-items:flex-start; } }
    `;
    document.head.appendChild(style);
  }

  function clearDemoShell() {
    renderCauses(document.getElementById("causes-grid"), []);
    renderLeaderboard("donors", []);
    renderLeaderboard("ngos", []);
    renderLoggedOutDashboard();
    document.querySelectorAll(".hero-stat .num").forEach((node) => (node.textContent = "0"));
  }

  async function loadStats() {
    try {
      const stats = await request("/stats");
      const values = [
        compactNumber(stats.totalDonated, { money: true }),
        compactNumber(stats.verifiedTasks),
        compactNumber(stats.verifiedNGOs),
        compactNumber(stats.totalDonations),
      ];
      document.querySelectorAll(".hero-stat .num").forEach((node, index) => {
        node.textContent = values[index] || "0";
      });
    } catch (_) {
      document.querySelectorAll(".hero-stat .num").forEach((node) => (node.textContent = "0"));
    }
  }

  async function loadCauses() {
    const grid = document.getElementById("causes-grid");
    if (!grid) return;
    try {
      const causes = await request("/causes");
      state.causes = mergeCauseRows(Array.isArray(causes) ? causes : []);
    } catch (_) {
      state.causes = mergeCauseRows([]);
    }
    renderCauses(grid, state.causes);
  }

  function mergeCauseRows(rows) {
    const byCategory = new Map(rows.map((row) => [row.category, row]));
    return coreCauses.map((core) => ({ ...core, ...(byCategory.get(core.category) || {}), ...core }));
  }

  function renderCauses(grid, causes) {
    if (!grid) return;
    const rows = mergeCauseRows(causes || []);
    grid.classList.remove("grid-3");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(auto-fit,minmax(245px,1fr))";
    grid.style.gap = "1rem";
    grid.innerHTML = rows.map(renderCauseCard).join("");
  }

  function renderCauseCard(cause) {
    const raised = Number(cause.raised || 0);
    const goal = Number(cause.goal || 0);
    const contributors = Number(cause.contributors || 0);
    const hasActivity = Boolean(cause.hasRealActivity || raised > 0 || contributors > 0);
    const pct = hasActivity && goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;

    return `
      <article class="premium-cause-card">
        <div class="cause-visual ${cause.accent}">
          <span class="cause-chip" style="position:absolute;top:12px;left:12px;">${escapeHtml(cause.eyebrow)}</span>
          <span class="art">${cause.icon}</span>
        </div>
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;margin-bottom:.5rem;">
          <h3 style="font-size:1.12rem;font-weight:850;line-height:1.2;margin:0;">${escapeHtml(cause.title)}</h3>
          <span class="token-chip">SM</span>
        </div>
        <p style="font-size:.88rem;color:var(--text2);line-height:1.65;margin:.25rem 0 1rem;">${escapeHtml(cause.description)}</p>
        ${hasActivity ? `
          <div class="cause-meta"><span>Real community activity</span><strong>${compactNumber(raised, { money: true })}</strong></div>
          <div class="premium-progress"><span style="width:${pct}%"></span></div>
          <div class="cause-footer">
            <span style="font-size:.8rem;color:var(--text2);">${compactNumber(contributors)} supporters</span>
            <button class="btn btn-primary" onclick="openDonateModal('${cause.category}')">Support</button>
          </div>
        ` : `
          <div class="cause-empty-state">
            <div>${escapeHtml(cause.empty || "No community activity yet")}</div>
            <div style="font-size:.8rem;font-weight:600;margin-top:.25rem;">No community activity yet</div>
          </div>
          <div class="cause-footer">
            <span style="font-size:.8rem;color:var(--text2);">Be the first supporter</span>
            <button class="btn btn-primary" onclick="openDonateModal('${cause.category}')">Support</button>
          </div>
        `}
      </article>
    `;
  }

  async function loadDashboard() {
    if (!getToken()) {
      renderLoggedOutDashboard();
      return;
    }
    try {
      const data = await request("/dashboard");
      state.dashboard = data;
      state.auth.user = data.user;
      localStorage.setItem(userKey, JSON.stringify(data.user));
      renderDashboard(data);
    } catch (err) {
      notify(`Dashboard unavailable: ${err.message}`);
      renderLoggedOutDashboard();
    }
  }

  function renderLoggedOutDashboard() {
    const historyBody = document.querySelector("#dtab-history tbody");
    if (historyBody) historyBody.innerHTML = `<tr><td colspan="7"><div class="empty-panel">Login to see your real donation history.</div></td></tr>`;
    const activity = recentActivityCard();
    if (activity) activity.innerHTML = `<h4 style="font-weight:700;margin-bottom:1rem;">Recent Activity</h4><div class="empty-panel">No community activity yet.</div>`;
    const badgeGrid = document.querySelector("#dtab-badges .badges-grid");
    if (badgeGrid) badgeGrid.innerHTML = `<div class="empty-panel" style="grid-column:1/-1;">Badges appear after verified activity.</div>`;
  }

  function renderDashboard(data) {
    const user = data.user || {};
    const progression = data.progression || {};
    const displayTitle = `${progression.titleIcon || ""} ${user.title || progression.title || "Beginner"}`.trim();

    const avatar = document.querySelector(".dash-sidebar .user-avatar");
    if (avatar) avatar.textContent = initials(user.name);
    const sidebarName = document.querySelector(".dash-sidebar div[style*='font-weight:700']");
    if (sidebarName) sidebarName.textContent = user.name || "ServeMate User";
    const sidebarBadge = document.querySelector(".dash-sidebar .badge");
    if (sidebarBadge) sidebarBadge.textContent = displayTitle;
    const levelName = document.querySelector(".level-name");
    if (levelName) levelName.textContent = `Level ${user.level || progression.level || 1} - ${user.title || progression.title || "Beginner"}`;
    const xpCount = document.querySelector(".xp-count");
    if (xpCount) xpCount.textContent = `${compactNumber(user.xp)} / ${compactNumber(progression.nextLevelXp)} XP`;
    const fill = document.querySelector(".level-bar .progress-fill");
    if (fill) fill.style.width = `${progression.progress || 0}%`;
    const remaining = document.querySelector(".level-bar div[style*='font-size:.75rem']");
    if (remaining) remaining.textContent = `${compactNumber(progression.xpRemaining)} XP to next level`;

    const greeting = document.querySelector("#dtab-overview h2");
    if (greeting) greeting.textContent = `Good to see you, ${user.name || "friend"}`;
    const cards = document.querySelectorAll("#dtab-overview .stat-card .value");
    if (cards[0]) cards[0].textContent = compactNumber(user.totalDonated, { money: true });
    if (cards[1]) cards[1].textContent = `${compactNumber(user.xp)} XP`;
    if (cards[2]) cards[2].textContent = compactNumber(user.donationCount);
    if (cards[3]) cards[3].textContent = `Lv ${user.level || progression.level || 1}`;

    renderOverviewActivity(data.recentDonations || []);
    renderHistory(data.recentDonations || []);
    renderBadges(user, progression);
    renderProgression(progression);
  }

  function recentActivityCard() {
    return Array.from(document.querySelectorAll("#dtab-overview .card h4"))
      .find((h) => h.textContent.includes("Recent Activity"))?.parentElement;
  }

  function renderOverviewActivity(donations) {
    const card = recentActivityCard();
    if (!card) return;
    if (!donations.length) {
      card.innerHTML = `<h4 style="font-weight:700;margin-bottom:1rem;">Recent Activity</h4><div class="empty-panel">No community activity yet. Your first verified action will appear here.</div>`;
      return;
    }
    card.innerHTML = `
      <h4 style="font-weight:700;margin-bottom:1rem;">Recent Activity</h4>
      <div style="display:flex;flex-direction:column;gap:.75rem;">
        ${donations.slice(0, 4).map((donation) => `
          <div style="display:flex;align-items:center;gap:.75rem;font-size:.88rem;">
            <div style="width:38px;height:38px;border-radius:50%;background:var(--blue-light);display:flex;align-items:center;justify-content:center;flex-shrink:0;">${donation.cause?.icon || "SM"}</div>
            <div><div style="font-weight:700;">Supported ${escapeHtml(donation.cause?.title || "a verified cause")}</div><div style="color:var(--text3);font-size:.8rem;">${money(donation.amount)} - ${escapeHtml(donation.status || "pending")}</div></div>
          </div>`).join("")}
      </div>`;
  }

  function renderHistory(donations) {
    const tbody = document.querySelector("#dtab-history tbody");
    if (!tbody) return;
    if (!donations.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-panel">No donation history yet. Be the first supporter.</div></td></tr>`;
      return;
    }
    tbody.innerHTML = donations.map((donation) => {
      const date = donation.createdAt ? new Date(donation.createdAt).toLocaleDateString("en-IN") : "-";
      const status = donation.status || "pending";
      const statusClass = status === "verified" ? "badge-green" : status === "completed" ? "badge-blue" : "badge-orange";
      return `
        <tr>
          <td><div style="font-weight:700;">${donation.cause?.icon || "SM"} ${escapeHtml(donation.cause?.title || "Donation")}</div></td>
          <td style="font-family:'Sora',sans-serif;font-weight:800;">${money(donation.amount)}</td>
          <td style="color:var(--text2);">${date}</td>
          <td><span class="ngo-badge">${escapeHtml(donation.ngo?.name || "Pending NGO assignment")}</span></td>
          <td style="color:var(--text2);font-size:.82rem;">${escapeHtml(donation.ngo?.location || donation.location || "-")}</td>
          <td>${donation.proofVideo ? `<a href="${escapeHtml(donation.proofVideo)}" class="proof-btn" target="_blank">Watch</a>` : `<span style="color:var(--text3);">Awaiting proof</span>`}</td>
          <td><span class="badge ${statusClass}">${escapeHtml(status)}</span></td>
        </tr>`;
    }).join("");
  }

  function renderBadges(user, progression) {
    const progressCard = document.querySelector("#dtab-badges .card");
    if (progressCard) {
      progressCard.innerHTML = `
        <div class="title-card" style="background:${progression.titleGradient || "linear-gradient(135deg,#22c55e,#2563eb)"};">
          <div style="font-size:.8rem;opacity:.82;font-weight:800;">Current Title</div>
          <div style="font-size:1.45rem;font-weight:900;margin:.2rem 0;">${progression.titleIcon || "\u{1F331}"} ${escapeHtml(user.title || progression.title || "Beginner")}</div>
          <div style="font-size:.85rem;opacity:.9;">Level ${user.level || progression.level || 1} - ${compactNumber(user.xp)} XP</div>
        </div>
        <div style="font-size:.85rem;color:var(--text2);margin:1rem 0 .65rem;">${compactNumber(progression.xpIntoLevel)} / ${compactNumber(progression.xpForNextLevel)} XP in this level</div>
        <div class="premium-progress" style="height:12px;"><span style="width:${progression.progress || 0}%"></span></div>`;
    }
    const badgeGrid = document.querySelector("#dtab-badges .badges-grid");
    if (!badgeGrid) return;
    const badges = user.badges || [];
    if (!badges.length) {
      badgeGrid.innerHTML = `<div class="empty-panel" style="grid-column:1/-1;">Badges are empty for now. Real achievements will appear after verified activity.</div>`;
      return;
    }
    badgeGrid.innerHTML = badges.map((badge) => `<div class="badge-item earned"><div class="b-icon">\u{1F3C5}</div><div class="b-name">${escapeHtml(badge)}</div></div>`).join("");
  }

  function renderProgression(progression) {
    const path = document.querySelector("#dtab-gamification .level-path");
    if (!path) return;
    const currentLevel = progression.level || 1;
    path.innerHTML = (progression.ranks || []).map((rank) => {
      const done = currentLevel > rank.maxLevel;
      const current = currentLevel >= rank.minLevel && currentLevel <= rank.maxLevel;
      return `<div class="level-node ${done ? "done" : ""} ${current ? "current" : ""}">
        <div class="l-icon">${rank.icon}</div>
        <div class="l-name">${escapeHtml(rank.title)}</div>
        <div class="l-xp">Level ${rank.minLevel}${Number.isFinite(rank.maxLevel) ? `-${rank.maxLevel}` : "+"}</div>
      </div>`;
    }).join("");
  }

  async function loadLeaderboard(type = "donors") {
    try {
      const rows = await request(`/leaderboard/${type}`);
      state.leaderboard[type] = rows;
      renderLeaderboard(type, rows);
    } catch (_) {
      renderLeaderboard(type, []);
    }
  }

  function renderLeaderboard(type, rows) {
    const target = document.getElementById(type === "ngos" ? "lb-ngos" : "lb-donors");
    if (!target) return;
    if (!Array.isArray(rows) || rows.length === 0) {
      target.innerHTML = `<div class="empty-panel">No community activity yet. Be the first supporter.</div>`;
      return;
    }
    target.innerHTML = rows.map((row, index) => {
      const rank = index === 0 ? "\u{1F947}" : index === 1 ? "\u{1F948}" : index === 2 ? "\u{1F949}" : String(index + 1);
      if (type === "ngos") {
        return `<div class="lb-row">
          <div class="lb-rank">${rank}</div>
          <div class="lb-avatar">${initials(row.name)}</div>
          <div class="flex-1"><div class="lb-name">${escapeHtml(row.name || "NGO")} <span class="verified-tick">✓</span></div><div class="lb-location">${escapeHtml(row.areaOfWork || row.location || "Verified NGO")}</div></div>
          <div style="text-align:right;"><div class="lb-xp">Impact: ${compactNumber(row.impactScore)}</div><div class="lb-count">${compactNumber(row.tasksCompleted)} tasks</div></div>
        </div>`;
      }
      const progression = row.progression || {};
      return `<div class="lb-row">
        <div class="lb-rank">${rank}</div>
        <div class="lb-avatar">${row.avatar ? "" : initials(row.name)}</div>
        <div class="flex-1"><div class="lb-name">${escapeHtml(row.name || "Supporter")}</div><div class="lb-location"><span class="rank-chip" style="background:${progression.titleGradient || "linear-gradient(135deg,#22c55e,#2563eb)"}">${progression.titleIcon || "\u{1F331}"} ${escapeHtml(row.title || progression.title || "Beginner")}</span></div></div>
        <div style="text-align:right;"><div class="lb-xp">${compactNumber(row.xp)} XP</div><div class="lb-count">${compactNumber(row.donationCount)} donations</div></div>
      </div>`;
    }).join("");
  }

  function renderAuthShell() {
    const user = state.auth.user;
    Array.from(document.querySelectorAll("button")).filter((button) => /login/i.test(button.textContent)).forEach((button) => {
      if (!user) return;
      button.textContent = "Logout";
      button.onclick = () => {
        localStorage.removeItem(tokenKey);
        localStorage.removeItem(userKey);
        state.auth = { token: null, user: null };
        location.reload();
      };
    });
  }

  function notify(message) {
    state.notifications.push({ message, at: new Date().toISOString() });
    if (typeof window.showToast === "function") window.showToast(message);
  }

  window.BackendService = {
    request,
    login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }).then((data) => (setSession(data), data)),
    register: (name, email, password) => request("/auth/register", { method: "POST", body: { name, email, password } }).then((data) => (setSession(data), data)),
    donate: (amount, cause) => request("/donate", { method: "POST", body: { amount, cause } }),
    registerNGO: (payload) => request("/auth/ngo/register", { method: "POST", body: payload }),
    updateProfile: (payload) => request("/profile", { method: "PATCH", body: payload }),
    volunteer: (ngoId, payload = {}) => request(`/ngos/${ngoId}/volunteers`, { method: "POST", body: payload }),
  };

  window.loginAction = async function loginAction() {
    const activeTab = document.querySelector("#auth-modal .tab-btn.active")?.textContent || "Login";
    try {
      if (activeTab === "Login") {
        const root = document.getElementById("auth-login");
        await BackendService.login(value('input[type="email"]', root), value('input[type="password"]', root));
      } else {
        const root = document.getElementById("auth-register");
        await BackendService.register(value('input[type="text"]', root), value('input[type="email"]', root), value('input[type="password"]', root));
      }
      closeModal("auth-modal");
      await loadDashboard();
      showPage("dashboard");
      notify("Account synced.");
    } catch (err) {
      notify(`Authentication failed: ${err.message}`);
    }
  };

  window.showDonateSuccess = async function showDonateSuccess() {
    if (!getToken()) {
      notify("Please login before supporting a cause.");
      openAuthModal();
      return;
    }
    const custom = value("#custom-amount");
    const selected = document.querySelector(".amount-btn.active")?.textContent || "";
    const amount = custom ? Number(custom) : Number(selected.replace(/[^\d]/g, "")) || 50;
    const cause = value("#donate-cause");
    try {
      const result = await BackendService.donate(amount, cause);
      state.payment.lastDonation = result.donation;
      document.getElementById("success-amount").textContent = money(result.donation?.amount || amount);
      const xpBadge = document.querySelector("#donate-step2 .badge");
      if (xpBadge) xpBadge.textContent = `+${compactNumber(result.donation?.xpEarned || amount)} XP`;
      document.getElementById("donate-step1").style.display = "none";
      document.getElementById("donate-step2").style.display = "";
      await Promise.all([loadDashboard(), loadCauses(), loadLeaderboard("donors")]);
    } catch (err) {
      notify(`Donation failed: ${err.message}`);
    }
  };

  window.switchLB = function switchLB(type, btn) {
    document.querySelectorAll(".lb-tab").forEach((button) => button.classList.remove("active"));
    if (btn) btn.classList.add("active");
    document.getElementById("lb-donors").style.display = type === "donors" ? "" : "none";
    document.getElementById("lb-ngos").style.display = type === "ngos" ? "" : "none";
    loadLeaderboard(type);
  };

  window.openUserProfile = function openUserProfile(id) {
    const user = (state.leaderboard.donors || []).find((row) => row._id === id || row.id === id || row.name === id) || state.auth.user;
    if (!user) return;
    const progression = user.progression || {};
    document.getElementById("upm-avatar").textContent = initials(user.name);
    document.getElementById("upm-avatar").style.background = progression.titleGradient || "linear-gradient(135deg,var(--blue),var(--orange))";
    document.getElementById("upm-name").textContent = user.name || "Supporter";
    document.getElementById("upm-sub").textContent = `Level ${user.level || progression.level || 1} | ${user.title || progression.title || "Beginner"} | ${compactNumber(user.xp)} XP`;
    document.getElementById("upm-stats").innerHTML = [
      { n: compactNumber(user.totalDonated, { money: true }), l: "Total Donated" },
      { n: compactNumber(user.xp), l: "XP" },
      { n: compactNumber(user.donationCount), l: "Donations" },
      { n: user.title || progression.title || "Beginner", l: "Title" },
    ].map((s) => `<div class="pm-stat"><div class="n">${escapeHtml(s.n)}</div><div class="l">${escapeHtml(s.l)}</div></div>`).join("");
    document.getElementById("upm-badges").innerHTML = (user.badges || []).length
      ? user.badges.map((badge) => `<span class="badge badge-blue">${escapeHtml(badge)}</span>`).join("")
      : `<div class="empty-panel">No achievements yet.</div>`;
    document.getElementById("upm-history").innerHTML = `<div class="title-card" style="background:${progression.titleGradient || "linear-gradient(135deg,#22c55e,#2563eb)"};"><div style="font-size:1.25rem;font-weight:900;">${progression.titleIcon || "\u{1F331}"} ${escapeHtml(user.title || progression.title || "Beginner")}</div><div>Real XP based rank</div></div>`;
    openModal("user-profile-modal");
  };

  document.addEventListener("DOMContentLoaded", async () => {
    injectStyles();
    window.ServeMateState = state;
    clearDemoShell();
    renderAuthShell();
    await Promise.all([loadStats(), loadCauses(), loadDashboard(), loadLeaderboard("donors")]);
  });
})();
