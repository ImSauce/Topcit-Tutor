// ============================================================================
// Announcement Management - messages shown to students in the game.
// Stored in the top-level Announcements collection.
// ============================================================================

import { listAnnouncements, saveAnnouncement, deleteAnnouncement } from "../store.js";
import {
  esc, on, toast, openModal, confirmAction, errorMessage, emptyHTML,
  loadingHTML, fmtDateTime, toDate, relTime
} from "../util.js";

const TYPES = [
  { key: "info",        label: "Information", badge: "accent" },
  { key: "update",      label: "Update",      badge: "good" },
  { key: "maintenance", label: "Maintenance", badge: "warn" },
  { key: "urgent",      label: "Urgent",      badge: "bad" }
];

export async function render(view) {
  view.innerHTML = loadingHTML();
  const items = await listAnnouncements();
  const now = Date.now();

  const status = (a) => {
    if (a.active === false) return `<span class="badge">Draft</span>`;
    const expires = toDate(a.expiresAt);
    if (expires && expires.getTime() < now) return `<span class="badge bad">Expired</span>`;
    return `<span class="badge good">Live</span>`;
  };

  view.innerHTML = `
    <div class="card">
      <div class="card-head">
        <div style="flex:1;min-width:200px">
          <h2>Announcements <span class="badge">${items.length}</span></h2>
          <p>Maintenance notices and learning updates. The Unity client reads the
             <code>Announcements</code> collection where <code>active == true</code>.</p>
        </div>
        <button class="btn btn-primary btn-sm" data-act="new">+ New announcement</button>
      </div>
      <div class="card-body tight">
        ${items.length ? `
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Title</th><th>Type</th><th>Status</th><th>Published</th><th>Expires</th><th>Author</th><th></th></tr></thead>
          <tbody>
            ${items.map((a) => {
              const type = TYPES.find((t) => t.key === (a.type || "info")) || TYPES[0];
              return `<tr>
                <td><strong>${esc(a.title || "(untitled)")}</strong>
                  <div class="uid trunc" style="max-width:360px">${esc(a.body || "")}</div></td>
                <td><span class="badge ${type.badge}">${esc(type.label)}</span></td>
                <td>${status(a)}</td>
                <td title="${esc(fmtDateTime(a.publishedAt))}">${esc(relTime(a.publishedAt))}</td>
                <td>${esc(a.expiresAt ? fmtDateTime(a.expiresAt) : "Never")}</td>
                <td class="uid">${esc(a.author || "—")}</td>
                <td class="actions"><div class="btn-row" style="justify-content:flex-end">
                  <button class="btn btn-xs" data-act="toggle" data-id="${esc(a.id)}">${a.active === false ? "Publish" : "Unpublish"}</button>
                  <button class="btn btn-xs" data-act="edit" data-id="${esc(a.id)}">Edit</button>
                  <button class="btn btn-xs btn-danger" data-act="del" data-id="${esc(a.id)}">Delete</button>
                </div></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table></div>` : emptyHTML("No announcements yet.")}
      </div>
    </div>`;

  const reload = () => render(view);

  on(view, '[data-act="new"]', () => editModal(null, reload));
  on(view, '[data-act="edit"]', (e, el) => editModal(items.find((a) => a.id === el.dataset.id), reload));

  on(view, '[data-act="toggle"]', async (e, el) => {
    const a = items.find((x) => x.id === el.dataset.id);
    try {
      await saveAnnouncement(a.id, { ...stripMeta(a), active: a.active === false });
      toast(a.active === false ? "Published." : "Unpublished.", "good");
      reload();
    } catch (err) { toast(errorMessage(err), "bad", 6000); }
  });

  on(view, '[data-act="del"]', async (e, el) => {
    const ok = await confirmAction({
      title: "Delete announcement",
      message: "Students will no longer see this message.",
      confirmText: "Delete", danger: true
    });
    if (!ok) return;
    await deleteAnnouncement(el.dataset.id);
    toast("Deleted.", "good");
    reload();
  });
}

function stripMeta(a) {
  const { id, path, updatedAt, publishedAt, author, ...rest } = a;
  return rest;
}

async function editModal(existing, reload) {
  const isNew = !existing;
  const expires = toDate(existing?.expiresAt);
  const localExpires = expires
    ? new Date(expires.getTime() - expires.getTimezoneOffset() * 6e4).toISOString().slice(0, 16)
    : "";

  await openModal({
    title: isNew ? "New announcement" : "Edit announcement",
    wide: true,
    body: `
      <div class="form-grid">
        <label class="field span-2"><span>Title</span>
          <input type="text" data-f="title" value="${esc(existing?.title || "")}"
                 placeholder="Scheduled maintenance on Saturday" /></label>
        <label class="field span-2"><span>Message</span>
          <textarea data-f="body" rows="5" placeholder="What students need to know.">${esc(existing?.body || "")}</textarea></label>
        <label class="field"><span>Type</span>
          <select data-f="type">
            ${TYPES.map((t) => `<option value="${t.key}" ${(existing?.type || "info") === t.key ? "selected" : ""}>${esc(t.label)}</option>`).join("")}
          </select></label>
        <label class="field"><span>Expires (optional)</span>
          <input type="datetime-local" data-f="expiresAt" value="${esc(localExpires)}" />
          <small>Leave blank to keep it up indefinitely.</small></label>
        <div class="span-2"><label class="check">
          <input type="checkbox" data-f="active" ${existing?.active !== false ? "checked" : ""} />
          Publish immediately (visible to students)</label></div>
      </div>`,
    confirmText: isNew ? "Create" : "Save",
    onConfirm: async (body) => {
      const data = {};
      body.querySelectorAll("[data-f]").forEach((el) => {
        const key = el.dataset.f;
        if (el.type === "checkbox") data[key] = el.checked;
        else if (key === "expiresAt") data[key] = el.value ? new Date(el.value) : null;
        else data[key] = el.value.trim();
      });
      if (!data.title) { toast("A title is required.", "warn"); return false; }
      try {
        await saveAnnouncement(existing ? existing.id : null, data);
        toast("Saved.", "good");
        await reload();
      } catch (err) {
        toast(errorMessage(err), "bad", 6000);
        return false;
      }
    }
  });
}
