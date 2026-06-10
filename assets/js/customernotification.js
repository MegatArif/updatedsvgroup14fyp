
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
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
  getDocs,
  runTransaction,
  serverTimestamp,
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
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  listenNotifications(user.uid);
  checkExpiredReservations(user.uid);

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

// ── Expired reservation check ─────────────────────────────────
// Customer notification reads should not keep a stale pending booking alive.
// This checks the reservation itself, independent of notification read status.
async function checkExpiredReservations(uid) {
  try {
    const q = query(
      collection(db, "reservation"),
      where("userId", "==", uid)
    );
    const snapshot = await getDocs(q);

    await Promise.all(
      snapshot.docs
        .filter((reservationDoc) => shouldExpire(reservationDoc.data()))
        .map((reservationDoc) => expireReservationOnce(reservationDoc.id))
    );
  } catch (err) {
    console.warn("checkExpiredReservations failed:", err);
  }
}

function shouldExpire(r) {
  const status = (r.status || "pending").toLowerCase();
  if (status !== "pending") return false;

  const bookingTime = new Date(`${r.date}T${r.time}`);
  if (Number.isNaN(bookingTime.getTime())) return false;

  return new Date() >= bookingTime;
}

async function expireReservationOnce(reservationId) {
  const reservationRef = doc(db, "reservation", reservationId);
  const notificationRef = doc(db, "notifications", `expired_${reservationId}`);

  await runTransaction(db, async (transaction) => {
    const reservationSnap = await transaction.get(reservationRef);
    if (!reservationSnap.exists()) return;

    const reservation = reservationSnap.data();
    if (!shouldExpire(reservation)) return;

    transaction.update(reservationRef, {
      status: "expired",
      notifSentExpired: true,
    });

    if (reservation.notifSentExpired || !reservation.userId) return;

    transaction.set(notificationRef, {
      userId:        reservation.userId,
      type:          "expired",
      message:       `Your reservation at ${reservation.cafe || "the cafe"} on ${reservation.date} at ${formatTimeDisplay(reservation.time)} has expired because no decision was made before the reservation time.`,
      cafeName:      reservation.cafe || "",
      reservationId,
      read:          false,
      createdAt:     serverTimestamp(),
    });
  });
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
        <div class="notif-msg">${escHtml(formatTimesInMessage(n.message))}</div>
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

function formatTimeDisplay(timeString) {
  if (!timeString || !timeString.includes(":")) return timeString || "";

  const [hourString, minuteString = "00"] = timeString.split(":");
  let hour = Number.parseInt(hourString, 10);
  if (Number.isNaN(hour)) return timeString;

  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;

  return `${hour}:${minuteString} ${ampm}`;
}

function formatTimesInMessage(message) {
  return String(message ?? "").replace(
    /\bat\s+([01]?\d|2[0-3]):([0-5]\d)(?!\s*[AP]M)\b/gi,
    (_match, hour, minute) => `at ${formatTimeDisplay(`${hour}:${minute}`)}`
  );
}
