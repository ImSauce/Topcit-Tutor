// ============================================================================
// In-App Economy - collectible/shop catalog, currency tuning, bulk grants.
// ============================================================================

import { renderCatalog } from "./catalog-ui.js";
import { COL, getConfig, saveConfig, listUsers, bulkGrant } from "../store.js";
import {
  esc, fmtNum, on, toast, openModal, errorMessage, loadingHTML
} from "../util.js";

export async function render(view, params, ctx) {
  view.innerHTML = loadingHTML();
  const config = await getConfig();

  view.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div style="flex:1;min-width:200px">
          <h2>Currency &amp; reward rates</h2>
          <p>What students earn and what they spend it on. The Unity client reads
             <code>Config/gamification</code>.</p>
        </div>
        <div class="btn-row">
          <button class="btn btn-sm" data-act="bulk-points">Grant points to all students</button>
          <button class="btn btn-primary btn-sm" data-act="save-config">Save rates</button>
        </div>
      </div>
      <div class="card-body">
        <div class="form-grid">
          ${num("pointsPerLesson", "Points per lesson completed", config)}
          ${num("pointsPerQuiz", "Points per quiz completed", config)}
          ${num("hintCost", "Cost of one quiz hint", config)}
          ${num("dailyStreakXp", "XP for keeping a daily streak", config)}
        </div>
      </div>
    </div>

    <div data-catalog style="margin-top:16px"></div>`;

  on(view, '[data-act="save-config"]', async (e, el) => {
    const data = {};
    view.querySelectorAll("[data-c]").forEach((input) => {
      data[input.dataset.c] = Number(input.value) || 0;
    });
    el.disabled = true;
    try {
      await saveConfig(data);
      await ctx.reloadConfig();
      toast("Rates saved.", "good");
    } catch (err) {
      toast(errorMessage(err), "bad", 6000);
    } finally {
      el.disabled = false;
    }
  });

  on(view, '[data-act="bulk-points"]', async () => {
    const users = await listUsers();
    await openModal({
      title: `Grant points to all ${users.length} students`,
      body: `<label class="field"><span>Points to grant (negative subtracts)</span>
          <input type="number" data-amount value="50" /></label>
        <div data-progress class="hint" style="margin-top:12px"></div>`,
      confirmText: "Grant",
      onConfirm: async (body) => {
        const amount = Number(body.querySelector("[data-amount]").value) || 0;
        if (!amount) { toast("Enter a non-zero amount.", "warn"); return false; }
        const progress = body.querySelector("[data-progress]");
        try {
          await bulkGrant(users.map((u) => u.id), { points: amount }, ctx.config || undefined,
            (done, total) => { progress.textContent = `${done} / ${total}…`; });
          toast(`Granted ${amount} points to ${users.length} students.`, "good");
        } catch (err) {
          toast(errorMessage(err), "bad", 6000);
          return false;
        }
      }
    });
  });

  await renderCatalog({
    view: view.querySelector("[data-catalog]"),
    collection: COL.itemCatalog,
    title: "Items, hints & collectibles",
    description: `Everything a student can own: shop items, collectible companion characters and unlockables.
      New accounts are seeded from this list; use <strong>Push</strong> to hand an item to existing students.`,
    idPrefix: "item_",
    pushKind: "item",
    columns: [
      { key: "itemName", label: "Item name" },
      { key: "category", label: "Category", render: (r) => r.category
          ? `<span class="badge purple">${esc(r.category)}</span>` : "—" },
      { key: "cost", label: "Cost", num: true, render: (r) => r.cost ? fmtNum(r.cost) : "Free" },
      { key: "purchasable", label: "In shop", render: (r) => r.purchasable
          ? `<span class="badge good">Yes</span>` : `<span class="badge">No</span>` },
      { key: "active", label: "Active", render: (r) => r.active === false
          ? `<span class="badge">Hidden</span>` : `<span class="badge good">Active</span>` }
    ],
    fields: [
      { key: "itemName", label: "Item name", type: "text", placeholder: "Laptop", def: "" },
      { key: "category", label: "Category", type: "text", placeholder: "Companion, Gear, Hint pack…", def: "" },
      { key: "description", label: "Description", type: "textarea", def: "" },
      { key: "cost", label: "Cost in points", type: "number", def: 0 },
      { key: "order", label: "Display order", type: "number", def: 0 },
      { key: "icon", label: "Icon / sprite name", type: "text", placeholder: "item_laptop", def: "" },
      { key: "purchasable", label: "Available in the shop", type: "bool", def: true },
      { key: "active", label: "Active (visible to students)", type: "bool", def: true }
    ]
  });
}

function num(key, label, config) {
  return `<label class="field"><span>${esc(label)}</span>
    <input type="number" data-c="${esc(key)}" value="${esc(config[key] ?? 0)}" /></label>`;
}
