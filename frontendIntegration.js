(function () {
  const API_BASE =
    window.SERVEMATE_API_BASE_URL ||
    "https://servemate.onrender.com/api";

  const tokenKey = "servemate_token";
  const userKey = "servemate_user";

  function getToken() {
    return localStorage.getItem(tokenKey) || localStorage.getItem("sm_token");
  }

  function setSession(data) {
    if (data.token) {
      localStorage.setItem(tokenKey, data.token);
      localStorage.setItem("sm_token", data.token);
    }
    const user = data.user || data.ngo;
    if (user) {
      localStorage.setItem(userKey, JSON.stringify(user));
      localStorage.setItem("sm_user", JSON.stringify(user));
    }
  }

  function savedUser() {
    try {
      return JSON.parse(localStorage.getItem(userKey) || localStorage.getItem("sm_user") || "null");
    } catch {
      return null;
    }
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
    if (!response.ok) {
      throw new Error(data.error || data.message || "Request failed");
    }
    return data;
  }

  function value(selector, root = document) {
    return root?.querySelector(selector)?.value?.trim() || "";
  }

  function money(amount) {
    return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
  }

  function initials(name) {
    return String(name || "SM")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "SM";
  }

  function updateNav() {
    const user = savedUser();
    const loginButtons = document.querySelectorAll("[onclick='openAuthModal()'], [onclick='openAuthModal();closeMobileMenu()']");
    loginButtons.forEach((button) => {
      if (user) button.textContent = user.name ? user.name.split(" ")[0] : "Account";
    });
  }

  async function loadDashboard() {
    if (!getToken()) return;
    try {
      const data = await request("/dashboard");
      const user = { ...(savedUser() || {}), ...(data.user || {}) };
      localStorage.setItem(userKey, JSON.stringify(user));

      const avatar = document.querySelector(".dash-sidebar .user-avatar");
      if (avatar) avatar.textContent = initials(user.name);

      const name = document.querySelector(".dash-sidebar div[style*='font-weight:700']");
      if (name) name.textContent = user.name || "ServeMate User";

      const cards = document.querySelectorAll("#dtab-overview .stat-card .value");
      if (cards[0]) cards[0].textContent = money(user.totalDonated);
      if (cards[1]) cards[1].textContent = Number(user.xp || 0).toLocaleString("en-IN");
      if (cards[2]) cards[2].textContent = Number(user.donationCount || 0).toLocaleString("en-IN");

      renderDonationHistory(data.recentDonations || []);
      updateNav();
    } catch (err) {
      showToast(`Dashboard unavailable: ${err.message}`);
    }
  }

  function renderDonationHistory(donations) {
    const tbody = document.querySelector("#dtab-history tbody");
    if (!tbody || donations.length === 0) return;

    tbody.innerHTML = donations.map((donation) => {
      const cause = donation.cause || {};
      const ngo = donation.ngo || {};
      const date = donation.createdAt ? new Date(donation.createdAt).toLocaleDateString("en-IN") : "-";
      const status = donation.status || "pending";
      const statusClass = status === "verified" ? "badge-green" : status === "completed" ? "badge-blue" : "badge-orange";
      return `
        <tr>
          <td><div style="font-weight:600;">${cause.icon || ""} ${cause.title || "Donation"}</div></td>
          <td style="font-family:'Sora',sans-serif;font-weight:700;">${money(donation.amount)}</td>
          <td style="color:var(--text2);">${date}</td>
          <td><span class="ngo-badge">${ngo.name || "Pending assignment"}</span></td>
          <td style="color:var(--text2);font-size:.82rem;">${ngo.location || donation.location || "-"}</td>
          <td><a href="#" class="proof-btn" onclick="openProofModal()">Watch</a></td>
          <td><span class="badge ${statusClass}">${status}</span></td>
        </tr>
      `;
    }).join("");
  }

  async function loadLeaderboard(type) {
    const target = document.getElementById(type === "ngos" ? "lb-ngos" : "lb-donors");
    if (!target) return;

    try {
      const rows = await request(`/leaderboard/${type}`);
      if (!Array.isArray(rows) || rows.length === 0) return;

      target.innerHTML = rows.map((row, index) => {
        const rank = index + 1;
        if (type === "ngos") {
          return `
            <div class="lb-row">
              <div class="lb-rank">${rank}</div>
              <div class="lb-avatar">${initials(row.name)}</div>
              <div class="flex-1"><div class="lb-name">${row.name || "NGO"}</div><div class="lb-location">${row.areaOfWork || ""}</div></div>
              <div style="text-align:right;"><div class="lb-xp">Impact: ${row.impactScore || 0}</div><div class="lb-count">${row.tasksCompleted || 0} tasks done</div></div>
            </div>
          `;
        }
        return `
          <div class="lb-row">
            <div class="lb-rank">${rank}</div>
            <div class="lb-avatar">${initials(row.name)}</div>
            <div class="flex-1"><div class="lb-name">${row.name || "Donor"}</div><div class="lb-location">${row.level || ""}</div></div>
            <div style="text-align:right;"><div class="lb-xp">${Number(row.xp || 0).toLocaleString("en-IN")} XP</div><div class="lb-count">${row.donationCount || 0} donations</div></div>
          </div>
        `;
      }).join("");
    } catch (err) {
      showToast(`Leaderboard unavailable: ${err.message}`);
    }
  }

  async function loadStats() {
    try {
      const stats = await request("/stats");
      document.querySelectorAll("[data-stat='donated']").forEach((el) => {
        el.textContent = money(stats.totalDonated || 0);
      });
      document.querySelectorAll("[data-stat='lives']").forEach((el) => {
        el.textContent = `${Number(stats.livesImpacted || 0).toLocaleString("en-IN")}+`;
      });
      document.querySelectorAll("[data-stat='ngos']").forEach((el) => {
        el.textContent = `${stats.verifiedNGOs || 0} NGOs`;
      });
    } catch {}
  }

  window.BackendService = {
    request,
    async login(email, password) {
      const data = await request("/auth/login", { method: "POST", body: { email, password } });
      setSession(data);
      return data;
    },
    async register(name, email, password) {
      const data = await request("/auth/register", { method: "POST", body: { name, email, password } });
      setSession(data);
      return data;
    },
    donate(amount, cause) {
      return request("/donate", { method: "POST", body: { amount, cause } });
    },
    contact(name, email, subject, message) {
      return request("/contact", {
        method: "POST",
        body: { name, email, message: subject ? `${subject}: ${message}` : message },
      });
    },
    registerNGO(payload) {
      return request("/auth/ngo/register", { method: "POST", body: payload });
    },
  };

  window.loginAction = async function loginAction() {
    const activeTab = document.querySelector("#auth-modal .tab-btn.active")?.textContent || "Login";
    try {
      if (activeTab === "Login") {
        const root = document.getElementById("auth-login");
        await BackendService.login(value('input[type="email"]', root), value('input[type="password"]', root));
        closeModal("auth-modal");
        await loadDashboard();
        showPage("dashboard");
        showToast("Logged in successfully.");
        return;
      }

      const root = document.getElementById("auth-register");
      await BackendService.register(
        value('input[type="text"]', root),
        value('input[type="email"]', root),
        value('input[type="password"]', root)
      );
      closeModal("auth-modal");
      await loadDashboard();
      showPage("dashboard");
      showToast("Account created and logged in.");
    } catch (err) {
      showToast(`Authentication failed: ${err.message}`);
    }
  };

  window.showDonateSuccess = async function showDonateSuccess() {
    if (!getToken()) {
      showToast("Please login before donating.");
      openAuthModal();
      return;
    }

    const custom = value("#custom-amount");
    const amount = custom ? Number(custom) : currentDonateAmount;
    const cause = value("#donate-cause");

    try {
      const result = await BackendService.donate(amount, cause);
      document.getElementById("success-amount").textContent = money(result.donation?.amount || amount);
      const xpBadge = document.querySelector("#donate-step2 .badge");
      if (xpBadge) xpBadge.textContent = `+${result.donation?.xpEarned || amount} XP Earned`;
      document.getElementById("donate-step1").style.display = "none";
      document.getElementById("donate-step2").style.display = "";
      await loadDashboard();
    } catch (err) {
      showToast(`Donation failed: ${err.message}`);
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
      await BackendService.contact(
        value('input[type="text"]', root),
        value('input[type="email"]', root),
        value("select", root),
        value("textarea", root)
      );
      root.querySelectorAll("input, textarea").forEach((field) => (field.value = ""));
      showToast("Message sent. We will reply within 24 hours.");
    } catch (err) {
      showToast(`Message failed: ${err.message}`);
    }
  };

  window.submitNGOApplication = async function submitNGOApplication() {
    const root = document.getElementById("ngo-modal");
    const inputs = root.querySelectorAll("input");
    const name = inputs[0]?.value?.trim();
    const regNumber = inputs[1]?.value?.trim();
    const email = inputs[3]?.value?.trim();
    const location = inputs[5]?.value?.trim();
    const volunteerCount = inputs[6]?.value?.trim();

    try {
      await BackendService.registerNGO({
        name,
        email,
        password: `ServeMate-${Date.now()}!`,
        regNumber,
        taxStatus: "Both",
        areaOfWork: location || "General welfare",
        description: `Contact person: ${inputs[2]?.value?.trim() || "Not provided"}. Phone: ${inputs[4]?.value?.trim() || "Not provided"}.`,
        location,
        volunteerCount,
      });
      closeModal("ngo-modal");
      showToast("Application submitted. We will review and contact you.");
    } catch (err) {
      showToast(`NGO application failed: ${err.message}`);
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    const contactButton = document.querySelector("#page-contact .card button");
    if (contactButton) contactButton.onclick = submitContactForm;

    const ngoButton = document.querySelector("#ngo-modal .btn-orange");
    if (ngoButton) ngoButton.onclick = submitNGOApplication;

    loadStats();
    loadLeaderboard("donors");
    loadDashboard();
    updateNav();
  });
})();
