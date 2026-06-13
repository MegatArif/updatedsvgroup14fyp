import { db, app }   from './firebase-config.js';
    import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js';
    import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js';
    import { setupNavbar } from './navbar.js';

    import { guardSession, sessionLogout } from './session.js';
    // Call guardFunction 
    guardSession(['customer']);
    
    setupNavbar();
 
    const auth = getAuth(app);
 
    const urlParams     = new URLSearchParams(window.location.search);
    const reservationId = urlParams.get('reservationId');
 
    let reservationData = null;
    let currentUser     = null;
 
    // ── Format helpers ──
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
 
    // ── Load reservation ──
    async function loadReservation() {
      if (!reservationId) { showError('No reservation ID found. Please go back and try again.'); return; }
 
      try {
        const snap = await getDoc(doc(db, 'reservation', reservationId));
        if (!snap.exists()) { showError('Reservation not found.'); return; }
 
        reservationData = snap.data();
 
        const guests = parseInt(reservationData.guests) || 1;
        const total  = 10;
 
        document.getElementById('payCardCafe').textContent     = reservationData.cafe     || '—';
        document.getElementById('payCardLocation').textContent = reservationData.location || '—';
        document.getElementById('payCardCustomer').textContent = reservationData.username || '—';
        document.getElementById('payCardDate').textContent     = formatDate(reservationData.date);
        document.getElementById('payCardTime').textContent     = formatTime(reservationData.time);
        document.getElementById('payCardGuests').textContent   = guests + ' guest' + (guests > 1 ? 's' : '');
        document.getElementById('priceTotal').textContent      = `RM ${total.toFixed(2)}`;
        document.getElementById('btnTotal').textContent        = `RM ${total.toFixed(2)}`;
 
      } catch (err) {
        console.error(err);
        showError('Failed to load reservation details.');
      }
    }
 
    // ── Auth ──
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(doc(db, 'Customers', user.uid));
        currentUser = {
          uid:      user.uid,
          username: snap.exists() ? (snap.data().username || user.email) : user.email,
          email:    user.email,
        };
      }
      loadReservation();
    });
 
    // ── Pay button ──
    window.handlePayNow = async function() {
      const rawPhone = document.getElementById('phoneInput').value.trim().replace(/\D/g, '');
 
      if (!rawPhone || rawPhone.length < 9) {
        showError('Please enter a valid Malaysian mobile number.');
        return;
      }
      if (!reservationData) { showError('Reservation data not loaded yet.'); return; }
 
      const guests = parseInt(reservationData.guests) || 1;
      const amount = 10;
      const phone  = '0' + rawPhone; // prepend 0 for ToyyibPay
 
      const btn = document.getElementById('payBtn');
      btn.disabled = true;
      btn.classList.add('loading');
      hideError();
 
      try {
        const response = await fetch('/api/create-bill', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName:  reservationData.username || currentUser?.username || 'Customer',
            customerEmail: currentUser?.email || 'noreply@cafehunt.com',
            customerPhone: phone,
            amount:        amount,
            reservationId: reservationId,
            cafeName:      reservationData.cafe || '',
          }),
        });
 
        const data = await response.json();
 
        if (data.billCode) {
          window.location.href = `https://toyyibpay.com/${data.billCode}`;
        } else {
        const detail = data.detail?.[0]?.msg || data.raw || data.error || 'Failed to create payment.';
          showError(data.error || 'Failed to create payment. Please try again.');
          btn.disabled = false;
          btn.classList.remove('loading');
        }
      } catch (err) {
        console.error(err);
        showError('Network error. Please check your connection and try again.');
        btn.disabled = false;
        btn.classList.remove('loading');
      }
    };
 
    function showError(msg) {
      const el = document.getElementById('errorMsg');
      document.getElementById('errorText').textContent = msg;
      el.classList.add('show');
    }
    function hideError() {
      document.getElementById('errorMsg').classList.remove('show');
    }
 
    // Only allow digits in phone input
    document.getElementById('phoneInput').addEventListener('input', function() {
      this.value = this.value.replace(/\D/g, '');
    });