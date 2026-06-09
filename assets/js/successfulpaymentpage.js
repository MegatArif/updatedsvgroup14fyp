import { db, app } from './firebase-config.js';
import { doc, getDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js';
import { setupNavbar } from './navbar.js';

setupNavbar();


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
    const total  = 10;

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

window.downloadReceipt = function() {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'mm', format: 'a5' });

  const cafe     = document.getElementById('sucCafe').textContent;
  const customer = document.getElementById('sucCustomer').textContent;
  const date     = document.getElementById('sucDate').textContent;
  const time     = document.getElementById('sucTime').textContent;
  const guests   = document.getElementById('sucGuests').textContent;
  const amount   = document.getElementById('sucAmount').textContent;
  const ref      = document.getElementById('sucRef').textContent;
  const now      = new Date().toLocaleString('en-MY');

  const W = pdf.internal.pageSize.getWidth();

  // ── Background ──
  pdf.setFillColor(253, 248, 241);
  pdf.rect(0, 0, W, pdf.internal.pageSize.getHeight(), 'F');

  // ── Header bar ──
  pdf.setFillColor(74, 122, 74);
  pdf.roundedRect(10, 8, W - 20, 28, 4, 4, 'F');

  // ── Check circle ──
  pdf.setFillColor(255, 255, 255, 0.2);
  pdf.circle(W / 2, 18, 8, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('✓', W / 2, 20, { align: 'center' });

  // ── Header text ──
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Payment Successful', W / 2, 30, { align: 'center' });

  // ── Brand ──
  pdf.setTextColor(139, 90, 43);
  pdf.setFontSize(11);
  pdf.text('☕  CafeHunt', W / 2, 44, { align: 'center' });

  pdf.setTextColor(180, 140, 100);
  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'normal');
  pdf.text('PAYMENT CONFIRMATION', W / 2, 49, { align: 'center' });

  // ── Tear line ──
  pdf.setDrawColor(220, 200, 175);
  pdf.setLineDashPattern([2, 2], 0);
  pdf.line(10, 54, W - 10, 54);
  pdf.setLineDashPattern([], 0);

  // ── Section: Reservation Details ──
  pdf.setTextColor(180, 120, 70);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.text('RESERVATION DETAILS', 14, 61);

  const rows = [
    ['Cafe',     cafe],
    ['Customer', customer],
    ['Date',     date],
    ['Time',     time],
    ['Guests',   guests],
  ];

  let y = 67;
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

  // ── Amount box ──
  y += 2;
  pdf.setFillColor(232, 245, 233);
  pdf.roundedRect(12, y, W - 24, 18, 3, 3, 'F');
  pdf.setDrawColor(150, 200, 150);
  pdf.roundedRect(12, y, W - 24, 18, 3, 3, 'S');

  pdf.setTextColor(34, 100, 34);
  pdf.setFontSize(8.5);
  pdf.setFont('helvetica', 'bold');
  pdf.text('✓  Amount Paid', 17, y + 7);

  pdf.setFontSize(13);
  pdf.text(amount, W - 14, y + 8, { align: 'right' });

  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Status: PAID', 17, y + 13);

  // ── Reference box ──
  y += 24;
  pdf.setFillColor(250, 246, 240);
  pdf.roundedRect(12, y, W - 24, 12, 2, 2, 'F');
  pdf.setDrawColor(220, 200, 175);
  pdf.roundedRect(12, y, W - 24, 12, 2, 2, 'S');

  pdf.setTextColor(140, 110, 80);
  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Reference ID', 16, y + 5);

  pdf.setTextColor(40, 28, 18);
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(8);
  pdf.text(ref, W - 14, y + 5, { align: 'right' });

  pdf.setTextColor(160, 130, 90);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  pdf.text(`Printed: ${now}`, 16, y + 10);

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
  pdf.text('See you soon ☕', W / 2, y + 13, { align: 'center' });

  pdf.save(`CafeHunt_Receipt_${ref}.pdf`);
};