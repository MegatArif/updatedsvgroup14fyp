import { db, app } from './firebase-config.js';
import { doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js';
import { setupNavbar } from './navbar.js';

setupNavbar();

const PRICE_PER_GUEST = 5;
const urlParams     = new URLSearchParams(window.location.search);
const reservationId = urlParams.get('reservationId')
                   || urlParams.get('order_id')
                   || urlParams.get('billExternalReferenceNo')
                   || '';

console.log('All URL params:', window.location.search);
console.log('reservationId:', reservationId);

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
    const total  = guests * PRICE_PER_GUEST;

    document.getElementById('sucCafe').textContent     = r.cafe      || '—';
    document.getElementById('sucCustomer').textContent = r.username   || '—';
    document.getElementById('sucDate').textContent     = formatDate(r.date);
    document.getElementById('sucTime').textContent     = formatTime(r.time);
    document.getElementById('sucGuests').textContent   = guests + ' guest' + (guests > 1 ? 's' : '');
    document.getElementById('sucAmount').textContent   = `RM ${total.toFixed(2)}`;
    document.getElementById('sucRef').textContent      = reservationId.substring(0, 12).toUpperCase();
  } catch(err) {
    console.error(err);
  }
}

// ── Mark payment as paid (backup if server callback fails) ──
async function markPaid() {
  const payStatus = urlParams.get('status_id');
  if ((payStatus === '1' || payStatus === 1) && reservationId) {
    try {
      await updateDoc(doc(db, 'reservation', reservationId), {
        paymentStatus: 'paid',
        paidAt: new Date().toISOString(),
      });
      console.log('paymentStatus updated to paid');
    } catch(err) {
      console.error('markPaid failed:', err);
    }
  }
}

// ── Auth ──
const auth = getAuth(app);
onAuthStateChanged(auth, async (user) => {
  if (user) {
    await getDoc(doc(db, 'Customers', user.uid));
  }
  // Run both after auth resolves
  await markPaid();
  await loadDetails();
});

// ── Confetti ──
function spawnConfetti() {
  const wrap   = document.getElementById('confetti');
  const colors = ['#c47b4a','#f4b942','#2b6e3c','#e8d5bc','#a55f36','#f6ede5'];
  for (let i = 0; i < 55; i++) {
    const dot = document.createElement('div');
    dot.className = 'dot';
    dot.style.left            = Math.random() * 100 + 'vw';
    dot.style.background      = colors[Math.floor(Math.random() * colors.length)];
    dot.style.width           = (Math.random() * 7 + 5) + 'px';
    dot.style.height          = dot.style.width;
    dot.style.animationDuration = (Math.random() * 2.5 + 1.5) + 's';
    dot.style.animationDelay  = (Math.random() * 1.2) + 's';
    dot.style.opacity         = Math.random() * .7 + .3;
    wrap.appendChild(dot);
  }
}
spawnConfetti();