// ============================================================================
// Shared catalog CRUD table, used by Achievements and In-App Economy.
// A "catalog" is a master list the admin maintains; entries can be pushed out
// to every student, which writes into each student's own subcollection.
// ============================================================================

import {
  listCollection, setDocument, deleteDocument, pushToAllUsers, logAction
} from "../store.js";
import {
  esc, on, toast, openModal, confirmAction, errorMessage, emptyHTML,
  loadingHTML, fmtValue, downloadCSV
} from "../util.js";

/**
 * @param {object} opts
 * @param {HTMLElement} opts.view
 * @param {string} opts.collection   Firestore collection name
 * @param {string} opts.title
 * @param {string} opts.description
 * @param {Array}  opts.fields       [{ key, label, type, placeholder, def, hint }]
 * @param {Array}  opts.columns      [{ key, label, num?, render? }]
 * @param {string} opts.pushKind     "achievement" | "item" | null
 * @param {string} opts.idPrefix     used to suggest the next document ID
 */
export async function renderCatalog(opts) {
  const { view, collection, title, description, fields, columns, pushKind, idPrefix } = opts;
  view.innerHTML = loadingHTML();

  let rows = [];
  try {
    rows = await listCollection(collection);
  } catch (err) {
    view.innerHTML = `<div class="card"><div class="card-body">
      <div class="notice">${esc(errorMessage(err))}</div></div></div>`;
    return;
  }
  rows.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) ||
    String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));

  const reload = () => renderCatalog(opts);

  view.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div style="flex:1;min-width:200px">
          <h2>${esc(title)} <span class="badge">${rows.length}</span></h2>
          <p>${description}</p>
        </div>
        <div class="btn-row">
          <button class="btn btn-sm" data-act="export">Export CSV</button>
          ${pushKind ? `<button class="btn btn-sm" data-act="push-all">Push all to students</button>` : ""}
          <button class="btn btn-primary btn-sm" data-act="new">+ New entry</button>
        </div>
      </div>
      <div class="card-body tight">
        ${rows.length ? `
        <div class="table-wrap"><table class="data">
          <thead><tr>
            <th>ID</th>
            ${columns.map((c) => `<th class="${c.num ? "num" : ""}">${esc(c.label)}</th>`).join("")}
            <th></th>
          </tr></thead>
          <tbody>
            ${rows.map((r) => `
              <tr>
                <td class="mono">${esc(r.id)}</td>
                ${columns.map((c) => `<td class="${c.num ? "num" : ""}">${
                  c.render ? c.render(r) : esc(fmtValue(r[c.key]))}</td>`).join("")}
                <td class="actions"><div class="btn-row" style="justify-content:flex-end">
                  ${pushKind ? `<button class="btn btn-xs" data-act="push" data-id="${esc(r.id)}">Push</button>` : ""}
                  <button class="btn btn-xs" data-act="edit" data-id="${esc(r.id)}">Edit</button>
                  <button class="btn btn-xs btn-danger" data-act="del" data-id="${esc(r.id)}">Delete</button>
                </div></td>
              </tr>`).join("")}
          </tbody>
        </table></div>` : emptyHTML("No entries yet. Create one to get started.")}
      </div>
    </div>`;

  const payloadFor = (r) => pushKind === "achievement"
    ? { id: r.id, title: r.title || r.id }
    : { id: r.id, itemName: r.itemName || r.title || r.id };

  on(view, '[data-act="new"]', () => entryModal(null));
  on(view, '[data-act="edit"]', (e, el) => entryModal(rows.find((r) => r.id === el.dataset.id)));
  on(view, '[data-act="export"]', () => downloadCSV(collection, rows));

  on(view, '[data-act="del"]', async (e, el) => {
    const ok = await confirmAction({
      title: `Delete "${el.dataset.id}" from the catalog?`,
      message: "This removes the master definition only. Copies already granted to students are untouched.",
      confirmText: "Delete", danger: true
    });
    if (!ok) return;
    await deleteDocument(`${collection}/${el.dataset.id}`);
    await logAction("catalog.delete", `${collection}/${el.dataset.id}`);
    toast("Deleted.", "good");
    reload();
  });

  on(view, '[data-act="push"]', async (e, el) => {
    const row = rows.find((r) => r.id === el.dataset.id);
    await pushModal([row]);
  });

  on(view, '[data-act="push-all"]', () => pushModal(rows));

  async function pushModal(entries) {
    if (!entries.length) return toast("Nothing to push.", "warn");
    await openModal({
      title: `Push ${entries.length === 1 ? `"${entries[0].id}"` : `${entries.length} entries`} to every student`,
      body: `<p class="hint" style="color:var(--text);font-size:13px">
          Each student who does not already have this ${pushKind} gets it created in their own
          subcollection. Students who already have it keep their unlocked state — only the
          display name is refreshed.</p>
        <div data-progress class="hint" style="margin-top:12px"></div>`,
      confirmText: "Push now",
      onConfirm: async (body) => {
        const progress = body.querySelector("[data-progress]");
        try {
          for (const entry of entries) {
            await pushToAllUsers(pushKind, payloadFor(entry), (done, total) => {
              progress.textContent = `${entry.id}: ${done} / ${total} students…`;
            });
          }
          toast("Pushed to all students.", "good");
        } catch (err) {
          toast(errorMessage(err), "bad", 6000);
          return false;
        }
      }
    });
  }

  async function entryModal(existing) {
    const isNew = !existing;
    const nextId = `${idPrefix}${rows.length + 1}`;
    await openModal({
      title: isNew ? `New ${title.replace(/s$/, "").toLowerCase()}` : `Edit ${existing.id}`,
      wide: true,
      body: `
        <div class="form-grid">
          <label class="field"><span>Document ID</span>
            <input type="text" data-id value="${esc(existing ? existing.id : nextId)}" ${isNew ? "" : "readonly"} />
            <small>Must match the ID the Unity client uses.</small></label>
          ${fields.map((f) => fieldHTML(f, existing)).join("")}
        </div>`,
      confirmText: isNew ? "Create" : "Save",
      onConfirm: async (body) => {
        const id = body.querySelector("[data-id]").value.trim();
        if (!id) { toast("Document ID is required.", "warn"); return false; }
        const data = {};
        body.querySelectorAll("[data-f]").forEach((el) => {
          const key = el.dataset.f;
          if (el.type === "checkbox") data[key] = el.checked;
          else if (el.type === "number") data[key] = Number(el.value) || 0;
          else data[key] = el.value.trim();
        });
        try {
          await setDocument(`${collection}/${id}`, data, true);
          await logAction(isNew ? "catalog.create" : "catalog.update", `${collection}/${id}`, data);
          toast("Saved.", "good");
          reload();
        } catch (err) {
          toast(errorMessage(err), "bad", 6000);
          return false;
        }
      }
    });
  }
}

function fieldHTML(f, existing) {
  const value = existing ? existing[f.key] : f.def;
  const span = f.wide ? "span-2" : "";
  if (f.type === "bool") {
    return `<div class="${span || "span-2"}"><label class="check">
      <input type="checkbox" data-f="${esc(f.key)}" ${value ?? f.def ? "checked" : ""} /> ${esc(f.label)}</label></div>`;
  }
  if (f.type === "textarea") {
    return `<label class="field span-2"><span>${esc(f.label)}</span>
      <textarea data-f="${esc(f.key)}" placeholder="${esc(f.placeholder || "")}">${esc(value ?? "")}</textarea>
      ${f.hint ? `<small>${esc(f.hint)}</small>` : ""}</label>`;
  }
  return `<label class="field ${span}"><span>${esc(f.label)}</span>
    <input type="${f.type === "number" ? "number" : "text"}" data-f="${esc(f.key)}"
      value="${esc(value ?? f.def ?? "")}" placeholder="${esc(f.placeholder || "")}" />
    ${f.hint ? `<small>${esc(f.hint)}</small>` : ""}</label>`;
}
