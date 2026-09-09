// ============================================================================
// Database Explorer - browse and edit any document in Firestore, the way the
// Firebase console does, but scoped to this project's schema.
//
// The web SDK cannot enumerate subcollections, so nesting comes from the
// declared schema in store.js (subcollectionsFor).
// ============================================================================

import {
  ROOT_COLLECTIONS, subcollectionsFor, listCollection, getDocument,
  setDocument, deleteDocument, deleteRecursive, logAction
} from "../store.js";
import {
  esc, on, toast, openModal, confirmAction, errorMessage, emptyHTML,
  loadingHTML, fmtValue, toDate, downloadCSV
} from "../util.js";

let path = "";   // "" = root, odd segments = collection, even = document

export async function render(view, params, ctx) {
  view.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div style="flex:1;min-width:220px">
          <h2>Database explorer</h2>
          <p data-crumbs class="mono"></p>
        </div>
        <div class="toolbar">
          <input type="text" data-path placeholder="Users/abc123/Subjects" style="width:260px" />
          <button class="btn btn-sm" data-act="go">Go</button>
          <button class="btn btn-sm" data-act="root">Root</button>
        </div>
      </div>
      <div class="card-body tight" data-panel></div>
    </div>`;

  const panel = view.querySelector("[data-panel]");
  const crumbs = view.querySelector("[data-crumbs]");
  const pathInput = view.querySelector("[data-path]");

  const go = (p) => { path = p.replace(/^\/+|\/+$/g, ""); draw(); };

  on(view, '[data-act="go"]', () => go(pathInput.value.trim()));
  on(view, '[data-act="root"]', () => go(""));
  pathInput.addEventListener("keydown", (e) => { if (e.key === "Enter") go(pathInput.value.trim()); });

  // preventDefault keeps the breadcrumb links from touching the router's hash.
  on(view, "[data-goto]", (e, el) => { e.preventDefault(); go(el.dataset.goto); });

  async function draw() {
    pathInput.value = path;
    const parts = path.split("/").filter(Boolean);
    crumbs.innerHTML = `<a href="#" data-goto="">root</a>` + parts.map((seg, i) => {
      const sub = parts.slice(0, i + 1).join("/");
      return ` / <a href="#" data-goto="${esc(sub)}">${esc(seg)}</a>`;
    }).join("");

    panel.innerHTML = loadingHTML();
    try {
      if (!path) return drawRoot();
      if (parts.length % 2 === 1) return drawCollection();
      return drawDocument();
    } catch (err) {
      panel.innerHTML = `<div class="notice" style="margin:16px">${esc(errorMessage(err))}</div>`;
    }
  }

  function drawRoot() {
    panel.innerHTML = `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Collection</th><th>What it holds</th><th></th></tr></thead>
        <tbody>
          ${ROOT_COLLECTIONS.map((c) => `
            <tr class="row-link" data-goto="${esc(c)}">
              <td class="mono"><strong>${esc(c)}</strong></td>
              <td>${esc(DESCRIPTIONS[c] || "")}</td>
              <td class="actions"><button class="btn btn-xs" data-goto="${esc(c)}">Open</button></td>
            </tr>`).join("")}
        </tbody>
      </table></div>
      <div class="pager"><span>Type any path above to jump straight to it, e.g.
        <code>Users/&lt;uid&gt;/Subjects/subject_1/Modules</code></span></div>`;
  }

  async function drawCollection() {
    const docs = await listCollection(path);
    const keys = Array.from(docs.reduce((set, d) => {
      Object.keys(d).forEach((k) => { if (k !== "id" && k !== "path") set.add(k); });
      return set;
    }, new Set())).slice(0, 7);

    panel.innerHTML = `
      <div class="toolbar" style="padding:12px 16px;border-bottom:1px solid var(--border)">
        <span class="hint grow">${docs.length} document${docs.length === 1 ? "" : "s"} in <code>${esc(path)}</code></span>
        <button class="btn btn-sm" data-act="export-col">Export CSV</button>
        <button class="btn btn-primary btn-sm" data-act="new-doc">+ New document</button>
      </div>
      ${docs.length ? `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Document ID</th>${keys.map((k) => `<th>${esc(k)}</th>`).join("")}<th></th></tr></thead>
        <tbody>
          ${docs.map((d) => `
            <tr class="row-link" data-goto="${esc(d.path)}">
              <td class="mono"><strong>${esc(d.id)}</strong></td>
              ${keys.map((k) => `<td><span class="trunc">${esc(fmtValue(d[k]))}</span></td>`).join("")}
              <td class="actions"><div class="btn-row" style="justify-content:flex-end">
                <button class="btn btn-xs" data-goto="${esc(d.path)}">Open</button>
                <button class="btn btn-xs btn-danger" data-act="del-doc" data-p="${esc(d.path)}">Delete</button>
              </div></td>
            </tr>`).join("")}
        </tbody>
      </table></div>` : emptyHTML("This collection is empty.")}`;

    on(panel, '[data-act="export-col"]', () => downloadCSV(path.replace(/\//g, "_"), docs));

    on(panel, '[data-act="del-doc"]', async (e, el) => {
      e.stopPropagation();
      const target = el.dataset.p;
      const ok = await confirmAction({
        title: "Delete document",
        message: `Deletes <code>${esc(target)}</code> and everything nested beneath it.`,
        confirmText: "Delete", danger: true
      });
      if (!ok) return;
      await deleteRecursive(target);
      await logAction("explorer.delete", target);
      toast("Deleted.", "good");
      draw();
    });

    on(panel, '[data-act="new-doc"]', async () => {
      await openModal({
        title: `New document in ${path}`,
        wide: true,
        body: `
          <label class="field"><span>Document ID</span>
            <input type="text" data-id placeholder="leave blank for an auto ID" /></label>
          <label class="field" style="margin-top:14px"><span>Fields (JSON)</span>
            <textarea class="mono" data-json rows="8">{
  "example": "value"
}</textarea>
            <small>Use ISO date strings for timestamps, e.g. "2026-08-06T00:00:00Z" — they are converted automatically.</small>
          </label>`,
        confirmText: "Create",
        onConfirm: async (body) => {
          const id = body.querySelector("[data-id]").value.trim() || autoId();
          let data;
          try {
            data = reviveDates(JSON.parse(body.querySelector("[data-json]").value));
          } catch (err) {
            toast(`Invalid JSON: ${err.message}`, "warn", 5000);
            return false;
          }
          await setDocument(`${path}/${id}`, data, false);
          await logAction("explorer.create", `${path}/${id}`, data);
          toast("Document created.", "good");
          draw();
        }
      });
    });
  }

  async function drawDocument() {
    const data = await getDocument(path);
    const subs = subcollectionsFor(path);

    if (!data) {
      panel.innerHTML = `<div class="notice" style="margin:16px">
        No document at <code>${esc(path)}</code>. It may still have subcollections below it.
      </div>${subsHTML(subs)}`;
      return;
    }

    const entries = Object.entries(data)
      .filter(([k]) => k !== "id" && k !== "path")
      .sort(([a], [b]) => a.localeCompare(b));

    panel.innerHTML = `
      <div class="toolbar" style="padding:12px 16px;border-bottom:1px solid var(--border)">
        <span class="hint grow mono">${esc(path)}</span>
        <button class="btn btn-sm" data-act="edit-json">Edit as JSON</button>
        <button class="btn btn-sm btn-danger" data-act="del-this">Delete document</button>
      </div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Field</th><th>Type</th><th>Value</th></tr></thead>
        <tbody>
          ${entries.length ? entries.map(([k, v]) => `
            <tr>
              <td class="mono"><strong>${esc(k)}</strong></td>
              <td><span class="badge">${esc(typeOf(v))}</span></td>
              <td>${esc(fmtValue(v))}</td>
            </tr>`).join("")
            : `<tr><td colspan="3" class="empty">This document has no fields.</td></tr>`}
        </tbody>
      </table></div>
      ${subsHTML(subs)}`;

    on(panel, '[data-act="del-this"]', async () => {
      const ok = await confirmAction({
        title: "Delete document",
        message: `Deletes <code>${esc(path)}</code> and everything nested beneath it.`,
        confirmText: "Delete", danger: true, typeToConfirm: path.split("/").pop()
      });
      if (!ok) return;
      await deleteRecursive(path);
      await logAction("explorer.delete", path);
      toast("Deleted.", "good");
      go(path.split("/").slice(0, -1).join("/"));
    });

    on(panel, '[data-act="edit-json"]', async () => {
      await openModal({
        title: "Edit document",
        wide: true,
        body: `<label class="field"><span>Fields (JSON)</span>
            <textarea class="mono" data-json rows="16">${esc(JSON.stringify(plain(data), null, 2))}</textarea>
            <small>Saved with merge, so fields you remove here stay in Firestore.
            Set a field to null to blank it.</small></label>`,
        confirmText: "Save",
        onConfirm: async (body) => {
          let parsed;
          try {
            parsed = reviveDates(JSON.parse(body.querySelector("[data-json]").value));
          } catch (err) {
            toast(`Invalid JSON: ${err.message}`, "warn", 5000);
            return false;
          }
          delete parsed.id;
          delete parsed.path;
          await setDocument(path, parsed, true);
          await logAction("explorer.edit", path, parsed);
          toast("Saved.", "good");
          draw();
        }
      });
    });
  }

  function subsHTML(subs) {
    if (!subs.length) return "";
    return `<div class="pager" style="justify-content:flex-start;gap:8px;flex-wrap:wrap">
      <span>Subcollections:</span>
      ${subs.map((s) => `<button class="btn btn-xs" data-goto="${esc(path)}/${esc(s)}">${esc(s)}</button>`).join("")}
    </div>`;
  }

  draw();
}

const DESCRIPTIONS = {
  Users: "Student profiles, with Achievements / Inventory / Subjects beneath each one",
  Admins: "Accounts allowed to sign in to this portal",
  AchievementCatalog: "Master achievement and badge definitions",
  ItemCatalog: "Master shop items, collectibles and hint packs",
  SubjectCatalog: "Master curriculum: subjects → modules → lesson & quiz IDs",
  Announcements: "Messages shown to students",
  Config: "Gamification tuning (XP curve, reward rates)",
  AdminLogs: "Audit trail of every change made from this portal"
};

function typeOf(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "object" && toDate(v)) return "timestamp";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

/** Firestore values -> plain JSON (timestamps become ISO strings). */
function plain(obj) {
  const out = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (k === "id" || k === "path") return;
    if (v && typeof v === "object" && typeof v.toDate === "function") out[k] = v.toDate().toISOString();
    else out[k] = v;
  });
  return out;
}

/** ISO-looking strings -> Date, so they land in Firestore as timestamps. */
function reviveDates(obj) {
  const isoish = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
  const walk = (v) => {
    if (typeof v === "string" && isoish.test(v)) {
      const d = new Date(v);
      return isNaN(d) ? v : d;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out = {};
      Object.entries(v).forEach(([k, val]) => { out[k] = walk(val); });
      return out;
    }
    return v;
  };
  return walk(obj);
}

function autoId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 20; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}
