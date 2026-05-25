import { app, db } from './firebase-config.js';
import { collection, addDoc, serverTimestamp, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

const auth = getAuth(app);

// --- Toast System Initialization ---
const toastStyle = document.createElement('style');
toastStyle.textContent = `
  #toast-container {
    position: fixed;
    top: 1.5rem;
    right: 1.5rem;
    z-index: 99999;
    display: flex;
    flex-direction: column;
    gap: .6rem;
    pointer-events: none;
  }
  .toast {
    display: flex;
    align-items: flex-start;
    gap: .75rem;
    min-width: 280px;
    max-width: 360px;
    padding: .9rem 1.1rem;
    border-radius: .85rem;
    background: #1a1a1a;
    box-shadow: 0 8px 32px rgba(0,0,0,0.35);
    font-family: "Segoe UI", sans-serif;
    font-size: .85rem;
    font-weight: 600;
    color: #f5f5f5;
    pointer-events: all;
    border-left: 4px solid transparent;
    opacity: 0;
    transform: translateX(60px);
    transition: opacity .32s ease, transform .32s ease;
  }
  .toast.show { opacity: 1; transform: translateX(0); }
  .toast.hide { opacity: 0; transform: translateX(60px); }
  .toast.success { border-color: #43a047; }
  .toast.error   { border-color: #e53935; }
  .toast.info    { border-color: #1e88e5; }
  .toast-icon { font-size: 1.2rem; flex-shrink: 0; margin-top: .05rem; }
  .toast.success .toast-icon { color: #43a047; }
  .toast.error   .toast-icon { color: #e53935; }
  .toast.info    .toast-icon { color: #1e88e5; }
  .toast-body { flex: 1; line-height: 1.45; }
  .toast-title { font-size: .75rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; margin-bottom: .2rem; opacity: .6; }
  .toast-progress {
    position: absolute;
    bottom: 0; left: 0;
    height: 3px;
    width: 100%;
    transform-origin: left;
  }
  @keyframes progress { from { transform: scaleX(1); } to { transform: scaleX(0); } }
  .toast.show .toast-progress { animation: progress linear forwards; }
`;
document.head.appendChild(toastStyle);

let toastContainer;

function showToast(message, type = 'error', duration = 3500) {
  if (!toastContainer) return;

  const titles = { success: 'Success', error: 'Error', info: 'Info' };
  const icons = { success: 'ri-checkbox-circle-fill', error: 'ri-error-warning-fill', info: 'ri-information-fill' };
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.style.position = 'relative';
  toast.style.overflow = 'hidden';
  toast.innerHTML = `
    <i class="toast-icon ${icons[type]}"></i>
    <div class="toast-body">
      <div class="toast-title">${titles[type]}</div>
      <div>${message}</div>
    </div>
    <div class="toast-progress" style="animation-duration: ${duration}ms"></div>
  `;
  
  toastContainer.appendChild(toast);

  // Trigger transition
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.replace('show', 'hide');
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

// State variables to track the logged-in user
let currentUserName = "Guest User";
let currentUserUid = null;

// Listen for authentication state changes
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserUid = user.uid;
    // Fetch the detailed profile (like the name "Alex") from the 'Customers' collection
    const userDocRef = doc(db, "Customers", user.uid);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      currentUserName = userSnap.data().username || user.displayName || "User";
    }
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const reservationForm = document.getElementById('reservationForm');
  const dateInput = document.getElementById('resDate');
  const formCard = document.getElementById('formCard');
  const confirmationCard = document.getElementById('confirmationCard');
  const returnMenuBtn = document.getElementById('returnMenuBtn');
  const cafeSubtitle = document.getElementById('cafeSubtitle');

  // Get the cafe name from the URL query parameters (e.g., ?cafe=Cafe+Name)
  const urlParams = new URLSearchParams(window.location.search);
  const selectedCafe = urlParams.get('cafe') || "Cafe Pronto"; // Fallback to default
  const selectedLocation = urlParams.get('location') || "Main Branch"; // Fallback to default

  // Update the UI subtitle to reflect the selected cafe
  if (cafeSubtitle) {
    cafeSubtitle.textContent = `Experience exquisite dining at ${selectedCafe}`;
  }

  // Safely initialize container after body is ready
  toastContainer = document.createElement('div');
  toastContainer.id = 'toast-container';
  document.body.appendChild(toastContainer);

  // 1. Validation Logic: Restrict date picker from allowing past dates
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  
  const minDateString = `${yyyy}-${mm}-${dd}`;
  dateInput.min = minDateString;

  // Helper function to turn ISO dates into a warmer format (e.g., Nov 24, 2026)
  function formatDateDisplay(dateString) {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    const dateObj = new Date(dateString + 'T00:00:00'); // Prevent timezone offset errors
    return dateObj.toLocaleDateString('en-US', options);
  }

  // Helper function to turn 24hr time strings into elegant 12hr strings
  function formatTimeDisplay(timeString) {
    const [hourStr, minStr] = timeString.split(':');
    let hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12; // convert 0 to 12
    return `${hour}:${minStr} ${ampm}`;
  }

  // 2. Form Submit Interception & Summary Generation
  reservationForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      // Standard HTML5 validation check
      if (!reservationForm.checkValidity()) {
        throw new Error("Please fill out all the fields appropriately before booking.");
      }

      // Grab values safely
      const guestsValue = document.getElementById('guests').value;
      const dateValue = dateInput.value;
      const timeValue = document.getElementById('resTime').value;

      // Save to Firestore using the specific "reservation" collection and schema
      // Note: cafe, location, and username are set as defaults since they aren't in the form
      await addDoc(collection(db, "reservation"), {
        cafe: selectedCafe,      // Use the dynamically fetched cafe name
        date: dateValue,
        guests: guestsValue,
        location: selectedLocation, // Use the dynamically fetched location
        time: timeValue,
        username: currentUserName, // Now uses the actual logged-in user's name
        userId: currentUserUid,    // Recommended: store the UID for database relations
        createdAt: serverTimestamp()
      });

      // Assign formatted values to the confirmation UI components
      document.getElementById('summaryGuests').textContent = guestsValue;
      document.getElementById('summaryDate').textContent = formatDateDisplay(dateValue);
      document.getElementById('summaryTime').textContent = formatTimeDisplay(timeValue);

      // Perform seamless visual transition
      formCard.classList.add('hidden');
      confirmationCard.classList.remove('hidden');
      showToast("Your table has been reserved!", "success");
    } catch (error) {
      showToast(error.message, "error");
    }
  });

  // Handle redirection back to the main menu or home page
  returnMenuBtn.addEventListener('click', () => {
    window.location.href = 'gallery.html'; 
  });
});