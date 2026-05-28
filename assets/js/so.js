/* ═══════════════════════════════════════════════════════
   so.js  —  Shop Owner Dashboard
   Depends on:
     assets/js/toast.js        → showToast()
     assets/js/navbar.js       → setupNavbar()
     assets/js/firebase-config.js → db, app
═══════════════════════════════════════════════════════ */

import { showToast }   from "./toast.js";
import { setupNavbar } from "./navbar.js";
import { db, app }     from "./firebase-config.js";

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  orderBy,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

const auth = getAuth(app);

/* ═══════════════════════════════════════════════════════
   STATE
   reservations[] — populated from Firestore
   Each item shape (mirrors your Firestore fields):
   {
     id,          ← Firestore document ID
     createdAt,   ← Firestore Timestamp
     date,        ← "2026-05-25"
     guests,      ← "3 People"
     time,        ← "21:00"
     userId,
     username,
     status,      ← "pending" | "confirmed" | "rejected" | "completed"
   }
═══════════════════════════════════════════════════════ */
let reservations = [];

// Per-reservation notes stored in memory: { "<docId>": [{text, date}, …] }
const notes = {};

/* ═══════════════════════════════════════════════════════
   FIRESTORE — LOAD RESERVATIONS FOR THIS OWNER'S CAFE
═══════════════════════════════════════════════════════ */
async function loadReservations(user) {
  try {
    // 1. Get this owner's cafe name so we can filter reservations
    const cafesSnap = await getDocs(
      query(collection(db, "cafes"), where("ownerId", "==", user.uid))
    );

    if (cafesSnap.empty) {
      showToast("No cafe registered to this account.", "error");
      return;
    }

    const cafeName = cafesSnap.docs[0].data().name || "";

    // 2. Query reservations where cafe == cafeName
    //    (matches the "cafe" field in your Firestore screenshot)
    const resQuery = query(
      collection(db, "reservation"),
      where("cafe", "==", cafeName),
      
    );

    const snap = await getDocs(resQuery);

    reservations = snap.docs.map((d) => ({
      id:        d.id,
      createdAt: d.data().createdAt ?? null,
      date:      d.data().date      ?? "",
      guests:    d.data().guests    ?? "",
      time:      d.data().time      ?? "",
      userId:    d.data().userId    ?? "",
      username:  d.data().username  ?? "",
      status:    d.data().status    ?? "pending",   // default pending if field missing
    }));

    reservations.sort((a, b) => {
    const tA = a.createdAt?.seconds ?? 0;
    const tB = b.createdAt?.seconds ?? 0;
    return tB - tA;
  });
    await checkAndExpireReservations();
    await loadAllNotes();
    renderStats();
    renderPendingTable();
    renderCompletedCards();

  } catch (err) {
  console.error("loadReservations:", err.code, err.message); // show full error
  showToast("Failed to load reservations.", "error");
}
}

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
    el.textContent = `${String(h).padStart(2, "0")}:${m}:${s} ${ampm}`;
  };
  tick();
  setInterval(tick, 1000);
}

/* ═══════════════════════════════════════════════════════
   STATS
═══════════════════════════════════════════════════════ */
function renderStats() {
  const total     = reservations.length;
  const confirmed = reservations.filter(r => r.status === "accepted").length;
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
    pending:   { cls: "badge-pending",   icon: "fa-clock",            label: "Pending"   },
    accepted:  { cls: "badge-confirmed", icon: "fa-circle-check",     label: "Accepted"  },
    rejected:  { cls: "badge-rejected",  icon: "fa-circle-xmark",     label: "Rejected"  },
    completed: { cls: "badge-completed", icon: "fa-check-double",     label: "Completed" },
    expired:   { cls: "badge-expired",   icon: "fa-calendar-xmark",   label: "Expired"   },
    cancel:    { cls: "badge-cancel",    icon: "fa-ban",              label: "Cancelled" },
  };
  const c = map[status] || map.pending;
  return `<span class="badge ${c.cls}"><i class="fas ${c.icon}"></i>${c.label}</span>`;
}

/* ═══════════════════════════════════════════════════════
   PENDING TABLE
   Shows all non-completed reservations.
   Columns: ID (short), Customer, Date, Time, Guests, Status, Actions
═══════════════════════════════════════════════════════ */
function renderPendingTable() {
  const tbody = document.getElementById("reservationsBody");
  if (!tbody) return;

  const rows = reservations.filter(r => r.status !== "completed");

  if (!rows.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No reservations.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const shortId = r.id.slice(-6).toUpperCase();

    const actionCell = r.status === "pending"
  ? `<div class="action-btns">
       <button class="btn-approve" onclick="updateStatus('${r.id}','accepted')">
         <i class="fas fa-check"></i> Approve
       </button>
       <button class="btn-reject"  onclick="updateStatus('${r.id}','rejected')">
         <i class="fas fa-xmark"></i> Reject
       </button>
     </div>`
  : `<span class="resolved-label">${r.status === "accepted" ? "✓ Approved" : r.status === "cancel" ? "✗ Cancelled" : r.status === "expired" ? "⏰ Expired" : "✗ Rejected"}</span>`;

    return `
      <tr id="row-${r.id}">
        <td><strong title="${r.id}">${shortId}</strong></td>
        <td>${escapeHtml(r.username)}</td>
        <td>${r.date}</td>
        <td>${r.time}</td>
        <td>${escapeHtml(r.guests)}</td>
        <td id="badge-${r.id}">${makeBadge(r.status)}</td>
        <td id="action-${r.id}">${actionCell}</td>
      </tr>`;
  }).join("");
}

/* ═══════════════════════════════════════════════════════
   APPROVE / REJECT — writes status back to Firestore
═══════════════════════════════════════════════════════ */
window.updateStatus = async function(id, newStatus) {
  const r = reservations.find(x => x.id === id);
  if (!r) return;

  try {
    // Update Firestore first
    await updateDoc(doc(db, "reservation", id), { status: newStatus });

    // Then update local state
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
      
      rowEl.style.background = newStatus === "accepted" ? "#eaf5ec" : "#fdf2f2";  // was "confirmed"
      setTimeout(() => { rowEl.style.background = ""; }, 1400);
    }

    renderStats();

    showToast(
    newStatus === "accepted"
      ? `Reservation approved.`
      : `Reservation rejected.`,
    newStatus === "accepted" ? "success" : "error"
  );

  } catch (err) {
    console.error("updateStatus:", err);
    showToast("Failed to update reservation status.", "error");
  }
};


/* ═══════════════════════════════════════════════════════
   AUTO-EXPIRE — marks pending reservations as expired
   if their date+time has already passed
═══════════════════════════════════════════════════════ */
async function checkAndExpireReservations() {
  const now = new Date();

  for (const r of reservations) {
    if (r.status !== "pending") continue;

    // Combine date + time into a Date object  e.g. "2026-05-25" + "13:52"
    const reservationDateTime = new Date(`${r.date}T${r.time}:00`);

    if (reservationDateTime < now) {
      try {
        await updateDoc(doc(db, "reservation", r.id), { status: "expired" });
        r.status = "expired"; // update local state too
        console.log(`Expired: ${r.id}`);
      } catch (err) {
        console.error("Failed to expire reservation:", r.id, err);
      }
    }
  }
}
/* ═══════════════════════════════════════════════════════
   COMPLETED CARDS
═══════════════════════════════════════════════════════ */
function renderCompletedCards() {
  const grid = document.getElementById("compGrid");
  if (!grid) return;

  // In renderCompletedCards()
const done = reservations.filter(r => r.status === "completed" || r.status === "accepted");

  if (!done.length) {
    grid.innerHTML = `<p style="color:var(--text-muted);font-style:italic;padding:10px 0;">No completed reservations yet.</p>`;
    return;
  }

  grid.innerHTML = done.map(r => {
    const count     = (notes[r.id] || []).length;
    const noteBadge = count > 0 ? `<span class="note-count-badge">${count}</span>` : "";
    const shortId   = r.id.slice(-6).toUpperCase();

    return `
  <div class="comp-card" id="card-${r.id}">
    <div class="comp-card-top">
      <div>
        <div class="comp-card-id" title="${r.id}">${shortId}</div>
        <div class="comp-card-name">${escapeHtml(r.username)}</div>
      </div>
      ${makeBadge(r.status)}
    </div>
    <div class="comp-card-meta">
      <span><i class="fas fa-calendar-alt"></i>${r.date} &nbsp;·&nbsp; ${r.time}</span>
      <span><i class="fas fa-users"></i>${escapeHtml(r.guests)}</span>
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
   NOTES MODAL
═══════════════════════════════════════════════════════ */
let activeNoteId = null;

window.openNotesModal = function(id) {
  activeNoteId = id;
  const r = reservations.find(x => x.id === id);

  document.getElementById("modalSubtitle").textContent =
    `${r.id.slice(-6).toUpperCase()}  ·  ${r.username}`;
  document.getElementById("modalTitle").textContent = "Reservation Notes";

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

window.saveNote = async function() {
  const ta   = document.getElementById("noteTextarea");
  const text = ta.value.trim();
  if (!text || !activeNoteId) return;

  if (!notes[activeNoteId]) notes[activeNoteId] = [];

  const now  = new Date();
  const date =
    now.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" }) +
    "  " +
    now.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" });

  notes[activeNoteId].unshift({ text, date });

  // Save to Firestore
  await setDoc(doc(db, "reservationNotes", activeNoteId), {
    notes: notes[activeNoteId]
  });

  ta.value = "";
  updateCharCount();
  renderNotesList(activeNoteId);
  refreshNoteButton(activeNoteId);

  showToast("Note saved successfully.", "success");
};

window.deleteNote = async function(index) {
  if (!activeNoteId) return;
  if (!confirm("Delete this note?")) return;

  notes[activeNoteId].splice(index, 1);

  // Update Firestore
  await setDoc(doc(db, "reservationNotes", activeNoteId), {
    notes: notes[activeNoteId]
  });

  renderNotesList(activeNoteId);
  refreshNoteButton(activeNoteId);
  showToast("Note deleted.", "info");
};

async function loadAllNotes() {
  for (const r of reservations) {
    try {
      const snap = await getDoc(doc(db, "reservationNotes", r.id));
      if (snap.exists()) {
        notes[r.id] = snap.data().notes || [];
      }
    } catch (err) {
      console.error("Failed to load notes for", r.id, err);
    }
  }
}

function refreshNoteButton(id) {
  const btn = document.getElementById(`noteBtn-${id}`);
  if (!btn) return;
  const count = (notes[id] || []).length;
  const badge = count > 0 ? `<span class="note-count-badge">${count}</span>` : "";
  btn.innerHTML = `<i class="fas fa-pen"></i> Note ${badge}`;
}

window.updateCharCount = function() {
  const ta  = document.getElementById("noteTextarea");
  const el  = document.getElementById("charCount");
  const btn = document.getElementById("saveNoteBtn");
  if (!ta || !el) return;
  el.textContent = `${ta.value.length} / 500`;
  if (btn) btn.disabled = ta.value.trim().length === 0;
};

function escapeHtml(str) {
  return String(str)
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

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeNotesModal();
  });
}
  window.handleReceipt = function(id) {
  const r = reservations.find(x => x.id === id);
  if (!r) return;

  const { jsPDF } = window.jspdf;
  const pdfdoc = new jsPDF({ unit: "mm", format: [80, 170] });

  // HEADER
  pdfdoc.setFillColor(227, 176, 122);
  pdfdoc.rect(0, 0, 80, 22, "F");
  pdfdoc.setTextColor(60, 40, 30);
  pdfdoc.setFont("helvetica", "bold");
  pdfdoc.setFontSize(14);
  pdfdoc.text("CAFEHUNT", 40, 10, { align: "center" });
  pdfdoc.setFontSize(7);
  pdfdoc.text("OFFICIAL RESERVATION RECEIPT", 40, 16, { align: "center" });

  let y = 30;
  pdfdoc.setTextColor(120);
  pdfdoc.setFontSize(7);
  pdfdoc.text(r.username, 40, y, { align: "center" });
  y += 8;

  pdfdoc.setDrawColor(220, 190, 160);
  pdfdoc.line(5, y, 75, y);
  y += 10;

  const row = (k, v) => {
    pdfdoc.setTextColor(120);
    pdfdoc.setFont("helvetica", "bold");
    pdfdoc.text(k, 5, y);
    pdfdoc.setTextColor(60, 40, 30);
    pdfdoc.setFont("helvetica", "normal");
    pdfdoc.text(String(v), 30, y);
    y += 8;
  };

  row("Customer", r.username);
  row("Date",     r.date);
  row("Time",     r.time);
  row("Guests",   r.guests);

  y += 5;
  pdfdoc.setFillColor(255, 242, 217);
  pdfdoc.rect(5, y - 4, 70, 10, "F");
  pdfdoc.setTextColor(150, 90, 40);
  pdfdoc.setFont("helvetica", "bold");
  pdfdoc.text(`STATUS : ${r.status.toUpperCase()}`, 40, y + 2, { align: "center" });

  pdfdoc.save(`CafeHunt_${r.id}_${Date.now()}.pdf`);
};
/* ═══════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  setupNavbar();
  startClock();
  injectNotesModal();

  // Wait for auth, then load real data
  onAuthStateChanged(auth, (user) => {
    if (user) {
      loadReservations(user);
    } else {
      window.location.href = "index.html";
    }
  });
});