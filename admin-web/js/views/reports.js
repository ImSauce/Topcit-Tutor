// ============================================================================
// Reports & Analytics - participation, completion rates, quiz performance,
// XP distribution, and CSV exports.
// ============================================================================

import { getAnalytics, cached } from "./analytics-cache.js";
import {
  esc, fmtNum, fmtDuration, on, emptyHTML, downloadCSV, pct, errorMessage
} from "../util.js";

export async function render(view, params, ctx) {
  const existing = cached();

  view.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div style="flex:1;min-width:200px">
          <h2>Reports &amp; analytics</h2>
          <p>Engagement and performance across the whole cohort.</p>
        </div>
        <div class="btn-row">
          <button class="btn btn-sm" data-act="export-summary" ${existing ? "" : "disabled"}>Export summary</button>
          <button class="btn btn-sm" data-act="export-quizzes" ${existing ? "" : "disabled"}>Export quiz report</button>
          <button class="btn btn-primary btn-sm" data-act="refresh">${existing ? "Refresh data" : "Generate report"}</button>
        </div>
      </div>
      <div class="card-body" data-body>
        ${existing ? "" : `<div class="empty">
          Press <strong>Generate report</strong>. Every student's lessons and quizzes are read,
          so this takes a few seconds for a large cohort.</div>`}
      </div>
    </div>`;

  const bodyEl = view.querySelector("[data-body]");

  function draw(d) {
    const buckets = ["0–20", "21–40", "41–60", "61–80", "81–100"];
    const peakBucket = Math.max(1, ...d.scoreBuckets);
    const modules = [...d.perModule.entries()]
      .map(([key, m]) => ({ key, ...m, rate: pct(m.done, m.total) }))
      .sort((a, b) => a.rate - b.rate);
    const quizzes = [...d.perQuiz.entries()]
      .map(([key, q]) => ({ key, ...q, avg: q.attempts ? q.scoreSum / q.attempts : 0,
        avgTime: q.attempts ? q.timeSum / q.attempts : 0 }))
      .sort((a, b) => a.avg - b.avg);

    bodyEl.innerHTML = `
      <div class="grid cols-4">
        <div class="stat accent"><div class="label">Participation</div>
          <div class="value">${pct(d.active30, d.users)}%</div>
          <div class="sub">${fmtNum(d.active30)} of ${fmtNum(d.users)} active in 30 days</div></div>
        <div class="stat good"><div class="label">Lesson completion</div>
          <div class="value">${pct(d.lessonsDone, d.lessons)}%</div>
          <div class="sub">${fmtNum(d.lessonsDone)} of ${fmtNum(d.lessons)} assigned</div></div>
        <div class="stat purple"><div class="label">Quiz completion</div>
          <div class="value">${pct(d.quizzesDone, d.quizzes)}%</div>
          <div class="sub">${fmtNum(d.quizzesDone)} of ${fmtNum(d.quizzes)} assigned</div></div>
        <div class="stat warn"><div class="label">Average quiz score</div>
          <div class="value">${d.scoreCount ? d.avgScore.toFixed(1) : "—"}</div>
          <div class="sub">${fmtNum(d.scoreCount)} attempts · ${esc(fmtDuration(d.avgTime))} average</div></div>
      </div>

      <div class="grid cols-2" style="margin-top:16px">
        <div class="card">
          <div class="card-head"><h3>Quiz score distribution</h3></div>
          <div class="card-body">
            ${d.scoreCount ? `<div class="chart">
              ${d.scoreBuckets.map((n, i) => `
                <div class="col" title="${n} attempts scored ${buckets[i]}">
                  <b>${n || ""}</b>
                  <i style="height:${Math.round((n / peakBucket) * 110)}px;${n ? "" : "opacity:.25"}"></i>
                  <small>${buckets[i]}</small>
                </div>`).join("")}
            </div>` : emptyHTML("No completed quiz attempts yet.")}
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>XP &amp; engagement</h3></div>
          <div class="card-body">
            <dl class="kv">
              <dt>Total XP awarded</dt><dd>${fmtNum(d.totalXp)}</dd>
              <dt>Average level</dt><dd>${d.avgLevel.toFixed(2)}</dd>
              <dt>Points in circulation</dt><dd>${fmtNum(d.totalPoints)}</dd>
              <dt>Longest streak</dt><dd>${fmtNum(d.maxStreak)} days</dd>
              <dt>Active last 7 days</dt><dd>${fmtNum(d.active7)} (${pct(d.active7, d.users)}%)</dd>
              <dt>New this week</dt><dd>${fmtNum(d.newThisWeek)}</dd>
              <dt>Deactivated accounts</dt><dd>${fmtNum(d.disabled)}</dd>
              <dt>Subjects completed</dt><dd>${fmtNum(d.subjectsDone)} of ${fmtNum(d.subjects)}</dd>
            </dl>
          </div>
        </div>
      </div>

      <div class="grid cols-2" style="margin-top:16px">
        <div class="card">
          <div class="card-head"><h3>Hardest modules</h3><p>Lowest completion rate first</p></div>
          <div class="card-body tight">
            ${modules.length ? `<div class="table-wrap"><table class="data">
              <thead><tr><th>Module</th><th class="num">Completed</th><th>Rate</th></tr></thead>
              <tbody>${modules.slice(0, 12).map((m) => `
                <tr><td><span class="trunc" title="${esc(m.title)}">${esc(m.title)}</span></td>
                  <td class="num">${m.done} / ${m.total}</td>
                  <td style="min-width:120px"><div class="bar-row">
                    <div class="bar"><i style="width:${m.rate}%"></i></div><span>${m.rate}%</span></div></td></tr>`).join("")}
              </tbody></table></div>` : emptyHTML("No module data.")}
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h3>Quiz performance</h3><p>Lowest average score first</p></div>
          <div class="card-body tight">
            ${quizzes.length ? `<div class="table-wrap"><table class="data">
              <thead><tr><th>Quiz</th><th class="num">Attempts</th><th class="num">Avg score</th><th class="num">Avg time</th></tr></thead>
              <tbody>${quizzes.slice(0, 12).map((q) => `
                <tr><td><span class="trunc" title="${esc(q.key)}">${esc(q.key)}</span></td>
                  <td class="num">${q.attempts}</td>
                  <td class="num"><strong>${q.avg.toFixed(1)}</strong></td>
                  <td class="num">${esc(fmtDuration(q.avgTime))}</td></tr>`).join("")}
              </tbody></table></div>` : emptyHTML("No completed quizzes yet.")}
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <div class="card-head"><h3>Top performers</h3></div>
        <div class="card-body tight">
          <div class="table-wrap"><table class="data">
            <thead><tr><th>#</th><th>Student</th><th class="num">Level</th><th class="num">Total XP</th>
              <th class="num">Lessons</th><th class="num">Quizzes</th><th class="num">Avg score</th></tr></thead>
            <tbody>
              ${[...d.perUser].sort((a, b) => b.totalXp - a.totalXp).slice(0, 10).map((u, i) => `
                <tr class="row-link" data-uid="${esc(u.uid)}">
                  <td><span class="rank ${i < 3 ? "r" + (i + 1) : ""}">${i + 1}</span></td>
                  <td>${esc(u.username)}</td>
                  <td class="num">${fmtNum(u.level)}</td>
                  <td class="num">${fmtNum(u.totalXp)}</td>
                  <td class="num">${u.lessonsDone}/${u.lessons}</td>
                  <td class="num">${u.quizzesDone}/${u.quizzes}</td>
                  <td class="num">${u.scoreCount ? u.avgScore.toFixed(1) : "—"}</td>
                </tr>`).join("")}
            </tbody>
          </table></div>
        </div>
      </div>

      <p class="hint" style="margin-top:12px">Snapshot generated ${esc(d.generatedAt.toLocaleString())}.</p>`;

    view.querySelectorAll("[data-act^='export-']").forEach((b) => { b.disabled = false; });
  }

  if (existing) draw(existing);

  async function load(force) {
    bodyEl.innerHTML = `<div class="loading"><span class="spinner"></span><span data-progress>Reading student data…</span></div>`;
    const label = bodyEl.querySelector("[data-progress]");
    try {
      const d = await getAnalytics({
        force,
        onProgress: (done, total) => { label.textContent = `Reading student ${done} of ${total}…`; }
      });
      draw(d);
    } catch (err) {
      bodyEl.innerHTML = `<div class="notice">${esc(errorMessage(err))}</div>`;
    }
  }

  on(view, '[data-act="refresh"]', () => load(true));
  on(view, "[data-uid]", (e, el) => ctx.navigate(`#/users/${encodeURIComponent(el.dataset.uid)}`));

  on(view, '[data-act="export-summary"]', () => {
    const d = cached();
    if (!d) return;
    downloadCSV(`topcit-summary-${new Date().toISOString().slice(0, 10)}`, [{
      generatedAt: d.generatedAt.toISOString(),
      students: d.users,
      activeLast7Days: d.active7,
      activeLast30Days: d.active30,
      newThisWeek: d.newThisWeek,
      deactivated: d.disabled,
      totalXpAwarded: d.totalXp,
      totalPoints: d.totalPoints,
      averageLevel: d.avgLevel.toFixed(2),
      longestStreak: d.maxStreak,
      lessonsCompleted: d.lessonsDone,
      lessonsAssigned: d.lessons,
      lessonCompletionRate: `${pct(d.lessonsDone, d.lessons)}%`,
      quizzesCompleted: d.quizzesDone,
      quizzesAssigned: d.quizzes,
      quizCompletionRate: `${pct(d.quizzesDone, d.quizzes)}%`,
      modulesCompleted: d.modulesDone,
      subjectsCompleted: d.subjectsDone,
      averageQuizScore: d.scoreCount ? d.avgScore.toFixed(2) : "",
      averageQuizSeconds: d.scoreCount ? Math.round(d.avgTime) : ""
    }]);
  });

  on(view, '[data-act="export-quizzes"]', () => {
    const d = cached();
    if (!d) return;
    downloadCSV(`topcit-quiz-report-${new Date().toISOString().slice(0, 10)}`,
      [...d.perQuiz.entries()].map(([key, q]) => ({
        quiz: key,
        attempts: q.attempts,
        averageScore: q.attempts ? (q.scoreSum / q.attempts).toFixed(2) : "",
        averageSeconds: q.attempts ? Math.round(q.timeSum / q.attempts) : "",
        totalScore: q.scoreSum
      })));
  });
}
