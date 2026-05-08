(function () {
  const API_BASE = window.SERVEMATE_API_BASE_URL || "https://servemate.onrender.com/api";
  const tokenKey = "servemate_token";
  const userKey = "servemate_user";

  const getToken = () => localStorage.getItem(tokenKey) || localStorage.getItem("sm_token");
  const setToken = (token) => {
    localStorage.setItem(tokenKey, token);
    localStorage.setItem("sm_token", token);
  };
  const clearToken = () => {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem("sm_token");
  };
  const savedUser = () => {
    try {
      return JSON.parse(localStorage.getItem(userKey) || localStorage.getItem("sm_user") || "null");
    } catch {
      return null;
    }
  };
  const saveUser = (user) => {
    localStorage.setItem(userKey, JSON.stringify(user));
    localStorage.setItem("sm_user", JSON.stringify(user));
  };
  const clearUser = () => {
    localStorage.removeItem(userKey);
    localStorage.removeItem("sm_user");
  };

  async function request(path, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
      if (response.status === 401) {
        clearToken();
        clearUser();
        updateNav();
      }
      throw new Error(data.error || data.message || "Request failed");
    }
    return data;
  }

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
  const value = (selector, root = document) => root?.querySelector(selector)?.value?.trim() || "";
  const number = (value) => Number(value || 0).toLocaleString("en-IN");
  const initials = (name) => String(name || "SM").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "SM";
  const toast = (message) => window.showToast ? window.showToast(message) : alert(message);
  const publicNav = [
    { label: "Home", page: "home" },
    { label: "What is ServeMate", page: "about" },
    { label: "Transparency", page: "transparency" },
    { label: "NGOs", page: "ngos" },
    { label: "Leaderboard", page: "leaderboard" },
    { label: "Contact", page: "contact" },
  ];

  function navItems(user) {
    const items = [...publicNav];
    if (!user) {
      return [
        ...items,
        { label: "Login", action: "openAuthModal()" },
        { label: "Register", action: "ServeMATE.openRegister()", cta: true },
      ];
    }
    items.push({ label: "Dashboard", page: "dashboard" });
    if (user.role === "admin") items.push({ label: "Admin Panel", page: "admin", cta: true });
    items.push({ label: "Profile", page: "dashboard" }, { label: "Logout", action: "ServeMATE.logout()" });
    return items;
  }

  function renderNavButton(item, mobile = false) {
    const classes = mobile ? (item.cta ? ` class="cta"` : "") : ` class="nav-btn${item.cta ? " btn-nav-cta" : ""}"`;
    const action = item.page ? `${mobile ? "mobileNav" : "showPage"}('${item.page}')` : item.action;
    return mobile
      ? `<button data-sm-nav${classes} onclick="${action}">${esc(item.label)}</button>`
      : `<li data-sm-nav><button${classes} onclick="${action}">${esc(item.label)}</button></li>`;
  }

  function emptyState(title, body) {
    return `<div class="card sm-empty"><h4>${esc(title)}</h4><p>${esc(body)}</p></div>`;
  }

  function updateNav() {
    const user = savedUser();
    const nav = document.querySelector(".nav-links");
    if (nav) {
      nav.innerHTML = navItems(user).map((item) => renderNavButton(item)).join("");
    }

    const mobile = document.getElementById("mobile-menu");
    if (mobile) {
      mobile.innerHTML = navItems(user).map((item) => renderNavButton(item, true)).join("");
    }
  }

  async function restoreSession() {
    if (!getToken()) {
      updateNav();
      return null;
    }
    try {
      const data = await request("/auth/me");
      saveUser(data.user);
      updateNav();
      return data.user;
    } catch {
      return null;
    }
  }

  function protectPage(page) {
    if ((page === "dashboard" || page === "admin") && !getToken()) {
      toast("Please log in to continue.");
      window.openAuthModal?.();
      return false;
    }
    const user = savedUser();
    if (page === "admin" && user?.role !== "admin") {
      toast("Admin access required.");
      return false;
    }
    return true;
  }

  function patchShowPage() {
    const original = window.showPage;
    if (typeof original !== "function") return;
    window.showPage = function patchedShowPage(page) {
      if (!protectPage(page)) return;
      original(page);
      if (page === "dashboard") loadDashboard();
      if (page === "leaderboard") loadLeaderboard("donors");
      if (page === "ngos") loadNGOs();
      if (page === "admin") loadAdmin();
    };
  }

  async function loadStats() {
    try {
      const stats = await request("/stats");
      document.querySelectorAll("[data-stat='donated']").forEach((el) => {
        el.textContent = `${number(stats.totalTokensPurchased)} tokens`;
      });
      document.querySelectorAll("[data-stat='lives']").forEach((el) => {
        el.textContent = `${number(stats.totalImpact)} impact`;
      });
      document.querySelectorAll("[data-stat='ngos']").forEach((el) => {
        el.textContent = `${number(stats.verifiedNGOs)} NGOs`;
      });
      document.querySelectorAll("[data-stat='users']").forEach((el) => {
        el.textContent = number(stats.totalUsers);
      });
    } catch {}
  }

  async function loadCauses() {
    const grid = document.getElementById("causes-grid");
    const causeSelect = document.getElementById("donate-cause");
    if (!grid && !causeSelect) return;
    try {
      const causes = await request("/causes");
      if (causeSelect) {
        causeSelect.innerHTML = causes.length
          ? causes.map((cause) => `<option value="${esc(cause._id)}">${esc(cause.title)}</option>`).join("")
          : `<option value="">No active causes yet</option>`;
        causeSelect.disabled = !causes.length;
      }
      if (!grid) return;
      grid.innerHTML = causes.length ? causes.map((cause) => {
        const hasActivity = Number(cause.raised || 0) > 0 || Number(cause.contributors || 0) > 0;
        const pct = cause.goal ? Math.min(Math.round(((cause.raised || 0) / cause.goal) * 100), 100) : 0;
        return `
          <div class="card cause-card">
            <div class="cause-icon">${esc(cause.icon || "SM")}</div>
            <h3 style="font-size:1.15rem;font-weight:700;margin-bottom:.35rem;">${esc(cause.title)}</h3>
            <p style="font-size:.85rem;color:var(--text2);margin-bottom:1rem;line-height:1.6;">${esc(cause.description)}</p>
            ${hasActivity ? `
              <div class="cause-meta"><span>Community activity</span><span class="cause-raised">${number(cause.raised || 0)} tokens</span></div>
              <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
            ` : `<div class="sm-empty" style="padding:1rem;margin:0 0 1rem;"><h4>No community activity yet</h4><p>Be the first supporter for this cause.</p></div>`}
            <div class="cause-footer">
              <span style="font-size:.8rem;color:var(--text2);">${hasActivity ? `${number(cause.contributors || 0)} contributors` : "No contributors yet"}</span>
              <button class="btn btn-primary" onclick="openDonateModal('${esc(cause._id)}')">Use Tokens</button>
            </div>
          </div>
        `;
      }).join("") : emptyState("No active causes yet", "Reviewed causes will appear here when they are ready.");
    } catch (err) {
      if (grid) grid.innerHTML = emptyState("Causes unavailable", err.message);
      if (causeSelect) {
        causeSelect.innerHTML = `<option value="">Causes unavailable</option>`;
        causeSelect.disabled = true;
      }
    }
  }

  function clearFakeSections() {
    const donorRows = document.getElementById("lb-donors");
    const ngoRows = document.getElementById("lb-ngos");
    if (donorRows) donorRows.innerHTML = emptyState("Leaderboard loading", "Real rankings will appear after verified activity loads.");
    if (ngoRows) ngoRows.innerHTML = emptyState("NGO leaderboard loading", "Only approved NGOs are shown here.");

    const ngoGrid = document.querySelector("#page-ngos .grid-3");
    if (ngoGrid) ngoGrid.innerHTML = emptyState("No approved NGOs yet", "Approved NGO applications will appear here after admin review.");

    const history = document.querySelector("#dtab-history tbody");
    if (history) history.innerHTML = `<tr><td colspan="7">Your real token activity will appear here.</td></tr>`;
  }

  async function loadDashboard() {
    if (!getToken()) return;
    try {
      const data = await request("/dashboard");
      const user = data.user;
      saveUser(user);
      updateNav();

      const avatar = document.querySelector(".dash-sidebar .user-avatar");
      if (avatar) avatar.textContent = initials(user.name);
      const sidebarName = document.querySelector(".dash-sidebar div[style*='font-weight:700']");
      if (sidebarName) sidebarName.textContent = user.name || "ServeMATE User";
      const sidebarBadge = document.querySelector(".dash-sidebar .badge");
      if (sidebarBadge) sidebarBadge.textContent = user.title || "Beginner";
      const levelName = document.querySelector(".level-name");
      if (levelName) levelName.textContent = `Level ${user.level} - ${user.title}`;
      const xpCount = document.querySelector(".xp-count");
      if (xpCount) xpCount.textContent = data.progression.nextLevelXp ? `${number(user.xp)} / ${number(data.progression.nextLevelXp)} XP` : `${number(user.xp)} XP`;
      const fill = document.querySelector(".level-bar .progress-fill");
      if (fill) fill.style.width = `${Math.min(data.xpProgress || 0, 100)}%`;

      const heading = document.querySelector("#dtab-overview h2");
      if (heading) heading.textContent = `Welcome, ${user.name || "ServeMATE user"}`;
      const cards = document.querySelectorAll("#dtab-overview .stat-card");
      const values = [
        ["Token Balance", number(user.tokenBalance)],
        ["XP Points", number(user.xp)],
        ["Impact Score", number(user.totalImpact)],
        ["Leaderboard", data.leaderboardPosition ? `#${data.leaderboardPosition}` : "Unranked"],
      ];
      cards.forEach((card, index) => {
        const label = card.querySelector(".label");
        const valueEl = card.querySelector(".value");
        const change = card.querySelector(".change");
        if (label) label.textContent = values[index]?.[0] || "";
        if (valueEl) valueEl.textContent = values[index]?.[1] || "0";
        if (change) change.textContent = "From real activity";
      });

      const activityCard = document.querySelector("#dtab-overview .grid-2 .card:first-child > div");
      if (activityCard) {
        activityCard.innerHTML = (data.recentActivity || []).length
          ? data.recentActivity.map((item) => `<div style="font-size:.88rem;"><strong>${esc(item.message)}</strong><div style="color:var(--text3);font-size:.8rem;">${new Date(item.createdAt).toLocaleString("en-IN")}</div></div>`).join("")
          : `<p style="color:var(--text2);">No activity yet.</p>`;
      }

      const tbody = document.querySelector("#dtab-history tbody");
      if (tbody) {
        tbody.innerHTML = (data.recentDonations || []).length ? data.recentDonations.map((item) => `
          <tr>
            <td><div style="font-weight:600;">${esc(item.cause?.title || "Virtual token contribution")}</div></td>
            <td style="font-family:'Sora',sans-serif;font-weight:700;">${number(item.amount)} tokens</td>
            <td style="color:var(--text2);">${new Date(item.createdAt).toLocaleDateString("en-IN")}</td>
            <td><span class="ngo-badge">${esc(item.ngo?.ngoName || item.ngo?.name || "Pending assignment")}</span></td>
            <td style="color:var(--text2);font-size:.82rem;">${esc(item.ngo?.location || item.location || "-")}</td>
            <td>${item.proofVideo ? `<a href="${esc(item.proofVideo)}" target="_blank" class="proof-btn">View</a>` : "-"}</td>
            <td><span class="badge badge-blue">${esc(item.status)}</span></td>
          </tr>
        `).join("") : `<tr><td colspan="7">No token contributions yet.</td></tr>`;
      }

      const badges = document.querySelector(".badges-grid");
      if (badges) {
        badges.innerHTML = (user.badges || []).length
          ? user.badges.map((badge) => `<div class="badge-item earned"><div class="b-icon">+</div><div class="b-name">${esc(badge)}</div></div>`).join("")
          : `<p style="color:var(--text2);">Badges unlock from real XP and token activity.</p>`;
      }
    } catch (err) {
      toast(`Dashboard unavailable: ${err.message}`);
    }
  }

  async function loadLeaderboard(type = "donors") {
    const target = document.getElementById(type === "ngos" ? "lb-ngos" : "lb-donors");
    if (!target) return;
    try {
      const rows = await request(`/leaderboard/${type}`);
      if (!Array.isArray(rows) || rows.length === 0) {
        target.innerHTML = emptyState("No rankings yet", "Rankings appear after real token activity exists.");
        return;
      }
      target.innerHTML = rows.map((row, index) => {
        const name = row.ngoName || row.name || row.username || "ServeMATE member";
        return `
          <div class="lb-row">
            <div class="lb-rank">${index + 1}</div>
            <div class="lb-avatar">${initials(name)}</div>
            <div class="flex-1">
              <div class="lb-name">${esc(name)}</div>
              <div class="lb-location">${esc(row.title || row.location || row.areaOfWork || "")}</div>
              <div>${(row.badges || []).slice(0, 3).map((badge) => `<span class="badge badge-blue" style="font-size:.7rem;">${esc(badge)}</span>`).join(" ")}</div>
            </div>
            <div style="text-align:right;">
              <div class="lb-xp">${number(row.xp || row.impactScore || 0)} ${type === "ngos" ? "impact" : "XP"}</div>
              <div class="lb-count">${type === "ngos" ? `${number(row.tasksCompleted || 0)} tasks` : `${number(row.totalTokensPurchased || 0)} tokens`}</div>
            </div>
          </div>
        `;
      }).join("");
    } catch (err) {
      target.innerHTML = emptyState("Leaderboard unavailable", err.message);
    }
  }

  async function loadNGOs() {
    const grid = document.querySelector("#page-ngos .grid-3");
    if (!grid) return;
    try {
      const ngos = await request("/ngos");
      grid.innerHTML = ngos.length ? ngos.map((ngo, index) => `
        <div class="card ngo-card">
          <div class="ngo-rank">#${index + 1}</div>
          <div class="ngo-avatar">${initials(ngo.ngoName || ngo.name)}</div>
          <div class="ngo-name">${esc(ngo.ngoName || ngo.name)} <span class="verified-tick" title="Approved NGO">Verified</span></div>
          <div style="font-size:.82rem;color:var(--text2);margin-bottom:.5rem;">${esc(ngo.location || "")}</div>
          <p style="font-size:.85rem;color:var(--text2);line-height:1.6;">${esc(ngo.description || "No public description yet.")}</p>
          <div class="ngo-stat-row">
            <div class="ngo-stat"><div class="n">${number(ngo.tasksCompleted || 0)}</div><div class="l">Tasks</div></div>
            <div class="ngo-stat"><div class="n">${number((ngo.volunteers || []).length || ngo.volunteerCount || 0)}</div><div class="l">Volunteers</div></div>
            <div class="ngo-stat"><div class="n">${number(ngo.impactScore || 0)}</div><div class="l">Impact</div></div>
          </div>
        </div>
      `).join("") + `
        <div class="card" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;min-height:220px;border-style:dashed;cursor:pointer;" onclick="openNGORegModal()">
          <h4 style="font-weight:700;margin-bottom:.35rem;">Register Your NGO</h4>
          <p style="font-size:.85rem;color:var(--text2);">Applications appear publicly only after admin approval.</p>
        </div>` : emptyState("No approved NGOs yet", "NGO applications are hidden until admin approval.");
    } catch (err) {
      grid.innerHTML = emptyState("NGOs unavailable", err.message);
    }
  }

  function ensureAdminPage() {
    if (document.getElementById("page-admin")) return;
    document.body.insertAdjacentHTML("beforeend", `
      <div id="page-admin" class="page">
        <section style="background:var(--bg2);padding:3rem 2rem 2rem;">
          <div class="container" style="display:flex;justify-content:space-between;align-items:flex-end;gap:1rem;flex-wrap:wrap;">
            <div>
              <div class="section-label">Admin</div>
              <h2 class="section-title">ServeMATE Control Center</h2>
              <p class="section-sub">Moderate NGOs, users, transactions, messages, badges, and platform analytics from live platform activity.</p>
            </div>
            <button class="btn btn-primary" onclick="ServeMATE.reloadAdmin()">Refresh</button>
          </div>
        </section>
        <section style="padding-top:2rem;">
          <div class="container">
            <div id="admin-root">${emptyState("Loading admin", "Fetching live platform activity.")}</div>
          </div>
        </section>
      </div>
    `);
  }

  function adminTable(headers, rows, emptyMessage) {
    if (!rows || !rows.length) return `<p style="color:var(--text2);font-size:.9rem;">${esc(emptyMessage)}</p>`;
    return `<div style="overflow:auto;"><table class="history-table"><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
  }

  async function loadAdmin() {
    ensureAdminPage();
    const root = document.getElementById("admin-root");
    const user = savedUser();
    if (!root) return;
    if (user?.role !== "admin") {
      root.innerHTML = emptyState("Admin access required", "Sign in with the configured admin account to manage ServeMATE.");
      return;
    }
    try {
      root.innerHTML = emptyState("Loading admin", "Fetching live platform activity.");
      const [overview, pending, allNgos, users, transactions, contacts, analytics] = await Promise.all([
        request("/admin/overview"),
        request("/admin/ngos/pending"),
        request("/admin/ngos/all"),
        request("/admin/users?limit=25"),
        request("/admin/transactions?limit=25"),
        request("/admin/contacts"),
        request("/admin/analytics"),
      ]);
      const ngoRows = (allNgos.ngos || allNgos || []).map((ngo) => `
        <tr>
          <td><strong>${esc(ngo.ngoName || ngo.name)}</strong><div style="color:var(--text3);font-size:.78rem;">${esc(ngo.email)}</div></td>
          <td>${esc(ngo.location || "-")}</td>
          <td><span class="badge ${ngo.approvalStatus === "approved" ? "badge-green" : ngo.approvalStatus === "rejected" ? "badge-purple" : "badge-orange"}">${esc(ngo.approvalStatus || "pending")}</span></td>
          <td>${ngo.verified ? "Verified" : "Unverified"}</td>
          <td style="white-space:nowrap;">
            <button class="btn btn-primary btn-sm" onclick="ServeMATE.adminApproveNGO('${ngo._id}')">Approve</button>
            <button class="btn btn-ghost btn-sm" onclick="ServeMATE.adminVerifyNGO('${ngo._id}')">Verify</button>
            <button class="btn btn-ghost btn-sm" onclick="ServeMATE.adminRejectNGO('${ngo._id}')">Reject</button>
            <button class="btn btn-ghost btn-sm" onclick="ServeMATE.adminDeleteNGO('${ngo._id}')">Remove</button>
          </td>
        </tr>`);
      const userRows = (users.users || []).map((item) => `
        <tr>
          <td><strong>${esc(item.name)}</strong><div style="color:var(--text3);font-size:.78rem;">${esc(item.email)}</div></td>
          <td>${esc(item.role)}</td>
          <td>${number(item.xp || 0)}</td>
          <td>${number(item.tokenBalance || 0)}</td>
          <td>${esc(item.title || "Beginner")}</td>
          <td><button class="btn btn-ghost btn-sm" onclick="ServeMATE.adminDeleteUser('${item._id}')">Delete</button></td>
        </tr>`);
      const txRows = (transactions.transactions || []).map((tx) => `
        <tr>
          <td>${esc(tx.userId?.email || "-")}</td>
          <td>${number(tx.amount)} tokens</td>
          <td>${esc(tx.type)}</td>
          <td>${esc(tx.paymentStatus)}</td>
          <td>${tx.createdAt ? new Date(tx.createdAt).toLocaleString() : "-"}</td>
        </tr>`);
      const contactRows = (contacts || []).slice(0, 25).map((msg) => `
        <tr>
          <td><strong>${esc(msg.subject)}</strong><div style="color:var(--text3);font-size:.78rem;">${esc(msg.name)} · ${esc(msg.email)}</div></td>
          <td>${esc((msg.message || "").slice(0, 120))}</td>
          <td>${msg.read ? "Read" : "Unread"}</td>
          <td><button class="btn btn-ghost btn-sm" onclick="ServeMATE.adminMarkContactRead('${msg._id}')">Mark read</button></td>
        </tr>`);
      root.innerHTML = `
        <div class="stat-cards">
          <div class="stat-card"><div class="label">Users</div><div class="value">${number(overview.totalUsers)}</div><div class="change">${number(analytics.usersToday || 0)} today</div></div>
          <div class="stat-card"><div class="label">Approved NGOs</div><div class="value">${number(overview.verifiedNGOs)}</div><div class="change">${number(overview.pendingNGOs)} pending</div></div>
          <div class="stat-card"><div class="label">Token Purchases</div><div class="value">${number(overview.totalTokenPurchases || 0)}</div><div class="change">Virtual support tokens only</div></div>
          <div class="stat-card"><div class="label">Unread Messages</div><div class="value">${number(overview.unreadMessages)}</div><div class="change">Contact inbox</div></div>
        </div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin:1.5rem 0;">
          <button class="btn btn-primary btn-sm" onclick="ServeMATE.adminRecalculateLeaderboard()">Recalculate Leaderboard</button>
          <button class="btn btn-ghost btn-sm" onclick="ServeMATE.adminCreateBadge()">Create Badge</button>
          <button class="btn btn-ghost btn-sm" onclick="ServeMATE.adminSendAnnouncement()">Send Announcement</button>
        </div>
        <div class="grid-2">
          <div class="card" style="grid-column:1 / -1;"><h4>NGO Moderation</h4>${adminTable(["NGO", "Location", "Status", "Verification", "Actions"], ngoRows, "No NGO applications yet.")}</div>
          <div class="card" style="grid-column:1 / -1;"><h4>Users</h4>${adminTable(["User", "Role", "XP", "Tokens", "Title", "Action"], userRows, "No users found.")}</div>
          <div class="card" style="grid-column:1 / -1;"><h4>Token Transactions</h4>${adminTable(["User", "Amount", "Type", "Status", "Created"], txRows, "No token transactions yet.")}</div>
          <div class="card" style="grid-column:1 / -1;"><h4>Contact Messages</h4>${adminTable(["Message", "Preview", "Status", "Action"], contactRows, "No contact messages yet.")}</div>
        </div>
      `;
    } catch (err) {
      root.innerHTML = emptyState("Admin unavailable", err.message);
    }
  }
  async function ensureRazorpayScript() {
    if (window.Razorpay) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function selectedTokenAmount() {
    const input = document.getElementById("custom-amount");
    const raw = input?.value ? Number(input.value) : Number(window.currentDonateAmount || 0);
    const amount = Math.floor(raw);
    return Number.isFinite(amount) && amount > 0 ? amount : 0;
  }

  function setTokenActionBusy(isBusy, message = "Processing...") {
    const button = document.querySelector("#donate-step1 .btn-primary.btn-full");
    if (!button) return;
    button.disabled = isBusy;
    button.textContent = isBusy ? message : "Continue";
  }

  async function refreshUserSurfaces() {
    const dashboardOpen = document.getElementById("page-dashboard")?.classList.contains("active");
    if (dashboardOpen) await loadDashboard();
    loadStats();
    loadLeaderboard("donors");
  }

  async function purchaseTokens(amount) {
    const user = savedUser();
    if (!user) {
      window.openAuthModal?.();
      return;
    }
    if (!Number.isFinite(Number(amount)) || Number(amount) < 10) {
      toast("Minimum token purchase is 10 tokens.");
      return;
    }
    setTokenActionBusy(true, "Opening checkout...");
    const order = await request("/tokens/order", { method: "POST", body: { amount, currencyAmount: amount } });
    await ensureRazorpayScript();
    const checkout = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: "ServeMATE",
      description: `${order.tokens} virtual support tokens`,
      order_id: order.orderId,
      prefill: { name: user.name, email: user.email },
      handler: async (payment) => {
        setTokenActionBusy(true, "Verifying payment...");
        const result = await request("/tokens/verify", {
          method: "POST",
          body: { transactionId: order.transactionId, ...payment },
        });
        saveUser(result.user);
        updateNav();
        toast("Tokens credited successfully.");
        await refreshUserSurfaces();
        setTokenActionBusy(false);
      },
      modal: { ondismiss: () => setTokenActionBusy(false) },
    });
    checkout.open();
  }

  window.ServeMATE = {
    request,
    openRegister() {
      window.openAuthModal?.();
      window.switchAuthTab?.("register", document.querySelector("#auth-modal .tab-btn:nth-child(2)"));
    },
    logout() {
      clearToken();
      clearUser();
      updateNav();
      window.showPage?.("home");
    },
    async adminApproveNGO(id) {
      await request(`/admin/ngos/${id}/approve`, { method: "PATCH", body: {} });
      toast("NGO approved.");
      loadAdmin();
      loadNGOs();
    },
    async adminRejectNGO(id) {
      const reason = prompt("Reason for rejection?") || "";
      await request(`/admin/ngos/${id}/reject`, { method: "PATCH", body: { reason } });
      toast("NGO rejected.");
      loadAdmin();
    },
    async adminVerifyNGO(id) {
      await request(`/admin/ngos/${id}/verify`, { method: "PATCH", body: {} });
      toast("NGO verified.");
      loadAdmin();
      loadNGOs();
    },
    async adminDeleteNGO(id) {
      if (!confirm("Remove this NGO record?")) return;
      await request(`/admin/ngos/${id}`, { method: "DELETE" });
      toast("NGO removed.");
      loadAdmin();
      loadNGOs();
    },
    async adminDeleteUser(id) {
      if (!confirm("Delete this user account?")) return;
      await request(`/admin/users/${id}`, { method: "DELETE" });
      toast("User deleted.");
      loadAdmin();
    },
    async adminMarkContactRead(id) {
      await request(`/admin/contacts/${id}/read`, { method: "PATCH", body: {} });
      toast("Message marked read.");
      loadAdmin();
    },
    async adminRecalculateLeaderboard() {
      await request("/admin/leaderboard/recalculate", { method: "PATCH", body: {} });
      toast("Leaderboard recalculated.");
      loadAdmin();
      loadLeaderboard("donors");
    },
    async adminCreateBadge() {
      const name = prompt("Badge name");
      if (!name) return;
      const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const description = prompt("Badge description") || "";
      await request("/admin/badges", { method: "POST", body: { key, name, description } });
      toast("Badge created.");
      loadAdmin();
    },
    async adminSendAnnouncement() {
      const title = prompt("Announcement title");
      if (!title) return;
      const message = prompt("Announcement message") || "";
      await request("/admin/announcements", { method: "POST", body: { title, message } });
      toast("Announcement sent.");
      loadAdmin();
    },
    reloadAdmin: loadAdmin,
    purchaseTokens,
  };

  window.loginAction = async function loginAction() {
    const activeTab = document.querySelector("#auth-modal .tab-btn.active")?.textContent || "Login";
    try {
      if (activeTab === "Login") {
        const root = document.getElementById("auth-login");
        const data = await request("/auth/login", { method: "POST", body: { email: value('input[type="email"]', root), password: value('input[type="password"]', root) } });
        setToken(data.token);
        saveUser(data.user);
        closeModal("auth-modal");
        updateNav();
        window.showPage?.("dashboard");
        return;
      }
      const root = document.getElementById("auth-register");
      const data = await request("/auth/register", {
        method: "POST",
        body: { name: value('input[type="text"]', root), email: value('input[type="email"]', root), password: value('input[type="password"]', root) },
      });
      setToken(data.token);
      saveUser(data.user);
      closeModal("auth-modal");
      updateNav();
      window.showPage?.("dashboard");
    } catch (err) {
      toast(`Authentication failed: ${err.message}`);
    }
  };

  window.showDonateSuccess = async function showDonateSuccess() {
    try {
      if (!getToken()) {
        toast("Please log in before using support tokens.");
        openAuthModal();
        return;
      }
      const amount = selectedTokenAmount();
      if (!amount) {
        toast("Enter a valid positive token amount.");
        return;
      }
      const user = savedUser();
      if ((user?.tokenBalance || 0) < amount) {
        toast("Opening secure checkout to buy virtual support tokens.");
        await purchaseTokens(amount);
        return;
      }
      if (!value("#donate-cause")) {
        toast("No active cause is available for token spending yet.");
        return;
      }
      setTokenActionBusy(true, "Using tokens...");
      const result = await request("/contribute", { method: "POST", body: { amount, cause: value("#donate-cause") } });
      saveUser(result.user);
      document.getElementById("success-amount").textContent = `${number(amount)} tokens`;
      document.getElementById("donate-step1").style.display = "none";
      document.getElementById("donate-step2").style.display = "";
      await refreshUserSurfaces();
      setTokenActionBusy(false);
    } catch (err) {
      setTokenActionBusy(false);
      toast(`Token action failed: ${err.message}`);
    }
  };

  window.switchLB = function switchLB(type, btn) {
    document.querySelectorAll(".lb-tab").forEach((button) => button.classList.remove("active"));
    if (btn) btn.classList.add("active");
    document.getElementById("lb-donors").style.display = type === "donors" ? "" : "none";
    document.getElementById("lb-ngos").style.display = type === "ngos" ? "" : "none";
    loadLeaderboard(type);
  };

  window.submitContactForm = async function submitContactForm() {
    const root = document.getElementById("page-contact");
    try {
      await request("/contact", {
        method: "POST",
        body: {
          name: value('input[type="text"]', root),
          email: value('input[type="email"]', root),
          subject: value("select", root),
          message: value("textarea", root),
          website: value('input[name="website"]', root),
        },
      });
      root.querySelectorAll("input, textarea").forEach((field) => (field.value = ""));
      toast("Message sent.");
    } catch (err) {
      toast(`Message failed: ${err.message}`);
    }
  };

  window.submitNGOApplication = async function submitNGOApplication() {
    const root = document.getElementById("ngo-modal");
    const inputs = root.querySelectorAll("input");
    try {
      await request("/auth/ngo/register", {
        method: "POST",
        body: {
          ngoName: inputs[0]?.value?.trim(),
          founderName: inputs[2]?.value?.trim(),
          email: inputs[3]?.value?.trim(),
          phone: inputs[4]?.value?.trim(),
          location: inputs[5]?.value?.trim(),
          volunteerCount: inputs[6]?.value?.trim(),
          regNumber: inputs[1]?.value?.trim(),
          description: value("textarea", root),
        },
      });
      closeModal("ngo-modal");
      toast("NGO application submitted for admin review.");
    } catch (err) {
      toast(`NGO application failed: ${err.message}`);
    }
  };

  document.addEventListener("DOMContentLoaded", async () => {
    ensureAdminPage();
    clearFakeSections();
    patchShowPage();

    const contactButton = document.querySelector("#page-contact .card button");
    if (contactButton) contactButton.onclick = submitContactForm;
    const ngoButton = document.querySelector("#ngo-modal .btn-orange");
    if (ngoButton) ngoButton.onclick = submitNGOApplication;

    await restoreSession();
    updateNav();
    loadStats();
    loadCauses();
    loadLeaderboard("donors");
    loadNGOs();
    if (document.getElementById("page-dashboard")?.classList.contains("active")) loadDashboard();
  });
})();


