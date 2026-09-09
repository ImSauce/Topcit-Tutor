// ============================================================================
// main.js - application shell: sign-in gate, admin check, hash router.
// ============================================================================

import {
  auth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail
} from "./firebase.js";
import { fetchAdminRecord, getConfig, logAction } from "./store.js";
import { $, esc, toast, errorMessage, loadingHTML } from "./util.js";

// ---- Theme -----------------------------------------------------------------

const THEME_KEY = "tt-admin-theme";
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
}
applyTheme(localStorage.getItem(THEME_KEY) || "dark");

$("#theme-toggle").addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(next);
});

// ---- Routes ----------------------------------------------------------------

const ROUTES = {
  dashboard:     { title: "Dashboard",             module: () => import("./views/dashboard.js") },
  users:         { title: "User Management",       module: () => import("./views/users.js") },
  user:          { title: "Student",               module: () => import("./views/user.js"), hideNav: true },
  progress:      { title: "Progress Monitoring",   module: () => import("./views/progress.js") },
  leaderboard:   { title: "Leaderboard",           module: () => import("./views/leaderboard.js") },
  curriculum:    { title: "Curriculum",            module: () => import("./views/curriculum.js") },
  achievements:  { title: "Achievements & Badges", module: () => import("./views/achievements.js") },
  economy:       { title: "In-App Economy",        module: () => import("./views/economy.js") },
  announcements: { title: "Announcements",         module: () => import("./views/announcements.js") },
  reports:       { title: "Reports & Analytics",   module: () => import("./views/reports.js") },
  explorer:      { title: "Database Explorer",     module: () => import("./views/explorer.js") },
  settings:      { title: "Settings & Admins",     module: () => import("./views/settings.js") }
};

/** Shared context handed to every view. */
export const ctx = {
  admin: null,          // { id, name, email, role }
  config: null,         // Config/gamification, with defaults filled in
  navigate: (hash) => { window.location.hash = hash; },
  reloadConfig: async () => { ctx.config = await getConfig(); return ctx.config; }
};

let currentToken = 0;

function parseHash() {
  const raw = (window.location.hash || "#/dashboard").replace(/^#\/?/, "");
  const parts = raw.split("/").filter(Boolean);
  const name = parts[0] || "dashboard";
  // #/users/<uid> renders the single-student view
  if (name === "users" && parts[1]) return { route: "user", params: { uid: decodeURIComponent(parts[1]) } };
  return { route: ROUTES[name] ? name : "dashboard", params: { rest: parts.slice(1) } };
}

function setCrumbs(parts) {
  $("#crumbs").innerHTML = parts
    .map((p, i) => (i === parts.length - 1 ? `<strong>${esc(p)}</strong>` : `${esc(p)}<span class="sep">/</span>`))
    .join("");
}

function markNav(route) {
  document.querySelectorAll("#nav a").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === route);
  });
}

async function renderRoute() {
  const token = ++currentToken;
  const { route, params } = parseHash();
  const def = ROUTES[route];
  const view = $("#view");

  markNav(def.hideNav ? "users" : route);
  setCrumbs([def.title]);
  view.innerHTML = loadingHTML();
  document.getElementById("app-shell").classList.remove("menu-open");

  try {
    const mod = await def.module();
    if (token !== currentToken) return;               // a newer navigation won
    ctx.setCrumbs = setCrumbs;
    await mod.render(view, params, ctx);              // the live ctx, so config updates propagate
  } catch (err) {
    console.error(err);
    if (token !== currentToken) return;
    view.innerHTML = `
      <div class="card"><div class="card-body">
        <div class="notice">
          <strong>Could not load “${esc(def.title)}”.</strong>
          <p class="hint" style="margin-top:6px">${esc(errorMessage(err))}</p>
        </div>
      </div></div>`;
  }
}

window.addEventListener("hashchange", renderRoute);

$("#menu-toggle").addEventListener("click", () => {
  document.getElementById("app-shell").classList.toggle("menu-open");
});

// ---- Auth ------------------------------------------------------------------

const loginScreen = $("#login-screen");
const appShell    = $("#app-shell");
const loginForm   = $("#login-form");
const loginError  = $("#login-error");

function showLoginError(message) {
  loginError.textContent = message;
  loginError.hidden = false;
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#login-submit");
  const email = $("#login-email").value.trim();
  const password = $("#login-password").value;
  loginError.hidden = true;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span>Signing in…`;
  try {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged takes it from here.
  } catch (err) {
    showLoginError(errorMessage(err));
    btn.disabled = false;
    btn.textContent = "Sign in";
  }
});

$("#login-reset").addEventListener("click", async () => {
  const email = $("#login-email").value.trim();
  if (!email) return showLoginError("Enter your email address first, then press this again.");
  try {
    await sendPasswordResetEmail(auth, email);
    loginError.hidden = true;
    toast(`Password reset email sent to ${email}.`, "good", 6000);
  } catch (err) {
    showLoginError(errorMessage(err));
  }
});

$("#logout").addEventListener("click", async () => {
  await signOut(auth);
});

function resetLoginButton() {
  const btn = $("#login-submit");
  btn.disabled = false;
  btn.textContent = "Sign in";
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    ctx.admin = null;
    appShell.hidden = true;
    loginScreen.hidden = false;
    resetLoginButton();
    return;
  }

  // Signed in - but only accounts present in Admins/{uid} may use this portal.
  let record = null;
  try {
    record = await fetchAdminRecord(user.uid);
  } catch (err) {
    console.error(err);
    showLoginError(
      "Signed in, but the Admins collection could not be read. Check your Firestore rules. " +
      `(${errorMessage(err)})`
    );
    await signOut(auth);
    resetLoginButton();
    return;
  }

  if (!record) {
    showLoginError(
      "This account is not an administrator. Add a document with ID " +
      `"${user.uid}" to the Admins collection in Firestore to grant access.`
    );
    console.info("Your Firebase Auth UID is:", user.uid);
    await signOut(auth);
    resetLoginButton();
    return;
  }

  ctx.admin = { id: user.uid, email: user.email, ...record };
  $("#who-name").textContent = record.name || user.email;
  $("#who-role").textContent = record.role || "Administrator";

  loginScreen.hidden = true;
  appShell.hidden = false;
  resetLoginButton();

  try { ctx.config = await getConfig(); } catch { ctx.config = null; }
  logAction("admin.signIn", user.email || user.uid);

  if (!window.location.hash) window.location.hash = "#/dashboard";
  renderRoute();
});
