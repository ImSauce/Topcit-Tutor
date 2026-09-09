// ============================================================================
// Settings & Admins - XP curve, administrator accounts, audit log.
// ============================================================================

import {
  getConfig, saveConfig, listAdmins, saveAdmin, removeAdmin, listLogs,
  DEFAULT_CONFIG
} from "../store.js";
import { auth, firebaseConfig } from "../firebase.js";
import {
  esc, on, toast, openModal, confirmAction, errorMessage, emptyHTML,
  loadingHTML, fmtDateTime, relTime, fmtValue, xpCapForLevel, downloadCSV
} from "../util.js";

export async function render(view, params, ctx) {
  view.innerHTML = loadingHTML();
  const [config, admins, logs] = await Promise.all([getConfig(), listAdmins(), listLogs(200)]);

  const preview = [1, 2, 3, 5, 10, 20].map((lvl) =>
    `<tr><td class="num">${lvl}</td><td class="num">${xpCapForLevel(lvl, config)}</td></tr>`).join("");

  view.innerHTML = `
    <div class="grid cols-2">
      <div class="card">
        <div class="card-head">
          <div style="flex:1;min-width:180px">
            <h2>Gamification &amp; XP curve</h2>
            <p>Written to <code>Config/gamification</code>.</p>
          </div>
          <div class="btn-row">
            <button class="btn btn-sm" data-act="defaults">Restore defaults</button>
            <button class="btn btn-primary btn-sm" data-act="save">Save</button>
          </div>
        </div>
        <div class="card-body">
          <div class="form-grid">
            ${num("startingXpCap", "XP needed for level 1", config, "Matches LevelingRules.StartingXpCap in Unity.")}
            ${num("xpIncreasePerLevel", "Extra XP per level", config, "Matches LevelingRules.XpIncreasePerLevel.")}
            ${num("xpPerLesson", "XP per lesson completed", config)}
            ${num("xpPerQuiz", "XP per quiz completed", config)}
            ${num("pointsPerLesson", "Points per lesson", config)}
            ${num("pointsPerQuiz", "Points per quiz", config)}
            ${num("dailyStreakXp", "XP per daily streak", config)}
            ${num("hintCost", "Hint cost in points", config)}
          </div>
          <div class="notice" style="margin-top:16px">
            Changing the curve here does <strong>not</strong> change the numbers compiled into the Unity
            client — update <code>Assets/Scripts/Mechanics/LevelingRules.cs</code> to match, then use
            <em>Leaderboard → Recalculate levels</em> to re-derive every student's level from their total XP.
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h2>XP curve preview</h2></div>
        <div class="card-body tight">
          <div class="table-wrap"><table class="data">
            <thead><tr><th class="num">Level</th><th class="num">XP to finish that level</th></tr></thead>
            <tbody>${preview}</tbody>
          </table></div>
          <div class="pager"><span>cap(level) = ${config.startingXpCap} + (level − 1) × ${config.xpIncreasePerLevel}</span></div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="card-head">
        <div style="flex:1;min-width:200px">
          <h2>Administrators <span class="badge">${admins.length}</span></h2>
          <p>Only accounts with a document in <code>Admins</code> can sign in to this portal.</p>
        </div>
        <button class="btn btn-primary btn-sm" data-act="add-admin">+ Add administrator</button>
      </div>
      <div class="card-body tight">
        ${admins.length ? `
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>UID</th><th></th></tr></thead>
          <tbody>
            ${admins.map((a) => `
              <tr>
                <td><strong>${esc(a.name || "—")}</strong>${a.id === ctx.admin.id ? ` <span class="badge accent">You</span>` : ""}</td>
                <td>${esc(a.email || "—")}</td>
                <td><span class="badge purple">${esc(a.role || "Administrator")}</span></td>
                <td class="uid">${esc(a.id)}</td>
                <td class="actions"><div class="btn-row" style="justify-content:flex-end">
                  <button class="btn btn-xs" data-act="edit-admin" data-id="${esc(a.id)}">Edit</button>
                  <button class="btn btn-xs btn-danger" data-act="del-admin" data-id="${esc(a.id)}"
                    ${a.id === ctx.admin.id ? "disabled title='You cannot remove your own access'" : ""}>Remove</button>
                </div></td>
              </tr>`).join("")}
          </tbody>
        </table></div>` : emptyHTML("No administrators listed — which is odd, since you are signed in.")}
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="card-head">
        <div style="flex:1;min-width:200px">
          <h2>Audit log</h2>
          <p>Every change made from this portal, newest first.</p>
        </div>
        <button class="btn btn-sm" data-act="export-logs">Export CSV</button>
      </div>
      <div class="card-body tight">
        ${logs.length ? `
        <div class="table-wrap" style="max-height:460px;overflow-y:auto"><table class="data">
          <thead><tr><th>When</th><th>Action</th><th>Target</th><th>Details</th><th>By</th></tr></thead>
          <tbody>
            ${logs.map((l) => `
              <tr>
                <td title="${esc(fmtDateTime(l.at))}">${esc(relTime(l.at))}</td>
                <td><span class="badge accent">${esc(l.action || "—")}</span></td>
                <td class="uid"><span class="trunc">${esc(l.target || "—")}</span></td>
                <td><span class="trunc">${esc(l.details ? fmtValue(l.details) : "")}</span></td>
                <td class="uid">${esc(l.adminEmail || "—")}</td>
              </tr>`).join("")}
          </tbody>
        </table></div>` : emptyHTML("No entries yet.")}
      </div>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="card-head"><h2>Connection</h2></div>
      <div class="card-body">
        <dl class="kv">
          <dt>Firebase project</dt><dd class="mono">${esc(firebaseConfig.projectId)}</dd>
          <dt>Auth domain</dt><dd class="mono">${esc(firebaseConfig.authDomain)}</dd>
          <dt>Signed in as</dt><dd>${esc(auth.currentUser?.email || "—")} <span class="uid">${esc(ctx.admin.id)}</span></dd>
          <dt>Your role</dt><dd>${esc(ctx.admin.role || "Administrator")}</dd>
        </dl>
      </div>
    </div>`;

  const reload = () => render(view, params, ctx);

  // ---- Config --------------------------------------------------------------
  on(view, '[data-act="save"]', async (e, el) => {
    const data = {};
    view.querySelectorAll("[data-c]").forEach((input) => { data[input.dataset.c] = Number(input.value) || 0; });
    if (data.startingXpCap < 1) { toast("XP for level 1 must be at least 1.", "warn"); return; }
    el.disabled = true;
    try {
      await saveConfig(data);
      await ctx.reloadConfig();
      toast("Settings saved.", "good");
      reload();
    } catch (err) {
      toast(errorMessage(err), "bad", 6000);
      el.disabled = false;
    }
  });

  on(view, '[data-act="defaults"]', async () => {
    const ok = await confirmAction({
      title: "Restore default values?",
      message: "Resets every reward setting to the values the Unity client ships with.",
      confirmText: "Restore"
    });
    if (!ok) return;
    await saveConfig(DEFAULT_CONFIG);
    await ctx.reloadConfig();
    toast("Defaults restored.", "good");
    reload();
  });

  // ---- Admins --------------------------------------------------------------
  on(view, '[data-act="add-admin"]', () => adminModal(null, reload));
  on(view, '[data-act="edit-admin"]', (e, el) =>
    adminModal(admins.find((a) => a.id === el.dataset.id), reload));

  on(view, '[data-act="del-admin"]', async (e, el) => {
    const a = admins.find((x) => x.id === el.dataset.id);
    const ok = await confirmAction({
      title: `Remove ${a.name || a.email || a.id}?`,
      message: "They lose access to this portal immediately. Their Firebase Authentication login still exists.",
      confirmText: "Remove access", danger: true
    });
    if (!ok) return;
    await removeAdmin(a.id);
    toast("Administrator removed.", "good");
    reload();
  });

  on(view, '[data-act="export-logs"]', () => {
    downloadCSV(`topcit-audit-log-${new Date().toISOString().slice(0, 10)}`, logs.map((l) => ({
      at: l.at?.toDate ? l.at.toDate().toISOString() : "",
      action: l.action || "",
      target: l.target || "",
      details: l.details ? JSON.stringify(l.details) : "",
      adminEmail: l.adminEmail || "",
      adminUid: l.adminUid || ""
    })));
  });
}

function num(key, label, config, hint = "") {
  return `<label class="field"><span>${esc(label)}</span>
    <input type="number" data-c="${esc(key)}" value="${esc(config[key] ?? 0)}" />
    ${hint ? `<small>${esc(hint)}</small>` : ""}</label>`;
}

async function adminModal(existing, reload) {
  const isNew = !existing;
  await openModal({
    title: isNew ? "Add administrator" : `Edit ${existing.name || existing.id}`,
    wide: true,
    body: `
      <div class="form-grid">
        <label class="field span-2"><span>Firebase Auth UID</span>
          <input type="text" data-id value="${esc(existing?.id || "")}" ${isNew ? "" : "readonly"}
                 placeholder="paste the UID from Firebase console → Authentication" />
          <small>The account must already exist in Firebase Authentication. Its UID becomes the document ID.</small></label>
        <label class="field"><span>Name</span>
          <input type="text" data-f="name" value="${esc(existing?.name || "")}" placeholder="Sam" /></label>
        <label class="field"><span>Email</span>
          <input type="email" data-f="email" value="${esc(existing?.email || "")}" placeholder="admin@example.com" /></label>
        <label class="field span-2"><span>Role label</span>
          <input type="text" data-f="role" value="${esc(existing?.role || "Administrator")}"
                 placeholder="Administrator" />
          <small>Shown in the header. Access is all-or-nothing — any listed account has full access.</small></label>
      </div>`,
    confirmText: isNew ? "Grant access" : "Save",
    onConfirm: async (body) => {
      const uid = body.querySelector("[data-id]").value.trim();
      if (!uid) { toast("The Firebase Auth UID is required.", "warn"); return false; }
      const data = {};
      body.querySelectorAll("[data-f]").forEach((el) => { data[el.dataset.f] = el.value.trim(); });
      try {
        await saveAdmin(uid, data);
        toast("Administrator saved.", "good");
        await reload();
      } catch (err) {
        toast(errorMessage(err), "bad", 6000);
        return false;
      }
    }
  });
}
