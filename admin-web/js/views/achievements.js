// ============================================================================
// Achievement & Badge Management - the master achievement catalog.
// ============================================================================

import { renderCatalog } from "./catalog-ui.js";
import { COL } from "../store.js";
import { esc, fmtNum } from "../util.js";

export async function render(view) {
  await renderCatalog({
    view,
    collection: COL.achievementCatalog,
    title: "Achievement catalog",
    description: `Master definitions for achievements, badges and ranks. New students are seeded from this list;
      use <strong>Push</strong> to add an achievement to students who already exist.`,
    idPrefix: "achievement_",
    pushKind: "achievement",
    columns: [
      { key: "title", label: "Title" },
      { key: "category", label: "Category", render: (r) => r.category
          ? `<span class="badge purple">${esc(r.category)}</span>` : "—" },
      { key: "condition", label: "Unlock condition" },
      { key: "xpReward", label: "XP", num: true, render: (r) => fmtNum(r.xpReward || 0) },
      { key: "pointsReward", label: "Points", num: true, render: (r) => fmtNum(r.pointsReward || 0) },
      { key: "active", label: "Active", render: (r) => r.active === false
          ? `<span class="badge">Hidden</span>` : `<span class="badge good">Active</span>` }
    ],
    fields: [
      { key: "title", label: "Title", type: "text", placeholder: "First Login", def: "" },
      { key: "category", label: "Category / rank", type: "text", placeholder: "Milestone, Streak, Rank…", def: "" },
      { key: "description", label: "Description", type: "textarea",
        placeholder: "Shown to the student when the achievement unlocks.", def: "" },
      { key: "condition", label: "Unlock condition", type: "text",
        placeholder: "e.g. complete 5 lessons", def: "",
        hint: "Free text for your own reference and for the Unity client to interpret." },
      { key: "xpReward", label: "XP reward", type: "number", def: 0 },
      { key: "pointsReward", label: "Points reward", type: "number", def: 0 },
      { key: "order", label: "Display order", type: "number", def: 0 },
      { key: "icon", label: "Icon / sprite name", type: "text", placeholder: "badge_first_login", def: "" },
      { key: "active", label: "Active (visible to students)", type: "bool", def: true }
    ]
  });
}
