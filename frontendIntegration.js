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
    ngos: [],
    admin: { causes: [] },
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
      .empty-panel strong { display:block; color:var(--text); margin-bottom:.35rem; }
      .empty-panel span { display:block; line-height:1.55; }
      .real-proof-card, .real-ngo-card {
        border:1px solid var(--border); border-radius:20px; padding:1rem; background:var(--card);
        box-shadow:0 18px 60px rgba(15,23,42,.08); transition:transform .22s ease, box-shadow .22s ease;
      }
      .real-proof-card:hover, .real-ngo-card:hover { transform:translateY(-4px); box-shadow:0 26px 80px rgba(15,23,42,.14); }
      .real-proof-meta, .real-ngo-meta { color:var(--text2); font-size:.86rem; line-height:1.6; }
      .admin-shell { display:grid; grid-template-columns: 260px minmax(0,1fr); gap:1.2rem; align-items:start; }
      .admin-sidebar { position:sticky; top:86px; border:1px solid var(--border); border-radius:22px; padding:1rem; background:linear-gradient(180deg,var(--card),color-mix(in srgb,var(--bg2) 70%,var(--card))); box-shadow:0 22px 70px rgba(15,23,42,.08); }
      .admin-action { width:100%; display:flex; align-items:center; justify-content:space-between; gap:.75rem; border:1px solid var(--border); background:var(--card); color:var(--text); padding:.75rem .85rem; border-radius:14px; font-weight:800; cursor:pointer; margin-bottom:.55rem; }
      .admin-action:hover { border-color:var(--blue); transform:translateY(-1px); }
      .admin-panel-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:1rem; }
      .admin-stat-card { border:1px solid var(--border); border-radius:20px; padding:1rem; background:var(--card); box-shadow:0 16px 45px rgba(15,23,42,.07); }
      .admin-stat-card .label { color:var(--text2); font-size:.78rem; text-transform:uppercase; letter-spacing:.06em; font-weight:850; }
      .admin-stat-card .value { font-size:1.55rem; font-weight:950; margin-top:.35rem; }
      .admin-section { border:1px solid var(--border); border-radius:22px; background:var(--card); box-shadow:0 20px 65px rgba(15,23,42,.08); padding:1rem; margin-top:1rem; }
      .admin-section-head { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; margin-bottom:1rem; flex-wrap:wrap; }
      .admin-section h4 { font-size:1rem; font-weight:900; margin:0 0 .2rem; }
      .admin-muted { color:var(--text2); font-size:.84rem; line-height:1.55; }
      .admin-list { display:flex; flex-direction:column; gap:.7rem; }
      .admin-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:1rem; align-items:center; border:1px solid var(--border); background:color-mix(in srgb,var(--bg2) 60%,var(--card)); border-radius:16px; padding:.85rem; }
      .admin-row-title { font-weight:900; margin-bottom:.2rem; }
      .admin-row-meta { color:var(--text2); font-size:.82rem; line-height:1.5; }
      .admin-form { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.75rem; }
      .admin-form .full { grid-column:1/-1; }
      .proof-admin-form { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:.5rem; margin-top:.7rem; }
      .proof-admin-form input { padding:.65rem .75rem; border:1px solid var(--border); border-radius:10px; background:var(--bg); color:var(--text); }
      .title-card { padding:1rem; border-radius:20px; color:#fff; position:relative; overflow:hidden; box-shadow:0 22px 70px rgba(79,70,229,.24); }
      .title-card::before { content:""; position:absolute; inset:-2px; background:linear-gradient(120deg, rgba(255,255,255,.42), transparent 34%, rgba(255,255,255,.24)); animation: sm-sheen 3s linear infinite; }
      .title-card > * { position:relative; }
      .sm-skeleton { opacity:.75; }
      @keyframes sm-sheen { from { transform: translateX(-80%); } to { transform: translateX(80%); } }
      @media (max-width: 900px) { .admin-shell { grid-template-columns:1fr; } .admin-sidebar { position:static; } }
      @media (max-width: 720px) { .premium-cause-card { min-height: auto; } .cause-visual { height: 112px; } .lb-row { align-items:flex-start; } .admin-row { grid-template-columns:1fr; } .admin-form, .proof-admin-form { grid-template-columns:1fr; } }
    `;
    document.head.appendChild(style);
  }

  function clearDemoShell() {
    renderCauses(document.getElementById("causes-grid"), []);
    renderLeaderboard("donors", []);
    renderLeaderboard("ngos", []);
    renderTransparency([]);
    renderNGOs([]);
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
    populateDonationCauses();
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
    const canSupport = !cause.isPlaceholder && cause._id && cause.assignedNgo && cause.assignedNgo.verified;
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
            <button class="btn btn-primary" ${canSupport ? `onclick="openDonateModal('${cause._id}')"` : "disabled"}>${canSupport ? "Support" : "Awaiting approved NGO"}</button>
          </div>
        ` : `
          <div class="cause-empty-state">
            <div>${escapeHtml(cause.empty || "No community activity yet")}</div>
            <div style="font-size:.8rem;font-weight:600;margin-top:.25rem;">No community activity yet</div>
          </div>
          <div class="cause-footer">
            <span style="font-size:.8rem;color:var(--text2);">${canSupport ? "Be the first supporter" : "Admin approval required"}</span>
            <button class="btn btn-primary" ${canSupport ? `onclick="openDonateModal('${cause._id}')"` : "disabled"}>${canSupport ? "Support" : "Coming soon"}</button>
          </div>
        `}
      </article>
    `;
  }

  function realDonationCauses() {
    return (state.causes || []).filter((cause) => !cause.isPlaceholder && cause._id && cause.assignedNgo && cause.assignedNgo.verified);
  }

  function populateDonationCauses(selectedId = "") {
    const select = document.getElementById("donate-cause");
    if (!select) return;
    const causes = realDonationCauses();
    if (!causes.length) {
      select.innerHTML = `<option value="">No approved NGO causes available yet</option>`;
      select.disabled = true;
      return;
    }
    select.disabled = false;
    select.innerHTML = causes.map((cause) => `<option value="${escapeHtml(cause._id)}">${escapeHtml(cause.title)}${cause.assignedNgo?.name ? ` - ${escapeHtml(cause.assignedNgo.name)}` : ""}</option>`).join("");
    if (selectedId && causes.some((cause) => String(cause._id) === String(selectedId))) select.value = selectedId;
  }

  window.openDonateModal = function openDonateModal(causeId = "") {
    document.getElementById("donate-step1").style.display = "";
    document.getElementById("donate-step2").style.display = "none";
    populateDonationCauses(causeId);
    if (typeof updateImpact === "function") updateImpact();
    openModal("donate-modal");
  };

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

  async function loadTransparency() {
    try {
      const payload = await request("/transparency");
      renderTransparency(Array.isArray(payload) ? payload : payload.logs || []);
    } catch (_) {
      renderTransparency([]);
    }
  }

  function renderTransparency(logs) {
    const feed = document.getElementById("transparency-feed");
    if (!feed) return;
    if (!Array.isArray(logs) || logs.length === 0) {
      feed.innerHTML = `<div class="empty-panel"><strong>No verified proof videos yet</strong><span>Real NGO proof will appear here after an approved NGO completes work and an admin verifies the uploaded video.</span></div>`;
      return;
    }
    feed.innerHTML = logs.map((log) => {
      const date = log.createdAt ? new Date(log.createdAt).toLocaleDateString("en-IN") : "Verified";
      const title = log.title || log.cause?.title || "Verified impact proof";
      const ngoName = log.ngo?.name || "Verified NGO";
      const location = log.location || log.ngo?.location || "Verified location";
      const description = log.description || "Admin-verified proof uploaded by the NGO.";
      const proof = log.proofVideo ? `<a class="proof-btn" href="${escapeHtml(log.proofVideo)}" target="_blank" rel="noopener">Watch proof</a>` : `<span style="color:var(--text3);">Proof processing</span>`;
      return `<article class="real-proof-card">
        <div style="display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;flex-wrap:wrap;">
          <div>
            <h4 style="margin:0 0 .4rem;font-size:1rem;font-weight:850;">${escapeHtml(title)}</h4>
            <div class="real-proof-meta">${escapeHtml(date)} | ${escapeHtml(location)} | ${escapeHtml(ngoName)}</div>
          </div>
          ${proof}
        </div>
        <p style="margin:.85rem 0 0;color:var(--text2);line-height:1.65;">${escapeHtml(description)}</p>
      </article>`;
    }).join("");
  }

  async function loadNGOs() {
    try {
      const ngos = await request("/ngos");
      state.ngos = Array.isArray(ngos) ? ngos : [];
      renderNGOs(state.ngos);
    } catch (_) {
      state.ngos = [];
      renderNGOs([]);
    }
  }

  function renderNGOs(ngos) {
    const grid = document.getElementById("ngo-grid");
    if (!grid) return;
    if (!Array.isArray(ngos) || ngos.length === 0) {
      grid.innerHTML = `<div class="empty-panel" style="grid-column:1/-1;"><strong>No approved NGOs yet</strong><span>Approved NGO registrations from MongoDB will appear here after admin verification.</span></div>`;
      return;
    }
    grid.innerHTML = ngos.map((ngo) => {
      const areas = Array.isArray(ngo.causesManaged) && ngo.causesManaged.length
        ? ngo.causesManaged.join(", ")
        : (ngo.areaOfWork || "Verified community work");
      return `<article class="real-ngo-card">
        <div style="display:flex;align-items:center;gap:.85rem;margin-bottom:.85rem;">
          <div class="lb-avatar">${ngo.logo ? "" : initials(ngo.name)}</div>
          <div>
            <div style="font-weight:900;">${escapeHtml(ngo.name || "Verified NGO")} <span class="verified-tick">✓</span></div>
            <div class="real-ngo-meta">${escapeHtml(ngo.location || "Location pending")}</div>
          </div>
        </div>
        <p style="color:var(--text2);line-height:1.65;margin:.5rem 0 1rem;">${escapeHtml(ngo.about || areas)}</p>
        <div class="real-ngo-meta">Impact score: ${compactNumber(ngo.impactScore)} | Completed tasks: ${compactNumber(ngo.tasksCompleted)} | Volunteers: ${compactNumber(ngo.volunteerCount || 0)}</div>
        <button class="btn btn-outline btn-full" style="margin-top:1rem;" onclick="openNGOProfile('${escapeHtml(ngo._id || "")}')">View NGO</button>
      </article>`;
    }).join("");
  }

  window.openNGOProfile = function openNGOProfile(id) {
    const ngo = (state.ngos || []).find((row) => String(row._id || row.id) === String(id));
    if (!ngo) {
      notify("NGO profile is available after real NGO data loads.");
      return;
    }
    document.getElementById("npm-icon").textContent = initials(ngo.name);
    document.getElementById("npm-name").textContent = `${ngo.name || "Verified NGO"} ✓`;
    document.getElementById("npm-location").textContent = ngo.location || "Location pending";
    document.getElementById("npm-rating").innerHTML = `<span style="color:var(--orange);font-size:.85rem;">${Number(ngo.rating || 0).toFixed(1)} rating</span>`;
    document.getElementById("npm-stats").innerHTML = [
      { n: compactNumber(ngo.tasksCompleted), l: "Tasks" },
      { n: compactNumber(ngo.volunteerCount || 0), l: "Volunteers" },
      { n: compactNumber(ngo.impactScore), l: "Impact" },
    ].map((s) => `<div class="pm-stat"><div class="n">${escapeHtml(s.n)}</div><div class="l">${escapeHtml(s.l)}</div></div>`).join("");
    document.getElementById("npm-motive").textContent = ngo.about || ngo.description || ngo.areaOfWork || "Approved NGO profile from MongoDB.";
    document.getElementById("npm-badges").innerHTML = `<span class="badge badge-green">Verified NGO</span>${ngo.areaOfWork ? `<span class="badge badge-blue">${escapeHtml(ngo.areaOfWork)}</span>` : ""}`;
    document.getElementById("npm-vol-count").textContent = compactNumber(ngo.volunteerCount || 0);
    document.getElementById("npm-volunteers").innerHTML = `<div class="empty-panel">Volunteer details appear after real approved requests.</div>`;
    document.getElementById("npm-videos").innerHTML = `<div class="empty-panel">Verified proof videos appear from public transparency records.</div>`;
    openModal("ngo-profile-modal");
  };

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
    ensureAdminNavigation();
  }

  function ensureAdminNavigation() {
    const user = state.auth.user || readUser();
    const adminPage = document.getElementById("page-admin");
    const nav = document.querySelector(".nav-links");
    const mobile = document.getElementById("mobile-menu");
    document.querySelectorAll("[data-admin-nav]").forEach((node) => node.remove());
    if (!user || user.role !== "admin" || !adminPage) return;
    if (nav) {
      const item = document.createElement("li");
      item.setAttribute("data-admin-nav", "true");
      item.innerHTML = `<button class="nav-btn btn-nav-cta" onclick="showPage('admin');loadAdminPanel()">Admin Panel</button>`;
      nav.appendChild(item);
    }
    if (mobile) {
      const button = document.createElement("button");
      button.setAttribute("data-admin-nav", "true");
      button.className = "cta";
      button.textContent = "Admin Panel";
      button.onclick = () => {
        closeMobileMenu();
        showPage("admin");
        loadAdminPanel();
      };
      mobile.appendChild(button);
    }
  }

  function notify(message) {
    state.notifications.push({ message, at: new Date().toISOString() });
    if (typeof window.showToast === "function") window.showToast(message);
  }

  window.BackendService = {
    request,
    login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }).then((data) => (setSession(data), data)),
    register: (name, email, password) => request("/auth/register", { method: "POST", body: { name, email, password } }).then((data) => (setSession(data), data)),
    donate: (amount, causeId) => request("/donate", { method: "POST", body: { amount, causeId } }),
    paymentConfig: () => request("/payments/config"),
    createPaymentOrder: (amount, causeId) => request("/payments/order", { method: "POST", body: { amount, causeId } }),
    verifyPayment: (payload) => request("/payments/verify", { method: "POST", body: payload }),
    registerNGO: (payload) => request("/auth/ngo/register", { method: "POST", body: payload }),
    updateProfile: (payload) => request("/profile", { method: "PATCH", body: payload }),
    volunteer: (ngoId, payload = {}) => request(`/ngos/${ngoId}/volunteers`, { method: "POST", body: payload }),
    contact: (payload) => request("/contact", { method: "POST", body: payload }),
    transparency: () => request("/transparency"),
    ngos: () => request("/ngos"),
    adminOverview: () => request("/admin/overview"),
    adminPendingNgos: () => request("/admin/ngos/pending"),
    adminAllNgos: () => request("/admin/ngos/all"),
    adminCauses: () => request("/admin/causes"),
    adminCreateCause: (payload) => request("/admin/causes", { method: "POST", body: payload }),
    adminVerifyNgo: (id) => request(`/admin/ngos/${id}/verify`, { method: "PATCH" }),
    adminRemoveNgo: (id) => request(`/admin/ngos/${id}`, { method: "DELETE" }),
    adminUsers: () => request("/admin/users"),
    adminDonations: () => request("/admin/donations"),
    adminContacts: () => request("/admin/contacts"),
    adminMarkContactRead: (id) => request(`/admin/contacts/${id}/read`, { method: "PATCH", body: {} }),
    adminCompleteDonation: (id, payload) => request(`/admin/donations/${id}/complete`, { method: "PATCH", body: payload }),
    adminVerifyDonation: (id) => request(`/admin/donations/${id}/verify`, { method: "PATCH", body: {} }),
    adminResetUser: (id) => request(`/admin/users/${id}/reset-activity`, { method: "POST", body: {} }),
    adminResetAll: () => request("/admin/reset/all-activity", { method: "POST", body: { confirmation: "RESET_ALL_ACTIVITY" } }),
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

  function loadRazorpayScript() {
    return new Promise((resolve, reject) => {
      if (window.Razorpay) return resolve();
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Unable to load Razorpay checkout"));
      document.head.appendChild(script);
    });
  }

  window.showDonateSuccess = async function showDonateSuccess() {
    if (!getToken()) {
      notify("Please login before supporting a cause.");
      openAuthModal();
      return;
    }
    const custom = value("#custom-amount");
    const selected = document.querySelector(".amount-btn.active")?.textContent || "";
    const amount = custom ? Number(custom) : Number(selected.replace(/[^\d]/g, "")) || 50;
    const causeSelect = document.getElementById("donate-cause");
    const cause = causeSelect?.value || "";
    if (!cause) {
      notify("Please select a cause before donating.");
      causeSelect?.focus();
      return;
    }
    if (!Number.isFinite(amount) || amount < 10) {
      notify("Minimum donation amount is Rs 10.");
      return;
    }
    const button = document.querySelector("#donate-step1 .btn-primary.btn-full");
    const originalText = button?.textContent;
    try {
      if (button) {
        button.disabled = true;
        button.textContent = "Processing payment...";
      }
      const paymentConfig = await BackendService.paymentConfig();
      if (!paymentConfig.enabled) {
        throw new Error("Razorpay is not configured on the server");
      }
      const order = await BackendService.createPaymentOrder(amount, cause);
      await loadRazorpayScript();
      const result = await new Promise((resolve, reject) => {
        const checkout = new window.Razorpay({
          key: order.keyId,
          amount: order.amount * 100,
          currency: order.currency || "INR",
          name: "ServeMATE",
          description: order.cause?.title || "Verified cause donation",
          order_id: order.orderId,
          handler: async (response) => {
            try {
              resolve(await BackendService.verifyPayment({ ...response, causeId: cause, amount }));
            } catch (err) {
              reject(err);
            }
          },
          modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
          theme: { color: "#2563eb" },
        });
        checkout.open();
      });
      state.payment.lastDonation = result.donation;
      document.getElementById("success-amount").textContent = money(result.donation?.amount || amount);
      const successCause = document.querySelector("#donate-step2 strong:last-of-type");
      if (successCause) successCause.textContent = causeSelect.options[causeSelect.selectedIndex]?.textContent?.replace(/^[^\w]+/, "").trim() || "selected cause";
      const xpBadge = document.querySelector("#donate-step2 .badge");
      if (xpBadge) xpBadge.textContent = `+${compactNumber(result.donation?.xpEarned || amount)} XP`;
      document.getElementById("donate-step1").style.display = "none";
      document.getElementById("donate-step2").style.display = "";
      await Promise.all([loadDashboard(), loadCauses(), loadLeaderboard("donors")]);
    } catch (err) {
      notify(err.message.includes("Razorpay is not configured")
        ? "Payment gateway is not configured yet. Add Razorpay keys on the server before accepting donations."
        : `Donation failed: ${err.message}`);
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText || "Donate Now";
      }
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

  window.loadAdminPanel = async function loadAdminPanel() {
    if ((state.auth.user || readUser())?.role !== "admin") {
      notify("Admin login required.");
      return;
    }
    try {
      const [overview, pending, allNgos, users, donationData, causes, contacts] = await Promise.all([
        BackendService.adminOverview(),
        BackendService.adminPendingNgos(),
        BackendService.adminAllNgos(),
        BackendService.adminUsers(),
        BackendService.adminDonations(),
        BackendService.adminCauses(),
        BackendService.adminContacts(),
      ]);
      state.admin.causes = causes || [];
      const causeNgoSelect = document.getElementById("admin-cause-ngo");
      if (causeNgoSelect) {
        const approved = (allNgos || []).filter((ngo) => ngo.verified);
        causeNgoSelect.innerHTML = approved.length
          ? approved.map((ngo) => `<option value="${escapeHtml(ngo._id)}">${escapeHtml(ngo.name)} - ${escapeHtml(ngo.location || "Approved")}</option>`).join("")
          : `<option value="">No approved NGOs available</option>`;
      }
      const overviewEl = document.getElementById("admin-overview");
      if (overviewEl) {
        overviewEl.innerHTML = [
          ["Users", overview.totalUsers],
          ["Approved NGOs", overview.verifiedNGOs],
          ["Pending NGOs", overview.pendingNGOs],
          ["Verified Donations", overview.totalDonations],
          ["Real Donations", donationData.total || 0],
          ["Live Causes", causes.length || 0],
          ["Unread Messages", overview.unreadMessages || 0],
        ].map(([label, value]) => `<div class="admin-stat-card"><div class="label">${label}</div><div class="value">${compactNumber(value)}</div></div>`).join("");
      }
      const causesEl = document.getElementById("admin-causes");
      if (causesEl) {
        causesEl.innerHTML = causes.length
          ? causes.map((cause) => `
            <div class="admin-row">
              <div>
                <div class="admin-row-title">${escapeHtml(cause.title)} <span class="badge ${cause.active ? "badge-green" : "badge-orange"}">${cause.active ? "Active" : "Paused"}</span></div>
                <div class="admin-row-meta">${escapeHtml(cause.category)} | Goal ${compactNumber(cause.goal, { money: true })} | Raised ${compactNumber(cause.raised, { money: true })} | NGO: ${escapeHtml(cause.assignedNgo?.name || "Unassigned")}</div>
              </div>
            </div>`).join("")
          : `<div class="empty-panel"><strong>No causes yet</strong><span>Create a real cause and assign it to an approved NGO to unlock donations.</span></div>`;
      }
      const pendingEl = document.getElementById("admin-pending-ngos");
      if (pendingEl) {
        pendingEl.innerHTML = pending.length
          ? pending.map((ngo) => `
            <div class="admin-row">
              <div>
                <div class="admin-row-title">${escapeHtml(ngo.name)}</div>
                <div class="admin-row-meta">${escapeHtml(ngo.email)} - ${escapeHtml(ngo.areaOfWork || "NGO")}</div>
              </div>
              <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
                <button class="btn btn-primary" onclick="approveNgo('${ngo._id}')">Approve</button>
                <button class="btn btn-outline" onclick="removeNgo('${ngo._id}')">Remove</button>
              </div>
            </div>`).join("")
          : `<div class="empty-panel">No pending NGO approvals.</div>`;
      }
      const allNgosEl = document.getElementById("admin-all-ngos");
      if (allNgosEl) {
        allNgosEl.innerHTML = allNgos.length
          ? allNgos.map((ngo) => `
            <div class="admin-row">
              <div>
                <div class="admin-row-title">${escapeHtml(ngo.name)} <span class="badge ${ngo.verified ? "badge-green" : "badge-orange"}">${ngo.verified ? "Approved" : "Pending"}</span></div>
                <div class="admin-row-meta">${escapeHtml(ngo.email)} - ${compactNumber(ngo.totalReceived || 0, { money: true })} received</div>
              </div>
              <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
                ${ngo.verified ? "" : `<button class="btn btn-primary" onclick="approveNgo('${ngo._id}')">Approve</button>`}
                <button class="btn btn-outline" onclick="removeNgo('${ngo._id}')">Remove</button>
              </div>
            </div>`).join("")
          : `<div class="empty-panel">No NGO registrations found.</div>`;
      }
      const usersEl = document.getElementById("admin-users");
      if (usersEl) {
        usersEl.innerHTML = users.length
          ? users.map((user) => `
            <div class="admin-row">
              <div><div class="admin-row-title">${escapeHtml(user.name)} <span class="badge badge-blue">${escapeHtml(user.role || "user")}</span></div><div class="admin-row-meta">${escapeHtml(user.email)} - ${compactNumber(user.xp)} XP - ${compactNumber(user.totalDonated, { money: true })} donated</div></div>
              <button class="btn btn-outline" onclick="resetUserActivity('${user._id}')">Reset</button>
            </div>`).join("")
          : `<div class="empty-panel">No users found.</div>`;
      }
      const donationsEl = document.getElementById("admin-donations");
      if (donationsEl) {
        const donations = donationData.donations || [];
        donationsEl.innerHTML = donations.length
          ? donations.map((donation) => `
            <div class="admin-row">
              <div>
                <div class="admin-row-title">${escapeHtml(donation.user?.name || "User")} - ${compactNumber(donation.amount, { money: true })} <span class="badge ${donation.status === "verified" ? "badge-green" : "badge-blue"}">${escapeHtml(donation.status)}</span></div>
                <div class="admin-row-meta">${escapeHtml(donation.cause?.title || "Cause")} - ${escapeHtml(donation.ngo?.name || "NGO")} - ${escapeHtml(donation.paymentProvider || "record")}</div>
                ${donation.status === "verified" ? `<div class="admin-row-meta">Public proof verified.</div>` : `
                  <div class="proof-admin-form">
                    <input id="proof-url-${donation._id}" placeholder="Proof video URL" value="${escapeHtml(donation.proofVideo || "")}">
                    <input id="proof-note-${donation._id}" placeholder="Proof note" value="${escapeHtml(donation.proofNote || "")}">
                    <input id="proof-location-${donation._id}" placeholder="Location" value="${escapeHtml(donation.location || "")}">
                  </div>`}
              </div>
              <div style="display:flex;gap:.5rem;flex-wrap:wrap;justify-content:flex-end;">
                ${donation.status === "verified" ? "" : `<button class="btn btn-outline" onclick="completeDonationProof('${donation._id}')">Save Proof</button><button class="btn btn-primary" onclick="verifyDonationProof('${donation._id}')">Verify</button>`}
              </div>
            </div>`).join("")
          : `<div class="empty-panel">No real donations found.</div>`;
      }
      const contactsEl = document.getElementById("admin-contacts");
      if (contactsEl) {
        contactsEl.innerHTML = contacts.length
          ? contacts.map((contact) => `
            <div class="admin-row">
              <div>
                <div class="admin-row-title">${escapeHtml(contact.name)} <span class="badge ${contact.read ? "badge-blue" : "badge-orange"}">${contact.read ? "Read" : "Unread"}</span></div>
                <div class="admin-row-meta">${escapeHtml(contact.email)} - ${escapeHtml(contact.message)}</div>
              </div>
              <div style="display:flex;gap:.5rem;flex-wrap:wrap;justify-content:flex-end;">
                ${contact.read ? "" : `<button class="btn btn-outline" onclick="markContactRead('${contact._id}')">Mark Read</button>`}
              </div>
            </div>`).join("")
          : `<div class="empty-panel">No contact messages found.</div>`;
      }
    } catch (err) {
      notify(`Admin panel unavailable: ${err.message}`);
    }
  };

  window.approveNgo = async function approveNgo(id) {
    await BackendService.adminVerifyNgo(id);
    notify("NGO approved.");
    await loadAdminPanel();
    await Promise.all([loadCauses(), loadLeaderboard("ngos"), loadStats()]);
  };

  window.removeNgo = async function removeNgo(id) {
    if (!confirm("Remove this NGO registration from MongoDB?")) return;
    await BackendService.adminRemoveNgo(id);
    notify("NGO removed.");
    await loadAdminPanel();
    await Promise.all([loadCauses(), loadLeaderboard("ngos"), loadStats()]);
  };

  window.resetUserActivity = async function resetUserActivity(id) {
    if (!confirm("Reset this user's transactions, XP, badges, and totals?")) return;
    await BackendService.adminResetUser(id);
    notify("User activity reset.");
    await loadAdminPanel();
    await Promise.all([loadDashboard(), loadLeaderboard("donors"), loadStats(), loadCauses()]);
  };

  window.createAdminCause = async function createAdminCause() {
    const payload = {
      title: value("#admin-cause-title"),
      category: value("#admin-cause-category"),
      goal: Number(value("#admin-cause-goal")),
      assignedNgo: value("#admin-cause-ngo"),
      description: value("#admin-cause-description"),
      impactPerRupee: value("#admin-cause-impact"),
      icon: "SM",
    };
    try {
      await BackendService.adminCreateCause(payload);
      notify("Cause created and connected to approved NGO.");
      ["#admin-cause-title", "#admin-cause-goal", "#admin-cause-description", "#admin-cause-impact"].forEach((selector) => {
        const node = document.querySelector(selector);
        if (node) node.value = "";
      });
      await Promise.all([loadAdminPanel(), loadCauses()]);
    } catch (err) {
      notify(`Cause creation failed: ${err.message}`);
    }
  };

  window.completeDonationProof = async function completeDonationProof(id) {
    const payload = {
      proofVideo: value(`#proof-url-${id}`),
      proofNote: value(`#proof-note-${id}`),
      location: value(`#proof-location-${id}`),
    };
    try {
      await BackendService.adminCompleteDonation(id, payload);
      notify("Proof saved for donation.");
      await loadAdminPanel();
    } catch (err) {
      notify(`Proof save failed: ${err.message}`);
    }
  };

  window.verifyDonationProof = async function verifyDonationProof(id) {
    const payload = {
      proofVideo: value(`#proof-url-${id}`),
      proofNote: value(`#proof-note-${id}`),
      location: value(`#proof-location-${id}`),
    };
    try {
      await BackendService.adminCompleteDonation(id, payload);
      await BackendService.adminVerifyDonation(id);
      notify("Donation proof verified and published.");
      await Promise.all([loadAdminPanel(), loadTransparency(), loadStats(), loadLeaderboard("ngos")]);
    } catch (err) {
      notify(`Verification failed: ${err.message}`);
    }
  };

  window.markContactRead = async function markContactRead(id) {
    try {
      await BackendService.adminMarkContactRead(id);
      notify("Message marked as read.");
      await loadAdminPanel();
    } catch (err) {
      notify(`Contact update failed: ${err.message}`);
    }
  };

  window.submitNGORegistration = async function submitNGORegistration() {
    const payload = {
      name: value("#ngo-name"),
      regNumber: value("#ngo-reg"),
      email: value("#ngo-email"),
      password: value("#ngo-password"),
      taxStatus: value("#ngo-tax"),
      areaOfWork: value("#ngo-area"),
      location: value("#ngo-location"),
      volunteerCount: Number(value("#ngo-volunteers")) || 0,
      description: value("#ngo-description"),
    };
    try {
      await BackendService.registerNGO(payload);
      closeModal("ngo-modal");
      notify("NGO application submitted for admin approval.");
    } catch (err) {
      notify(`NGO registration failed: ${err.message}`);
    }
  };

  window.submitContactMessage = async function submitContactMessage() {
    const payload = {
      name: value("#contact-name"),
      email: value("#contact-email"),
      message: value("#contact-message"),
    };
    try {
      await BackendService.contact(payload);
      ["#contact-name", "#contact-email", "#contact-message"].forEach((selector) => {
        const node = document.querySelector(selector);
        if (node) node.value = "";
      });
      notify("Message sent. It is saved for the admin team.");
    } catch (err) {
      notify(`Message failed: ${err.message}`);
    }
  };

  document.addEventListener("DOMContentLoaded", async () => {
    injectStyles();
    window.ServeMateState = state;
    clearDemoShell();
    renderAuthShell();
    await Promise.all([loadStats(), loadCauses(), loadDashboard(), loadLeaderboard("donors"), loadLeaderboard("ngos"), loadTransparency(), loadNGOs()]);
  });
})();
