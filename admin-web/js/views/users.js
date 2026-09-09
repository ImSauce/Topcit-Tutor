// ============================================================================
// User Management - list, search, create, edit, deactivate, delete, bulk grant.
// ============================================================================

import {
  listUsers, createStudentAccount, setUserDisabled, deleteUser, updateUser,
  bulkGrant, sendReset, seedNewUser
} from "../store.js";
import {
  esc, fmtNum, fmtDate, relTime, toDate, on, toast, openModal, confirmAction,
  errorMessage, downloadCSV, emptyHTML, loadingHTML, barHTML, xpCapForLevel,
  compare, debounce
} from "../util.js";

const state = {
  users: [],
  search: "",
  status: "all",
  sort: { key: "createdAt", dir: "desc" },
  selected: new Set()
};

export async function render(view, params, ctx) {
  view.innerHTML = loadingHTML("Loading students…");
  state.users = await listUsers();
  state.selected.clear();

  view.innerHTML = `
    <div class="card">
      <div class="card-head">
        <h2>Students <span class="badge" data-count>${state.users.length}</span></h2>
        <div class="toolbar">
          <input type="search" data-search placeholder="Search username, email or UID…" style="width:250px" />
          <select data-status style="width:150px">
            <option value="all">All accounts</option>
            <option value="active">Active only</option>
            <option value="disabled">Deactivated only</option>
          </select>
          <button class="btn btn-sm" data-act="export">Export CSV</button>
          <button class="btn btn-sm" data-act="bulk" disabled>Bulk actions</button>
          <button class="btn btn-primary btn-sm" data-act="new">+ New student</button>
        </div>
      </div>
      <div class="card-body tight" data-table></div>
    </div>`;

  const tableEl = view.querySelector("[data-table]");

  function visible() {
    const q = state.search.trim().toLowerCase();
    let rows = state.users.filter((u) => {
      if (state.status === "active" && u.disabled) return false;
      if (state.status === "disabled" && !u.disabled) return false;
      if (!q) return true;
      return [u.username, u.email, u.id].some((v) => String(v || "").toLowerCase().includes(q));
    });
    const { key, dir } = state.sort;
    rows.sort((a, b) => {
      const av = key === "createdAt" ? (toDate(a.createdAt)?.getTime() ?? 0) : a[key];
      const bv = key === "createdAt" ? (toDate(b.createdAt)?.getTime() ?? 0) : b[key];
      const r = compare(av, bv);
      return dir === "asc" ? r : -r;
    });
    return rows;
  }

  function draw() {
    const rows = visible();
    view.querySelector("[data-count]").textContent = rows.length === state.users.length
      ? state.users.length
      : `${rows.length} / ${state.users.length}`;
    view.querySelector('[data-act="bulk"]').disabled = state.selected.size === 0;

    if (!rows.length) {
      tableEl.innerHTML = emptyHTML(
        state.users.length ? "No students match that filter." : "No students yet. Use “+ New student” to create one."
      );
      return;
    }

    const th = (key, label, cls = "") =>
      `<th class="sortable ${cls}" data-sort="${key}">${label}${
        state.sort.key === key ? (state.sort.dir === "asc" ? " ▲" : " ▼") : ""}</th>`;

    tableEl.innerHTML = `
      <div class="table-wrap"><table class="data">
        <thead><tr>
          <th style="width:34px"><input type="checkbox" data-all title="Select all" /></th>
          ${th("username", "Student")}
          ${th("level", "Level", "num")}
          <th>XP progress</th>
          ${th("totalXp", "Total XP", "num")}
          ${th("points", "Points", "num")}
          ${th("streak", "Streak", "num")}
          ${th("createdAt", "Joined")}
          <th>Status</th>
          <th></th>
        </tr></thead>
        <tbody>
          ${rows.map((u) => {
            const cap = xpCapForLevel(u.level || 1, ctx.config || undefined);
            return `
            <tr data-uid="${esc(u.id)}">
              <td><input type="checkbox" data-pick="${esc(u.id)}" ${state.selected.has(u.id) ? "checked" : ""} /></td>
              <td class="row-link" data-open>
                <strong>${esc(u.username || "(no username)")}</strong>
                ${u.email ? `<div class="uid">${esc(u.email)}</div>` : `<div class="uid">${esc(u.id)}</div>`}
              </td>
              <td class="num">${fmtNum(u.level || 1)}</td>
              <td style="min-width:150px">${barHTML(u.xp || 0, cap)}<span class="uid">${fmtNum(u.xp || 0)} / ${fmtNum(cap)}</span></td>
              <td class="num">${fmtNum(u.totalXp || 0)}</td>
              <td class="num">${fmtNum(u.points || 0)}</td>
              <td class="num">${fmtNum(u.streak || 0)}</td>
              <td title="${esc(fmtDate(u.createdAt))}">${esc(relTime(u.createdAt))}</td>
              <td>${u.disabled
                ? `<span class="badge bad">Deactivated</span>`
                : `<span class="badge good">Active</span>`}</td>
              <td class="actions">
                <div class="btn-row" style="justify-content:flex-end">
                  <button class="btn btn-xs" data-act="edit" data-id="${esc(u.id)}">Edit</button>
                  <button class="btn btn-xs" data-act="toggle" data-id="${esc(u.id)}">${u.disabled ? "Reactivate" : "Deactivate"}</button>
                  <button class="btn btn-xs btn-danger" data-act="delete" data-id="${esc(u.id)}">Delete</button>
                </div>
              </td>
            </tr>`;
          }).join("")}
        </tbody>
      </table></div>`;
  }

  draw();

  // ---- Filters -------------------------------------------------------------
  view.querySelector("[data-search]").addEventListener("input", debounce((e) => {
    state.search = e.target.value;
    draw();
  }, 180));

  view.querySelector("[data-status]").addEventListener("change", (e) => {
    state.status = e.target.value;
    draw();
  });

  on(view, "[data-sort]", (e, el) => {
    const key = el.dataset.sort;
    if (state.sort.key === key) state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
    else state.sort = { key, dir: key === "username" ? "asc" : "desc" };
    draw();
  });

  on(view, "[data-all]", (e, el) => {
    if (el.checked) visible().forEach((u) => state.selected.add(u.id));
    else state.selected.clear();
    draw();
  }, "change");

  on(view, "[data-pick]", (e, el) => {
    if (el.checked) state.selected.add(el.dataset.pick);
    else state.selected.delete(el.dataset.pick);
    view.querySelector('[data-act="bulk"]').disabled = state.selected.size === 0;
  }, "change");

  on(view, "[data-open]", (e, el) => {
    ctx.navigate(`#/users/${encodeURIComponent(el.closest("tr").dataset.uid)}`);
  });

  // ---- Actions -------------------------------------------------------------
  const refresh = async () => {
    state.users = await listUsers();
    draw();
  };

  on(view, '[data-act="new"]', () => newStudentModal(refresh));
  on(view, '[data-act="export"]', () => exportUsers(visible()));

  on(view, '[data-act="edit"]', async (e, el) => {
    const user = state.users.find((u) => u.id === el.dataset.id);
    if (user) await editUserModal(user, refresh);
  });

  on(view, '[data-act="toggle"]', async (e, el) => {
    const user = state.users.find((u) => u.id === el.dataset.id);
    if (!user) return;
    if (user.disabled) {
      await setUserDisabled(user.id, false);
      toast(`${user.username || user.id} reactivated.`, "good");
      return refresh();
    }
    const reason = await openModal({
      title: `Deactivate ${user.username || user.id}?`,
      body: `
        <p class="hint" style="color:var(--text);font-size:13px">
          The student keeps their data, but the Firestore rules stop them reading or writing it,
          so the game will refuse to load their progress.
        </p>
        <label class="field" style="margin-top:14px">
          <span>Reason (shown in the audit log)</span>
          <input type="text" data-reason placeholder="e.g. Left the program" />
        </label>`,
      confirmText: "Deactivate",
      confirmClass: "btn-danger",
      onConfirm: (body) => body.querySelector("[data-reason]").value.trim()
    });
    if (reason === null) return;
    await setUserDisabled(user.id, true, reason);
    toast(`${user.username || user.id} deactivated.`, "warn");
    refresh();
  });

  on(view, '[data-act="delete"]', async (e, el) => {
    const user = state.users.find((u) => u.id === el.dataset.id);
    if (!user) return;
    const name = user.username || user.id;
    const ok = await confirmAction({
      title: "Delete student data",
      message: `This permanently deletes <strong>${esc(name)}</strong>'s profile and every achievement,
        inventory item, subject, module, lesson and quiz record beneath it. This cannot be undone.
        <br><br>Their Firebase <em>Authentication</em> login is not removed by this action — delete it from
        the Firebase console (or deploy the optional Cloud Function) if you also want the sign-in gone.`,
      confirmText: "Delete permanently",
      danger: true,
      typeToConfirm: name
    });
    if (!ok) return;
    try {
      const count = await deleteUser(user.id);
      toast(`Deleted ${count} documents for ${name}.`, "good");
      state.selected.delete(user.id);
      refresh();
    } catch (err) {
      toast(errorMessage(err), "bad", 6000);
    }
  });

  on(view, '[data-act="bulk"]', () => bulkModal([...state.selected], ctx, refresh));
}

// ---------------------------------------------------------------------------

function exportUsers(rows) {
  downloadCSV(`topcit-students-${new Date().toISOString().slice(0, 10)}`, rows.map((u) => ({
    uid: u.id,
    username: u.username || "",
    email: u.email || "",
    level: u.level || 1,
    xp: u.xp || 0,
    totalXp: u.totalXp || 0,
    points: u.points || 0,
    streak: u.streak || 0,
    hints: u.hints || 0,
    status: u.disabled ? "deactivated" : "active",
    createdAt: toDate(u.createdAt)?.toISOString() || ""
  })));
}

async function newStudentModal(refresh) {
  await openModal({
    title: "Create a student account",
    body: `
      <div class="form-grid">
        <label class="field span-2"><span>Username</span>
          <input type="text" data-username placeholder="sam" required /></label>
        <label class="field"><span>Email</span>
          <input type="email" data-email placeholder="student@example.com" /></label>
        <label class="field"><span>Password</span>
          <input type="text" data-password placeholder="at least 6 characters" /></label>
      </div>
      <p class="hint" style="margin-top:12px">
        With an email and password this creates a real Firebase Authentication login plus the
        full starter data set (achievements, inventory, subjects → modules → lessons &amp; quizzes),
        seeded from your catalogs. Leave both blank to create Firestore data only, for an account
        that already exists in Authentication — paste its UID below.
      </p>
      <label class="field" style="margin-top:12px"><span>Existing UID (data-only mode)</span>
        <input type="text" data-uid placeholder="firebase auth uid" /></label>`,
    confirmText: "Create student",
    onConfirm: async (body) => {
      const username = body.querySelector("[data-username]").value.trim();
      const email = body.querySelector("[data-email]").value.trim();
      const password = body.querySelector("[data-password]").value;
      const uid = body.querySelector("[data-uid]").value.trim();

      if (!username) { toast("Username is required.", "warn"); return false; }

      try {
        if (uid) {
          await seedNewUser(uid, username, email);
          toast(`Starter data created for ${username}.`, "good");
        } else {
          if (!email || !password) { toast("Enter an email and password, or an existing UID.", "warn"); return false; }
          if (password.length < 6) { toast("Password must be at least 6 characters.", "warn"); return false; }
          const newUid = await createStudentAccount({ email, password, username });
          toast(`Created ${username} (${newUid.slice(0, 8)}…).`, "good", 5000);
        }
        await refresh();
      } catch (err) {
        toast(errorMessage(err), "bad", 7000);
        return false;
      }
    }
  });
}

async function editUserModal(user, refresh) {
  const num = (key, label, step = "1") => `
    <label class="field"><span>${label}</span>
      <input type="number" step="${step}" data-f="${key}" value="${esc(user[key] ?? 0)}" /></label>`;

  await openModal({
    title: `Edit ${user.username || user.id}`,
    wide: true,
    body: `
      <div class="form-grid">
        <label class="field"><span>Username</span>
          <input type="text" data-f="username" value="${esc(user.username || "")}" /></label>
        <label class="field"><span>Email (record only)</span>
          <input type="email" data-f="email" value="${esc(user.email || "")}" /></label>
        ${num("level", "Level")}
        ${num("xp", "XP (current level bar)")}
        ${num("totalXp", "Total XP (lifetime)")}
        ${num("points", "Points")}
        ${num("streak", "Streak (days)")}
        ${num("hints", "Hints")}
        <label class="field span-2"><span>Admin notes</span>
          <textarea data-f="adminNotes" placeholder="Internal notes about this student">${esc(user.adminNotes || "")}</textarea></label>
        <div class="span-2" style="display:flex;gap:18px;flex-wrap:wrap">
          <label class="check"><input type="checkbox" data-b="lobbyTutorial" ${user.lobbyTutorial ? "checked" : ""}/> Lobby tutorial seen</label>
          <label class="check"><input type="checkbox" data-b="module" ${user.module ? "checked" : ""}/> Module tutorial seen</label>
        </div>
      </div>
      <div class="notice info" style="margin-top:14px">
        UID <code>${esc(user.id)}</code>
        ${user.email ? `· <button class="btn btn-xs" type="button" data-reset>Send password reset email</button>` : ""}
      </div>`,
    confirmText: "Save changes",
    onOpen: (body) => {
      const btn = body.querySelector("[data-reset]");
      if (!btn) return;
      btn.addEventListener("click", async () => {
        try {
          await sendReset(user.email);
          toast(`Password reset email sent to ${user.email}.`, "good", 5000);
        } catch (err) {
          toast(errorMessage(err), "bad", 6000);
        }
      });
    },
    onConfirm: async (body) => {
      const data = {};
      body.querySelectorAll("[data-f]").forEach((el) => {
        const key = el.dataset.f;
        data[key] = el.type === "number" ? Number(el.value) || 0 : el.value.trim();
      });
      body.querySelectorAll("[data-b]").forEach((el) => { data[el.dataset.b] = el.checked; });
      try {
        await updateUser(user.id, data);
        toast("Student updated.", "good");
        await refresh();
      } catch (err) {
        toast(errorMessage(err), "bad", 6000);
        return false;
      }
    }
  });
}

async function bulkModal(uids, ctx, refresh) {
  if (!uids.length) return;
  await openModal({
    title: `Bulk action — ${uids.length} student${uids.length === 1 ? "" : "s"}`,
    body: `
      <div class="form-grid">
        <label class="field"><span>Grant XP</span>
          <input type="number" data-xp value="0" /><small>Levels roll over using the current XP curve.</small></label>
        <label class="field"><span>Grant points</span>
          <input type="number" data-points value="0" /></label>
        <label class="field"><span>Grant hints</span>
          <input type="number" data-hints value="0" /></label>
      </div>
      <p class="hint" style="margin-top:12px">Negative numbers subtract. XP is applied one student at a time so
      every level-up is calculated correctly.</p>
      <div data-progress class="hint" style="margin-top:10px"></div>`,
    confirmText: "Apply to selected",
    onConfirm: async (body) => {
      const xp = Number(body.querySelector("[data-xp]").value) || 0;
      const points = Number(body.querySelector("[data-points]").value) || 0;
      const hints = Number(body.querySelector("[data-hints]").value) || 0;
      if (!xp && !points && !hints) { toast("Enter at least one amount.", "warn"); return false; }
      const progress = body.querySelector("[data-progress]");
      try {
        await bulkGrant(uids, { xp, points, hints }, ctx.config || undefined, (done, total) => {
          progress.textContent = `Updating ${done} / ${total}…`;
        });
        toast(`Applied to ${uids.length} students.`, "good");
        await refresh();
      } catch (err) {
        toast(errorMessage(err), "bad", 6000);
        return false;
      }
    }
  });
}
