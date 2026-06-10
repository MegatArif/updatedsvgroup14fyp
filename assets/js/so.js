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
    pending:   { cls:"badge-pending",   icon:"fa-clock",          label:"Pending"   },
    accepted:  { cls:"badge-confirmed", icon:"fa-circle-check",   label:"Accepted"  },
    rejected:  { cls:"badge-rejected",  icon:"fa-circle-xmark",   label:"Rejected"  },
    expired:   { cls:"badge-rejected",  icon:"fa-hourglass-end",  label:"Expired"   },
    completed: { cls:"badge-completed", icon:"fa-check-double",   label:"Completed" },
    cancel:    { cls:"badge-cancel",    icon:"fa-ban",            label:"Cancelled" },
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

const rows = reservations.filter(r => r.status !== "completed");

const done = reservations.filter(r => 
  r.status === "completed" || 
  (r.status === "accepted" && r.paymentStatus === "paid")
);

  if (!rows.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No reservations.</td></tr>`;
    return;
  }

    tbody.innerHTML = rows.map(r => {
  const status = (r.status || "pending").toLowerCase();

 const actionCell =
  status === "pending"
    ? `<div class="action-btns">
        <button class="btn-approve" onclick="updateStatus('${r._docId}','accepted')">
          <i class="fas fa-check"></i> Approve
        </button>
        <button class="btn-reject" onclick="updateStatus('${r._docId}','rejected')">
          <i class="fas fa-xmark"></i> Reject
        </button>
      </div>`

    : status === "accepted"
      ? `<span class="resolved-label">✓ Approved</span>`

    : status === "rejected"
      ? `<span class="resolved-label">✗ Rejected</span>`

    : status === "expired"
      ? `<span class="resolved-label">⏳ Expired</span>`
    
    : status === "cancel"  
    ? `<span class="resolved-label">✗ Cancelled</span>`

    : `<span class="resolved-label">—</span>`;

  return `
    <tr id="row-${r._docId}">
      <td><strong>${r._docId.substring(0, 6)}…</strong></td>
      <td>${r.username || r.customer || "—"}</td>
      <td>${r.date || "—"}</td>
      <td>${formatReceiptTime(r.time)}</td>
      <td>${r.guests || "—"}</td>
      <td id="payment-${r._docId}">${makePaymentBadge(r)}</td>
      <td id="badge-${r._docId}">${makeBadge(r.status)}</td>
      <td id="action-${r._docId}">${actionCell}</td>
    </tr>`;
}).join("");
}
  function makePaymentBadge(r) {
  if (r.paymentStatus === "paid") {
    return `<span class="badge" style="background:#e8f5e9;color:#2e7d32;border:1px solid #c8e6c9;">
      <i class="fas fa-circle-check"></i> Paid
    </span>`;
  }
  return `<span class="badge" style="background:#fff8ec;color:#a86000;border:1px solid #f0d090;">
    <i class="fas fa-clock"></i> Unpaid
  </span>`;
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
    if (newStatus === "accepted" && r.userId) {
      await addDoc(collection(db, "notifications"), {
        userId:        r.userId,                          // customer's UID
        type:          "accepted",
        message:       `Your reservation at ${ownerCafeName || r.cafe || "the cafe"} on ${r.date} at ${formatReceiptTime(r.time)} has been accepted! We look forward to seeing you.`,
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
      actionEl.innerHTML = `<span class="resolved-label">${newStatus === "accepted" ? "✓ Approved" : "✗ Rejected"}</span>`;

    // Brief row flash
    const rowEl = document.getElementById(`row-${docId}`);
    if (rowEl) {
      rowEl.style.transition = "background .4s";
      rowEl.style.background  = newStatus === "accepted" ? "#eaf5ec" : "#fdf2f2";
      setTimeout(() => { rowEl.style.background = ""; }, 1400);
    }

    renderStats();

    showToast(
      newStatus === "accepted"
        ? `Reservation approved — customer has been notified. ✅`
        : `Reservation ${docId.substring(0,6)} has been rejected.`,
      newStatus === "accepted" ? "success" : "error"
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
          <span><i class="fas fa-calendar-alt"></i>${r.date || ""} ${formatReceiptTime(r.time)}</span>
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
   RECEIPT  —  generates the same PDF as the customer side
═══════════════════════════════════════════════════════ */
function formatReceiptDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-MY', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
  });
}
function formatReceiptTime(t) {
  if (!t || !t.includes(':')) return t || '—';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}
function iconToBase64SO(unicode, color = '#8b5a2b', size = 64) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    setTimeout(() => {
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = color;
      ctx.font = `900 ${size * 0.75}px "Font Awesome 6 Free"`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(unicode, size / 2, size / 2);
      resolve(canvas.toDataURL('image/png'));
    }, 100);
  });
}

window.handleReceipt = async function(id) {
  const r = reservations.find(x => x._docId === id);
  if (!r) return;

  // jsPDF must be available — add to your HTML if not already:
  // <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  if (!window.jspdf) {
    showToast("PDF library not loaded.", "error");
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'mm', format: 'a5' });

  const cafe     = r.cafe     || '—';
  const customer = r.username || r.customer || '—';
  const date     = formatReceiptDate(r.date);
  const time     = formatReceiptTime(r.time);
  const guests   = (parseInt(r.guests) || 1);
  const guestStr = guests + ' guest' + (guests > 1 ? 's' : '');
  const total    = 10;
  const amount   = `RM ${total.toFixed(2)}`;
  const ref      = id.substring(0, 12).toUpperCase();
  const now      = new Date().toLocaleString('en-MY');

  const W = pdf.internal.pageSize.getWidth();

  // ── Background ──
  pdf.setFillColor(253, 248, 241);
  pdf.rect(0, 0, W, pdf.internal.pageSize.getHeight(), 'F');

  // ── Green header bar ──
  pdf.setFillColor(74, 122, 74);
  pdf.roundedRect(10, 8, W - 20, 30, 4, 4, 'F');

  // ── White check circle ──
  pdf.setFillColor(255, 255, 255);
  pdf.circle(W / 2, 19, 7, 'F');

  // ── Checkmark ──
  pdf.setDrawColor(74, 122, 74);
  pdf.setLineWidth(1.5);
  pdf.line(W/2 - 3, 19.5, W/2 - 0.5, 22.5);
  pdf.line(W/2 - 0.5, 22.5, W/2 + 4, 16.5);
  pdf.setLineWidth(0.2);

  // ── Header text ──
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(13);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Payment Successful', W / 2, 33, { align: 'center' });

  // ── Mug icon ──
  const mugBase64 = await iconToBase64SO('\uf7b6', '#8b5a2b', 64);
  const brandTextWidth = pdf.getStringUnitWidth('CafeHunt') * 11 / pdf.internal.scaleFactor;
  const brandIconW = 6;
  const gap = 2;
  const totalBrandW = brandIconW + gap + brandTextWidth;
  const brandStartX = (W - totalBrandW) / 2;

  pdf.addImage(mugBase64, 'PNG', brandStartX, 39, brandIconW, brandIconW);
  pdf.setTextColor(139, 90, 43);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('CafeHunt', brandStartX + brandIconW + gap, 45);

  pdf.setTextColor(180, 140, 100);
  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'normal');
  pdf.text('PAYMENT CONFIRMATION', W / 2, 51, { align: 'center' });

  // ── Dashed tear line ──
  pdf.setDrawColor(220, 200, 175);
  pdf.setLineDashPattern([2, 2], 0);
  pdf.line(10, 56, W - 10, 56);
  pdf.setLineDashPattern([], 0);

  // ── Section label ──
  pdf.setTextColor(180, 120, 70);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.text('RESERVATION DETAILS', 14, 63);

  // ── Detail rows ──
  const rows = [
    ['Cafe',     cafe],
    ['Customer', customer],
    ['Date',     date],
    ['Time',     time],
    ['Guests',   guestStr],
  ];

  let y = 69;
  rows.forEach(([label, value]) => {
    pdf.setFillColor(255, 252, 247);
    pdf.roundedRect(12, y - 4.5, W - 24, 9, 2, 2, 'F');
    pdf.setTextColor(140, 110, 80);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text(label, 16, y);
    pdf.setTextColor(40, 28, 18);
    pdf.setFont('helvetica', 'bold');
    pdf.text(value, W - 14, y, { align: 'right' });
    y += 12;
  });

  // ── Amount paid box ──
  y += 2;
  pdf.setFillColor(232, 245, 233);
  pdf.roundedRect(12, y, W - 24, 18, 3, 3, 'F');
  pdf.setDrawColor(150, 200, 150);
  pdf.roundedRect(12, y, W - 24, 18, 3, 3, 'S');

  pdf.setFillColor(34, 139, 34);
  pdf.circle(19, y + 7, 3, 'F');
  pdf.setDrawColor(255, 255, 255);
  pdf.setLineWidth(0.8);
  pdf.line(17.2, y + 7, 18.5, y + 8.3);
  pdf.line(18.5, y + 8.3, 21, y + 5.5);
  pdf.setLineWidth(0.2);

  pdf.setTextColor(34, 100, 34);
  pdf.setFontSize(8.5);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Amount Paid', 24, y + 7.5);
  pdf.setFontSize(13);
  pdf.text(amount, W - 14, y + 9, { align: 'right' });
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(80, 140, 80);
  pdf.text('Status: PAID', 17, y + 14);

  // ── Reference box ──
  y += 24;
  pdf.setFillColor(250, 246, 240);
  pdf.roundedRect(12, y, W - 24, 13, 2, 2, 'F');
  pdf.setDrawColor(220, 200, 175);
  pdf.roundedRect(12, y, W - 24, 13, 2, 2, 'S');

  pdf.setTextColor(140, 110, 80);
  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Reference ID', 16, y + 5.5);
  pdf.setTextColor(40, 28, 18);
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(8);
  pdf.text(ref, W - 14, y + 5.5, { align: 'right' });
  pdf.setTextColor(160, 130, 90);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  pdf.text(`Printed: ${now}`, 16, y + 10.5);

  // ── Footer ──
  y += 20;
  pdf.setDrawColor(220, 200, 175);
  pdf.setLineDashPattern([2, 2], 0);
  pdf.line(10, y, W - 10, y);
  pdf.setLineDashPattern([], 0);

  pdf.setTextColor(180, 140, 100);
  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Thank you for using CafeHunt!', W / 2, y + 7, { align: 'center' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.text('See you soon', W / 2, y + 13, { align: 'center' });

  pdf.save(`CafeHunt_Receipt_${ref}.pdf`);
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
   AUTO EXPIRE PENDING RESERVATIONS
═══════════════════════════════════════════════════════ */
async function checkExpiredReservations(list) {
  const now = new Date();

  for (const r of list) {

    const status = (r.status || "pending").toLowerCase();

    // 只处理 pending
    if (status !== "pending") continue;

    const bookingTime = new Date(`${r.date}T${r.time}`);

    // 到预约时间还没 approve/reject
    if (now >= bookingTime) {

      try {

        await updateDoc(
          doc(db, "reservation", r._docId),
          {
            status: "expired"
          }
        );

        
   if (!r.notifSentExpired) {

  // Customer notification
  if (r.userId) {
    await addDoc(collection(db, "notifications"), {
      userId: r.userId,
      type: "expired",
      message:
        `Your reservation at ${r.cafe || "the cafe"} on ${r.date} at ${formatReceiptTime(r.time)} has expired because no decision was made before the reservation time.`,
      cafeName: r.cafe || "",
      reservationId: r._docId,
      read: false,
      createdAt: serverTimestamp(),
    });
  }

  // Shop Owner notification
  await addDoc(collection(db, "sonotifications"), {
    type: "expired",
    cafeName: r.cafe || "",
    customerName: r.username || r.customer || "Customer",
    reservationId: r._docId,
    read: false,
    createdAt: serverTimestamp(),
    message:
      `${r.username || r.customer || "A customer"}'s reservation on ${r.date} at ${formatReceiptTime(r.time)} expired because no action was taken before the reservation time.`
  });

  await updateDoc(
    doc(db, "reservation", r._docId),
    {
      notifSentExpired: true
    }
  );
}

      } catch (err) {
        console.error("Auto expire failed:", err);
      }
    }
  }
}

/* ═══════════════════════════════════════════════════════
   AUTO COMPLETE ACCEPTED + PAID RESERVATIONS
═══════════════════════════════════════════════════════ */
async function checkCompletedReservations(list) {
  const now = new Date();

  for (const r of list) {
    const status = (r.status || "").toLowerCase();
    const isPaid = r.paymentStatus === "paid";

    // Only process accepted + paid
    if (status !== "accepted" || !isPaid) continue;

    const bookingTime = new Date(`${r.date}T${r.time}`);

    // Past booking time → mark as completed
    if (now >= bookingTime) {
      try {
        await updateDoc(doc(db, "reservation", r._docId), {
          status: "completed",
        });

        // Optional: notify customer their visit is completed
        if (r.userId && !r.notifSentCompleted) {
          await addDoc(collection(db, "notifications"), {
            userId: r.userId,
            type: "completed",
            message: `Your visit to ${r.cafe || "the cafe"} on ${r.date} at ${formatReceiptTime(r.time)} is now marked as completed. Thank you for visiting!`,
            cafeName: r.cafe || "",
            reservationId: r._docId,
            read: false,
            createdAt: serverTimestamp(),
          });

          await updateDoc(doc(db, "reservation", r._docId), {
            notifSentCompleted: true,
          });
        }

      } catch (err) {
        console.error("Auto complete failed:", err);
      }
    }
  }
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

onSnapshot(q, async (snapshot) => {
  reservations = snapshot.docs.map((d) => ({
    _docId: d.id,
    ...d.data(),
  }));

  await checkExpiredReservations(reservations);
  await checkCompletedReservations(reservations);

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
 setInterval(() => {
      if (reservations.length > 0) {
        checkExpiredReservations(reservations);
        checkCompletedReservations(reservations);
      }
    }, 60000);
    } catch (err) {
      console.error("so.js init error:", err);
      showToast("Could not load reservation data.", "error");
    }
  });
});
