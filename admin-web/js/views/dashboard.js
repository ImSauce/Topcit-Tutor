// ============================================================================
// Dashboard - system overview at a glance.
// ============================================================================

import { listUsers, listLogs, countGroup, fsWhere } from "../store.js";
import {
  esc, fmtNum, fmtDateTime, relTime, toDate, emptyHTML, on, pct
} from "../util.js";

export async function render(view, params, ctx) {
  const [users, logs] = await Promise.all([listUsers(), listLogs(12)]);

  const now = Date.now();
  const day = 864e5;
  const lastSeen = (u) => toDate(u.updatedAt) || toDate(u.lastActiveAt) || toDate(u.createdAt);

  const active7 = users.filter((u) => { const d = lastSeen(u); return d && now - d.getTime() <= 7 * day; }).length;
  const newWeek = users.filter((u) => { const d = toDate(u.createdAt); return d && now - d.getTime() <= 7 * day; }).length;
  const disabled = users.filter((u) => u.disabled).length;
  const totalXp = users.reduce((s, u) => s + (Number(u.totalXp) || 0), 0);
  const totalPoints = users.reduce((s, u) => s + (Number(u.points) || 0), 0);
  const avgLevel = users.length ? users.reduce((s, u) => s + (Number(u.level) || 1), 0) / users.length : 0;
  const bestStreak = users.reduce((m, u) => Math.max(m, Number(u.streak) || 0), 0);

  const top = [...users]
    .sort((a, b) => (Number(b.totalXp) || 0) - (Number(a.totalXp) || 0))
    .slice(0, 6);

  const recent = [...users]
    .filter((u) => toDate(u.createdAt))
    .sort((a, b) => toDate(b.createdAt) - toDate(a.createdAt))
    .slice(0, 6);

  // Sign-ups over the last 14 days
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * day);
    const key = d.toISOString().slice(0, 10);
    const count = users.filter((u) => {
      const c = toDate(u.createdAt);
      return c && c.toISOString().slice(0, 10) === key;
    }).length;
    days.push({ key, label: d.toLocaleDateString(undefined, { day: "numeric" }), count });
  }
  const peak = Math.max(1, ...days.map((d) => d.count));

  view.innerHTML = `
    <div class="grid cols-4">
      <div class="stat accent">
        <div class="label">Registered students</div>
        <div class="value">${fmtNum(users.length)}</div>
        <div class="sub">${fmtNum(newWeek)} joined in the last 7 days</div>
      </div>
      <div class="stat good">
        <div class="label">Active (7 days)</div>
        <div class="value">${fmtNum(active7)}</div>
        <div class="sub">${pct(active7, users.length)}% of all students</div>
      </div>
      <div class="stat purple">
        <div class="label">Total XP earned</div>
        <div class="value">${fmtNum(totalXp)}</div>
        <div class="sub">Average level ${avgLevel.toFixed(1)}</div>
      </div>
      <div class="stat warn">
        <div class="label">Longest streak</div>
        <div class="value">${fmtNum(bestStreak)}</div>
        <div class="sub">${fmtNum(totalPoints)} points in circulation</div>
      </div>
    </div>

    <div class="grid cols-4" style="margin-top:16px">
      <div class="stat">
        <div class="label">Lessons completed</div>
        <div class="value" data-stat="lessons">…</div>
        <div class="sub" data-sub="lessons">counting…</div>
      </div>
      <div class="stat">
        <div class="label">Quizzes completed</div>
        <div class="value" data-stat="quizzes">…</div>
        <div class="sub" data-sub="quizzes">counting…</div>
      </div>
      <div class="stat">
        <div class="label">Modules completed</div>
        <div class="value" data-stat="modules">…</div>
        <div class="sub" data-sub="modules">counting…</div>
      </div>
      <div class="stat ${disabled ? "warn" : ""}">
        <div class="label">Deactivated accounts</div>
        <div class="value">${fmtNum(disabled)}</div>
        <div class="sub">${disabled ? "Blocked from signing in" : "All accounts active"}</div>
      </div>
    </div>

    <div class="grid cols-2" style="margin-top:16px">
      <div class="card">
        <div class="card-head"><h2>Sign-ups — last 14 days</h2></div>
        <div class="card-body">
          <div class="chart">
            ${days.map((d) => `
              <div class="col" title="${esc(d.key)}: ${d.count}">
                <b>${d.count || ""}</b>
                <i style="height:${Math.round((d.count / peak) * 110)}px;${d.count ? "" : "opacity:.25"}"></i>
                <small>${esc(d.label)}</small>
              </div>`).join("")}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h2>Top students by total XP</h2>
          <a class="btn btn-sm" href="#/leaderboard">Full leaderboard</a>
        </div>
        <div class="card-body tight">
          ${top.length ? `
          <div class="table-wrap"><table class="data">
            <thead><tr><th>#</th><th>Student</th><th class="num">Level</th><th class="num">Total XP</th><th class="num">Streak</th></tr></thead>
            <tbody>
              ${top.map((u, i) => `
                <tr class="row-link" data-uid="${esc(u.id)}">
                  <td><span class="rank ${i < 3 ? "r" + (i + 1) : ""}">${i + 1}</span></td>
                  <td>${esc(u.username || "(no username)")}</td>
                  <td class="num">${fmtNum(u.level || 1)}</td>
                  <td class="num">${fmtNum(u.totalXp || 0)}</td>
                  <td class="num">${fmtNum(u.streak || 0)}</td>
                </tr>`).join("")}
            </tbody>
          </table></div>` : emptyHTML("No students yet.")}
        </div>
      </div>
    </div>

    <div class="grid cols-2" style="margin-top:16px">
      <div class="card">
        <div class="card-head">
          <h2>Newest students</h2>
          <a class="btn btn-sm" href="#/users">Manage users</a>
        </div>
        <div class="card-body tight">
          ${recent.length ? `
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Student</th><th>Joined</th><th class="num">Level</th><th></th></tr></thead>
            <tbody>
              ${recent.map((u) => `
                <tr class="row-link" data-uid="${esc(u.id)}">
                  <td>${esc(u.username || "(no username)")}<div class="uid">${esc(u.id)}</div></td>
                  <td>${esc(relTime(u.createdAt))}</td>
                  <td class="num">${fmtNum(u.level || 1)}</td>
                  <td class="actions"><button class="btn btn-xs" data-open="${esc(u.id)}">Open</button></td>
                </tr>`).join("")}
            </tbody>
          </table></div>` : emptyHTML("No students yet. Create one from User Management.")}
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <h2>Recent admin activity</h2>
          <a class="btn btn-sm" href="#/settings">Full audit log</a>
        </div>
        <div class="card-body tight">
          ${logs.length ? `
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Action</th><th>Target</th><th>By</th><th>When</th></tr></thead>
            <tbody>
              ${logs.map((l) => `
                <tr>
                  <td><span class="badge accent">${esc(l.action || "—")}</span></td>
                  <td class="uid"><span class="trunc">${esc(l.target || "—")}</span></td>
                  <td>${esc(l.adminEmail || "—")}</td>
                  <td title="${esc(fmtDateTime(l.at))}">${esc(relTime(l.at))}</td>
                </tr>`).join("")}
            </tbody>
          </table></div>`
          : emptyHTML("No admin actions recorded yet. Changes you make here will show up in this list.")}
        </div>
      </div>
    </div>`;

  // Row click / Open button -> student detail
  on(view, "[data-uid]", (e, el) => {
    if (e.target.closest("a")) return;
    ctx.navigate(`#/users/${encodeURIComponent(el.dataset.uid)}`);
  });

  // Collection-group counts run after first paint so the page never blocks on them.
  const fill = (key, done, total) => {
    const valueEl = view.querySelector(`[data-stat="${key}"]`);
    const subEl = view.querySelector(`[data-sub="${key}"]`);
    if (!valueEl) return;
    if (done === null) {
      valueEl.textContent = "n/a";
      subEl.textContent = "Needs a collection-group index";
      return;
    }
    valueEl.textContent = fmtNum(done);
    subEl.textContent = total === null ? "across all students" : `of ${fmtNum(total)} assigned (${pct(done, total)}%)`;
  };

  Promise.all([
    countGroup("Lessons", [fsWhere("completed", "==", true)]),
    countGroup("Lessons"),
    countGroup("Quizzes", [fsWhere("completed", "==", true)]),
    countGroup("Quizzes"),
    countGroup("Modules", [fsWhere("completed", "==", true)]),
    countGroup("Modules")
  ]).then(([ld, lt, qd, qt, md, mt]) => {
    fill("lessons", ld, lt);
    fill("quizzes", qd, qt);
    fill("modules", md, mt);
  }).catch((err) => console.warn("Dashboard counts failed:", err));
}
