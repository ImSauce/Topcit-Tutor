// ============================================================================
// Single student view - profile, progress tree, achievements, inventory,
// and a raw field editor for anything not covered by the forms.
// ============================================================================

import {
  getUser, updateUser, grantXp, grantPoints, setUserDisabled, deleteUser,
  getProgressTree, summarizeTree, listUserAchievements, listUserInventory,
  setDocument, deleteDocument, listCollection, COL, logAction, sendReset,
  pushAchievementToUser, pushItemToUser, pushSubjectToUser, deleteRecursive
} from "../store.js";
import {
  esc, fmtNum, fmtDateTime, fmtDuration, relTime, toDate, on, toast,
  openModal, confirmAction, errorMessage, emptyHTML, loadingHTML,
  xpCapForLevel, pct, fmtValue, boolBadge
} from "../util.js";

let uid = null;
let user = null;
let tab = "overview";

export async function render(view, params, ctx) {
  uid = params.uid;
  tab = "overview";
  view.innerHTML = loadingHTML("Loading student…");

  user = await getUser(uid);
  if (!user) {
    view.innerHTML = `<div class="card"><div class="card-body">
      <div class="notice"><strong>No student document at <code>Users/${esc(uid)}</code>.</strong>
      <p class="hint" style="margin-top:6px">It may have been deleted, or the UID is wrong.</p></div>
      <div style="margin-top:14px"><a class="btn" href="#/users">← Back to students</a></div>
    </div></div>`;
    return;
  }

  ctx.setCrumbs(["User Management", user.username || uid]);
  paint(view, ctx);
}

function paint(view, ctx) {
  const cap = xpCapForLevel(user.level || 1, ctx.config || undefined);

  view.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div style="flex:1;min-width:200px">
          <h2 style="font-size:17px">
            ${esc(user.username || "(no username)")}
            ${user.disabled ? `<span class="badge bad">Deactivated</span>` : `<span class="badge good">Active</span>`}
          </h2>
          <p class="uid" style="margin-top:3px">${esc(uid)}${user.email ? ` · ${esc(user.email)}` : ""}</p>
        </div>
        <div class="btn-row">
          <a class="btn btn-sm" href="#/users">← All students</a>
          <button class="btn btn-sm" data-act="grant-xp">Grant XP</button>
          <button class="btn btn-sm" data-act="grant-points">Grant points</button>
          <button class="btn btn-sm" data-act="toggle">${user.disabled ? "Reactivate" : "Deactivate"}</button>
          <button class="btn btn-sm btn-danger" data-act="delete">Delete</button>
        </div>
      </div>
      <div class="tabs">
        ${["overview", "progress", "achievements", "inventory", "raw"].map((t) => `
          <button data-tab="${t}" class="${t === tab ? "active" : ""}">${
            { overview: "Overview", progress: "Progress", achievements: "Achievements",
              inventory: "Inventory", raw: "Raw fields" }[t]}</button>`).join("")}
      </div>
      <div class="card-body" data-panel>${loadingHTML()}</div>
    </div>`;

  on(view, "[data-tab]", (e, el) => {
    tab = el.dataset.tab;
    view.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    loadTab(view, ctx);
  });

  on(view, '[data-act="grant-xp"]', () => grantModal(view, ctx, "xp"));
  on(view, '[data-act="grant-points"]', () => grantModal(view, ctx, "points"));

  on(view, '[data-act="toggle"]', async () => {
    await setUserDisabled(uid, !user.disabled, "");
    user = await getUser(uid);
    toast(user.disabled ? "Student deactivated." : "Student reactivated.", user.disabled ? "warn" : "good");
    paint(view, ctx);
  });

  on(view, '[data-act="delete"]', async () => {
    const name = user.username || uid;
    const ok = await confirmAction({
      title: "Delete student data",
      message: `Permanently deletes <strong>${esc(name)}</strong>'s profile and every nested record.
        The Firebase Authentication login is not removed.`,
      confirmText: "Delete permanently",
      danger: true,
      typeToConfirm: name
    });
    if (!ok) return;
    try {
      const n = await deleteUser(uid);
      toast(`Deleted ${n} documents.`, "good");
      ctx.navigate("#/users");
    } catch (err) {
      toast(errorMessage(err), "bad", 6000);
    }
  });

  loadTab(view, ctx);
}

async function reloadUser(view, ctx) {
  user = await getUser(uid);
  paint(view, ctx);
}

async function loadTab(view, ctx) {
  const panel = view.querySelector("[data-panel]");
  panel.innerHTML = loadingHTML();
  try {
    if (tab === "overview")     await overviewTab(panel, view, ctx);
    else if (tab === "progress")     await progressTab(panel, view, ctx);
    else if (tab === "achievements") await listTab(panel, view, ctx, "achievements");
    else if (tab === "inventory")    await listTab(panel, view, ctx, "inventory");
    else if (tab === "raw")          await rawTab(panel, view, ctx);
  } catch (err) {
    console.error(err);
    panel.innerHTML = `<div class="notice">${esc(errorMessage(err))}</div>`;
  }
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

async function overviewTab(panel, view, ctx) {
  const cap = xpCapForLevel(user.level || 1, ctx.config || undefined);
  const tree = await getProgressTree(uid);
  const s = summarizeTree(tree);

  panel.innerHTML = `
    <div class="grid cols-4">
      <div class="stat accent"><div class="label">Level</div><div class="value">${fmtNum(user.level || 1)}</div>
        <div class="sub">${fmtNum(user.xp || 0)} / ${fmtNum(cap)} XP this level</div></div>
      <div class="stat purple"><div class="label">Total XP</div><div class="value">${fmtNum(user.totalXp || 0)}</div>
        <div class="sub">lifetime, uncapped</div></div>
      <div class="stat good"><div class="label">Points</div><div class="value">${fmtNum(user.points || 0)}</div>
        <div class="sub">${fmtNum(user.hints || 0)} hints owned</div></div>
      <div class="stat warn"><div class="label">Streak</div><div class="value">${fmtNum(user.streak || 0)}</div>
        <div class="sub">consecutive days</div></div>
    </div>

    <div class="grid cols-2" style="margin-top:16px">
      <div class="card">
        <div class="card-head"><h3>Learning progress</h3></div>
        <div class="card-body">
          <div style="display:grid;gap:12px">
            ${progressRow("Subjects", s.subjectsDone, s.subjects)}
            ${progressRow("Modules", s.modulesDone, s.modules)}
            ${progressRow("Lessons", s.lessonsDone, s.lessons)}
            ${progressRow("Quizzes", s.quizzesDone, s.quizzes)}
          </div>
          <div class="grid cols-2" style="margin-top:16px">
            <div class="stat"><div class="label">Average quiz score</div>
              <div class="value" style="font-size:20px">${s.scoreCount ? s.avgScore.toFixed(1) : "—"}</div>
              <div class="sub">${fmtNum(s.scoreCount)} completed attempts</div></div>
            <div class="stat"><div class="label">Average quiz time</div>
              <div class="value" style="font-size:20px">${s.scoreCount ? fmtDuration(s.avgTime) : "—"}</div>
              <div class="sub">per completed quiz</div></div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>Account</h3>
          <button class="btn btn-sm" data-act="reset-pw" ${user.email ? "" : "disabled"}>Send password reset</button>
        </div>
        <div class="card-body">
          <dl class="kv">
            <dt>UID</dt><dd class="mono">${esc(uid)}</dd>
            <dt>Username</dt><dd>${esc(user.username || "—")}</dd>
            <dt>Email</dt><dd>${esc(user.email || "— (not stored on the profile)")}</dd>
            <dt>Joined</dt><dd>${esc(fmtDateTime(user.createdAt))} <span class="uid">${esc(relTime(user.createdAt))}</span></dd>
            <dt>Last admin update</dt><dd>${esc(fmtDateTime(user.updatedAt))}${user.updatedBy ? ` <span class="uid">by ${esc(user.updatedBy)}</span>` : ""}</dd>
            <dt>Lobby tutorial</dt><dd>${boolBadge(user.lobbyTutorial ?? user.LobbyTutorial, "Seen", "Not seen")}</dd>
            <dt>Module tutorial</dt><dd>${boolBadge(user.module ?? user.ModuleTutorial, "Seen", "Not seen")}</dd>
            <dt>Status</dt><dd>${user.disabled
              ? `<span class="badge bad">Deactivated</span> ${esc(user.disabledReason || "")}`
              : `<span class="badge good">Active</span>`}</dd>
            <dt>Admin notes</dt><dd>${esc(user.adminNotes || "—")}</dd>
          </dl>
        </div>
      </div>
    </div>`;

  on(panel, '[data-act="reset-pw"]', async () => {
    try {
      await sendReset(user.email);
      toast(`Password reset email sent to ${user.email}.`, "good", 5000);
    } catch (err) { toast(errorMessage(err), "bad", 6000); }
  });
}

/** Grant or subtract XP / points for this one student. */
async function grantModal(view, ctx, kind) {
  const isXp = kind === "xp";
  await openModal({
    title: isXp ? "Grant XP" : "Grant points",
    body: `
      <label class="field"><span>Amount (negative subtracts)</span>
        <input type="number" data-amount value="${isXp ? 50 : 100}" /></label>
      <p class="hint" style="margin-top:12px">
        ${isXp
          ? `XP rolls into level-ups using the same maths as <code>LevelingRules.cs</code>:
             level 1 needs ${xpCapForLevel(1, ctx.config || undefined)} XP, and each level after that
             needs ${(ctx.config?.xpIncreasePerLevel ?? 10)} more. Lifetime <code>totalXp</code> is updated too.`
          : `Points are the in-app currency students spend on hints and collectibles.`}
      </p>
      <div class="notice info" style="margin-top:12px">
        Currently: level ${fmtNum(user.level || 1)}, ${fmtNum(user.xp || 0)} XP this level,
        ${fmtNum(user.totalXp || 0)} total XP, ${fmtNum(user.points || 0)} points.
      </div>`,
    confirmText: "Apply",
    onConfirm: async (body) => {
      const amount = Number(body.querySelector("[data-amount]").value) || 0;
      if (!amount) { toast("Enter a non-zero amount.", "warn"); return false; }
      try {
        if (isXp) {
          const result = await grantXp(uid, amount, ctx.config || undefined);
          toast(`Now level ${result.level} with ${result.xp} XP on the bar.`, "good", 5000);
        } else {
          await grantPoints(uid, amount);
          toast(`${amount > 0 ? "Granted" : "Removed"} ${Math.abs(amount)} points.`, "good");
        }
        await reloadUser(view, ctx);
      } catch (err) {
        toast(errorMessage(err), "bad", 6000);
        return false;
      }
    }
  });
}

function progressRow(label, done, total) {
  return `<div>
    <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px">
      <span style="color:var(--text-dim)">${esc(label)}</span>
      <strong>${fmtNum(done)} / ${fmtNum(total)}</strong>
    </div>
    <div class="bar ${done === total && total > 0 ? "good" : ""}"><i style="width:${pct(done, total)}%"></i></div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Progress tree
// ---------------------------------------------------------------------------

async function progressTab(panel, view, ctx) {
  const tree = await getProgressTree(uid);

  const reload = () => loadTab(view, ctx);

  panel.innerHTML = `
    <div class="toolbar" style="margin-bottom:14px">
      <p class="hint grow">Click a row to expand. Every value here writes straight to Firestore.</p>
      <button class="btn btn-sm" data-act="assign-subject">Assign subject from catalog</button>
      <button class="btn btn-sm" data-act="complete-all">Mark everything complete</button>
      <button class="btn btn-sm btn-danger" data-act="reset-progress">Reset all progress</button>
    </div>
    <div class="card"><div class="tree">
      ${tree.length ? tree.map((s) => subjectHTML(s)).join("") : emptyHTML("This student has no subjects assigned.")}
    </div></div>`;

  // Expand / collapse
  on(panel, ".tree-head", (e, el) => {
    if (e.target.closest("button") || e.target.closest("input")) return;
    const kids = el.parentElement.querySelector(".tree-kids");
    if (!kids) return;
    const open = kids.hasAttribute("hidden");
    kids.toggleAttribute("hidden", !open);
    el.classList.toggle("open", open);
  });

  // ---- Edits ---------------------------------------------------------------
  on(panel, "[data-edit-subject]", async (e, el) => {
    const sid = el.dataset.editSubject;
    const s = tree.find((x) => x.id === sid);
    await editDocModal({
      title: `Subject — ${s.title || sid}`,
      path: `${COL.users}/${uid}/Subjects/${sid}`,
      fields: [
        { key: "title", label: "Title", type: "text", value: s.title || "" },
        { key: "unlocked", label: "Unlocked", type: "bool", value: !!s.unlocked },
        { key: "completed", label: "Completed", type: "bool", value: !!s.completed },
        { key: "completedModules", label: "Completed modules", type: "number", value: s.completedModules || 0 },
        { key: "completedAt", label: "Completed at", type: "date", value: s.completedAt },
        { key: "unlockedAt", label: "Unlocked at", type: "date", value: s.unlockedAt }
      ],
      onSaved: reload
    });
  });

  on(panel, "[data-edit-module]", async (e, el) => {
    const [sid, mid] = el.dataset.editModule.split("|");
    const m = tree.find((x) => x.id === sid).modules.find((x) => x.id === mid);
    await editDocModal({
      title: `Module — ${m.title || mid}`,
      path: `${COL.users}/${uid}/Subjects/${sid}/Modules/${mid}`,
      fields: [
        { key: "title", label: "Title", type: "text", value: m.title || "" },
        { key: "unlocked", label: "Unlocked", type: "bool", value: !!m.unlocked },
        { key: "completed", label: "Completed", type: "bool", value: !!m.completed },
        { key: "completedLessons", label: "Completed lessons", type: "number", value: m.completedLessons || 0 },
        { key: "completedQuizzes", label: "Completed quizzes", type: "number", value: m.completedQuizzes || 0 },
        { key: "completedAt", label: "Completed at", type: "date", value: m.completedAt }
      ],
      onSaved: reload
    });
  });

  on(panel, "[data-edit-quiz]", async (e, el) => {
    const [sid, mid, qid] = el.dataset.editQuiz.split("|");
    const q = tree.find((x) => x.id === sid).modules.find((x) => x.id === mid).quizzes.find((x) => x.id === qid);
    await editDocModal({
      title: `Quiz — ${qid}`,
      path: `${COL.users}/${uid}/Subjects/${sid}/Modules/${mid}/Quizzes/${qid}`,
      fields: [
        { key: "score", label: "Score", type: "number", value: q.score || 0 },
        { key: "elapsedTime", label: "Elapsed time (seconds)", type: "number", value: q.elapsedTime || 0 },
        { key: "completed", label: "Completed", type: "bool", value: !!q.completed },
        { key: "completedAt", label: "Completed at", type: "date", value: q.completedAt }
      ],
      onSaved: reload
    });
  });

  on(panel, "[data-toggle-lesson]", async (e, el) => {
    const [sid, mid, lid] = el.dataset.toggleLesson.split("|");
    const done = el.checked;
    const path = `${COL.users}/${uid}/Subjects/${sid}/Modules/${mid}/Lessons/${lid}`;
    try {
      await setDocument(path, { completed: done, completedAt: done ? new Date() : null }, true);
      await logAction("progress.lesson", path, { completed: done });
      toast(`Lesson ${lid} marked ${done ? "complete" : "incomplete"}.`, "good", 2200);
    } catch (err) {
      toast(errorMessage(err), "bad", 6000);
      el.checked = !done;
    }
  }, "change");

  on(panel, "[data-toggle-quiz]", async (e, el) => {
    const [sid, mid, qid] = el.dataset.toggleQuiz.split("|");
    const done = el.checked;
    const path = `${COL.users}/${uid}/Subjects/${sid}/Modules/${mid}/Quizzes/${qid}`;
    try {
      await setDocument(path, { completed: done, completedAt: done ? new Date() : null }, true);
      await logAction("progress.quiz", path, { completed: done });
      toast(`Quiz ${qid} marked ${done ? "complete" : "incomplete"}.`, "good", 2200);
    } catch (err) {
      toast(errorMessage(err), "bad", 6000);
      el.checked = !done;
    }
  }, "change");

  on(panel, "[data-del-subject]", async (e, el) => {
    const sid = el.dataset.delSubject;
    const ok = await confirmAction({
      title: "Remove subject",
      message: `Delete <code>${esc(sid)}</code> and all of its modules, lessons and quizzes from this student?`,
      confirmText: "Remove", danger: true
    });
    if (!ok) return;
    await deleteRecursive(`${COL.users}/${uid}/Subjects/${sid}`);
    await logAction("progress.removeSubject", `${COL.users}/${uid}/Subjects/${sid}`);
    toast("Subject removed.", "good");
    reload();
  });

  on(panel, '[data-act="assign-subject"]', async () => {
    const catalog = await listCollection(COL.subjectCatalog);
    if (!catalog.length) {
      toast("The subject catalog is empty. Add subjects under Curriculum first.", "warn", 6000);
      return;
    }
    await openModal({
      title: "Assign a subject",
      body: `<label class="field"><span>Catalog subject</span>
        <select data-sid>${catalog.map((s) => `<option value="${esc(s.id)}">${esc(s.title || s.id)}</option>`).join("")}</select>
      </label>
      <p class="hint" style="margin-top:10px">Copies the subject with all of its modules, lessons and quizzes.
      Existing progress on shared IDs is preserved.</p>`,
      confirmText: "Assign",
      onConfirm: async (body) => {
        try {
          await pushSubjectToUser(uid, body.querySelector("[data-sid]").value);
          toast("Subject assigned.", "good");
          reload();
        } catch (err) { toast(errorMessage(err), "bad", 6000); return false; }
      }
    });
  });

  on(panel, '[data-act="complete-all"]', async () => {
    const ok = await confirmAction({
      title: "Mark everything complete",
      message: "Marks every lesson, quiz, module and subject for this student as completed, timestamped now. Quiz scores are left untouched.",
      confirmText: "Mark complete"
    });
    if (!ok) return;
    const now = new Date();
    for (const s of tree) {
      for (const m of s.modules || []) {
        for (const l of m.lessons || []) {
          await setDocument(`${COL.users}/${uid}/Subjects/${s.id}/Modules/${m.id}/Lessons/${l.id}`,
            { completed: true, completedAt: now }, true);
        }
        for (const q of m.quizzes || []) {
          await setDocument(`${COL.users}/${uid}/Subjects/${s.id}/Modules/${m.id}/Quizzes/${q.id}`,
            { completed: true, completedAt: now }, true);
        }
        await setDocument(`${COL.users}/${uid}/Subjects/${s.id}/Modules/${m.id}`, {
          completed: true, completedAt: now,
          completedLessons: (m.lessons || []).length, completedQuizzes: (m.quizzes || []).length,
          unlocked: true
        }, true);
      }
      await setDocument(`${COL.users}/${uid}/Subjects/${s.id}`, {
        completed: true, completedAt: now, completedModules: (s.modules || []).length, unlocked: true
      }, true);
    }
    await logAction("progress.completeAll", `${COL.users}/${uid}`);
    toast("All progress marked complete.", "good");
    reload();
  });

  on(panel, '[data-act="reset-progress"]', async () => {
    const ok = await confirmAction({
      title: "Reset all progress",
      message: "Sets every lesson, quiz, module and subject back to incomplete and clears quiz scores and times. Subjects stay assigned.",
      confirmText: "Reset progress", danger: true, typeToConfirm: "RESET"
    });
    if (!ok) return;
    for (const s of tree) {
      for (const m of s.modules || []) {
        for (const l of m.lessons || []) {
          await setDocument(`${COL.users}/${uid}/Subjects/${s.id}/Modules/${m.id}/Lessons/${l.id}`,
            { completed: false, completedAt: null }, true);
        }
        for (const q of m.quizzes || []) {
          await setDocument(`${COL.users}/${uid}/Subjects/${s.id}/Modules/${m.id}/Quizzes/${q.id}`,
            { completed: false, completedAt: null, score: 0, elapsedTime: 0 }, true);
        }
        await setDocument(`${COL.users}/${uid}/Subjects/${s.id}/Modules/${m.id}`,
          { completed: false, completedAt: null, completedLessons: 0, completedQuizzes: 0 }, true);
      }
      await setDocument(`${COL.users}/${uid}/Subjects/${s.id}`,
        { completed: false, completedAt: null, completedModules: 0 }, true);
    }
    await logAction("progress.resetAll", `${COL.users}/${uid}`);
    toast("Progress reset.", "good");
    reload();
  });
}

function subjectHTML(s) {
  const modules = s.modules || [];
  const done = modules.filter((m) => m.completed).length;
  return `
    <div class="tree-node">
      <div class="tree-head">
        <span class="caret">▶</span>
        <span class="title"><strong>${esc(s.title || s.id)}</strong> <span class="uid">${esc(s.id)}</span></span>
        <span class="meta">${done}/${modules.length} modules</span>
        ${s.unlocked ? "" : `<span class="badge">Locked</span>`}
        ${s.completed ? `<span class="badge good">Completed</span>` : ""}
        <button class="btn btn-xs" data-edit-subject="${esc(s.id)}">Edit</button>
        <button class="btn btn-xs btn-danger" data-del-subject="${esc(s.id)}">Remove</button>
      </div>
      <div class="tree-kids" hidden>
        ${modules.length ? modules.map((m) => moduleHTML(s, m)).join("") : emptyHTML("No modules.")}
      </div>
    </div>`;
}

function moduleHTML(s, m) {
  const lessons = m.lessons || [];
  const quizzes = m.quizzes || [];
  const ld = lessons.filter((l) => l.completed).length;
  const qd = quizzes.filter((q) => q.completed).length;
  return `
    <div class="tree-node">
      <div class="tree-head">
        <span class="caret">▶</span>
        <span class="title">${esc(m.title || m.id)} <span class="uid">${esc(m.id)}</span></span>
        <span class="meta">${ld}/${lessons.length} lessons · ${qd}/${quizzes.length} quizzes</span>
        ${m.unlocked ? "" : `<span class="badge">Locked</span>`}
        ${m.completed ? `<span class="badge good">Completed</span>` : ""}
        <button class="btn btn-xs" data-edit-module="${esc(s.id)}|${esc(m.id)}">Edit</button>
      </div>
      <div class="tree-kids" hidden>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Lesson</th><th>Done</th><th>Completed at</th></tr></thead>
          <tbody>
            ${lessons.length ? lessons.map((l) => `
              <tr>
                <td class="mono">${esc(l.id)}</td>
                <td><input type="checkbox" ${l.completed ? "checked" : ""}
                     data-toggle-lesson="${esc(s.id)}|${esc(m.id)}|${esc(l.id)}" /></td>
                <td>${esc(fmtDateTime(l.completedAt))}</td>
              </tr>`).join("")
              : `<tr><td colspan="3" class="empty" style="padding:14px">No lessons.</td></tr>`}
          </tbody>
        </table></div>
        <div class="table-wrap" style="margin-top:8px"><table class="data">
          <thead><tr><th>Quiz</th><th>Done</th><th class="num">Score</th><th class="num">Time</th><th>Completed at</th><th></th></tr></thead>
          <tbody>
            ${quizzes.length ? quizzes.map((q) => `
              <tr>
                <td class="mono">${esc(q.id)}</td>
                <td><input type="checkbox" ${q.completed ? "checked" : ""}
                     data-toggle-quiz="${esc(s.id)}|${esc(m.id)}|${esc(q.id)}" /></td>
                <td class="num"><strong>${fmtNum(q.score || 0)}</strong></td>
                <td class="num">${esc(fmtDuration(q.elapsedTime))}</td>
                <td>${esc(fmtDateTime(q.completedAt))}</td>
                <td class="actions"><button class="btn btn-xs"
                     data-edit-quiz="${esc(s.id)}|${esc(m.id)}|${esc(q.id)}">Edit score</button></td>
              </tr>`).join("")
              : `<tr><td colspan="6" class="empty" style="padding:14px">No quizzes.</td></tr>`}
          </tbody>
        </table></div>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Achievements / Inventory tabs (same shape, different collection)
// ---------------------------------------------------------------------------

async function listTab(panel, view, ctx, kind) {
  const isAch = kind === "achievements";
  const sub = isAch ? "Achievements" : "Inventory";
  const rows = isAch ? await listUserAchievements(uid) : await listUserInventory(uid);
  rows.sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
  const reload = () => loadTab(view, ctx);

  panel.innerHTML = `
    <div class="toolbar" style="margin-bottom:14px">
      <p class="hint grow">${isAch
        ? "Achievements this student holds. “Unlocked” is what the game reads."
        : "Items this student owns, and which one is equipped."}</p>
      <button class="btn btn-sm" data-act="from-catalog">Grant from catalog</button>
      <button class="btn btn-primary btn-sm" data-act="add">+ Add manually</button>
    </div>
    <div class="card"><div class="table-wrap"><table class="data">
      <thead><tr>
        <th>ID</th><th>${isAch ? "Title" : "Item name"}</th>
        <th>Unlocked</th>${isAch ? "" : "<th>Equipped</th>"}<th>Unlocked at</th><th></th>
      </tr></thead>
      <tbody>
        ${rows.length ? rows.map((r) => `
          <tr>
            <td class="mono">${esc(r.id)}</td>
            <td><strong>${esc(isAch ? (r.Title || r.title || "—") : (r.itemName || "—"))}</strong></td>
            <td><input type="checkbox" ${r.unlocked ? "checked" : ""} data-flag="unlocked" data-id="${esc(r.id)}" /></td>
            ${isAch ? "" : `<td><input type="checkbox" ${r.equipped ? "checked" : ""} data-flag="equipped" data-id="${esc(r.id)}" /></td>`}
            <td>${esc(fmtDateTime(r.unlockedAt))}</td>
            <td class="actions"><div class="btn-row" style="justify-content:flex-end">
              <button class="btn btn-xs" data-act="edit" data-id="${esc(r.id)}">Edit</button>
              <button class="btn btn-xs btn-danger" data-act="del" data-id="${esc(r.id)}">Delete</button>
            </div></td>
          </tr>`).join("")
          : `<tr><td colspan="${isAch ? 5 : 6}" class="empty">Nothing here yet.</td></tr>`}
      </tbody>
    </table></div></div>`;

  const pathFor = (id) => `${COL.users}/${uid}/${sub}/${id}`;

  on(panel, "[data-flag]", async (e, el) => {
    const value = el.checked;
    const field = el.dataset.flag;
    const payload = { [field]: value };
    if (field === "unlocked") payload.unlockedAt = value ? new Date() : null;
    try {
      await setDocument(pathFor(el.dataset.id), payload, true);
      await logAction(`${kind}.${field}`, pathFor(el.dataset.id), payload);
      toast("Saved.", "good", 1800);
    } catch (err) {
      toast(errorMessage(err), "bad", 6000);
      el.checked = !value;
    }
  }, "change");

  on(panel, '[data-act="edit"]', async (e, el) => {
    const r = rows.find((x) => x.id === el.dataset.id);
    await editDocModal({
      title: `${isAch ? "Achievement" : "Item"} — ${r.id}`,
      path: pathFor(r.id),
      fields: isAch ? [
        { key: "Title", label: "Title", type: "text", value: r.Title || "" },
        { key: "unlocked", label: "Unlocked", type: "bool", value: !!r.unlocked },
        { key: "unlockedAt", label: "Unlocked at", type: "date", value: r.unlockedAt }
      ] : [
        { key: "itemName", label: "Item name", type: "text", value: r.itemName || "" },
        { key: "unlocked", label: "Unlocked", type: "bool", value: !!r.unlocked },
        { key: "equipped", label: "Equipped", type: "bool", value: !!r.equipped },
        { key: "unlockedAt", label: "Unlocked at", type: "date", value: r.unlockedAt }
      ],
      onSaved: reload
    });
  });

  on(panel, '[data-act="del"]', async (e, el) => {
    const ok = await confirmAction({
      title: `Remove ${el.dataset.id}?`,
      message: "This deletes the document from this student only.",
      confirmText: "Remove", danger: true
    });
    if (!ok) return;
    await deleteDocument(pathFor(el.dataset.id));
    await logAction(`${kind}.delete`, pathFor(el.dataset.id));
    toast("Removed.", "good");
    reload();
  });

  on(panel, '[data-act="add"]', async () => {
    await openModal({
      title: isAch ? "Add achievement" : "Add item",
      body: `<div class="form-grid">
        <label class="field"><span>Document ID</span>
          <input type="text" data-id placeholder="${isAch ? "achievement_2" : "item_2"}" /></label>
        <label class="field"><span>${isAch ? "Title" : "Item name"}</span>
          <input type="text" data-name placeholder="${isAch ? "Finish Your First Quiz" : "Notebook"}" /></label>
        <label class="check span-2"><input type="checkbox" data-unlocked checked /> Unlocked</label>
      </div>`,
      confirmText: "Add",
      onConfirm: async (body) => {
        const id = body.querySelector("[data-id]").value.trim();
        const name = body.querySelector("[data-name]").value.trim();
        const unlocked = body.querySelector("[data-unlocked]").checked;
        if (!id || !name) { toast("ID and name are both required.", "warn"); return false; }
        const data = isAch
          ? { Title: name, unlocked, unlockedAt: unlocked ? new Date() : null }
          : { itemName: name, unlocked, equipped: false, unlockedAt: unlocked ? new Date() : null };
        await setDocument(pathFor(id), data, false);
        await logAction(`${kind}.add`, pathFor(id), data);
        toast("Added.", "good");
        reload();
      }
    });
  });

  on(panel, '[data-act="from-catalog"]', async () => {
    const catalog = await listCollection(isAch ? COL.achievementCatalog : COL.itemCatalog);
    if (!catalog.length) {
      toast(`The ${isAch ? "achievement" : "item"} catalog is empty. Add entries under ${isAch ? "Achievements" : "In-App Economy"} first.`, "warn", 6000);
      return;
    }
    await openModal({
      title: "Grant from catalog",
      body: `<label class="field"><span>Catalog entry</span>
        <select data-cid>${catalog.map((c) =>
          `<option value="${esc(c.id)}">${esc(c.title || c.itemName || c.id)}</option>`).join("")}</select></label>`,
      confirmText: "Grant",
      onConfirm: async (body) => {
        const entry = catalog.find((c) => c.id === body.querySelector("[data-cid]").value);
        if (isAch) await pushAchievementToUser(uid, { id: entry.id, title: entry.title || entry.id });
        else await pushItemToUser(uid, { id: entry.id, itemName: entry.itemName || entry.id });
        await logAction(`${kind}.grantFromCatalog`, pathFor(entry.id));
        toast("Granted.", "good");
        reload();
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Raw field editor
// ---------------------------------------------------------------------------

async function rawTab(panel, view, ctx) {
  const fresh = await getUser(uid);
  const entries = Object.entries(fresh).filter(([k]) => k !== "id" && k !== "path").sort();

  panel.innerHTML = `
    <div class="toolbar" style="margin-bottom:14px">
      <p class="hint grow">Every field on <code>Users/${esc(uid)}</code>, exactly as stored.
      Use this for fields the forms above don't cover.</p>
      <button class="btn btn-sm" data-act="add-field">+ Add field</button>
    </div>
    <div class="card"><div class="table-wrap"><table class="data">
      <thead><tr><th>Field</th><th>Type</th><th>Value</th><th></th></tr></thead>
      <tbody>
        ${entries.map(([k, v]) => `
          <tr>
            <td class="mono"><strong>${esc(k)}</strong></td>
            <td><span class="badge">${esc(typeOf(v))}</span></td>
            <td>${esc(fmtValue(v))}</td>
            <td class="actions"><div class="btn-row" style="justify-content:flex-end">
              <button class="btn btn-xs" data-act="edit-field" data-k="${esc(k)}">Edit</button>
              <button class="btn btn-xs btn-danger" data-act="del-field" data-k="${esc(k)}">Delete</button>
            </div></td>
          </tr>`).join("")}
      </tbody>
    </table></div></div>`;

  const reload = () => loadTab(view, ctx);

  on(panel, '[data-act="edit-field"]', (e, el) => fieldModal(el.dataset.k, fresh[el.dataset.k], reload));
  on(panel, '[data-act="add-field"]', () => fieldModal("", "", reload, true));

  on(panel, '[data-act="del-field"]', async (e, el) => {
    const key = el.dataset.k;
    const ok = await confirmAction({
      title: `Delete field "${key}"?`,
      message: "The field is removed from the student document. The game may misbehave if it expects this field.",
      confirmText: "Delete field", danger: true
    });
    if (!ok) return;
    const { deleteField } = await import("../firebase.js");
    await updateUser(uid, { [key]: deleteField() });
    toast("Field deleted.", "good");
    reload();
  });
}

function typeOf(v) {
  if (v === null || v === undefined) return "null";
  if (toDate(v) && typeof v === "object") return "timestamp";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

async function fieldModal(key, value, reload, isNew = false) {
  await openModal({
    title: isNew ? "Add field" : `Edit "${key}"`,
    body: `
      <div class="form-grid">
        <label class="field"><span>Field name</span>
          <input type="text" data-key value="${esc(key)}" ${isNew ? "" : "readonly"} /></label>
        <label class="field"><span>Type</span>
          <select data-type>
            <option value="string">string</option>
            <option value="number">number</option>
            <option value="boolean">boolean</option>
            <option value="timestamp">timestamp</option>
            <option value="null">null</option>
            <option value="json">json (array / map)</option>
          </select></label>
        <label class="field span-2"><span>Value</span>
          <textarea class="mono" data-value rows="3"></textarea></label>
      </div>`,
    confirmText: "Save",
    onOpen: (body) => {
      const typeSel = body.querySelector("[data-type]");
      const valueEl = body.querySelector("[data-value]");
      const t = typeOf(value);
      typeSel.value = ["string", "number", "boolean", "timestamp", "null"].includes(t) ? t : "json";
      if (t === "timestamp") {
        const d = toDate(value);
        valueEl.value = d ? d.toISOString() : "";
      } else if (t === "json" || t === "array" || t === "object") {
        valueEl.value = JSON.stringify(value, null, 2);
      } else if (t === "null") {
        valueEl.value = "";
      } else {
        valueEl.value = String(value);
      }
    },
    onConfirm: async (body) => {
      const k = body.querySelector("[data-key]").value.trim();
      const type = body.querySelector("[data-type]").value;
      const raw = body.querySelector("[data-value]").value;
      if (!k) { toast("Field name is required.", "warn"); return false; }
      let parsed;
      try {
        if (type === "string") parsed = raw;
        else if (type === "number") {
          parsed = Number(raw);
          if (!isFinite(parsed)) throw new Error("Not a valid number.");
        }
        else if (type === "boolean") parsed = /^(true|1|yes)$/i.test(raw.trim());
        else if (type === "timestamp") {
          const d = raw.trim() ? new Date(raw.trim()) : new Date();
          if (isNaN(d)) throw new Error("Not a valid date. Try an ISO string like 2026-08-06T00:00:00Z.");
          parsed = d;
        }
        else if (type === "null") parsed = null;
        else parsed = JSON.parse(raw);
      } catch (err) {
        toast(err.message, "warn", 5000);
        return false;
      }
      await updateUser(uid, { [k]: parsed });
      toast("Saved.", "good");
      await reload();
    }
  });
}

// ---------------------------------------------------------------------------
// Shared: typed document editor
// ---------------------------------------------------------------------------

export async function editDocModal({ title, path, fields, onSaved }) {
  const input = (f) => {
    if (f.type === "bool") {
      return `<label class="check"><input type="checkbox" data-f="${esc(f.key)}" data-t="bool" ${f.value ? "checked" : ""}/> ${esc(f.label)}</label>`;
    }
    if (f.type === "date") {
      const d = toDate(f.value);
      const local = d ? new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : "";
      return `<label class="field"><span>${esc(f.label)}</span>
        <input type="datetime-local" data-f="${esc(f.key)}" data-t="date" value="${esc(local)}" />
        <small>Leave blank for null.</small></label>`;
    }
    return `<label class="field"><span>${esc(f.label)}</span>
      <input type="${f.type === "number" ? "number" : "text"}" data-f="${esc(f.key)}" data-t="${esc(f.type)}"
        value="${esc(f.value ?? "")}" /></label>`;
  };

  await openModal({
    title,
    body: `<div class="form-grid">${fields.map((f) =>
      f.type === "bool" ? `<div class="span-2">${input(f)}</div>` : input(f)).join("")}</div>
      <p class="hint mono" style="margin-top:12px">${esc(path)}</p>`,
    confirmText: "Save",
    onConfirm: async (body) => {
      const data = {};
      body.querySelectorAll("[data-f]").forEach((el) => {
        const key = el.dataset.f;
        const t = el.dataset.t;
        if (t === "bool") data[key] = el.checked;
        else if (t === "number") data[key] = Number(el.value) || 0;
        else if (t === "date") data[key] = el.value ? new Date(el.value) : null;
        else data[key] = el.value;
      });
      try {
        await setDocument(path, data, true);
        await logAction("document.edit", path, data);
        toast("Saved.", "good");
        if (onSaved) await onSaved();
      } catch (err) {
        toast(errorMessage(err), "bad", 6000);
        return false;
      }
    }
  });
}
