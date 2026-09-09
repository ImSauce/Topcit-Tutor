// ============================================================================
// Leaderboard Management - rankings, season reset, level recalculation.
// ============================================================================

import { listUsers, resetLeaderboard, recalcLevels } from "../store.js";
import {
  esc, fmtNum, on, toast, openModal, confirmAction, errorMessage, emptyHTML,
  loadingHTML, downloadCSV, xpCapForLevel, barHTML, relTime
} from "../util.js";

const FIELDS = [
  { key: "totalXp", label: "Total XP" },
  { key: "level",   label: "Level" },
  { key: "points",  label: "Points" },
  { key: "streak",  label: "Streak" },
  { key: "xp",      label: "Current-level XP" }
];

let field = "totalXp";
let top = 50;

export async function render(view, params, ctx) {
  view.innerHTML = loadingHTML("Building rankings…");
  const users = await listUsers();

  const draw = () => {
    const ranked = [...users]
      .filter((u) => !u.disabled)
      .sort((a, b) => (Number(b[field]) || 0) - (Number(a[field]) || 0))
      .slice(0, top);

    view.querySelector("[data-rows]").innerHTML = ranked.length ? `
      <div class="table-wrap"><table class="data">
        <thead><tr>
          <th style="width:60px">Rank</th><th>Student</th>
          <th class="num">Level</th><th>Level progress</th>
          <th class="num">Total XP</th><th class="num">Points</th>
          <th class="num">Streak</th><th>Joined</th><th></th>
        </tr></thead>
        <tbody>
          ${ranked.map((u, i) => {
            const cap = xpCapForLevel(u.level || 1, ctx.config || undefined);
            return `<tr class="row-link" data-uid="${esc(u.id)}">
              <td><span class="rank ${i < 3 ? "r" + (i + 1) : ""}">#${i + 1}</span></td>
              <td><strong>${esc(u.username || "(no username)")}</strong><div class="uid">${esc(u.id)}</div></td>
              <td class="num">${fmtNum(u.level || 1)}</td>
              <td style="min-width:140px">${barHTML(u.xp || 0, cap)}</td>
              <td class="num"><strong>${fmtNum(u.totalXp || 0)}</strong></td>
              <td class="num">${fmtNum(u.points || 0)}</td>
              <td class="num">${fmtNum(u.streak || 0)}</td>
              <td>${esc(relTime(u.createdAt))}</td>
              <td class="actions"><button class="btn btn-xs" data-open="${esc(u.id)}">Open</button></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table></div>`
      : emptyHTML("No ranked students yet.");
  };

  view.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div style="flex:1;min-width:200px">
          <h2>Leaderboard</h2>
          <p>Deactivated accounts are excluded from the rankings.</p>
        </div>
        <div class="toolbar">
          <select data-field style="width:170px">
            ${FIELDS.map((f) => `<option value="${f.key}" ${f.key === field ? "selected" : ""}>${esc(f.label)}</option>`).join("")}
          </select>
          <select data-top style="width:120px">
            ${[10, 25, 50, 100, 500].map((n) => `<option value="${n}" ${n === top ? "selected" : ""}>Top ${n}</option>`).join("")}
          </select>
          <button class="btn btn-sm" data-act="export">Export CSV</button>
          <button class="btn btn-sm" data-act="recalc">Recalculate levels</button>
          <button class="btn btn-sm btn-danger" data-act="reset">Season reset</button>
        </div>
      </div>
      <div class="card-body tight" data-rows></div>
    </div>`;

  draw();

  view.querySelector("[data-field]").addEventListener("change", (e) => { field = e.target.value; draw(); });
  view.querySelector("[data-top]").addEventListener("change", (e) => { top = Number(e.target.value); draw(); });

  on(view, "[data-uid]", (e, el) => ctx.navigate(`#/users/${encodeURIComponent(el.dataset.uid)}`));

  on(view, '[data-act="export"]', () => {
    downloadCSV(`topcit-leaderboard-${field}-${new Date().toISOString().slice(0, 10)}`,
      [...users].sort((a, b) => (Number(b[field]) || 0) - (Number(a[field]) || 0))
        .map((u, i) => ({
          rank: i + 1, uid: u.id, username: u.username || "", level: u.level || 1,
          xp: u.xp || 0, totalXp: u.totalXp || 0, points: u.points || 0, streak: u.streak || 0,
          status: u.disabled ? "deactivated" : "active"
        })));
  });

  on(view, '[data-act="recalc"]', async () => {
    const ok = await confirmAction({
      title: "Recalculate levels from total XP",
      message: `Rebuilds every student's <code>level</code> and current-level <code>xp</code> from their
        <code>totalXp</code> using the XP curve in Settings
        (start ${ctx.config?.startingXpCap ?? 50}, +${ctx.config?.xpIncreasePerLevel ?? 10} per level).
        Use this after changing the curve.`,
      confirmText: "Recalculate"
    });
    if (!ok) return;
    try {
      const changed = await recalcLevels(users, ctx.config || undefined);
      toast(`Updated ${changed} student${changed === 1 ? "" : "s"}.`, "good");
      ctx.navigate("#/leaderboard");
      render(view, params, ctx);
    } catch (err) { toast(errorMessage(err), "bad", 6000); }
  });

  on(view, '[data-act="reset"]', async () => {
    await openModal({
      title: "Season reset",
      body: `
        <p class="hint" style="color:var(--text);font-size:13px">
          Choose which fields to zero for all ${users.length} students. Learning progress
          (lessons, quizzes, achievements, inventory) is never touched by this.
        </p>
        <div style="display:grid;gap:10px;margin-top:14px">
          <label class="check"><input type="checkbox" data-r="xp" checked /> Reset current-level XP to 0</label>
          <label class="check"><input type="checkbox" data-r="totalXp" checked /> Reset lifetime total XP to 0</label>
          <label class="check"><input type="checkbox" data-r="level" checked /> Reset level to 1</label>
          <label class="check"><input type="checkbox" data-r="points" /> Reset points to 0</label>
          <label class="check"><input type="checkbox" data-r="streak" /> Reset streak to 0</label>
        </div>
        <label class="field" style="margin-top:16px">
          <span>Type <code>RESET</code> to confirm</span>
          <input type="text" data-typed autocomplete="off" />
        </label>`,
      confirmText: "Reset season",
      confirmClass: "btn-danger",
      onConfirm: async (body) => {
        if (body.querySelector("[data-typed]").value.trim() !== "RESET") {
          toast("Type RESET to confirm.", "warn");
          return false;
        }
        const fields = {};
        body.querySelectorAll("[data-r]").forEach((el) => { fields[el.dataset.r] = el.checked; });
        if (!Object.values(fields).some(Boolean)) { toast("Select at least one field.", "warn"); return false; }
        try {
          const n = await resetLeaderboard(users.map((u) => u.id), fields);
          toast(`Season reset applied to ${n} students.`, "good");
          render(view, params, ctx);
        } catch (err) {
          toast(errorMessage(err), "bad", 6000);
          return false;
        }
      }
    });
  });
}
