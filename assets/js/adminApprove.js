// assets/js/adminapproval.js
// Admin Approval page — reads ShopOwner docs cross-referenced with cafes,
// lets admin approve / reject with optional reason, realtime via onSnapshot.

import { db, storage, app } from "./firebase-config.js";
import { setupNavbar }       from "./navbar.js";
import { showToast }         from "./toast.js";
import { guardSession }      from "./session.js";

import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  query,
  getDocs,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

import {
  ref,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-storage.js";

// ── Bootstrap ─────────────────────────────────────────────────────────────────
setupNavbar();
guardSession(["admin"]);

// ── State ─────────────────────────────────────────────────────────────────────
let allRegistrations = [];   // merged ShopOwner + cafe data
let activeTab        = "pending";
let searchQuery      = "";
let activeDocId      = null; // Firestore doc ID of the registration open in modal
let pendingAction    = null; // { docId, action: 'approve'|'reject' }

// ── DOM refs ──────────────────────────────────────────────────────────────────
const cardsGrid     = document.getElementById("cardsGrid");
const emptyState    = document.getElementById("emptyState");
const loadingState  = document.getElementById("loadingState");
const searchInput   = document.getElementById("searchInput");
const refreshBtn    = document.getElementById("refreshBtn");

// Detail modal
const detailOverlay  = document.getElementById("detailOverlay");
const modalCloseBtn  = document.getElementById("modalCloseBtn");
const modalCafeName  = document.getElementById("modalCafeName");
const modalOwnerEmail= document.getElementById("modalOwnerEmail");
const modalStatusBadge = document.getElementById("modalStatusBadge");
const modalHours     = document.getElementById("modalHours");
const modalAddress   = document.getElementById("modalAddress");
const modalCity      = document.getElementById("modalCity");
const modalPhone     = document.getElementById("modalPhone");
const modalDesc      = document.getElementById("modalDesc");
const modalFacilities= document.getElementById("modalFacilities");
const modalSubmitted = document.getElementById("modalSubmitted");
const modalReasonRow = document.getElementById("modalReasonRow");
const modalReason    = document.getElementById("modalReason");
const rejectionArea  = document.getElementById("rejectionArea");
const rejectionReason= document.getElementById("rejectionReason");
const modalActions   = document.getElementById("modalActions");
const modalImgWrap   = document.getElementById("modalImgWrap");

// Confirm modal
const confirmOverlay = document.getElementById("confirmOverlay");
const confirmIcon    = document.getElementById("confirmIcon");
const confirmTitle   = document.getElementById("confirmTitle");
const confirmMsg     = document.getElementById("confirmMsg");
const confirmCancel  = document.getElementById("confirmCancel");
const confirmOk      = document.getElementById("confirmOk");

// Stat pills
const countPending  = document.getElementById("countPending");
const countApproved = document.getElementById("countApproved");
const countRejected = document.getElementById("countRejected");

// ── Helpers ────────────────────────────────────────────────────────────────────

const facilityIcons = {
  "WiFi":              "fa-wifi",
  "Power outlet":      "fa-plug",
  "Outdoor seating":   "fa-umbrella-beach",
  "Meeting equipment": "fa-chalkboard-user",
};

function statusBadgeHtml(status) {
  const map = {
    pending:  { cls: "badge-pending",  icon: "fa-hourglass-half", label: "Pending"  },
    approved: { cls: "badge-approved", icon: "fa-circle-check",   label: "Approved" },
    rejected: { cls: "badge-rejected", icon: "fa-circle-xmark",   label: "Rejected" },
  };
  const c = map[status] || map.pending;
  return `<span class="status-badge ${c.cls}"><i class="fas ${c.icon}"></i>${c.label}</span>`;
}

function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

async function resolveImageUrl(imagePath) {
  if (!imagePath) return null;
  if (imagePath.startsWith("http")) return imagePath;
  try {
    return await getDownloadURL(ref(storage, imagePath));
  } catch {
    return null;
  }
}

// ── Firestore listener ─────────────────────────────────────────────────────────
// We listen to ShopOwner collection for all owners who have submitted a cafe
// (cafeRegistered: true), then cross-reference the cafes collection to get
// the cafe details. One listener per page load; unsubscribe on page hide.

let unsubscribe = null;

function startListener() {
  setLoading(true);

  // Listen to ALL ShopOwner docs that have submitted a registration.
  // NOTE: No orderBy here — sorting is done in JS below to avoid needing
  // a Firestore composite index on (cafeRegistered + createdAt).
  const q = query(
    collection(db, "ShopOwner"),
    where("cafeRegistered", "==", true)
  );

  unsubscribe = onSnapshot(q, async (snapshot) => {
    // For each owner, fetch their cafe doc from "cafes" collection
    const registrations = [];

    // Batch-fetch all cafes once to avoid N+1
    const cafesSnap = await getDocs(collection(db, "cafes"));
    const cafesByOwner = {};
    cafesSnap.forEach((d) => {
      const data = d.data();
      // cafes don't store ownerId by default in register-cafe.js,
      // but we need to match them. The register-cafe.js sets cafeRegistered
      // on the ShopOwner doc AFTER addDoc on cafes. We match by the fact
      // that there is one cafe per owner (current model). We store the
      // Firestore doc id on ShopOwner as cafeDocId when it's created.
      // Since register-cafe.js doesn't do that yet, we match by owner email
      // stored on the cafe doc (also not stored). Pragmatic fallback:
      // we store ownerId on the cafe during registration — but since the
      // current register-cafe.js doesn't do that, we key cafes by name
      // and let the admin see what was submitted. The safest approach
      // without touching register-cafe.js is to store cafeDocId on ShopOwner.
      // For now we read the ShopOwner field `cafeDocId` if present,
      // otherwise we fall back to matching by ownerEmail stored on the cafe.
      if (data.ownerEmail) cafesByOwner[data.ownerEmail] = { ...data, _docId: d.id };
      if (data.ownerId)    cafesByOwner[data.ownerId]    = { ...data, _docId: d.id };
    });

    for (const ownerDoc of snapshot.docs) {
      const owner = ownerDoc.data();

      // Resolve cafe data: prefer cafeDocId field, fall back to email match
      let cafeData = null;
      if (owner.cafeDocId) {
        // BUG FIX: must spread d.data() AND include d.id as _docId,
        // otherwise cafeData._docId is undefined and doApprove/doReject
        // skips the cafe update entirely.
        const matchedDoc = cafesSnap.docs.find((d) => d.id === owner.cafeDocId);
        cafeData = matchedDoc ? { ...matchedDoc.data(), _docId: matchedDoc.id } : null;
      }
      if (!cafeData) cafeData = cafesByOwner[owner.email] || cafesByOwner[ownerDoc.id] || null;

      // Resolve image URL
      const imageUrl = cafeData ? await resolveImageUrl(cafeData.image) : null;

      // Determine status from ShopOwner doc
      let status = "pending";
      if (owner.approved)         status = "approved";
      else if (owner.rejected)    status = "rejected";

      // DEBUG: remove this log once confirmed working
      console.log(`[approval] owner=${ownerDoc.id} cafeDocId=${owner.cafeDocId} → resolved _cafeDocId=${cafeData?._docId}`);

      registrations.push({
        _docId:      ownerDoc.id,        // ShopOwner doc ID
        _cafeDocId:  cafeData?._docId,
        status,
        email:       owner.email        || "—",
        phone:       owner.phone        || "—",
        cafeName:    cafeData?.name     || owner.cafeName || "Unnamed Cafe",
        openHour:    cafeData?.openHour || "—",
        closeHour:   cafeData?.closeHour|| "—",
        address:     cafeData?.address  || "—",
        city:        cafeData?.city     || "—",
        description: cafeData?.description || "—",
        facilities:  cafeData?.facilities  || [],
        imageUrl,
        submittedAt: owner.createdAt || null,
        rejectionNote: owner.rejectionNote || "",
      });
    }

    // Sort by createdAt descending (newest first) — done in JS since
    // we removed orderBy from the query to avoid needing a composite index.
    allRegistrations = registrations.sort((a, b) => {
      const ta = a.submittedAt?.seconds ?? 0;
      const tb = b.submittedAt?.seconds ?? 0;
      return tb - ta;
    });
    setLoading(false);
    updateStatPills();
    renderCards();

    // If detail modal is open for a doc that just changed, refresh it
    if (activeDocId) {
      const updated = allRegistrations.find((r) => r._docId === activeDocId);
      if (updated) refreshModalStatus(updated);
    }
  }, (err) => {
    console.error("Snapshot error:", err);
    setLoading(false);
    showToast("Failed to load registrations.", "error");
  });
}

// ── Stat pills ─────────────────────────────────────────────────────────────────

function updateStatPills() {
  countPending.textContent  = allRegistrations.filter((r) => r.status === "pending").length;
  countApproved.textContent = allRegistrations.filter((r) => r.status === "approved").length;
  countRejected.textContent = allRegistrations.filter((r) => r.status === "rejected").length;
}

// ── Filter + render ────────────────────────────────────────────────────────────

function getFiltered() {
  return allRegistrations.filter((r) => {
    const matchesTab =
      activeTab === "all" ||
      r.status === activeTab;

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      r.email.toLowerCase().includes(q) ||
      r.cafeName.toLowerCase().includes(q);

    return matchesTab && matchesSearch;
  });
}

function renderCards() {
  const filtered = getFiltered();

  if (!filtered.length) {
    cardsGrid.innerHTML = "";
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  cardsGrid.innerHTML = filtered.map((r) => {
    const imgHtml = r.imageUrl
      ? `<img class="reg-card-img" src="${r.imageUrl}" alt="${r.cafeName}">`
      : `<div class="reg-card-img-placeholder"><i class="fas fa-store"></i></div>`;

    const actionBtns = r.status === "pending"
      ? `<button class="btn-approve" data-id="${r._docId}"><i class="fas fa-check"></i> Approve</button>
         <button class="btn-reject"  data-id="${r._docId}"><i class="fas fa-xmark"></i> Reject</button>`
      : `<span class="resolved-label">${r.status === "approved" ? "✓ Approved" : "✗ Rejected"}</span>`;

    return `
      <div class="reg-card" data-id="${r._docId}">
        <div class="reg-card-top">
          <div style="display:flex;gap:12px;align-items:flex-start;flex:1;min-width:0;">
            ${imgHtml}
            <div class="reg-card-info">
              <div class="reg-card-name">${escHtml(r.cafeName)}</div>
              <div class="reg-card-email">${escHtml(r.email)}</div>
            </div>
          </div>
          ${statusBadgeHtml(r.status)}
        </div>

        <div class="reg-card-meta">
          <span><i class="fas fa-clock"></i>${r.openHour} – ${r.closeHour}</span>
          <span><i class="fas fa-map-marker-alt"></i>${escHtml(r.city)}</span>
          <span><i class="fas fa-calendar"></i>${formatDate(r.submittedAt)}</span>
        </div>

        <div class="reg-card-actions">
          ${actionBtns}
          <button class="btn-view-detail" data-id="${r._docId}">
            <i class="fas fa-eye"></i> Details
          </button>
        </div>
      </div>
    `;
  }).join("");

  // Bind card events
  cardsGrid.querySelectorAll(".btn-approve").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      confirmAction(btn.dataset.id, "approve");
    });
  });

  cardsGrid.querySelectorAll(".btn-reject").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openDetailModal(btn.dataset.id, true); // open modal in rejection-input mode
    });
  });

  cardsGrid.querySelectorAll(".btn-view-detail").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openDetailModal(btn.dataset.id, false);
    });
  });

  // Clicking the card body opens detail modal
  cardsGrid.querySelectorAll(".reg-card").forEach((card) => {
    card.addEventListener("click", () => openDetailModal(card.dataset.id, false));
  });
}

// ── Detail Modal ───────────────────────────────────────────────────────────────

function openDetailModal(docId, startInRejectMode = false) {
  const reg = allRegistrations.find((r) => r._docId === docId);
  if (!reg) return;

  activeDocId = docId;

  // Header
  modalCafeName.textContent   = reg.cafeName;
  modalOwnerEmail.textContent = reg.email;
  modalStatusBadge.innerHTML  = statusBadgeHtml(reg.status);

  // Image
  modalImgWrap.innerHTML = reg.imageUrl
    ? `<img src="${reg.imageUrl}" alt="${reg.cafeName}" style="width:100%;height:100%;object-fit:cover;">`
    : `<i class="fas fa-store modal-cafe-icon-placeholder"></i>`;

  // Details
  modalHours.textContent    = `${reg.openHour} – ${reg.closeHour}`;
  modalAddress.textContent  = reg.address;
  modalCity.textContent     = reg.city;
  modalPhone.textContent    = reg.phone;
  modalDesc.textContent     = reg.description;
  modalSubmitted.textContent= formatDate(reg.submittedAt);

  // Facilities
  modalFacilities.innerHTML = reg.facilities.length
    ? reg.facilities.map((f) =>
        `<span class="fac-pill"><i class="fas ${facilityIcons[f] || "fa-check"}"></i> ${f}</span>`
      ).join("")
    : `<span style="color:var(--text-muted);font-size:.82rem;">None listed</span>`;

  // Rejection reason (show only for rejected registrations)
  if (reg.status === "rejected" && reg.rejectionNote) {
    modalReasonRow.style.display = "";
    modalReason.textContent      = reg.rejectionNote;
  } else {
    modalReasonRow.style.display = "none";
  }

  // Rejection input area
  rejectionReason.value = "";
  if (startInRejectMode && reg.status === "pending") {
    rejectionArea.classList.remove("hidden");
  } else {
    rejectionArea.classList.add("hidden");
  }

  // Action buttons
  buildModalActions(reg, startInRejectMode);

  // Show modal
  detailOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeDetailModal() {
  activeDocId = null;
  detailOverlay.classList.remove("open");
  document.body.style.overflow = "";
  rejectionArea.classList.add("hidden");
  rejectionReason.value = "";
}

function refreshModalStatus(reg) {
  modalStatusBadge.innerHTML = statusBadgeHtml(reg.status);
  buildModalActions(reg, false);
  if (reg.status === "rejected" && reg.rejectionNote) {
    modalReasonRow.style.display = "";
    modalReason.textContent      = reg.rejectionNote;
  } else {
    modalReasonRow.style.display = "none";
  }
}

function buildModalActions(reg, inRejectMode) {
  if (reg.status === "pending") {
    if (inRejectMode) {
      // Show confirm-reject + cancel-reject buttons
      modalActions.innerHTML = `
        <button class="modal-btn-confirm-reject" id="btnDoReject">
          <i class="fas fa-circle-xmark"></i> Confirm Rejection
        </button>
        <button class="modal-btn-cancel" id="btnCancelReject">
          <i class="fas fa-arrow-left"></i> Back
        </button>
      `;
      document.getElementById("btnDoReject").addEventListener("click", () => {
        doReject(reg._docId, rejectionReason.value.trim());
      });
      document.getElementById("btnCancelReject").addEventListener("click", () => {
        rejectionArea.classList.add("hidden");
        buildModalActions(reg, false);
      });
    } else {
      modalActions.innerHTML = `
        <button class="modal-btn-approve" id="btnModalApprove">
          <i class="fas fa-circle-check"></i> Approve
        </button>
        <button class="modal-btn-reject" id="btnModalReject">
          <i class="fas fa-circle-xmark"></i> Reject
        </button>
      `;
      document.getElementById("btnModalApprove").addEventListener("click", () => {
        closeDetailModal();
        confirmAction(reg._docId, "approve");
      });
      document.getElementById("btnModalReject").addEventListener("click", () => {
        rejectionArea.classList.remove("hidden");
        buildModalActions(reg, true);
      });
    }
  } else {
    // Already resolved — show read-only note
    const note = reg.status === "approved"
      ? "This registration has been approved."
      : `This registration was rejected. ${reg.rejectionNote ? `Reason: "${reg.rejectionNote}"` : ""}`;
    modalActions.innerHTML = `<p class="modal-resolved-note">${note}</p>`;
  }
}

// ── Confirm modal ──────────────────────────────────────────────────────────────

function confirmAction(docId, action) {
  pendingAction = { docId, action };

  const isApprove = action === "approve";
  const reg = allRegistrations.find((r) => r._docId === docId);
  const name = reg?.cafeName || "this cafe";

  confirmIcon.textContent  = isApprove ? "✅" : "❌";
  confirmTitle.textContent = isApprove ? "Approve this cafe?" : "Reject this cafe?";
  confirmMsg.textContent   = isApprove
    ? `"${name}" will be listed on CafeHunt and the owner will gain dashboard access.`
    : `"${name}" will be rejected. The owner will remain locked out of the dashboard.`;

  confirmOk.className = isApprove
    ? "btn-confirm-ok"
    : "btn-confirm-ok danger";

  confirmOverlay.classList.remove("hidden");
}

function closeConfirm() {
  pendingAction = null;
  confirmOverlay.classList.add("hidden");
}

confirmCancel.addEventListener("click", closeConfirm);

confirmOk.addEventListener("click", async () => {
  if (!pendingAction) return;
  const { docId, action } = pendingAction;
  closeConfirm();

  if (action === "approve") {
    await doApprove(docId);
  } else {
    // For card-level reject without a reason: open the detail modal to get reason
    openDetailModal(docId, true);
  }
});

// ── Firestore write operations ─────────────────────────────────────────────────

async function doApprove(docId) {
  const reg = allRegistrations.find((r) => r._docId === docId);
  try {
    // 1. Update ShopOwner — unlocks dashboard access
    await updateDoc(doc(db, "ShopOwner", docId), {
      approved:      true,
      rejected:      false,
      rejectionNote: "",
      resolvedAt:    serverTimestamp(),
    });

    // 2. Update the cafe doc — gallery.js filters on approveStatus
    if (reg?._cafeDocId) {
      await updateDoc(doc(db, "cafes", reg._cafeDocId), {
        approveStatus: "approved",
      });
    }

    showToast("Cafe approved! Owner has dashboard access and cafe is now live. ✅", "success");
    closeDetailModal();
  } catch (err) {
    console.error("Approve error:", err);
    showToast("Failed to approve. Please try again.", "error");
  }
}

async function doReject(docId, reason) {
  if (!docId) return;
  const reg = allRegistrations.find((r) => r._docId === docId);
  try {
    // 1. Update ShopOwner — keeps owner locked out
    await updateDoc(doc(db, "ShopOwner", docId), {
      approved:      false,
      rejected:      true,
      rejectionNote: reason,
      resolvedAt:    serverTimestamp(),
    });

    // 2. Update the cafe doc — hides it from gallery
    if (reg?._cafeDocId) {
      await updateDoc(doc(db, "cafes", reg._cafeDocId), {
        approveStatus: "rejected",
      });
    }

    showToast("Registration rejected. Cafe is hidden from the gallery.", "error");
    closeDetailModal();
  } catch (err) {
    console.error("Reject error:", err);
    showToast("Failed to reject. Please try again.", "error");
  }
}

// ── UI Helpers ─────────────────────────────────────────────────────────────────

function setLoading(show) {
  loadingState.style.display = show ? "flex" : "none";
  if (show) emptyState.classList.add("hidden");
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Event wiring ───────────────────────────────────────────────────────────────

// Tabs
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeTab = btn.dataset.tab;
    renderCards();
  });
});

// Search (debounced)
let searchTimer;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery = searchInput.value.trim();
    renderCards();
  }, 250);
});

// Refresh button
refreshBtn.addEventListener("click", () => {
  refreshBtn.classList.add("spinning");
  // The realtime listener already handles updates; just give visual feedback
  setTimeout(() => refreshBtn.classList.remove("spinning"), 800);
  showToast("Refreshed.", "info");
});

// Close detail modal
modalCloseBtn.addEventListener("click", closeDetailModal);
detailOverlay.addEventListener("click", (e) => {
  if (e.target === detailOverlay) closeDetailModal();
});

// Close confirm modal on backdrop
confirmOverlay.addEventListener("click", (e) => {
  if (e.target === confirmOverlay) closeConfirm();
});

// Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!confirmOverlay.classList.contains("hidden")) { closeConfirm(); return; }
    if (detailOverlay.classList.contains("open"))     { closeDetailModal(); }
  }
});

// ── Init ───────────────────────────────────────────────────────────────────────
startListener();