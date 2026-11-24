"use strict";

const STORAGE_KEY = "parallax-participants-v1";
const LEGACY_STORAGE_KEY = "campus-pulse-participants-v1";
const ADMIN_EMAIL = "admin@parallax.in";
const ADMIN_PASSWORD = "PulseAdmin26!";

const GAMES = [
  { id: "hackathon", name: "Hackathon", emoji: "💡", category: "Build a project" },
  { id: "coding-sprint", name: "Coding Sprint", emoji: "💻", category: "Fast-paced coding" },
  { id: "debugging-duel", name: "Debugging Duel", emoji: "🐞", category: "Find and fix bugs" },
  { id: "ui-ux-design", name: "UI/UX Design", emoji: "🎨", category: "Design challenge" },
  { id: "tech-quiz", name: "Tech Quiz", emoji: "🧠", category: "Tech trivia" },
  { id: "ai-idea-pitch", name: "AI Idea Pitch", emoji: "🤖", category: "Pitch an idea" },
];

const app = document.getElementById("app");
const toast = document.getElementById("toast");
let participants = loadParticipants();
let activeStudent = null;
let toastTimer;
let studentMode = "register";
let rosterQuery = "";

function loadParticipants() {
  try {
    let stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      const legacyStored = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyStored !== null) {
        localStorage.setItem(STORAGE_KEY, legacyStored);
        stored = legacyStored;
      }
    }
    if (stored === null) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error("Saved participant data has an unexpected format.");
    return parsed.map((person) => ({
      ...person,
      games: Array.isArray(person.games)
        ? person.games.filter((gameId) => GAMES.some((game) => game.id === gameId))
        : [],
    }));
  } catch (error) {
    console.error("Could not load saved participant data.", error);
    window.setTimeout(() => showToast("Saved participant data could not be read. Clear this site's browser data to start fresh.", true), 0);
    return [];
  }
}

function persistParticipants(nextParticipants) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextParticipants));
    participants = nextParticipants;
    return true;
  } catch (error) {
    console.error("Could not save participant data.", error);
    showToast("Your changes could not be saved in this browser. Check its storage settings and try again.", true);
    return false;
  }
}

function showToast(message, isError) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle("error", Boolean(isError));
  toast.classList.add("visible");
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 4200);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function normalizedEmail(email) {
  return email.trim().toLowerCase();
}

async function hashPassword(password) {
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    throw new Error("Secure password hashing is unavailable. Open this site on localhost in a modern browser.");
  }
  const bytes = new TextEncoder().encode(password);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function renderAuth() {
  app.innerHTML = `
    <div class="card-heading">
      <div>
        <span class="card-kicker">YOUR PARALLAX STARTS HERE</span>
        <h3>Come on in.</h3>
        <p>Register to save your spot, or sign in to update your games.</p>
      </div>
    </div>
    <div class="auth-tabs" role="tablist" aria-label="Account options">
      <button class="auth-tab ${studentMode === "register" ? "active" : ""}" type="button" role="tab" aria-selected="${studentMode === "register"}" data-mode="register">Create account</button>
      <button class="auth-tab ${studentMode === "login" ? "active" : ""}" type="button" role="tab" aria-selected="${studentMode === "login"}" data-mode="login">Student login</button>
      <button class="auth-tab" type="button" role="tab" aria-selected="false" data-mode="admin">Admin</button>
    </div>
    ${studentMode === "register" ? registerForm() : loginForm()}
  `;
  app.querySelectorAll(".auth-tab").forEach((tab) => tab.addEventListener("click", () => {
    if (tab.dataset.mode === "admin") {
      renderAdminLogin();
      return;
    }
    studentMode = tab.dataset.mode;
    renderAuth();
  }));
  const form = app.querySelector("form");
  form.addEventListener("submit", studentMode === "register" ? handleRegistration : handleStudentLogin);
}

function registerForm() {
  return `
    <form id="register-form">
      <div class="form-grid">
        <div class="field"><label for="student-name">Your full name</label><input id="student-name" name="name" autocomplete="name" placeholder="e.g. Aanya Sharma" minlength="2" maxlength="70" required /></div>
        <div class="field"><label for="student-email">College email</label><input id="student-email" name="email" type="email" autocomplete="email" maxlength="120" placeholder="you@college.edu" required /></div>
        <div class="field"><label for="student-college">College / university</label><input id="student-college" name="college" autocomplete="organization" maxlength="100" placeholder="Your college name" required /></div>
        <div class="field"><label for="student-city">College city</label><input id="student-city" name="city" autocomplete="address-level2" maxlength="70" placeholder="City" required /></div>
        <div class="field full"><label for="student-department">Department / course</label><input id="student-department" name="department" maxlength="80" placeholder="e.g. Computer Science" required /></div>
        <div class="field full"><label for="student-password">Create a password</label><input id="student-password" name="password" type="password" autocomplete="new-password" minlength="8" maxlength="72" placeholder="At least 8 characters" required /><span class="password-hint">Use at least 8 characters.</span></div>
      </div>
      <button class="primary-button" type="submit">Create account <span class="button-arrow">↗</span></button>
      <p class="form-note">Your details help event organisers verify and coordinate participants.</p>
    </form>
  `;
}

function loginForm() {
  return `
    <form id="student-login-form">
      <div class="form-grid">
        <div class="field full"><label for="login-email">College email</label><input id="login-email" name="email" type="email" autocomplete="email" maxlength="120" placeholder="you@college.edu" required /></div>
        <div class="field full"><label for="login-password">Password</label><input id="login-password" name="password" type="password" autocomplete="current-password" maxlength="72" placeholder="Your password" required /></div>
      </div>
      <button class="primary-button" type="submit">Sign in <span class="button-arrow">↗</span></button>
      <p class="form-note">Your account is stored in this browser for this demo.</p>
    </form>
  `;
}

async function handleRegistration(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const email = normalizedEmail(data.get("email"));
  if (participants.some((person) => person.email === email)) {
    showToast("An account already exists for that email. Try signing in instead.", true);
    return;
  }
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const participant = {
      id: globalThis.crypto.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: String(data.get("name")).trim(),
      email,
      college: String(data.get("college")).trim(),
      city: String(data.get("city")).trim(),
      department: String(data.get("department")).trim(),
      passwordHash: await hashPassword(String(data.get("password"))),
      games: [],
      registeredAt: new Date().toISOString(),
    };
    const nextParticipants = [...participants, participant];
    if (!persistParticipants(nextParticipants)) return;
    activeStudent = participant.id;
    renderStudentDashboard();
    showToast("Your account is ready. Pick the games you want to play.");
  } catch (error) {
    console.error("Could not create student account.", error);
    showToast(error.message || "Your account could not be created. Please try again.", true);
  } finally {
    submitButton.disabled = false;
  }
}

async function handleStudentLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  const email = normalizedEmail(data.get("email"));
  try {
    const passwordHash = await hashPassword(String(data.get("password")));
    const participant = participants.find((person) => person.email === email && person.passwordHash === passwordHash);
    if (!participant) {
      showToast("We couldn't match that email and password. Check your details or create an account.", true);
      return;
    }
    activeStudent = participant.id;
    renderStudentDashboard();
    showToast(`Welcome back, ${participant.name.split(/\s+/)[0]}!`);
  } catch (error) {
    console.error("Could not sign in student.", error);
    showToast(error.message || "Sign-in failed. Please try again.", true);
  }
}

function currentParticipant() {
  return participants.find((person) => person.id === activeStudent);
}

function gameOptions(selectedGames) {
  return GAMES.map((game) => {
    const checked = selectedGames.includes(game.id);
    return `
      <label class="game-option ${checked ? "selected" : ""}">
        <span class="game-emoji" aria-hidden="true">${game.emoji}</span>
        <span><strong>${game.name}</strong><small>${game.category}</small></span>
        <input type="checkbox" name="games" value="${game.id}" ${checked ? "checked" : ""} aria-label="Register for ${game.name}" />
      </label>
    `;
  }).join("");
}

function renderStudentDashboard() {
  const person = currentParticipant();
  if (!person) {
    activeStudent = null;
    renderAuth();
    return;
  }
  app.innerHTML = `
    <div class="dashboard-top">
      <div class="account-row">
        <div class="avatar" aria-hidden="true">${escapeHtml(initials(person.name))}</div>
        <div class="account-info"><strong>${escapeHtml(person.name)}</strong><span>${escapeHtml(person.college)}</span></div>
      </div>
      <button class="text-button" type="button" id="student-logout">Sign out ↗</button>
    </div>
    <h3 class="dashboard-title">Pick your games.</h3>
    <p class="dashboard-subtitle">Choose one or more — you can update them any time.</p>
    <div class="saved-banner" id="saved-games-banner">${savedGamesMarkup(person.games)}</div>
    <div class="games-title-row"><strong>Available games</strong><span class="selection-count" id="selection-count">${person.games.length} SELECTED</span></div>
    <form id="games-form">
      <div class="game-list">${gameOptions(person.games)}</div>
      <button class="primary-button" type="submit">Save my game choices <span class="button-arrow">↗</span></button>
      <p class="dashboard-note">You can register for more than one game. Event details will be shared by the organisers.</p>
    </form>
  `;
  app.querySelector("#student-logout").addEventListener("click", () => {
    activeStudent = null;
    studentMode = "login";
    renderAuth();
  });
  const form = app.querySelector("#games-form");
  form.querySelectorAll('input[name="games"]').forEach((input) => {
    input.addEventListener("change", () => {
      input.closest(".game-option").classList.toggle("selected", input.checked);
      const count = form.querySelectorAll('input[name="games"]:checked').length;
      app.querySelector("#selection-count").textContent = `${count} SELECTED`;
    });
  });
  form.addEventListener("submit", handleGameRegistration);
}

function savedGamesMarkup(gameIds) {
  if (gameIds.length === 0) return "<strong>No games selected yet.</strong> Pick your games below to register.";
  const names = gameIds.map((id) => GAMES.find((game) => game.id === id)?.name).filter(Boolean);
  return `<strong>Your spot is saved for:</strong><div class="saved-games">${names.map((name) => `<span class="saved-chip">${escapeHtml(name)}</span>`).join("")}</div>`;
}

function handleGameRegistration(event) {
  event.preventDefault();
  const selected = Array.from(event.currentTarget.querySelectorAll('input[name="games"]:checked'), (input) => input.value);
  if (selected.length === 0) {
    showToast("Choose at least one game before saving your registration.", true);
    return;
  }
  const person = currentParticipant();
  if (!person) return;
  const nextParticipants = participants.map((participant) => (
    participant.id === person.id ? { ...participant, games: selected } : participant
  ));
  if (persistParticipants(nextParticipants)) {
    renderStudentDashboard();
    showToast("Your game choices have been saved. Good luck out there!");
  }
}

function renderAdminLogin() {
  app.innerHTML = `
    <div class="card-heading">
      <div>
        <span class="card-kicker">ORGANISER ACCESS</span>
        <h3>Welcome, admin.</h3>
        <p>Sign in to see the participant list and game registrations.</p>
      </div>
    </div>
    <div class="auth-tabs" role="tablist" aria-label="Account options">
      <button class="auth-tab" type="button" data-mode="register">Create account</button>
      <button class="auth-tab" type="button" data-mode="login">Student login</button>
      <button class="auth-tab active" type="button" aria-selected="true" data-mode="admin">Admin</button>
    </div>
    <form id="admin-login-form">
      <div class="form-grid">
        <div class="field full"><label for="admin-email">Admin email</label><input id="admin-email" name="email" type="email" autocomplete="username" placeholder="Admin email" required /></div>
        <div class="field full"><label for="admin-password">Password</label><input id="admin-password" name="password" type="password" autocomplete="current-password" placeholder="Admin password" required /></div>
      </div>
      <button class="primary-button" type="submit">Open admin dashboard <span class="button-arrow">↗</span></button>
      <div class="demo-note"><strong>Demo access only</strong><br />Email: <code>${ADMIN_EMAIL}</code><br />Password: <code>${ADMIN_PASSWORD}</code></div>
      <p class="form-note">For demonstration only — this front-end login is not suitable for real admin data.</p>
    </form>
  `;
  app.querySelectorAll(".auth-tab").forEach((tab) => tab.addEventListener("click", () => {
    studentMode = tab.dataset.mode;
    renderAuth();
  }));
  app.querySelector("#admin-login-form").addEventListener("submit", handleAdminLogin);
}

function handleAdminLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const data = new FormData(form);
  if (normalizedEmail(data.get("email")) !== ADMIN_EMAIL || data.get("password") !== ADMIN_PASSWORD) {
    showToast("That admin email and password don't match the demo credentials.", true);
    return;
  }
  participants = loadParticipants();
  renderAdminDashboard();
  showToast("Admin dashboard opened.");
}

function gameTotals() {
  return GAMES.map((game) => ({
    ...game,
    count: participants.filter((person) => Array.isArray(person.games) && person.games.includes(game.id)).length,
  }));
}

function renderAdminDashboard() {
  const totals = gameTotals();
  const registrations = totals.reduce((sum, game) => sum + game.count, 0);
  const topGame = [...totals].sort((a, b) => b.count - a.count)[0];
  app.innerHTML = `
    <div class="admin-heading">
      <div><span class="card-kicker">ORGANISER OVERVIEW</span><h3>All in one place.</h3><p>${participants.length} registered student${participants.length === 1 ? "" : "s"} found in this browser.</p></div>
      <span class="admin-badge">ADMIN</span>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><span>STUDENTS</span><strong>${participants.length}</strong></div>
      <div class="stat-card"><span>GAME REGISTRATIONS</span><strong>${registrations}</strong></div>
      <div class="stat-card"><span>MOST POPULAR</span><strong>${topGame && topGame.count > 0 ? escapeHtml(topGame.name) : "—"}</strong></div>
    </div>
    <div class="admin-section-head"><h4>Registrations by game</h4><div><button class="export-button" id="refresh-roster" type="button">Refresh</button> <button class="export-button" id="export-csv" type="button">Export CSV ↓</button></div></div>
    <div class="game-count-list">${totals.map((game) => `<div class="game-count"><span>${game.emoji} ${game.name}</span><strong>${game.count}</strong></div>`).join("")}</div>
    <input class="roster-search" id="roster-search" type="search" aria-label="Search participants" placeholder="Search name, college, email, or game…" value="${escapeHtml(rosterQuery)}" />
    <div class="table-wrap">
      <table class="roster-table">
        <thead><tr><th>STUDENT</th><th>COLLEGE</th><th>GAMES</th></tr></thead>
        <tbody id="roster-body">${rosterRows(rosterQuery)}</tbody>
      </table>
    </div>
    <p class="admin-disclaimer">Demo only: registrations are stored in this browser and are not shared across devices. Use a secure server and database before collecting real student information.</p>
    <button class="text-button" id="admin-logout" type="button">Sign out of admin ↗</button>
  `;
  app.querySelector("#roster-search").addEventListener("input", (event) => {
    rosterQuery = event.currentTarget.value;
    app.querySelector("#roster-body").innerHTML = rosterRows(rosterQuery);
  });
  app.querySelector("#refresh-roster").addEventListener("click", () => {
    participants = loadParticipants();
    renderAdminDashboard();
    showToast(`Roster refreshed. ${participants.length} student${participants.length === 1 ? "" : "s"} found.`);
  });
  app.querySelector("#export-csv").addEventListener("click", exportCsv);
  app.querySelector("#admin-logout").addEventListener("click", () => {
    rosterQuery = "";
    renderAdminLogin();
  });
}

function rosterRows(query) {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = participants.filter((person) => {
    const games = Array.isArray(person.games) ? person.games : [];
    const haystack = [person.name, person.email, person.college, person.city, person.department, ...games.map((id) => GAMES.find((game) => game.id === id)?.name || "")].join(" ").toLowerCase();
    return haystack.includes(normalizedQuery);
  });
  if (filtered.length === 0) {
    return `<tr><td class="empty-roster" colspan="3">${participants.length === 0 ? "No students have registered yet." : "No participants match your search."}</td></tr>`;
  }
  return filtered.map((person) => {
    const games = Array.isArray(person.games) ? person.games.map((id) => GAMES.find((game) => game.id === id)?.name).filter(Boolean) : [];
    return `<tr><td>${escapeHtml(person.name)}<br /><span>${escapeHtml(person.email)}</span></td><td>${escapeHtml(person.college)}<br /><span>${escapeHtml(person.city)}</span></td><td>${games.length ? games.map(escapeHtml).join(", ") : "Not selected"}</td></tr>`;
  }).join("");
}

function exportCsv() {
  const headers = ["Name", "Email", "College", "City", "Department", "Games", "Registered at"];
  const rows = participants.map((person) => [
    person.name,
    person.email,
    person.college,
    person.city,
    person.department,
    (person.games || []).map((id) => GAMES.find((game) => game.id === id)?.name).filter(Boolean).join("; "),
    person.registeredAt,
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "parallax-participants.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Participant list exported as CSV.");
}

function csvCell(value) {
  const safeValue = String(value ?? "").replace(/"/g, '""');
  return `"${safeValue}"`;
}

document.getElementById("admin-shortcut").addEventListener("click", () => {
  if (document.activeElement) document.activeElement.blur();
  renderAdminLogin();
});

renderAuth();