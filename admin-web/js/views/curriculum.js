// ============================================================================
// Curriculum - the master subject > module > lesson/quiz structure.
// Lives in SubjectCatalog and is the source used when seeding new students
// and when assigning content to existing ones.
// ============================================================================

import {
  COL, listCollection, setDocument, deleteDocument, deleteRecursive,
  pushToAllUsers, listUsers, getProgressTree, logAction
} from "../store.js";
import {
  esc, on, toast, openModal, confirmAction, errorMessage, emptyHTML,
  loadingHTML, fmtNum
} from "../util.js";

export async function render(view, params, ctx) {
  view.innerHTML = loadingHTML("Loading curriculum…");

  const subjects = await listCollection(COL.subjectCatalog);
  subjects.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) ||
    String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));

  for (const s of subjects) {
    s.modules = await listCollection(`${COL.subjectCatalog}/${s.id}/Modules`);
    s.modules.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) ||
      String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
  }

  const reload = () => render(view, params, ctx);

  const totalModules = subjects.reduce((n, s) => n + s.modules.length, 0);
  const totalLessons = subjects.reduce((n, s) =>
    n + s.modules.reduce((m, mod) => m + (mod.lessonIds || []).length, 0), 0);
  const totalQuizzes = subjects.reduce((n, s) =>
    n + s.modules.reduce((m, mod) => m + (mod.quizIds || []).length, 0), 0);

  view.innerHTML = `
    <div class="grid cols-4">
      <div class="stat accent"><div class="label">Subjects</div><div class="value">${fmtNum(subjects.length)}</div></div>
      <div class="stat"><div class="label">Modules</div><div class="value">${fmtNum(totalModules)}</div></div>
      <div class="stat"><div class="label">Lessons</div><div class="value">${fmtNum(totalLessons)}</div></div>
      <div class="stat"><div class="label">Quizzes</div><div class="value">${fmtNum(totalQuizzes)}</div></div>
    </div>

    <div class="card" style="margin-top:16px">
      <div class="card-head">
        <div style="flex:1;min-width:200px">
          <h2>Learning modules</h2>
          <p>This is the master structure. New students are seeded from it, and
             <strong>Push</strong> copies a subject to everyone who already has an account.</p>
        </div>
        <div class="btn-row">
          <button class="btn btn-sm" data-act="import">Import from a student</button>
          <button class="btn btn-primary btn-sm" data-act="new-subject">+ New subject</button>
        </div>
      </div>
      <div class="tree">
        ${subjects.length ? subjects.map((s) => `
          <div class="tree-node">
            <div class="tree-head">
              <span class="caret">▶</span>
              <span class="title"><strong>${esc(s.title || s.id)}</strong> <span class="uid">${esc(s.id)}</span></span>
              <span class="meta">${s.modules.length} modules</span>
              ${s.active === false ? `<span class="badge">Inactive</span>` : ""}
              ${s.unlockedByDefault === false ? `<span class="badge warn">Locked at start</span>` : ""}
              <button class="btn btn-xs" data-act="push-subject" data-sid="${esc(s.id)}">Push</button>
              <button class="btn btn-xs" data-act="new-module" data-sid="${esc(s.id)}">+ Module</button>
              <button class="btn btn-xs" data-act="edit-subject" data-sid="${esc(s.id)}">Edit</button>
              <button class="btn btn-xs btn-danger" data-act="del-subject" data-sid="${esc(s.id)}">Delete</button>
            </div>
            <div class="tree-kids" hidden>
              ${s.modules.length ? `
              <div class="table-wrap"><table class="data">
                <thead><tr><th>Module ID</th><th>Title</th><th>Lessons</th><th>Quizzes</th><th>Start state</th><th></th></tr></thead>
                <tbody>
                  ${s.modules.map((m) => `
                    <tr>
                      <td class="mono">${esc(m.id)}</td>
                      <td><strong>${esc(m.title || "—")}</strong></td>
                      <td class="mono">${(m.lessonIds || []).length ? esc((m.lessonIds || []).join(", ")) : "—"}</td>
                      <td class="mono">${(m.quizIds || []).length ? esc((m.quizIds || []).join(", ")) : "—"}</td>
                      <td>${m.unlockedByDefault === false
                        ? `<span class="badge warn">Locked</span>` : `<span class="badge good">Unlocked</span>`}</td>
                      <td class="actions"><div class="btn-row" style="justify-content:flex-end">
                        <button class="btn btn-xs" data-act="edit-module" data-sid="${esc(s.id)}" data-mid="${esc(m.id)}">Edit</button>
                        <button class="btn btn-xs btn-danger" data-act="del-module" data-sid="${esc(s.id)}" data-mid="${esc(m.id)}">Delete</button>
                      </div></td>
                    </tr>`).join("")}
                </tbody>
              </table></div>` : emptyHTML("No modules in this subject yet.")}
            </div>
          </div>`).join("")
        : emptyHTML("No subjects yet. Create one, or import the structure from an existing student.")}
      </div>
    </div>`;

  on(view, ".tree-head", (e, el) => {
    if (e.target.closest("button")) return;
    const kids = el.parentElement.querySelector(".tree-kids");
    if (!kids) return;
    const open = kids.hasAttribute("hidden");
    kids.toggleAttribute("hidden", !open);
    el.classList.toggle("open", open);
  });

  // ---- Subjects ------------------------------------------------------------
  on(view, '[data-act="new-subject"]', () => subjectModal(null, subjects.length, reload));
  on(view, '[data-act="edit-subject"]', (e, el) =>
    subjectModal(subjects.find((s) => s.id === el.dataset.sid), subjects.length, reload));

  on(view, '[data-act="del-subject"]', async (e, el) => {
    const ok = await confirmAction({
      title: `Delete subject "${el.dataset.sid}"?`,
      message: "Removes the subject and its modules from the catalog. Student copies are not affected.",
      confirmText: "Delete", danger: true
    });
    if (!ok) return;
    await deleteRecursive(`${COL.subjectCatalog}/${el.dataset.sid}`);
    await logAction("curriculum.deleteSubject", `${COL.subjectCatalog}/${el.dataset.sid}`);
    toast("Subject deleted.", "good");
    reload();
  });

  on(view, '[data-act="push-subject"]', async (e, el) => {
    const sid = el.dataset.sid;
    await openModal({
      title: `Push "${sid}" to every student`,
      body: `<p class="hint" style="color:var(--text);font-size:13px">
          Copies this subject with all of its modules, lessons and quizzes into every student account.
          Students who already have these IDs keep their existing progress — only titles are refreshed.</p>
        <div data-progress class="hint" style="margin-top:12px"></div>`,
      confirmText: "Push now",
      onConfirm: async (body) => {
        const progress = body.querySelector("[data-progress]");
        try {
          const n = await pushToAllUsers("subject", { id: sid }, (done, total) => {
            progress.textContent = `${done} / ${total} students…`;
          });
          toast(`Pushed to ${n} students.`, "good");
        } catch (err) { toast(errorMessage(err), "bad", 7000); return false; }
      }
    });
  });

  // ---- Modules -------------------------------------------------------------
  on(view, '[data-act="new-module"]', (e, el) => {
    const s = subjects.find((x) => x.id === el.dataset.sid);
    moduleModal(s.id, null, s.modules.length, reload);
  });

  on(view, '[data-act="edit-module"]', (e, el) => {
    const s = subjects.find((x) => x.id === el.dataset.sid);
    moduleModal(s.id, s.modules.find((m) => m.id === el.dataset.mid), s.modules.length, reload);
  });

  on(view, '[data-act="del-module"]', async (e, el) => {
    const ok = await confirmAction({
      title: `Delete module "${el.dataset.mid}"?`,
      message: "Removes it from the catalog only.",
      confirmText: "Delete", danger: true
    });
    if (!ok) return;
    await deleteDocument(`${COL.subjectCatalog}/${el.dataset.sid}/Modules/${el.dataset.mid}`);
    await logAction("curriculum.deleteModule", `${COL.subjectCatalog}/${el.dataset.sid}/Modules/${el.dataset.mid}`);
    toast("Module deleted.", "good");
    reload();
  });

  // ---- Import from a student ----------------------------------------------
  on(view, '[data-act="import"]', async () => {
    const users = await listUsers();
    if (!users.length) return toast("There are no students to import from.", "warn");
    await openModal({
      title: "Import curriculum from a student",
      body: `<label class="field"><span>Copy the structure of</span>
          <select data-uid>${users.map((u) =>
            `<option value="${esc(u.id)}">${esc(u.username || u.id)}</option>`).join("")}</select></label>
        <p class="hint" style="margin-top:10px">Reads that student's subjects, modules, lesson IDs and quiz IDs
        and writes them into the catalog. Existing catalog entries with the same IDs are updated, not duplicated.
        No student data is changed.</p>
        <div data-progress class="hint" style="margin-top:10px"></div>`,
      confirmText: "Import",
      onConfirm: async (body) => {
        const uid = body.querySelector("[data-uid]").value;
        const progress = body.querySelector("[data-progress]");
        try {
          const tree = await getProgressTree(uid);
          let sIndex = 0;
          for (const s of tree) {
            progress.textContent = `Importing ${s.title || s.id}…`;
            await setDocument(`${COL.subjectCatalog}/${s.id}`, {
              title: s.title || s.id,
              order: sIndex++,
              unlockedByDefault: s.unlocked !== false,
              active: true
            }, true);
            let mIndex = 0;
            for (const m of s.modules || []) {
              await setDocument(`${COL.subjectCatalog}/${s.id}/Modules/${m.id}`, {
                title: m.title || m.id,
                order: mIndex++,
                unlockedByDefault: m.unlocked !== false,
                lessonIds: (m.lessons || []).map((l) => l.id),
                quizIds: (m.quizzes || []).map((q) => q.id)
              }, true);
            }
          }
          await logAction("curriculum.import", `${COL.users}/${uid}`, { subjects: tree.length });
          toast(`Imported ${tree.length} subject(s).`, "good");
          await reload();
        } catch (err) {
          toast(errorMessage(err), "bad", 7000);
          return false;
        }
      }
    });
  });
}

async function subjectModal(existing, count, reload) {
  const isNew = !existing;
  await openModal({
    title: isNew ? "New subject" : `Edit ${existing.id}`,
    wide: true,
    body: `
      <div class="form-grid">
        <label class="field"><span>Document ID</span>
          <input type="text" data-id value="${esc(existing ? existing.id : `subject_${count + 1}`)}" ${isNew ? "" : "readonly"} />
          <small>Must match the ID used by the Unity client.</small></label>
        <label class="field"><span>Display order</span>
          <input type="number" data-f="order" value="${esc(existing?.order ?? count)}" /></label>
        <label class="field span-2"><span>Title</span>
          <input type="text" data-f="title" value="${esc(existing?.title || "")}"
                 placeholder="01 Software Development - Technical Field" /></label>
        <label class="field span-2"><span>Description</span>
          <textarea data-f="description">${esc(existing?.description || "")}</textarea></label>
        <div class="span-2" style="display:flex;gap:18px;flex-wrap:wrap">
          <label class="check"><input type="checkbox" data-f="unlockedByDefault"
            ${existing?.unlockedByDefault !== false ? "checked" : ""} /> Unlocked for new students</label>
          <label class="check"><input type="checkbox" data-f="active"
            ${existing?.active !== false ? "checked" : ""} /> Active</label>
        </div>
      </div>`,
    confirmText: isNew ? "Create" : "Save",
    onConfirm: async (body) => {
      const id = body.querySelector("[data-id]").value.trim();
      if (!id) { toast("Document ID is required.", "warn"); return false; }
      const data = collectFields(body);
      await setDocument(`${COL.subjectCatalog}/${id}`, data, true);
      await logAction(isNew ? "curriculum.createSubject" : "curriculum.updateSubject",
        `${COL.subjectCatalog}/${id}`, data);
      toast("Saved.", "good");
      await reload();
    }
  });
}

async function moduleModal(sid, existing, count, reload) {
  const isNew = !existing;
  await openModal({
    title: isNew ? `New module in ${sid}` : `Edit ${existing.id}`,
    wide: true,
    body: `
      <div class="form-grid">
        <label class="field"><span>Document ID</span>
          <input type="text" data-id value="${esc(existing ? existing.id : `module_${count + 1}`)}" ${isNew ? "" : "readonly"} /></label>
        <label class="field"><span>Display order</span>
          <input type="number" data-f="order" value="${esc(existing?.order ?? count)}" /></label>
        <label class="field span-2"><span>Title</span>
          <input type="text" data-f="title" value="${esc(existing?.title || "")}" placeholder="Overview" /></label>
        <label class="field"><span>Lesson IDs</span>
          <input type="text" data-list="lessonIds" value="${esc((existing?.lessonIds || []).join(", "))}"
                 placeholder="lesson_1, lesson_2" />
          <small>Comma separated, in order.</small></label>
        <label class="field"><span>Quiz IDs</span>
          <input type="text" data-list="quizIds" value="${esc((existing?.quizIds || []).join(", "))}"
                 placeholder="quiz_1" />
          <small>Comma separated, in order.</small></label>
        <div class="span-2"><label class="check"><input type="checkbox" data-f="unlockedByDefault"
          ${existing?.unlockedByDefault !== false ? "checked" : ""} /> Unlocked for new students</label></div>
      </div>`,
    confirmText: isNew ? "Create" : "Save",
    onConfirm: async (body) => {
      const id = body.querySelector("[data-id]").value.trim();
      if (!id) { toast("Document ID is required.", "warn"); return false; }
      const data = collectFields(body);
      body.querySelectorAll("[data-list]").forEach((el) => {
        data[el.dataset.list] = el.value.split(",").map((v) => v.trim()).filter(Boolean);
      });
      await setDocument(`${COL.subjectCatalog}/${sid}/Modules/${id}`, data, true);
      await logAction(isNew ? "curriculum.createModule" : "curriculum.updateModule",
        `${COL.subjectCatalog}/${sid}/Modules/${id}`, data);
      toast("Saved.", "good");
      await reload();
    }
  });
}

function collectFields(body) {
  const data = {};
  body.querySelectorAll("[data-f]").forEach((el) => {
    const key = el.dataset.f;
    if (el.type === "checkbox") data[key] = el.checked;
    else if (el.type === "number") data[key] = Number(el.value) || 0;
    else data[key] = el.value.trim();
  });
  return data;
}
