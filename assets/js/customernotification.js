
// assets/js/customernotification.js
// Reads the `notifications` Firestore collection for the logged-in customer,
// renders cards, supports mark-as-read and tab filtering.

import { db, app } from "./firebase-config.js";
import { setupNavbar } from "./navbar.js";
import { guardSession } from "./session.js";

import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

// ── Bootstrap ────────────────────────────────────────────────
setupNavbar();
guardSession(["customer"]);

const auth = getAuth(app);

// ── DOM refs ─────────────────────────────────────────────────
const listEl      = document.getElementById("notifList");
const loadingEl   = document.getElementById("notifLoading");
const emptyEl     = document.getElementById("notifEmpty");
const markAllBtn  = document.getElementById("markAllBtn");

// ── State ─────────────────────────────────────────────────────
let allNotifs = [];
let activeFilter = "all";

// ── Icon + label maps ─────────────────────────────────────────
const ICON_MAP = {
  accepted:        { icon: "fa-circle-check", label: "Booking Accepted" },
  payment_success: { icon: "fa-receipt",      label: "Payment Confirmed" },
  expired:         { icon: "fa-clock",         label: "Booking Expired"  },
};

// ── Auth → load notifications ─────────────────────────────────
onAuthStateChanged(auth, (user) => {
  if (!user) return;
  listenNotifications(user.uid);

  // Mark all as read
  markAllBtn.addEventListener("click", async () => {
    const unread = allNotifs.filter((n) => !n.read);
    if (!unread.length) return;

    // Batch-update all unread docs
    const batch = writeBatch(db);
    unread.forEach((n) => {
      batch.update(doc(db, "notifications", n.id), { read: true });
    });
    await batch.commit();
  });
});

// ── Realtime listener ─────────────────────────────────────────
function listenNotifications(uid) {
  const q = query(
    collection(db, "notifications"),
    where("userId", "==", uid)
  );

  onSnapshot(
    q,
    (snapshot) => {
      allNotifs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      // JS-side sort as safety net (handles missing createdAt on legacy docs)
      allNotifs.sort((a, b) => {
        const ta = a.createdAt?.seconds ?? 0;
        const tb = b.createdAt?.seconds ?? 0;
        return tb - ta;
      });
      loadingEl.style.display = "none";
      renderList();
    },
    (err) => {
      console.error("Notification listener error:", err);
      loadingEl.style.display = "none";
    }
  );
}

// ── Render ────────────────────────────────────────────────────
function renderList() {
  const filtered =
    activeFilter === "all"
      ? allNotifs
      : allNotifs.filter((n) => n.type === activeFilter);

  if (!filtered.length) {
    listEl.innerHTML = "";
    emptyEl.classList.remove("hidden");
    return;
  }
  emptyEl.classList.add("hidden");

  listEl.innerHTML = filtered.map((n) => notifCardHtml(n)).join("");

  // Bind mark-read buttons
  listEl.querySelectorAll(".btn-mark-read").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      await updateDoc(doc(db, "notifications", id), { read: true });
    });
  });
}

function notifCardHtml(n) {
  const meta   = ICON_MAP[n.type] || { icon: "fa-bell", label: "Notification" };
  const unread = !n.read;
  const time   = n.createdAt
    ? n.createdAt.toDate().toLocaleString("en-MY", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "";

  return `
    <div class="notif-card ${unread ? "unread" : ""}">
      <div class="notif-icon ${n.type}">
        <i class="fas ${meta.icon}"></i>
      </div>
      <div class="notif-content">
        <div class="notif-msg">${escHtml(n.message)}</div>
        ${n.cafeName
          ? `<div class="notif-cafe"><i class="fas fa-mug-hot"></i>${escHtml(n.cafeName)}</div>`
          : ""}
        <div class="notif-time">${time}</div>
      </div>
      ${unread
        ? `<div class="unread-dot"></div>
           <button class="btn-mark-read" data-id="${n.id}">Mark read</button>`
        : ""}
    </div>
  `;
}

// ── Tab filtering ─────────────────────────────────────────────
document.querySelectorAll(".ntab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".ntab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = btn.dataset.filter;
    renderList();
  });
});

// ── Helpers ───────────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}