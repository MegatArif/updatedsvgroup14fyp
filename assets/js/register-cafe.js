// assets/js/register-cafe.js

import { db, storage, app } from "./firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import {
  ref,
  uploadBytes,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-storage.js";
import {
  getAuth,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { showToast } from "./toast.js";

import { guardSession, sessionLogout } from './session.js';
// Call guardFunction 
guardSession(['shopowner']);


/* ── FACILITY ICON MAP ───────────────────────────────────────── */
const facilityIcons = {
  "WiFi":              "fa-wifi",
  "Power outlet":      "fa-plug",
  "Outdoor seating":   "fa-umbrella-beach",
  "Meeting equipment": "fas fa-chalkboard-user",
};
/* ── BANNED WORDS ────────────────────────────────────────────── */
const bannedWords = [
  "fuck", "shit", "ass", "bitch", "damn", "crap", "bastard",
  "bodoh", "sial", "anjing", "celaka", "pundek", "lancau",
  "kepala bapak", "puki", "hanjing", "nigga",
];

const CITY_NAMES = {
  skudai: 'Skudai', kulai: 'Kulai', masai: 'Masai',
  tangkak: 'Tangkak', pontian: 'Pontian', segamat: 'Segamat',
  muar: 'Muar', kluang: 'Kluang', batuPahat: 'Batu Pahat',
  johorBahru: 'Johor Bahru',
};
/* ── AUTH ────────────────────────────────────────────────────── */
const auth = getAuth(app);

/* ── DOM REFS ────────────────────────────────────────────────── */
const nameEl       = document.getElementById("cafeName");
const openEl       = document.getElementById("openHour");
const closeEl      = document.getElementById("closeHour");
const descEl       = document.getElementById("description");
const addressEl    = document.getElementById("address");
const cityEl       = document.getElementById("city");
const imageInput   = document.getElementById("cafeImage");
const uploadZone   = document.getElementById("uploadZone");
const placeholder  = document.getElementById("uploadPlaceholder");
const imgPreview   = document.getElementById("imagePreview");
const submitBtn    = document.getElementById("submitBtn");
const submitLabel  = document.getElementById("submitLabel");
const submitSpin   = document.getElementById("submitSpinner");

/* ── LIVE PREVIEW ────────────────────────────────────────────── */
function fmt(t) { if (!t) return "––:––"; return t; }

function updatePreview() {
  document.getElementById("previewName").textContent    = nameEl.value.trim()    || "Your Cafe Name";
  document.getElementById("previewAddress").textContent =
    `${addressEl.value.trim() || "Your address"}, ${CITY_NAMES[cityEl.value] || ""}`;
  document.getElementById("previewDesc").textContent    = descEl.value.trim()    || "Your description will appear here.";

  const open  = fmt(openEl.value);
  const close = fmt(closeEl.value);
  document.getElementById("previewHours").textContent = `${open}  –  ${close}`;

  const checked = [...document.querySelectorAll(".facility-pill input:checked")]
    .map(cb => cb.value);
  document.getElementById("previewFacilities").innerHTML = checked.length
    ? checked.map(f => `
        <span class="preview-fac-tag">
          <i class="fas ${facilityIcons[f] || 'fa-check'}"></i> ${f}
        </span>`).join("")
    : "";

  const descLen = descEl.value.length;
  const countEl = document.getElementById("descCount");
  if (countEl) {
    countEl.textContent = descLen;
    countEl.style.color = descLen > 280 ? "#e53e3e" : descLen > 200 ? "#d97706" : "";
  }

}

[nameEl, openEl, closeEl, descEl, addressEl, cityEl].forEach(el => {
  el.addEventListener("input", updatePreview);
});
document.querySelectorAll(".facility-pill input").forEach(cb => {
  cb.addEventListener("change", updatePreview);
});

/* ── IMAGE UPLOAD ZONE ───────────────────────────────────────── */
uploadZone.addEventListener("click", () => imageInput.click());

uploadZone.addEventListener("dragover", e => {
  e.preventDefault();
  uploadZone.style.borderColor = "var(--brand)";
});
uploadZone.addEventListener("dragleave", () => {
  uploadZone.style.borderColor = "";
});
uploadZone.addEventListener("drop", e => {
  e.preventDefault();
  uploadZone.style.borderColor = "";
  const file = e.dataTransfer.files[0];
  if (file) previewFile(file);
});

imageInput.addEventListener("change", () => {
  if (imageInput.files[0]) previewFile(imageInput.files[0]);
});

function previewFile(file) {
  if (!file.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.onload = e => {
    imgPreview.src = e.target.result;
    imgPreview.classList.remove("hidden");
    placeholder.classList.add("hidden");
    document.getElementById("previewImg").src = e.target.result;
  };
  reader.readAsDataURL(file);
}

/* ── GET NEXT ID ─────────────────────────────────────────────── */
// Uses total doc count + 1 — avoids needing a composite index on "id"
// and handles gaps in the sequence (e.g. id jumps from 4 → 6).
async function getNextId() {
  const snap = await getDocs(collection(db, "cafes"));
  // Find the highest existing numeric id and add 1
  let maxId = 0;
  snap.forEach(d => {
    const n = parseInt(d.data().id) || 0;
    if (n > maxId) maxId = n;
  });
  return maxId + 1;
}
function containsBannedWord(text) {
  const lower = text.toLowerCase();
  return bannedWords.some(word => {
    const regex = new RegExp(`\\b${word}\\b`, "i");
    return regex.test(lower);
  });
}
/* ── VALIDATE ────────────────────────────────────────────────── */
function validate() {
  if (!nameEl.value.trim())    { showToast("Cafe name is required.", "error"); return false; }
  if (!openEl.value)           { showToast("Open hour is required.", "error"); return false; }
  if (!closeEl.value)          { showToast("Close hour is required.", "error"); return false; }
  if (!descEl.value.trim())    { showToast("Description is required.", "error"); return false; }
  if (descEl.value.trim().length < 20)  { showToast("Description must be at least 20 characters.", "error"); return false; }
  if (descEl.value.trim().length > 300) { showToast("Description cannot exceed 300 characters.", "error"); return false; }
  if (containsBannedWord(nameEl.value)) { showToast("Name contains inappropriate language.", "error"); return false; }
  if (containsBannedWord(descEl.value)) { showToast("Description contains inappropriate language.", "error"); return false; }
  if (!addressEl.value.trim()) { showToast("Address is required.", "error"); return false; }
  if (!cityEl.value) { showToast("Please select a city.", "error"); return false; }
  return true;
}

/* ── SUBMIT ──────────────────────────────────────────────────── */
submitBtn.addEventListener("click", async () => {
  if (!validate()) return;

  const facilities = [...document.querySelectorAll(".facility-pill input:checked")]
    .map(cb => cb.value);

  submitBtn.disabled = true;
  submitLabel.classList.add("hidden");
  submitSpin.classList.remove("hidden");

  try {
    const nextId = await getNextId();
    let imagePath = "";

    const file = imageInput.files[0];
    if (file) {
      const ext        = file.name.split(".").pop();
      const storePath  = `cafes/cafes${nextId}.${ext}`;
      const storageRef = ref(storage, storePath);
      await uploadBytes(storageRef, file);
      imagePath = storePath;
    }

    // Build Firestore cafe document — default rating seeded at 4
    const currentUser = auth.currentUser;

    const cafeDoc = {
      id:            nextId,
      name:          nameEl.value.trim(),
      openHour:      openEl.value,
      closeHour:     closeEl.value,
      description:   descEl.value.trim(),
      address:       addressEl.value.trim(),
      city:          cityEl.value.trim(),
      facilities:    facilities,
      image:         imagePath,
      rating:        4,
      ratingCount:   1,
      ratingSum:     4,
      ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 0 },
      // ── approval fields ──────────────────────────────
      approveStatus: "pending",          // gallery filters on this
      ownerId:       currentUser?.uid || "",  // links cafe → ShopOwner
      ownerEmail:    currentUser?.email || "",
    };

    const cafeRef = await addDoc(collection(db, "cafes"), cafeDoc);
   
    // ADDED: Notify Admin of the new registration for the numbering indicator
    await addDoc(collection(db, "adminnotifications"), {
      type:          "new_cafe_registration",
      message:       `New Cafe: "${nameEl.value.trim()}" has been submitted and is awaiting approval.`,
      cafeName:      nameEl.value.trim(),
      ownerEmail:    currentUser?.email || "Unknown",
      createdAt:     serverTimestamp(),
      read:          false,
    });

    // Flag the shop owner's Firestore doc as having submitted a cafe
    // Also store the cafe's Firestore doc ID so adminapproval.js can find it
    if (currentUser) {
      await updateDoc(doc(db, "ShopOwner", currentUser.uid), {
        cafeRegistered: true,
        cafeDocId:      cafeRef.id,   // ← adminapproval.js uses this
        // approved remains false — admin must flip it
      });
    }

    // Lock button and show toast before signing out
    submitLabel.classList.remove("hidden");
    submitSpin.classList.add("hidden");
    submitLabel.textContent = "✅ Submitted — Signing you out…";

    showToast(
      `🎉 "${nameEl.value.trim()}" submitted! Signing you out — log back in after approval to access your dashboard.`,
      "success",
      3500
    );

    // Sign out after the toast has had time to read
    setTimeout(async () => {
      await signOut(auth);
      sessionStorage.clear();
      window.location.href = "index.html";  // ← your login page
    }, 3500);

  } catch (err) {
    console.error("Registration error:", err);
    showToast("Something went wrong. Please try again.", "error");
    submitBtn.disabled = false;
    submitLabel.classList.remove("hidden");
    submitSpin.classList.add("hidden");
  }
});

/* ── INIT ────────────────────────────────────────────────────── */
updatePreview();