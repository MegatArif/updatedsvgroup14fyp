import { app, db } from './firebase-config.js';
import { collection, addDoc, serverTimestamp, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { showToast } from './toast.js';

const auth = getAuth(app);

let currentUserName = "Guest User";
let currentUserUid = null;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserUid = user.uid;
    const userDocRef = doc(db, "Customers", user.uid);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      currentUserName = userSnap.data().username || user.displayName || "User";
    }
  }
});

const CITY_DISPLAY_MAP = {
  skudai:     'Skudai',
  kulai:      'Kulai',
  masai:      'Masai',
  tangkak:    'Tangkak',
  pontian:    'Pontian',
  segamat:    'Segamat',
  muar:       'Muar',
  kluang:     'Kluang',
  batuPahat:  'Batu Pahat',
  johorBahru: 'Johor Bahru',
};

document.addEventListener('DOMContentLoaded', () => {
  const reservationForm     = document.getElementById('reservationForm');
  const dateInput           = document.getElementById('resDate');
  const formCard            = document.getElementById('formCard');
  const confirmationCard    = document.getElementById('confirmationCard');
  const returnMenuBtn       = document.getElementById('returnMenuBtn');
  const cancelBookingBtn    = document.getElementById('cancelBookingBtn');
  const cafeTitle           = document.getElementById('cafeTitle');
  const cafeSubtitle        = document.getElementById('cafeSubtitle');
  const confirmationSubtitle= document.getElementById('confirmationSubtitle');

  const urlParams      = new URLSearchParams(window.location.search);
  const selectedCafe   = urlParams.get('name')     || "our Cafe";
  const rawCity        = urlParams.get('city')      || "";
  const selectedLocation = CITY_DISPLAY_MAP[rawCity] || rawCity || "Main Branch";
  const openHour       = urlParams.get('openHour')  || null;
  const closeHour      = urlParams.get('closeHour') || null;

  if (cafeTitle)    cafeTitle.textContent    = `Reservation for ${selectedCafe}`;
  if (cafeSubtitle) cafeSubtitle.textContent = `Experience exquisite dining in ${selectedLocation}`;
  if (selectedCafe !== "our Cafe") {
    document.title = `Book a Table at ${selectedCafe} - CafeHunt`;
  }

  // ── Show open hours hint on the page if available ──
  const timeInput = document.getElementById('resTime');
  if (openHour && closeHour && timeInput) {
    timeInput.min = openHour;
    timeInput.max = closeHour;

    // Inject a small hint text below the time input
    const hint = document.createElement('small');
    hint.id = 'timeHint';
    hint.style.cssText = 'display:block;margin-top:5px;color:#A98B76;font-size:0.8rem;';
    hint.textContent = `Open hours: ${formatTimeDisplay(openHour)} – ${formatTimeDisplay(closeHour)}`;
    timeInput.closest('.form-group')?.appendChild(hint);
  }

  // Restrict date picker to today onwards
  const today = new Date();
  const yyyy  = today.getFullYear();
  const mm    = String(today.getMonth() + 1).padStart(2, '0');
  const dd    = String(today.getDate()).padStart(2, '0');
  dateInput.min = `${yyyy}-${mm}-${dd}`;

  // ── Helpers ──────────────────────────────────────────────

  function formatDateDisplay(dateString) {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', options);
  }

  function formatTimeDisplay(timeString) {
    if (!timeString || !timeString.includes(':')) return timeString || '';
    const parts  = timeString.split(':');
    const minStr = parts[1] ?? '00';          
    let hour     = parseInt(parts[0], 10);
    if (isNaN(hour)) return timeString;
    const ampm   = hour >= 12 ? 'PM' : 'AM';
    hour         = hour % 12 || 12;
    return `${hour}:${minStr} ${ampm}`;
  }

  function toMinutes(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  /**
   * Returns an error string if timeValue is outside open hours, null if OK.
   * Handles two cases:
   *   Normal  : open=08:00, close=22:00  → selected must be 08:00–22:00
   *   Overnight: open=22:00, close=02:00 → selected must be 22:00–23:59 OR 00:00–02:00
   */
  function validateTimeSlot(timeValue) {
    if (!openHour || !closeHour) return null;

    const selected = toMinutes(timeValue);
    const open     = toMinutes(openHour);
    const close    = toMinutes(closeHour);

    let isValid;

    if (close > open) {
      // Normal same-day hours: e.g. 08:00 – 22:00
      isValid = selected >= open && selected <= close;
    } else {
      // Overnight hours: e.g. 22:00 – 02:00
      // Valid if selected is AFTER open OR BEFORE close
      isValid = selected >= open || selected <= close;
    }

    if (!isValid) {
      return `This cafe is only open from ${formatTimeDisplay(openHour)} to ${formatTimeDisplay(closeHour)}. Please choose a time within operating hours.`;
    }
    return null;
  }

  // ── Submit handler ────────────────────────────────────────

  reservationForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const guestsValue = document.getElementById('guests').value;
    const dateValue   = dateInput.value;
    const timeValue   = document.getElementById('resTime').value;

    // Step-by-step validation — most specific message wins
    let validationMsg = '';
    switch (true) {
      case !guestsValue:
        validationMsg = "Please specify the number of guests.";
        break;
      case !dateValue:
        validationMsg = "Please select a reservation date.";
        break;
      case !timeValue:
        validationMsg = "Please select a reservation time.";
        break;
      default: {
        // All fields filled — check time is within operating hours
        const slotError = validateTimeSlot(timeValue);
        if (slotError) validationMsg = slotError;
      }
    }

    if (validationMsg) {
      showToast(validationMsg, "error");
      return;
    }

    // All valid — write to Firestore
    try {
      await addDoc(collection(db, "reservation"), {
        cafe:      selectedCafe,
        date:      dateValue,
        guests:    guestsValue,
        location:  selectedLocation,
        time:      timeValue,
        username:  currentUserName,
        userId:    currentUserUid,
        createdAt: serverTimestamp()
      });

      document.getElementById('summaryGuests').textContent = guestsValue;
      document.getElementById('summaryDate').textContent   = formatDateDisplay(dateValue);
      document.getElementById('summaryTime').textContent   = formatTimeDisplay(timeValue);

      if (confirmationSubtitle) {
        confirmationSubtitle.textContent = `We're delighted to welcome you to ${selectedCafe}.`;
      }

      formCard.classList.add('hidden');
      confirmationCard.classList.remove('hidden');
      showToast("Your table has been reserved!", "success");

    } catch (error) {
      console.error('Booking error:', error);
      let msg = '';
      switch (error.code) {
        case 'permission-denied':
          msg = 'Permission denied. Please ensure you are logged in.'; break;
        case 'unavailable':
          msg = 'Service temporarily unavailable. Please try again.'; break;
        default:
          msg = 'An error occurred: ' + error.message;
      }
      showToast(msg, 'error');
    }
  });

  returnMenuBtn.addEventListener('click', () => {
    window.location.href = 'gallery.html';
  });

  if (cancelBookingBtn) {
    cancelBookingBtn.addEventListener('click', () => {
      window.location.href = 'gallery.html';
    });
  }
});