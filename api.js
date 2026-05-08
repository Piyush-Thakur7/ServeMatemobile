/**
 * ServeMATE Frontend API Integration
 * Drop this <script src="api.js"></script> into your HTML
 * It connects every UI action to the real backend at resence.in
 */

const API = (() => {
  const BASE = "https://resence.in/api";   // ← your domain

  // ── Token storage ──────────────────────────────────────────────────────────
  const getToken  = ()     => localStorage.getItem("sm_token");
  const setToken  = (t)    => localStorage.setItem("sm_token", t);
  const clearToken= ()     => localStorage.removeItem("sm_token");
  const getUser   = ()     => JSON.parse(localStorage.getItem("sm_user") || "null");
  const setUser   = (u)    => localStorage.setItem("sm_user", JSON.stringify(u));
  const clearUser = ()     => localStorage.removeItem("sm_user");

  // ── Base fetch ─────────────────────────────────────────────────────────────
  async function req(method, path, body = null, auth = false) {
    const headers = { "Content-Type": "application/json" };
    if (auth) headers["Authorization"] = "Bearer " + getToken();
    const res = await fetch(BASE + path, {
      method, headers,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  return {
    // ── AUTH ──────────────────────────────────────────────────────────────────
    async register(name, email, password) {
      const data = await req("POST", "/auth/register", { name, email, password });
      setToken(data.token); setUser(data.user);
      return data;
    },
    async login(email, password) {
      const data = await req("POST", "/auth/login", { email, password });
      setToken(data.token); setUser(data.user);
      return data;
    },
    logout() { clearToken(); clearUser(); location.reload(); },
    async me() { return req("GET", "/auth/me", null, true); },
    isLoggedIn() { return !!getToken(); },
    currentUser() { return getUser(); },

    // NGO auth
    async ngoRegister(form) {
      return req("POST", "/auth/ngo/register", form);
    },
    async ngoLogin(email, password) {
      const data = await req("POST", "/auth/ngo/login", { email, password });
      setToken(data.token); setUser(data.ngo);
      return data;
    },

    // ── CAUSES ────────────────────────────────────────────────────────────────
    async getCauses()    { return req("GET", "/causes"); },
    async getCause(id)   { return req("GET", "/causes/" + id); },

    // ── DONATE ────────────────────────────────────────────────────────────────
    async donate(causeId, amount) {
      const data = await req("POST", "/donate", { causeId, amount }, true);
      // Update cached user XP
      const user = getUser();
      if (user) { Object.assign(user, data.user); setUser(user); }
      return data;
    },
    async donationHistory() { return req("GET", "/donations/history", null, true); },

    // ── DASHBOARD ─────────────────────────────────────────────────────────────
    async dashboard() { return req("GET", "/dashboard", null, true); },

    // ── TRANSPARENCY ──────────────────────────────────────────────────────────
    async transparency(params = {}) {
      const qs = new URLSearchParams(params).toString();
      return req("GET", "/transparency" + (qs ? "?" + qs : ""));
    },

    // ── NGOs ──────────────────────────────────────────────────────────────────
    async getNGOs()       { return req("GET", "/ngos"); },
    async getNGO(id)      { return req("GET", "/ngos/" + id); },

    // ── LEADERBOARD ───────────────────────────────────────────────────────────
    async leaderDonors()  { return req("GET", "/leaderboard/donors"); },
    async leaderNGOs()    { return req("GET", "/leaderboard/ngos"); },

    // ── STATS ─────────────────────────────────────────────────────────────────
    async stats()         { return req("GET", "/stats"); },

    // ── CONTACT ───────────────────────────────────────────────────────────────
    async contact(name, email, message) {
      return req("POST", "/contact", { name, email, message });
    }
  };
})();

// ═══════════════════════════════════════════════════════════════════════════════
//  AUTO-WIRE: runs when the page loads and connects API to existing UI functions
// ═══════════════════════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", async () => {

  // ── Load real platform stats into hero section ─────────────────────────────
  try {
    const stats = await API.stats();
    const fmt = (n) => n >= 10000000 ? "₹" + (n/10000000).toFixed(1) + "Cr+"
                     : n >= 100000   ? "₹" + (n/100000).toFixed(1) + "L+"
                     : n >= 1000     ? (n/1000).toFixed(0) + "K+" : String(n);

    document.querySelectorAll("[data-stat='donated']").forEach(
      el => { el.textContent = fmt(stats.totalDonated); });
    document.querySelectorAll("[data-stat='lives']").forEach(
      el => { el.textContent = (stats.livesImpacted || 0).toLocaleString() + "+"; });
    document.querySelectorAll("[data-stat='ngos']").forEach(
      el => { el.textContent = stats.verifiedNGOs + " NGOs"; });
  } catch (_) {}

  // ── Load real causes into cause cards ─────────────────────────────────────
  try {
    const causes = await API.getCauses();
    const grid = document.getElementById("causes-grid");
    if (grid && causes.length) {
      grid.innerHTML = causes.map(c => {
        const pct = Math.min(Math.round((c.raised / c.goal) * 100), 100);
        return `
        <div class="cause-card" onclick="openDonateModal('${c._id}','${c.title}','${c.impactPerRupee}')">
          <div class="cause-icon">${c.icon}</div>
          <div class="cause-title">${c.title}</div>
          <p class="cause-desc">${c.description}</p>
          <div class="progress-wrap mb-2"><div class="progress-bar" style="width:${pct}%"></div></div>
          <div class="cause-meta">
            <span>₹${c.raised.toLocaleString()} raised</span>
            <span style="color:var(--orange);font-weight:600">${pct}%</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px">
            <span class="badge badge-orange">${c.icon} ${c.impactPerRupee}</span>
            <span class="text-sm text-muted">${c.contributors.toLocaleString()} contributors</span>
          </div>
          <button class="btn btn-primary btn-sm" style="width:100%;margin-top:14px;justify-content:center">
            Contribute Now
          </button>
        </div>`;
      }).join("");
    }
  } catch (_) {}

  // ── Auth state: show user name / logout in nav ─────────────────────────────
  updateNavAuth();

  // ── Load dashboard if on dashboard page ───────────────────────────────────
  if (document.getElementById("page-dashboard") &&
      !document.getElementById("page-dashboard").classList.contains("hidden")) {
    loadDashboard();
  }
});

// ─── NAV AUTH STATE ──────────────────────────────────────────────────────────
function updateNavAuth() {
  const user = API.currentUser();
  const actions = document.querySelector(".nav-actions");
  if (!actions) return;

  if (user) {
    actions.innerHTML = `
      <span style="font-size:13px;font-weight:600;color:var(--navy);padding:0 8px">
        👋 ${user.name?.split(" ")[0]}
      </span>
      <button class="btn btn-ghost btn-sm" onclick="showPage('dashboard')">Dashboard</button>
      <button class="btn btn-primary btn-sm" onclick="API.logout()">Logout</button>`;
  }
}

// ─── DONATE MODAL (wired to real API) ────────────────────────────────────────
let _activeCauseId = null;

function openDonateModal(causeId, title, impact) {
  _activeCauseId = causeId;
  const modal = document.getElementById("modal-donate") || document.getElementById("donate-modal");
  if (modal) {
    // Update impact text
    const impactEl = modal.querySelector("[data-impact]");
    if (impactEl) impactEl.textContent = impact;
    const titleEl = modal.querySelector("[data-cause-title]");
    if (titleEl) titleEl.textContent = title;
    // Show modal
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
    // Reset to step 1
    const s1 = modal.querySelector("#donate-step-1");
    const s2 = modal.querySelector("#donate-step-2");
    if (s1) s1.classList.remove("hidden");
    if (s2) s2.classList.add("hidden");
  }
}

// Override processDonation to use real API
window.processDonation = async function() {
  if (!API.isLoggedIn()) {
    alert("Please log in to donate.");
    const modal = document.getElementById("modal-donate") || document.getElementById("donate-modal");
    if (modal) { modal.classList.remove("open"); document.body.style.overflow = ""; }
    openModal("login");
    return;
  }

  const selectedBtn = document.querySelector(".amount-btn.selected");
  const customInput = document.getElementById("custom-amount");
  let amount = selectedBtn ? parseInt(selectedBtn.textContent.replace("₹","")) : 0;
  if (customInput?.value) amount = parseInt(customInput.value);

  if (!amount || amount < 10) {
    alert("Minimum donation is ₹10");
    return;
  }

  // Get causeId from select or active cause
  let causeId = _activeCauseId;
  const causeSelect = document.getElementById("cause-select");
  if (causeSelect?.dataset.id) causeId = causeSelect.dataset.id;

  if (!causeId) {
    alert("Please select a cause");
    return;
  }

  const btn = document.querySelector("#donate-step-1 .btn-orange");
  if (btn) { btn.textContent = "Processing..."; btn.disabled = true; }

  try {
    const data = await API.donate(causeId, amount);

    // Show success step
    const s1 = document.getElementById("donate-step-1");
    const s2 = document.getElementById("donate-step-2");
    if (s1) s1.classList.add("hidden");
    if (s2) {
      s2.classList.remove("hidden");
      const xpEl = s2.querySelector("[data-xp]");
      if (xpEl) xpEl.textContent = "+" + data.donation.xpEarned + " XP";
    }

    updateNavAuth();
  } catch (err) {
    alert("Donation failed: " + err.message);
  } finally {
    if (btn) { btn.textContent = "Donate Securely 🔒"; btn.disabled = false; }
  }
};

// ─── REGISTER FORM ────────────────────────────────────────────────────────────
window.handleRegister = async function() {
  const name  = document.querySelector("#modal-register [placeholder='Your full name']")?.value;
  const email = document.querySelector("#modal-register [type='email']")?.value;
  const pass  = document.querySelector("#modal-register [type='password']")?.value;

  if (!name || !email || !pass) { alert("All fields required"); return; }

  const btn = document.querySelector("#modal-register .btn-orange");
  if (btn) { btn.textContent = "Creating..."; btn.disabled = true; }

  try {
    await API.register(name, email, pass);
    closeModal("register");
    updateNavAuth();
    showPage("dashboard");
    loadDashboard();
  } catch (err) {
    alert(err.message);
  } finally {
    if (btn) { btn.textContent = "Create Account 🎉"; btn.disabled = false; }
  }
};

// ─── LOGIN FORM ───────────────────────────────────────────────────────────────
window.handleLogin = async function() {
  const email = document.querySelector("#modal-login [type='email']")?.value;
  const pass  = document.querySelector("#modal-login [type='password']")?.value;

  if (!email || !pass) { alert("Email and password required"); return; }

  const btn = document.querySelector("#modal-login .btn-primary");
  if (btn) { btn.textContent = "Signing in..."; btn.disabled = true; }

  try {
    await API.login(email, pass);
    closeModal("login");
    updateNavAuth();
    showPage("dashboard");
    loadDashboard();
  } catch (err) {
    alert(err.message);
  } finally {
    if (btn) { btn.textContent = "Sign In →"; btn.disabled = false; }
  }
};

// ─── NGO REGISTER ─────────────────────────────────────────────────────────────
window.handleNGORegister = async function() {
  const form = {
    name:           document.querySelector("#modal-ngoregister [placeholder='Official registered name']")?.value,
    email:          document.querySelector("#modal-ngoregister [type='email']")?.value,
    password:       "NGO@" + Math.random().toString(36).slice(2, 10), // temp password - sent via email in production
    regNumber:      document.querySelector("#modal-ngoregister [placeholder='NGO Reg. No.']")?.value,
    taxStatus:      document.querySelector("#modal-ngoregister select")?.value,
    areaOfWork:     document.querySelectorAll("#modal-ngoregister select")[1]?.value,
    volunteerCount: document.querySelector("#modal-ngoregister [type='number']")?.value
  };

  try {
    await API.ngoRegister(form);
    alert("Application submitted! We will contact you within 48 hours.");
    closeModal("ngoregister");
  } catch (err) {
    alert(err.message);
  }
};

// ─── DASHBOARD LOADER ─────────────────────────────────────────────────────────
window.loadDashboard = async function() {
  if (!API.isLoggedIn()) return;

  try {
    const { user, recentDonations, xpProgress, nextLevelXp } = await API.dashboard();

    // Update stat cards
    document.querySelectorAll("[data-dash='donated']").forEach(
      el => el.textContent = "₹" + (user.totalDonated || 0).toLocaleString());
    document.querySelectorAll("[data-dash='xp']").forEach(
      el => el.textContent = (user.xp || 0) + " XP");
    document.querySelectorAll("[data-dash='count']").forEach(
      el => el.textContent = user.donationCount || 0);
    document.querySelectorAll("[data-dash='badges']").forEach(
      el => el.textContent = (user.badges || []).length);
    document.querySelectorAll("[data-dash='name']").forEach(
      el => el.textContent = user.name);
    document.querySelectorAll("[data-dash='level']").forEach(
      el => el.textContent = user.level);

    // XP progress bar
    document.querySelectorAll("[data-dash='xpbar']").forEach(
      el => el.style.width = (xpProgress || 0) + "%");
    document.querySelectorAll("[data-dash='xptext']").forEach(
      el => el.textContent = (user.xp || 0) + " / " + (nextLevelXp || "MAX") + " XP");

    // Recent donations list
    const historyEl = document.getElementById("dash-history-list");
    if (historyEl && recentDonations?.length) {
      historyEl.innerHTML = recentDonations.map(d => `
        <div class="history-item">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
            <div style="display:flex;gap:14px;align-items:flex-start">
              <div style="width:48px;height:48px;background:var(--blue-l);border-radius:12px;
                   display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">
                ${d.cause?.icon || "🌟"}
              </div>
              <div>
                <div style="font-weight:700;font-size:16px">${d.cause?.title || "Donation"}</div>
                <div style="font-size:13px;color:var(--muted);margin-top:3px">
                  ${d.ngo?.name || "NGO"} · ${d.ngo?.location || d.location || "India"}
                </div>
                <div style="font-size:12px;color:var(--muted)">
                  ${new Date(d.createdAt).toLocaleDateString("en-IN",
                    { day:"numeric", month:"short", year:"numeric" })}
                </div>
              </div>
            </div>
            <div style="text-align:right">
              <div style="font-weight:800;font-size:20px">₹${d.amount}</div>
              <span class="badge ${d.status==='verified'?'badge-green':d.status==='completed'?'badge-blue':'badge-amber'}">
                ${d.status==='verified'?'✅ Verified':d.status==='completed'?'🔵 Completed':'⏳ Processing'}
              </span>
            </div>
          </div>
          ${d.proofVideo ? `
          <div class="video-thumb" onclick="window.open('${d.proofVideo}','_blank')"
               style="margin-top:14px">
            <div style="position:absolute;inset:0;background:linear-gradient(135deg,#1e3a8a,#1e293b)"></div>
            <div style="position:absolute;inset:0;display:flex;flex-direction:column;
                 align-items:center;justify-content:center;gap:10px">
              <div class="play-btn">▶</div>
              <span style="color:rgba(255,255,255,.8);font-size:13px;font-weight:600">
                Watch Proof Video
              </span>
            </div>
          </div>` : ""}
        </div>`).join("");
    }

    // Leaderboard
    loadLeaderboard();

  } catch (err) {
    console.error("Dashboard load error:", err);
  }
};

// ─── LEADERBOARD LOADER ───────────────────────────────────────────────────────
window.loadLeaderboard = async function() {
  try {
    const [donors, ngos] = await Promise.all([API.leaderDonors(), API.leaderNGOs()]);

    const donorRows = document.getElementById("donor-rows");
    if (donorRows) {
      donorRows.innerHTML = donors.slice(3).map((d, i) => `
        <div class="lb-row">
          <div style="display:flex;align-items:center;justify-content:center">
            <div style="width:32px;height:32px;background:var(--surface-m);border-radius:50%;
                 display:flex;align-items:center;justify-content:center;
                 font-size:13px;font-weight:700;color:var(--muted)">${i + 4}</div>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:40px;height:40px;border-radius:50%;background:var(--blue-l);
                 color:var(--blue);display:flex;align-items:center;justify-content:center;
                 font-family:var(--font);font-size:14px;font-weight:800;flex-shrink:0">
              ${d.name?.charAt(0) || "?"}
            </div>
            <div style="font-weight:600;font-size:14px">${d.name}</div>
          </div>
          <div style="font-weight:800;font-size:15px;color:var(--blue)">${d.xp} XP</div>
          <div style="font-size:14px;color:var(--muted)">${d.donationCount} donations</div>
        </div>`).join("");
    }

    const ngoRows = document.getElementById("ngo-rows");
    if (ngoRows) {
      ngoRows.innerHTML = ngos.map((n, i) => `
        <div class="lb-row ${i < 3 ? 'top3' : ''}">
          <div style="display:flex;align-items:center;justify-content:center">
            <div style="width:32px;height:32px;background:var(--surface-m);border-radius:50%;
                 display:flex;align-items:center;justify-content:center;
                 font-size:13px;font-weight:700;color:var(--muted)">${i + 1}</div>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:40px;height:40px;border-radius:12px;background:var(--blue-l);
                 color:var(--blue);display:flex;align-items:center;justify-content:center;
                 font-size:14px;font-weight:800;flex-shrink:0">
              ${n.name?.substring(0,2) || "NG"}
            </div>
            <div style="font-weight:600;font-size:14px">${n.name}</div>
          </div>
          <div style="font-weight:800;font-size:15px;color:var(--blue)">${n.impactScore} pts</div>
          <div style="font-size:14px;color:var(--muted)">${n.tasksCompleted} tasks</div>
        </div>`).join("");
    }
  } catch (err) {
    console.error("Leaderboard error:", err);
  }
};

// ─── TRANSPARENCY LOADER ──────────────────────────────────────────────────────
window.loadTransparency = async function() {
  const container = document.querySelector(".timeline");
  if (!container) return;
  try {
    const { logs } = await API.transparency({ limit: 10 });
    if (!logs?.length) return;
    container.innerHTML = logs.map(log => `
      <div class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-card">
          <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:14px">
            <div>
              <div style="font-weight:700;font-size:17px;margin-bottom:8px">
                ${log.description}
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <span class="badge badge-blue">🏢 ${log.ngo?.name || "NGO"}</span>
                <span class="badge badge-green">✅ Verified</span>
                ${log.location ? `<span class="badge badge-muted">📍 ${log.location}</span>` : ""}
              </div>
            </div>
            <div style="text-align:right">
              ${log.amount ? `<div style="font-weight:800;font-size:22px">₹${log.amount.toLocaleString()}</div>` : ""}
              <div class="text-sm text-muted">
                ${new Date(log.date).toLocaleDateString("en-IN",
                  { day:"numeric", month:"short", year:"numeric" })}
              </div>
            </div>
          </div>
          ${log.proofVideo ? `
          <div class="video-thumb" onclick="window.open('${log.proofVideo}','_blank')">
            <div style="position:absolute;inset:0;background:linear-gradient(135deg,#1e3a8a,#1e293b)"></div>
            <div style="position:absolute;inset:0;display:flex;flex-direction:column;
                 align-items:center;justify-content:center;gap:10px">
              <div class="play-btn">▶</div>
              <span style="color:rgba(255,255,255,.8);font-size:13px;font-weight:600">Watch Proof Video</span>
            </div>
          </div>` : ""}
        </div>
      </div>`).join("");
  } catch (_) {}
};

// ─── CONTACT FORM ─────────────────────────────────────────────────────────────
window.handleContact = async function() {
  const name    = document.querySelector("#page-contact [placeholder='Your full name']")?.value;
  const email   = document.querySelector("#page-contact [type='email']")?.value;
  const message = document.querySelector("#page-contact textarea")?.value;

  if (!name || !email || !message) { alert("All fields required"); return; }

  try {
    const data = await API.contact(name, email, message);
    alert(data.message);
  } catch (err) {
    alert(err.message);
  }
};

// Expose API globally so console debugging works
window.API = API;
console.log("🚀 ServeMate API loaded. Backend: https://resence.in/api");
