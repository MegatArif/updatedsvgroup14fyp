import { app, db } from './firebase-config.js';
import { collection, addDoc, serverTimestamp, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { showToast } from './toast.js';

const auth = getAuth(app);

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

// City display mapping to turn "skudai" -> "Skudai"
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
  const reservationForm = document.getElementById('reservationForm');
  const dateInput = document.getElementById('resDate');
  const formCard = document.getElementById('formCard');
  const confirmationCard = document.getElementById('confirmationCard');
  const returnMenuBtn = document.getElementById('returnMenuBtn');
  const cancelBookingBtn = document.getElementById('cancelBookingBtn');
  const cafeTitle = document.getElementById('cafeTitle');
  const cafeSubtitle = document.getElementById('cafeSubtitle');
  const confirmationSubtitle = document.getElementById('confirmationSubtitle');

  // Get the cafe name from the URL query parameters (e.g., ?cafe=Cafe+Name)
  const urlParams = new URLSearchParams(window.location.search);
  const selectedCafe = urlParams.get('name') || "our Cafe"; // Fallback to default
  const rawCity = urlParams.get('city') || "";
  const selectedLocation = CITY_DISPLAY_MAP[rawCity] || rawCity || "Main Branch";

  // Update the UI to reflect the selected cafe
  if (cafeTitle) {
    cafeTitle.textContent = `Reservation for ${selectedCafe}`;
  }
  if (cafeSubtitle) {
    cafeSubtitle.textContent = `Experience exquisite dining in ${selectedLocation}`;
  }

  if (selectedCafe !== "our Cafe") {
    document.title = `Book a Table at ${selectedCafe} - CafeHunt`;
  }

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

    // Grab values safely
    const guestsValue = document.getElementById('guests').value;
    const dateValue = dateInput.value;
    const timeValue = document.getElementById('resTime').value;

    // Manual validation check using switch statement
    let validationMsg = '';
    switch (true) {
      case !guestsValue: validationMsg = "Please specify the number of guests."; break;
      case !dateValue:   validationMsg = "Please select a reservation date."; break;
      case !timeValue:   validationMsg = "Please select a reservation time."; break;
    }

    if (validationMsg) {
      showToast(validationMsg, "error");
      return;
    }

    try {

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

      // Update the confirmation card text dynamically
      if (confirmationSubtitle) {
        confirmationSubtitle.textContent = `We're delighted to welcome you to ${selectedCafe}.`;
      }

      // Perform seamless visual transition
      formCard.classList.add('hidden');
      confirmationCard.classList.remove('hidden');
      showToast("Your table has been reserved!", "success");
    } catch (error) {
      console.error('Booking error:', error);
      let msg = '';
      switch (error.code) {
        case 'permission-denied':
          msg = 'You do not have permission to make a reservation. Please ensure you are logged in.';
          break;
        case 'unavailable':
          msg = 'The reservation service is temporarily unavailable. Please try again later.';
          break;
        default:
          msg = 'An error occurred: ' + error.message;
      }
      showToast(msg, 'error');
    }
  });

  // Handle redirection back to the main menu or home page
  returnMenuBtn.addEventListener('click', () => {
    window.location.href = 'gallery.html'; 
  });

  // Handle redirection back to the explore page from the form
  if (cancelBookingBtn) {
    cancelBookingBtn.addEventListener('click', () => {
      window.location.href = 'gallery.html';
    });
  }
});