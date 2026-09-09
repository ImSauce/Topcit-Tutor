// ============================================================================
// Small shared helpers: DOM, formatting, toasts, modals, CSV export.
// No Firebase in here - keep this file dependency-free.
// ============================================================================

// ---- DOM -------------------------------------------------------------------

/** Escape a value for safe insertion into HTML. */
export function esc(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Build an element from an HTML string. */
export function html(str) {
  const t = document.createElement("template");
  t.innerHTML = str.trim();
  return t.content.firstElementChild;
}

/** Delegated click handler: on(root, "[data-act='x']", handler) */
export function on(root, selector, handler, evt = "click") {
  root.addEventListener(evt, (e) => {
    const target = e.target.closest(selector);
    if (target && root.contains(target)) handler(e, target);
  });
}

export function debounce(fn, ms = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ---- Formatting ------------------------------------------------------------

/** Firestore Timestamp | Date | number | ISO string -> Date | null */
export function toDate(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return isNaN(value) ? null : value;
  if (typeof value === "object" && typeof value.toDate === "function") {
    try { return value.toDate(); } catch { return null; }
  }
  if (typeof value === "object" && typeof value.seconds === "number") {
    return new Date(value.seconds * 1000);
  }
  if (typeof value === "number") return new Date(value);
  const d = new Date(value);
  return isNaN(d) ? null : d;
}

export function fmtDate(value, fallback = "—") {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function fmtDateTime(value, fallback = "—") {
  const d = toDate(value);
  if (!d) return fallback;
  return d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

/** "3 days ago" / "in 2 hours" */
export function relTime(value, fallback = "—") {
  const d = toDate(value);
  if (!d) return fallback;
  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);
  const units = [
    ["year", 31536e6], ["month", 2592e6], ["day", 864e5],
    ["hour", 36e5], ["minute", 6e4], ["second", 1000]
  ];
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [unit, ms] of units) {
    if (abs >= ms || unit === "second") return rtf.format(Math.round(diff / ms), unit);
  }
  return fallback;
}

/** Seconds -> "1m 45s" */
export function fmtDuration(seconds) {
  const s = Number(seconds);
  if (!isFinite(s) || s <= 0) return "0s";
  const m = Math.floor(s / 60);
  const rest = Math.round(s % 60);
  return m > 0 ? `${m}m ${rest}s` : `${rest}s`;
}

export function fmtNum(value) {
  const n = Number(value);
  return isFinite(n) ? n.toLocaleString() : "0";
}

export function pct(part, total) {
  const p = Number(part), t = Number(total);
  if (!isFinite(p) || !isFinite(t) || t <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((p / t) * 100)));
}

/** Render any Firestore value as a short readable string. */
export function fmtValue(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  const d = toDate(value);
  if (d) return fmtDateTime(d);
  if (Array.isArray(value)) return `[${value.map(fmtValue).join(", ")}]`;
  if (value && typeof value.path === "string") return `→ ${value.path}`;
  try { return JSON.stringify(value); } catch { return String(value); }
}

// ---- XP / level math (mirrors Assets/Scripts/Mechanics/LevelingRules.cs) ----

export const LEVELING = { startingXpCap: 50, xpIncreasePerLevel: 10 };

export function xpCapForLevel(level, rules = LEVELING) {
  const lvl = Math.max(1, Number(level) || 1);
  return rules.startingXpCap + (lvl - 1) * rules.xpIncreasePerLevel;
}

/** Rolls XP into as many level-ups as needed, exactly like LevelingRules.ApplyXpGain. */
export function applyXpGain(currentLevel, currentXp, xpToAdd, rules = LEVELING) {
  let level = Math.max(1, Number(currentLevel) || 1);
  let xp = (Number(currentXp) || 0) + (Number(xpToAdd) || 0);
  if (xp < 0) xp = 0;
  let cap = xpCapForLevel(level, rules);
  let guard = 0;
  while (xp >= cap && guard++ < 10000) {
    xp -= cap;
    level += 1;
    cap = xpCapForLevel(level, rules);
  }
  return { level, xp };
}

// ---- Toasts ----------------------------------------------------------------

export function toast(message, kind = "good", ms = 3600) {
  const root = document.getElementById("toasts");
  if (!root) return;
  const el = html(`<div class="toast ${esc(kind)}">${esc(message)}</div>`);
  root.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity .25s";
    setTimeout(() => el.remove(), 250);
  }, ms);
}

/** Turn a Firebase error into something a human can act on. */
export function errorMessage(err) {
  const code = err && err.code ? String(err.code) : "";
  const map = {
    "permission-denied": "Permission denied. Your account may not be in the Admins collection, or the Firestore rules block this write.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/wrong-password": "Incorrect email or password.",
    "auth/user-not-found": "No account exists with that email.",
    "auth/invalid-email": "That email address is not valid.",
    "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
    "auth/email-already-in-use": "That email is already registered.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/network-request-failed": "Network error. Check your internet connection.",
    "auth/operation-not-allowed": "Email/password sign-in is disabled in the Firebase console.",
    "unavailable": "Cannot reach Firestore. Check your internet connection.",
    "failed-precondition": "Firestore needs an index for this query. Open the browser console for the creation link."
  };
  if (map[code]) return map[code];
  return (err && err.message) ? err.message.replace(/^Firebase:\s*/, "") : "Something went wrong.";
}

// ---- Modals ----------------------------------------------------------------

/**
 * Open a modal.
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.body        HTML string for the body
 * @param {string} [opts.confirmText]
 * @param {string} [opts.confirmClass]
 * @param {boolean} [opts.wide]
 * @param {(body: HTMLElement) => any} [opts.onOpen]  runs after mount
 * @param {(body: HTMLElement) => any|Promise<any>} [opts.onConfirm]
 *        return false to keep the modal open
 * @returns {Promise<any>} resolves with the onConfirm result, or null if cancelled
 */
export function openModal(opts) {
  return new Promise((resolve) => {
    const root = document.getElementById("modal-root");
    const backdrop = html(`
      <div class="modal-backdrop">
        <div class="modal ${opts.wide ? "wide" : ""}" role="dialog" aria-modal="true">
          <div class="modal-head">
            <h3>${esc(opts.title || "")}</h3>
            <button class="btn btn-ghost btn-icon" data-close aria-label="Close">✕</button>
          </div>
          <div class="modal-body">${opts.body || ""}</div>
          <div class="modal-foot">
            <button class="btn" data-close>${esc(opts.cancelText || "Cancel")}</button>
            ${opts.confirmText
              ? `<button class="btn ${opts.confirmClass || "btn-primary"}" data-confirm>${esc(opts.confirmText)}</button>`
              : ""}
          </div>
        </div>
      </div>`);

    const bodyEl = backdrop.querySelector(".modal-body");
    let settled = false;

    const close = (value) => {
      if (settled) return;
      settled = true;
      document.removeEventListener("keydown", onKey);
      backdrop.remove();
      resolve(value);
    };

    const onKey = (e) => { if (e.key === "Escape") close(null); };
    document.addEventListener("keydown", onKey);

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop || e.target.closest("[data-close]")) close(null);
    });

    const confirmBtn = backdrop.querySelector("[data-confirm]");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", async () => {
        if (!opts.onConfirm) return close(true);
        confirmBtn.disabled = true;
        const original = confirmBtn.textContent;
        confirmBtn.innerHTML = `<span class="spinner"></span>Working…`;
        try {
          const result = await opts.onConfirm(bodyEl);
          if (result === false) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = original;
            return;
          }
          close(result === undefined ? true : result);
        } catch (err) {
          console.error(err);
          toast(errorMessage(err), "bad", 6000);
          confirmBtn.disabled = false;
          confirmBtn.textContent = original;
        }
      });
    }

    root.appendChild(backdrop);
    if (opts.onOpen) opts.onOpen(bodyEl);
    const focusable = bodyEl.querySelector("input, textarea, select");
    if (focusable) focusable.focus();
  });
}

/** Yes/no confirmation. Resolves true only when confirmed. */
export function confirmAction({ title, message, confirmText = "Confirm", danger = false, typeToConfirm = null }) {
  return openModal({
    title,
    body: `
      <p class="hint" style="font-size:13px;color:var(--text)">${message}</p>
      ${typeToConfirm ? `
        <label class="field" style="margin-top:14px">
          <span>Type <code>${esc(typeToConfirm)}</code> to confirm</span>
          <input type="text" data-typed autocomplete="off" />
        </label>` : ""}`,
    confirmText,
    confirmClass: danger ? "btn-danger" : "btn-primary",
    onConfirm: (body) => {
      if (typeToConfirm) {
        const typed = body.querySelector("[data-typed]").value.trim();
        if (typed !== typeToConfirm) {
          toast(`You must type "${typeToConfirm}" exactly.`, "warn");
          return false;
        }
      }
      return true;
    }
  }).then((v) => v === true);
}

// ---- CSV -------------------------------------------------------------------

/** rows: array of plain objects. Downloads a CSV file. */
export function downloadCSV(filename, rows) {
  if (!rows || rows.length === 0) {
    toast("Nothing to export.", "warn");
    return;
  }
  const headers = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((k) => set.add(k));
    return set;
  }, new Set()));

  const cell = (v) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? fmtValue(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => cell(r[h])).join(","))].join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- Misc ------------------------------------------------------------------

export function loadingHTML(text = "Loading…") {
  return `<div class="loading"><span class="spinner"></span>${esc(text)}</div>`;
}

export function emptyHTML(text = "Nothing here yet.") {
  return `<div class="empty">${esc(text)}</div>`;
}

export function boolBadge(value, trueText = "Yes", falseText = "No") {
  return value
    ? `<span class="badge good">${esc(trueText)}</span>`
    : `<span class="badge">${esc(falseText)}</span>`;
}

export function barHTML(value, total, good = false) {
  const p = pct(value, total);
  return `<div class="bar-row">
    <div class="bar ${good && p === 100 ? "good" : ""}"><i style="width:${p}%"></i></div>
    <span>${p}%</span>
  </div>`;
}

/** Sort helper that copes with mixed types and missing values. */
export function compare(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}
