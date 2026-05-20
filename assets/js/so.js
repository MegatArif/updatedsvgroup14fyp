/* ═══════════════════════════════════════════════════════
   so.js  —  Shop Owner Dashboard
   Depends on:
     assets/js/toast.js   → showToast()
     assets/js/navbar.js  → setupNavbar()
═══════════════════════════════════════════════════════ */

import { showToast }   from "./toast.js";
import { setupNavbar } from "./navbar.js";

/* ═══════════════════════════════════════════════════════
   DATA
   Replace with your real Firestore/API calls as needed.
═══════════════════════════════════════════════════════ */
let reservations = [
  { id:"R001", customer:"Sarah Lim",   datetime:"2026-05-19 12:30", guests:4, amount:"RM 53.00", status:"completed" },
  { id:"R002", customer:"Jason Yong",  datetime:"2026-05-18 19:00", guests:6, amount:"RM 94.34", status:"completed" },
  { id:"R003", customer:"Ahmad Razif", datetime:"2026-05-20 14:00", guests:2, amount:null,        status:"pending"   },
  { id:"R004", customer:"Nurul Ain",   datetime:"2026-05-21 19:00", guests:5, amount:null,        status:"pending"   },
  { id:"R005", customer:"Ravi Kumar",  datetime:"2026-05-22 12:00", guests:3, amount:null,        status:"pending"   },
];

// Per-reservation notes stored in memory: { "R001": [{text, date}, …] }
const notes = {};

/* ═══════════════════════════════════════════════════════
   CLOCK
═══════════════════════════════════════════════════════ */
function startClock() {
  const el = document.getElementById("clock");
  if (!el) return;
  const tick = () => {
    const now  = new Date();
    let   h    = now.getHours();
    const m    = String(now.getMinutes()).padStart(2, "0");
    const s    = String(now.getSeconds()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    el.textContent = `${String(h).padStart(2,"0")}:${m}:${s} ${ampm}`;
  };
  tick();
  setInterval(tick, 1000);
}

/* ═══════════════════════════════════════════════════════
   STATS
═══════════════════════════════════════════════════════ */
function renderStats() {
  const total     = reservations.length;
  const confirmed = reservations.filter(r => r.status === "confirmed").length;
  const pending   = reservations.filter(r => r.status === "pending").length;

  animateCount("statTotal",     total);
  animateCount("statConfirmed", confirmed);
  animateCount("statPending",   pending);
}

function animateCount(elId, target) {
  const el = document.getElementById(elId);
  if (!el) return;
  let cur = 0;
  const step  = Math.max(1, Math.ceil(target / 30));
  const timer = setInterval(() => {
    cur = Math.min(cur + step, target);
    el.textContent = cur;
    if (cur >= target) clearInterval(timer);
  }, 30);
}

/* ═══════════════════════════════════════════════════════
   BADGE HELPER
═══════════════════════════════════════════════════════ */
function makeBadge(status) {
  const map = {
    pending:   { cls:"badge-pending",   icon:"fa-clock",        label:"Pending"   },
    confirmed: { cls:"badge-confirmed", icon:"fa-circle-check", label:"Confirmed" },
    rejected:  { cls:"badge-rejected",  icon:"fa-circle-xmark", label:"Rejected"  },
    completed: { cls:"badge-completed", icon:"fa-check-double", label:"Completed" },
  };
  const c = map[status] || map.pending;
  return `<span class="badge ${c.cls}"><i class="fas ${c.icon}"></i>${c.label}</span>`;
}

/* ═══════════════════════════════════════════════════════
   PENDING TABLE  (Approve / Reject actions)
═══════════════════════════════════════════════════════ */
function renderPendingTable() {
  const tbody = document.getElementById("reservationsBody");
  if (!tbody) return;

  // Show all non-completed reservations (pending / confirmed / rejected)
  const rows = reservations.filter(r => r.status !== "completed");

  if (!rows.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No reservations.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const actionCell = r.status === "pending"
      ? `<div class="action-btns">
           <button class="btn-approve" onclick="updateStatus('${r.id}','confirmed')">
             <i class="fas fa-check"></i> Approve
           </button>
           <button class="btn-reject" onclick="updateStatus('${r.id}','rejected')">
             <i class="fas fa-xmark"></i> Reject
           </button>
         </div>`
      : `<span class="resolved-label">${r.status === "confirmed" ? "✓ Approved" : "✗ Rejected"}</span>`;

    return `
      <tr id="row-${r.id}">
        <td><strong>${r.id}</strong></td>
        <td>${r.customer}</td>
        <td>${r.datetime}</td>
        <td>${r.guests}</td>
        <td id="badge-${r.id}">${makeBadge(r.status)}</td>
        <td id="action-${r.id}">${actionCell}</td>
      </tr>`;
  }).join("");
}

/* ═══════════════════════════════════════════════════════
   APPROVE / REJECT  (exposed globally for onclick)
═══════════════════════════════════════════════════════ */
window.updateStatus = function(id, newStatus) {
  const r = reservations.find(x => x.id === id);
  if (!r) return;

  r.status = newStatus;

  // Update badge cell in-place
  const badgeEl = document.getElementById(`badge-${id}`);
  if (badgeEl) badgeEl.innerHTML = makeBadge(newStatus);

  // Swap action buttons → resolved label
  const actionEl = document.getElementById(`action-${id}`);
  if (actionEl)
    actionEl.innerHTML = `<span class="resolved-label">${newStatus === "confirmed" ? "✓ Approved" : "✗ Rejected"}</span>`;

  // Brief row flash
  const rowEl = document.getElementById(`row-${id}`);
  if (rowEl) {
    rowEl.style.transition = "background .4s";
    rowEl.style.background  = newStatus === "confirmed" ? "#eaf5ec" : "#fdf2f2";
    setTimeout(() => { rowEl.style.background = ""; }, 1400);
  }

  renderStats();

  // ── showToast from your toast.js ───────────────────
  showToast(
    newStatus === "confirmed"
      ? `Reservation ${id} has been approved.`
      : `Reservation ${id} has been rejected.`,
    newStatus === "confirmed" ? "success" : "error"
  );
};

/* ═══════════════════════════════════════════════════════
   COMPLETED CARDS
═══════════════════════════════════════════════════════ */
function renderCompletedCards() {
  const grid = document.getElementById("compGrid");
  if (!grid) return;

  const done = reservations.filter(r => r.status === "completed");

  if (!done.length) {
    grid.innerHTML = `<p style="color:var(--text-muted);font-style:italic;padding:10px 0;">No completed reservations yet.</p>`;
    return;
  }

  grid.innerHTML = done.map(r => {
    const count     = (notes[r.id] || []).length;
    const noteBadge = count > 0 ? `<span class="note-count-badge">${count}</span>` : "";
    return `
      <div class="comp-card" id="card-${r.id}">
        <div class="comp-card-top">
          <div>
            <div class="comp-card-id">${r.id}</div>
            <div class="comp-card-name">${r.customer}</div>
          </div>
          ${makeBadge(r.status)}
        </div>
        <div class="comp-card-meta">
          <span><i class="fas fa-calendar-alt"></i>${r.datetime}</span>
          <span><i class="fas fa-users"></i>${r.guests} guests &nbsp;·&nbsp; ${r.amount ?? "—"}</span>
        </div>
        <div class="comp-card-actions">
          <button class="btn" onclick="handleReceipt('${r.id}')">
            <i class="fas fa-receipt"></i> Receipt
          </button>
          <button class="btn" id="noteBtn-${r.id}" onclick="openNotesModal('${r.id}')">
            <i class="fas fa-pen"></i> Note ${noteBadge}
          </button>
        </div>
      </div>`;
  }).join("");
}

/* ═══════════════════════════════════════════════════════
   RECEIPT
═══════════════════════════════════════════════════════ */
window.handleReceipt = function(id) {
  const r = reservations.find(x => x.id === id);
  if (!r) return;
  alert(
    `━━━━━━━━━━━━━━━━━━━━━━━\n`  +
    `  RECEIPT  —  ${r.id}\n`    +
    `━━━━━━━━━━━━━━━━━━━━━━━\n`  +
    `Customer : ${r.customer}\n` +
    `Date     : ${r.datetime}\n` +
    `Guests   : ${r.guests}\n`   +
    `Total    : ${r.amount ?? "N/A"}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━`
  );
};

/* ═══════════════════════════════════════════════════════
   NOTES MODAL
═══════════════════════════════════════════════════════ */
let activeNoteId = null;

window.openNotesModal = function(id) {
  activeNoteId = id;
  const r = reservations.find(x => x.id === id);

  document.getElementById("modalSubtitle").textContent = `${r.id}  ·  ${r.customer}`;
  document.getElementById("modalTitle").textContent    = "Reservation Notes";

  const ta = document.getElementById("noteTextarea");
  ta.value = "";
  updateCharCount();

  renderNotesList(id);
  document.getElementById("notesOverlay").classList.add("open");
  setTimeout(() => ta.focus(), 350);
};

window.closeNotesModal = function() {
  document.getElementById("notesOverlay").classList.remove("open");
  activeNoteId = null;
};

function renderNotesList(id) {
  const list    = document.getElementById("notesList");
  const noteArr = notes[id] || [];

  if (!noteArr.length) {
    list.innerHTML = `<p class="notes-empty">No notes yet. Add one below.</p>`;
    return;
  }

  list.innerHTML = noteArr.map((n, i) => `
    <div class="note-item">
      <div class="note-item-header">
        <span class="note-item-date">
          <i class="fas fa-clock" style="margin-right:5px;opacity:.4;"></i>${n.date}
        </span>
        <button class="note-item-delete" onclick="deleteNote(${i})" title="Delete note">
          <i class="fas fa-trash-can"></i>
        </button>
      </div>
      <div class="note-item-text">${escapeHtml(n.text)}</div>
    </div>`
  ).join("");
}

window.saveNote = function() {
  const ta   = document.getElementById("noteTextarea");
  const text = ta.value.trim();
  if (!text || !activeNoteId) return;

  if (!notes[activeNoteId]) notes[activeNoteId] = [];

  const now  = new Date();
  const date =
    now.toLocaleDateString("en-MY", { day:"2-digit", month:"short", year:"numeric" }) +
    "  " +
    now.toLocaleTimeString("en-MY", { hour:"2-digit", minute:"2-digit" });

  notes[activeNoteId].unshift({ text, date });

  ta.value = "";
  updateCharCount();
  renderNotesList(activeNoteId);
  refreshNoteButton(activeNoteId);

  // ── showToast from your toast.js ───────────────────
  showToast("Note saved successfully.", "success");
};

window.deleteNote = function(index) {
  if (!activeNoteId) return;
  if (!confirm("Delete this note?")) return;
  notes[activeNoteId].splice(index, 1);
  renderNotesList(activeNoteId);
  refreshNoteButton(activeNoteId);

  // ── showToast from your toast.js ───────────────────
  showToast("Note deleted.", "info");
};

function refreshNoteButton(id) {
  const btn   = document.getElementById(`noteBtn-${id}`);
  if (!btn) return;
  const count = (notes[id] || []).length;
  const badge = count > 0 ? `<span class="note-count-badge">${count}</span>` : "";
  btn.innerHTML = `<i class="fas fa-pen"></i> Note ${badge}`;
}

// Exposed globally so the inline oninput= on the textarea can call it
window.updateCharCount = function() {
  const ta  = document.getElementById("noteTextarea");
  const el  = document.getElementById("charCount");
  const btn = document.getElementById("saveNoteBtn");
  if (!ta || !el) return;
  el.textContent = `${ta.value.length} / 500`;
  if (btn) btn.disabled = ta.value.trim().length === 0;
};

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ═══════════════════════════════════════════════════════
   BUILD & INJECT NOTES MODAL  (once, on load)
═══════════════════════════════════════════════════════ */
function injectNotesModal() {
  if (document.getElementById("notesOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id        = "notesOverlay";
  overlay.className = "modal-overlay";

  // Close on backdrop click
  overlay.addEventListener("click", e => {
    if (e.target === overlay) closeNotesModal();
  });

  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">

      <div class="modal-header">
        <div class="modal-title-group">
          <span class="modal-subtitle" id="modalSubtitle"></span>
          <span class="modal-title"   id="modalTitle">Notes</span>
        </div>
        <button class="modal-close" onclick="closeNotesModal()" aria-label="Close">
          <i class="fas fa-xmark"></i>
        </button>
      </div>

      <div class="modal-body">

        <div>
          <div class="notes-section-label">Saved Notes</div>
          <div class="notes-list" id="notesList">
            <p class="notes-empty">No notes yet. Add one below.</p>
          </div>
        </div>

        <div class="add-note-area">
          <div class="add-note-label">New Note</div>
          <textarea
            id="noteTextarea"
            class="add-note-textarea"
            placeholder="Write a note for this reservation…"
            maxlength="500"
            oninput="updateCharCount()"
            onkeydown="if(event.ctrlKey&&event.key==='Enter') saveNote()"
          ></textarea>
          <div class="add-note-footer">
            <span class="add-note-char" id="charCount">0 / 500</span>
            <button class="add-note-btn" id="saveNoteBtn" onclick="saveNote()" disabled>
              <i class="fas fa-floppy-disk"></i> Save Note
            </button>
          </div>
        </div>

      </div>
    </div>`;

  document.body.appendChild(overlay);

  // Close on Escape
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeNotesModal();
  });
}

/* ═══════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  setupNavbar();           // ← your navbar.js
  startClock();
  renderStats();
  renderPendingTable();
  renderCompletedCards();
  injectNotesModal();
});