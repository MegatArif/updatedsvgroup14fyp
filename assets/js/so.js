/* ═══════════════════════════════════════════════════════
   so.js  —  Shop Owner Dashboard
   MODIFIED: connected to Firestore for real reservation data.
   ADDED: writes a "accepted" notification to the `notifications`
          collection when the owner approves a booking.
   Depends on:
     assets/js/toast.js        → showToast()
     assets/js/navbar.js       → setupNavbar()
     assets/js/firebase-config → db, app
═══════════════════════════════════════════════════════ */

import { showToast }   from "./toast.js";
import { setupNavbar } from "./navbar.js";

// ADDED: Firestore + Auth imports for real data + notification writing
import { db, app } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  getDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { guardSession } from "./session.js";

guardSession(["shopowner"]);

const auth = getAuth(app);

// MODIFIED: reservations is now populated from Firestore, not hard-coded
let reservations = [];

// Per-reservation notes stored in memory: { "docId": [{text, date}, …] }
const notes = {};

// The cafe name for this shop owner (loaded from Firestore)
let ownerCafeName = "";

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
    // Use Firestore doc ID as the row key
    const status = (r.status || "pending").toLowerCase();

const actionCell = status === "pending"
  ? `<div class="action-btns">
       <button class="btn-approve" onclick="updateStatus('${r._docId}','confirmed')">
         <i class="fas fa-check"></i> Approve
       </button>
       <button class="btn-reject" onclick="updateStatus('${r._docId}','rejected')">
         <i class="fas fa-xmark"></i> Reject
       </button>
     </div>`
  : status === "confirmed"
    ? `<span class="resolved-label">✓ Approved</span>`
    : status === "rejected"
      ? `<span class="resolved-label">✗ Rejected</span>`
      : `<div class="action-btns">
           <button class="btn-approve" onclick="updateStatus('${r._docId}','confirmed')">
             <i class="fas fa-check"></i> Approve
           </button>
           <button class="btn-reject" onclick="updateStatus('${r._docId}','rejected')">
             <i class="fas fa-xmark"></i> Reject
           </button>
         </div>`;

    return `
      <tr id="row-${r._docId}">
        <td><strong>${r._docId.substring(0, 6)}…</strong></td>
        <td>${r.username || r.customer || "—"}</td>
        <td>${r.date || ""} ${r.time || ""}</td>
        <td>${r.guests || "—"}</td>
        <td id="badge-${r._docId}">${makeBadge(r.status)}</td>
        <td id="action-${r._docId}">${actionCell}</td>
      </tr>`;
  }).join("");
}

/* ═══════════════════════════════════════════════════════
   APPROVE / REJECT
   MODIFIED: now writes to Firestore and sends a notification
             to the customer when the booking is accepted.
═══════════════════════════════════════════════════════ */
window.updateStatus = async function(docId, newStatus) {
  const r = reservations.find(x => x._docId === docId);
  if (!r) return;

  try {
    // 1. Update the reservation document in Firestore
    // ADDED: persists approval/rejection status so reservation.js can read it
    await updateDoc(doc(db, "reservation", docId), {
      status: newStatus,
    });

    // 2. ADDED: Write a notification to the customer if booking was accepted
    if (newStatus === "confirmed" && r.userId) {
      await addDoc(collection(db, "notifications"), {
        userId:        r.userId,                          // customer's UID
        type:          "accepted",
        message:       `Your reservation at ${ownerCafeName || r.cafe || "the cafe"} on ${r.date} at ${r.time} has been accepted! We look forward to seeing you.`,
        cafeName:      ownerCafeName || r.cafe || "",
        reservationId: docId,
        read:          false,
        createdAt:     serverTimestamp(),
      });
    }

    // 3. Update local array so re-renders are instant (Firestore onSnapshot will
    //    also update shortly after, which is fine)
    r.status = newStatus;

    // Update badge cell in-place
    const badgeEl = document.getElementById(`badge-${docId}`);
    if (badgeEl) badgeEl.innerHTML = makeBadge(newStatus);

    // Swap action buttons → resolved label
    const actionEl = document.getElementById(`action-${docId}`);
    if (actionEl)
      actionEl.innerHTML = `<span class="resolved-label">${newStatus === "confirmed" ? "✓ Approved" : "✗ Rejected"}</span>`;

    // Brief row flash
    const rowEl = document.getElementById(`row-${docId}`);
    if (rowEl) {
      rowEl.style.transition = "background .4s";
      rowEl.style.background  = newStatus === "confirmed" ? "#eaf5ec" : "#fdf2f2";
      setTimeout(() => { rowEl.style.background = ""; }, 1400);
    }

    renderStats();

    showToast(
      newStatus === "confirmed"
        ? `Reservation approved — customer has been notified. ✅`
        : `Reservation ${docId.substring(0,6)} has been rejected.`,
      newStatus === "confirmed" ? "success" : "error"
    );

  } catch (err) {
    console.error("updateStatus error:", err);
    showToast("Failed to update reservation. Please try again.", "error");
  }
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
    const count     = (notes[r._docId] || []).length;
    const noteBadge = count > 0 ? `<span class="note-count-badge">${count}</span>` : "";
    return `
      <div class="comp-card" id="card-${r._docId}">
        <div class="comp-card-top">
          <div>
            <div class="comp-card-id">${r._docId.substring(0,6)}…</div>
            <div class="comp-card-name">${r.username || r.customer || "—"}</div>
          </div>
          ${makeBadge(r.status)}
        </div>
        <div class="comp-card-meta">
          <span><i class="fas fa-calendar-alt"></i>${r.date || ""} ${r.time || ""}</span>
          <span><i class="fas fa-users"></i>${r.guests || "—"} guests</span>
        </div>
        <div class="comp-card-actions">
          <button class="btn" onclick="handleReceipt('${r._docId}')">
            <i class="fas fa-receipt"></i> Receipt
          </button>
          <button class="btn" id="noteBtn-${r._docId}" onclick="openNotesModal('${r._docId}')">
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
  const r = reservations.find(x => x._docId === id);
  if (!r) return;
  alert(
    `━━━━━━━━━━━━━━━━━━━━━━━\n`  +
    `  RECEIPT  —  ${id.substring(0,8)}\n`    +
    `━━━━━━━━━━━━━━━━━━━━━━━\n`  +
    `Customer : ${r.username || r.customer || "—"}\n` +
    `Date     : ${r.date || ""}\n` +
    `Time     : ${r.time || ""}\n` +
    `Guests   : ${r.guests || "—"}\n`   +
    `━━━━━━━━━━━━━━━━━━━━━━━`
  );
};

/* ═══════════════════════════════════════════════════════
   NOTES MODAL
═══════════════════════════════════════════════════════ */
let activeNoteId = null;

window.openNotesModal = function(id) {
  activeNoteId = id;
  const r = reservations.find(x => x._docId === id);

  document.getElementById("modalSubtitle").textContent = `${id.substring(0,8)}  ·  ${r?.username || "—"}`;
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

  showToast("Note saved successfully.", "success");
};

window.deleteNote = function(index) {
  if (!activeNoteId) return;
  if (!confirm("Delete this note?")) return;
  notes[activeNoteId].splice(index, 1);
  renderNotesList(activeNoteId);
  refreshNoteButton(activeNoteId);

  showToast("Note deleted.", "info");
};

function refreshNoteButton(id) {
  const btn   = document.getElementById(`noteBtn-${id}`);
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
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ═══════════════════════════════════════════════════════
   INJECT NOTES MODAL
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

/* ═══════════════════════════════════════════════════════
   FIRESTORE — load reservations for this shop owner
   ADDED: replaces the hard-coded dummy data array.
   Queries `reservation` where cafe == ownerCafeName.
   Uses onSnapshot for real-time updates.
═══════════════════════════════════════════════════════ */
function loadReservations(cafeName) {
  ownerCafeName = cafeName;

  const q = query(
    collection(db, "reservation"),
    where("cafe", "==", cafeName)
  );

  onSnapshot(q, (snapshot) => {
    reservations = snapshot.docs.map((d) => ({
      _docId: d.id,   // Firestore doc ID used as the unique key
      ...d.data(),
    }));

    renderStats();
    renderPendingTable();
    renderCompletedCards();
  });
}

/* ═══════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  setupNavbar();
  startClock();
  injectNotesModal();

  // ADDED: Wait for auth, then fetch the owner's cafe name from ShopOwner doc,
  // then load reservations scoped to that cafe.
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    try {
      const ownerSnap = await getDoc(doc(db, "ShopOwner", user.uid));
      const ownerData = ownerSnap.exists() ? ownerSnap.data() : {};
      const cafeDocId = ownerData.cafeDocId;

      if (!cafeDocId) {
        // No cafe registered yet — show empty state
        renderStats();
        renderPendingTable();
        renderCompletedCards();
        return;
      }

      const cafeSnap = await getDoc(doc(db, "cafes", cafeDocId));
      const cafeName = cafeSnap.exists() ? cafeSnap.data().name : "";

      if (!cafeName) {
        console.warn("so.js: could not resolve cafe name from cafeDocId:", cafeDocId);
        return;
      }

      loadReservations(cafeName);

    } catch (err) {
      console.error("so.js init error:", err);
      showToast("Could not load reservation data.", "error");
    }
  });
});