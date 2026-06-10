import { db, app } from './firebase-config.js';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';
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
    document.getElementById('sucCustomer').textContent = r.username  || '—';
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
  // Check if status_id is 1 (Success) and we have a reservationId
  if ((payStatus === '1' || payStatus === 1) && reservationId) {
    try {
      const resRef = doc(db, 'reservation', reservationId);
      const rSnap = await getDoc(resRef);

      if (!rSnap.exists()) {
        console.warn("Reservation document not found for ID:", reservationId);
        return;
      }

      const rData = rSnap.data();

      // Guard: If already marked as paid, skip to avoid duplicate notifications
      if (rData.paymentStatus === 'paid') {
        console.log('Payment already processed and recorded.');
        return;
      }

      await updateDoc(resRef, {
        paymentStatus: 'paid',
        paidAt: serverTimestamp(),
      });
      console.log('paymentStatus updated to paid');

      // Trigger Admin Notification for the successful payment
      await addDoc(collection(db, "adminnotifications"), {
          type: "payment_success",
          message: `Payment Received: ${rData.username || 'A customer'} successfully paid for their reservation at ${rData.cafe}.`,
          cafeName: rData.cafe || "",
          reservationId: reservationId,
          userId: rData.userId || "",
          read: false,
          createdAt: serverTimestamp(),
      });
      console.log('Admin notification created successfully.');


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
    dot.style.left              = Math.random() * 100 + 'vw';
    dot.style.background        = colors[Math.floor(Math.random() * colors.length)];
    dot.style.width             = (Math.random() * 7 + 5) + 'px';
    dot.style.height            = dot.style.width;
    dot.style.animationDuration = (Math.random() * 2.5 + 1.5) + 's';
    dot.style.animationDelay    = (Math.random() * 1.2) + 's';
    dot.style.opacity           = Math.random() * .7 + .3;
    wrap.appendChild(dot);
  }
}
spawnConfetti();

// ── Draw Font Awesome icon onto a canvas and return base64 PNG ──
// Font Awesome must already be loaded on the page for this to work.
function iconToBase64(unicode, color = '#8b5a2b', size = 64) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Wait a tick to ensure FA font is available, then draw
    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = color;
      ctx.font = `900 ${size * 0.75}px "Font Awesome 6 Free"`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(unicode, size / 2, size / 2);
      resolve(canvas.toDataURL('image/png'));
    };

    // Small delay to be safe with font loading
    setTimeout(draw, 100);
  });
}

// ── Download Receipt as PDF ──
window.downloadReceipt = async function() {
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

  // ── Green header bar ──
  pdf.setFillColor(74, 122, 74);
  pdf.roundedRect(10, 8, W - 20, 30, 4, 4, 'F');

  // ── White check circle ──
  pdf.setFillColor(255, 255, 255);
  pdf.circle(W / 2, 19, 7, 'F');

  // ── Checkmark drawn as two lines ──
  pdf.setDrawColor(74, 122, 74);
  pdf.setLineWidth(1.5);
  pdf.line(W/2 - 3, 19.5, W/2 - 0.5, 22.5);
  pdf.line(W/2 - 0.5, 22.5, W/2 + 4, 16.5);
  pdf.setLineWidth(0.2);

  // ── Header text ──
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(13);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Payment Successful', W / 2, 33, { align: 'center' });

  // ── Mug icon from Font Awesome rendered via canvas ──
  const mugBase64 = await iconToBase64('\uf7b6', '#8b5a2b', 64);

  // Center the brand: icon + "CafeHunt" text together
  const brandTextWidth = pdf.getStringUnitWidth('CafeHunt') * 11 / pdf.internal.scaleFactor;
  const brandIconW = 6;
  const gap = 2;
  const totalBrandW = brandIconW + gap + brandTextWidth;
  const brandStartX = (W - totalBrandW) / 2;

  pdf.addImage(mugBase64, 'PNG', brandStartX, 39, brandIconW, brandIconW);

  pdf.setTextColor(139, 90, 43);
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('CafeHunt', brandStartX + brandIconW + gap, 45);

  pdf.setTextColor(180, 140, 100);
  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'normal');
  pdf.text('PAYMENT CONFIRMATION', W / 2, 51, { align: 'center' });

  // ── Dashed tear line ──
  pdf.setDrawColor(220, 200, 175);
  pdf.setLineDashPattern([2, 2], 0);
  pdf.line(10, 56, W - 10, 56);
  pdf.setLineDashPattern([], 0);

  // ── Section label ──
  pdf.setTextColor(180, 120, 70);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'bold');
  pdf.text('RESERVATION DETAILS', 14, 63);

  // ── Detail rows ──
  const rows = [
    ['Cafe',     cafe],
    ['Customer', customer],
    ['Date',     date],
    ['Time',     time],
    ['Guests',   guests],
  ];

  let y = 69;
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

  // ── Amount paid box ──
  y += 2;
  pdf.setFillColor(232, 245, 233);
  pdf.roundedRect(12, y, W - 24, 18, 3, 3, 'F');
  pdf.setDrawColor(150, 200, 150);
  pdf.roundedRect(12, y, W - 24, 18, 3, 3, 'S');

  // Draw small green checkmark circle for "Amount Paid" label
  pdf.setFillColor(34, 139, 34);
  pdf.circle(19, y + 7, 3, 'F');
  pdf.setDrawColor(255, 255, 255);
  pdf.setLineWidth(0.8);
  pdf.line(17.2, y + 7, 18.5, y + 8.3);
  pdf.line(18.5, y + 8.3, 21, y + 5.5);
  pdf.setLineWidth(0.2);

  pdf.setTextColor(34, 100, 34);
  pdf.setFontSize(8.5);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Amount Paid', 24, y + 7.5);

  pdf.setFontSize(13);
  pdf.text(amount, W - 14, y + 9, { align: 'right' });

  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(80, 140, 80);
  pdf.text('Status: PAID', 17, y + 14);

  // ── Reference box ──
  y += 24;
  pdf.setFillColor(250, 246, 240);
  pdf.roundedRect(12, y, W - 24, 13, 2, 2, 'F');
  pdf.setDrawColor(220, 200, 175);
  pdf.roundedRect(12, y, W - 24, 13, 2, 2, 'S');

  pdf.setTextColor(140, 110, 80);
  pdf.setFontSize(7.5);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Reference ID', 16, y + 5.5);

  pdf.setTextColor(40, 28, 18);
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(8);
  pdf.text(ref, W - 14, y + 5.5, { align: 'right' });

  pdf.setTextColor(160, 130, 90);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  pdf.text(`Printed: ${now}`, 16, y + 10.5);

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
  pdf.text('See you soon', W / 2, y + 13, { align: 'center' });

  pdf.save(`CafeHunt_Receipt_${ref}.pdf`);
};