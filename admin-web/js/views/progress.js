// ============================================================================
// Student Progress Monitoring - completion and quiz performance for everyone,
// in one sortable table.
// ============================================================================

import { getAnalytics, cached } from "./analytics-cache.js";
import {
  esc, fmtNum, fmtDuration, on, emptyHTML, downloadCSV, barHTML, pct,
  compare, debounce, errorMessage
} from "../util.js";

const state = { search: "", sort: { key: "lessonsDone", dir: "desc" }, onlyStuck: false };

export async function render(view, params, ctx) {
  const existing = cached();

  view.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div style="flex:1;min-width:200px">
          <h2>Progress monitoring</h2>
          <p>Lesson, quiz and module completion per student, read straight from their subcollections.</p>
        </div>
        <div class="toolbar">
          <input type="search" data-search placeholder="Search student…" style="width:200px" />
          <label class="check"><input type="checkbox" data-stuck /> No activity yet</label>
          <button class="btn btn-sm" data-act="export">Export CSV</button>
          <button class="btn btn-primary btn-sm" data-act="refresh">${existing ? "Refresh" : "Load progress"}</button>
        </div>
      </div>
      <div class="card-body tight" data-rows>
        ${existing ? "" : `<div class="empty">
          Press <strong>Load progress</strong> to read every student's lessons and quizzes.
          This walks each student's subcollections, so it takes a few seconds.
        </div>`}
      </div>
    </div>`;

  const rowsEl = view.querySelector("[data-rows]");

  function draw(data) {
    const q = state.search.trim().toLowerCase();
    let rows = data.perUser.filter((u) => {
      if (state.onlyStuck && (u.lessonsDone > 0 || u.quizzesDone > 0)) return false;
      if (!q) return true;
      return [u.username, u.email, u.uid].some((v) => String(v || "").toLowerCase().includes(q));
    });

    const { key, dir } = state.sort;
    rows.sort((a, b) => {
      const r = compare(a[key], b[key]);
      return dir === "asc" ? r : -r;
    });

    const th = (k, label, cls = "") =>
      `<th class="sortable ${cls}" data-sort="${k}">${label}${
        state.sort.key === k ? (state.sort.dir === "asc" ? " ▲" : " ▼") : ""}</th>`;

    rowsEl.innerHTML = rows.length ? `
      <div class="table-wrap"><table class="data">
        <thead><tr>
          ${th("username", "Student")}
          ${th("level", "Level", "num")}
          <th>Lessons</th>
          <th>Quizzes</th>
          <th>Modules</th>
          ${th("avgScore", "Avg score", "num")}
          ${th("avgTime", "Avg time", "num")}
          ${th("totalXp", "Total XP", "num")}
          ${th("streak", "Streak", "num")}
          <th></th>
        </tr></thead>
        <tbody>
          ${rows.map((u) => `
            <tr class="row-link" data-uid="${esc(u.uid)}">
              <td><strong>${esc(u.username)}</strong>
                ${u.disabled ? `<span class="badge bad">Off</span>` : ""}
                <div class="uid">${esc(u.email || u.uid)}</div></td>
              <td class="num">${fmtNum(u.level)}</td>
              <td style="min-width:140px">${barHTML(u.lessonsDone, u.lessons, true)}
                <span class="uid">${u.lessonsDone}/${u.lessons}</span></td>
              <td style="min-width:140px">${barHTML(u.quizzesDone, u.quizzes, true)}
                <span class="uid">${u.quizzesDone}/${u.quizzes}</span></td>
              <td style="min-width:140px">${barHTML(u.modulesDone, u.modules, true)}
                <span class="uid">${u.modulesDone}/${u.modules}</span></td>
              <td class="num">${u.scoreCount ? u.avgScore.toFixed(1) : "—"}</td>
              <td class="num">${u.scoreCount ? esc(fmtDuration(u.avgTime)) : "—"}</td>
              <td class="num">${fmtNum(u.totalXp)}</td>
              <td class="num">${fmtNum(u.streak)}</td>
              <td class="actions"><button class="btn btn-xs" data-open>Open</button></td>
            </tr>`).join("")}
        </tbody>
      </table></div>
      <div class="pager">
        <span>${rows.length} of ${data.perUser.length} students</span>
        <span>Snapshot taken ${esc(data.generatedAt.toLocaleTimeString())}</span>
      </div>`
      : emptyHTML("No students match that filter.");
  }

  if (existing) draw(existing);

  async function load(force) {
    rowsEl.innerHTML = `<div class="loading"><span class="spinner"></span><span data-progress>Reading student data…</span></div>`;
    const label = rowsEl.querySelector("[data-progress]");
    try {
      const data = await getAnalytics({
        force,
        onProgress: (done, total) => { label.textContent = `Reading student ${done} of ${total}…`; }
      });
      draw(data);
    } catch (err) {
      rowsEl.innerHTML = `<div class="notice" style="margin:16px">${esc(errorMessage(err))}</div>`;
    }
  }

  on(view, '[data-act="refresh"]', () => load(true));

  on(view, "[data-sort]", (e, el) => {
    const key = el.dataset.sort;
    if (state.sort.key === key) state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
    else state.sort = { key, dir: key === "username" ? "asc" : "desc" };
    if (cached()) draw(cached());
  });

  on(view, "[data-open]", (e, el) =>
    ctx.navigate(`#/users/${encodeURIComponent(el.closest("tr").dataset.uid)}`));

  view.querySelector("[data-search]").addEventListener("input", debounce((e) => {
    state.search = e.target.value;
    if (cached()) draw(cached());
  }, 180));

  view.querySelector("[data-stuck]").addEventListener("change", (e) => {
    state.onlyStuck = e.target.checked;
    if (cached()) draw(cached());
  });

  on(view, '[data-act="export"]', () => {
    const data = cached();
    if (!data) return;
    downloadCSV(`topcit-progress-${new Date().toISOString().slice(0, 10)}`, data.perUser.map((u) => ({
      uid: u.uid, username: u.username, email: u.email, level: u.level,
      totalXp: u.totalXp, points: u.points, streak: u.streak,
      lessonsCompleted: u.lessonsDone, lessonsAssigned: u.lessons,
      quizzesCompleted: u.quizzesDone, quizzesAssigned: u.quizzes,
      modulesCompleted: u.modulesDone, modulesAssigned: u.modules,
      subjectsCompleted: u.subjectsDone, subjectsAssigned: u.subjects,
      completionPercent: pct(u.lessonsDone + u.quizzesDone, u.lessons + u.quizzes),
      averageQuizScore: u.scoreCount ? u.avgScore.toFixed(2) : "",
      averageQuizSeconds: u.scoreCount ? Math.round(u.avgTime) : "",
      status: u.disabled ? "deactivated" : "active",
      joined: u.createdAt ? u.createdAt.toISOString() : ""
    })));
  });
}
