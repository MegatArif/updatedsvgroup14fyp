import { db, app } from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js';
import { setupNavbar } from './navbar.js';

setupNavbar();

const auth = getAuth(app);
const urlParams     = new URLSearchParams(window.location.search);
const reservationId = urlParams.get('reservationId')
                   || urlParams.get('billExternalReferenceNo')
                   || '';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-MY', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
  });
}
function formatTime(t) {
  if (!t || !t.includes(':')) return t || '—';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`;
}

async function loadDetails() {
  if (!reservationId) return;
  try {
    const snap = await getDoc(doc(db, 'reservation', reservationId));
    if (!snap.exists()) return;
    const r = snap.data();
    const guests = parseInt(r.guests) || 1;

    document.getElementById('failCafe').textContent   = r.cafe || '—';
    document.getElementById('failDate').textContent   = formatDate(r.date);
    document.getElementById('failTime').textContent   = formatTime(r.time);
    document.getElementById('failGuests').textContent = guests + ' guest' + (guests > 1 ? 's' : '');
    document.getElementById('failRef').textContent    = reservationId.substring(0, 12).toUpperCase();
  } catch(err) {
    console.error(err);
  }
}

// Retry button — go back to payment page
document.getElementById('retryBtn').addEventListener('click', () => {
  window.location.href = `paymentpage.html?reservationId=${reservationId}`;
});

onAuthStateChanged(auth, async (user) => {
  await loadDetails();
});
