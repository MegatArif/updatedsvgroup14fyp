    import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
    import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
    import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

    // Your Firebase config (get from Firebase Console)
    const firebaseConfig = {
        apiKey: "AIzaSyBW6kZ1X9qSa5aOMjY-gjC--u1QQVqZrBU",
        authDomain: "projectcafehunt.firebaseapp.com",
        projectId: "projectcafehunt",
        storageBucket: "projectcafehunt.firebasestorage.app",
        messagingSenderId: "420902695771",
        appId: "1:420902695771:web:6484b6f576eff6257ee07e"
    };
    const ADMIN_EMAILS = [
    'megatarifidlan@graduate.utm.my',
    'leexuabhui.tuta@gmail.com',
    'looeeying@graduate.utm.my',
  ];
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
  
  
  const card          = document.getElementById('authCard');
  const toOwnerBtn    = document.getElementById('toOwnerBtn');
  const toCustomerBtn = document.getElementById('toCustomerBtn');
  const toastStyle = document.createElement('style');
  toastStyle.textContent = `
    #toast-container {
      position: fixed; top: 1.5rem; right: 1.5rem;
      z-index: 99999; display: flex; flex-direction: column;
      gap: .6rem; pointer-events: none;
    }
    .toast {
      display: flex; align-items: flex-start; gap: .75rem;
      min-width: 280px; max-width: 360px;
      padding: .9rem 1.1rem; border-radius: .85rem;
      background: #1a1a1a; box-shadow: 0 8px 32px rgba(0,0,0,0.35);
      font-family: "Syne", sans-serif; font-size: .85rem; font-weight: 600;
      color: #f5f5f5; pointer-events: all;
      border-left: 4px solid transparent;
      opacity: 0; transform: translateX(60px);
      transition: opacity .32s ease, transform .32s ease;
      position: relative; overflow: hidden;
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
    .toast-progress { position: absolute; bottom: 0; left: 0; height: 3px; width: 100%; transform-origin: left; border-radius: 0 0 .85rem .85rem; }
    .toast.success .toast-progress { background: #43a047; }
    .toast.error   .toast-progress { background: #e53935; }
    .toast.info    .toast-progress { background: #1e88e5; }
  
    /* ── EMAIL OVERLAY ── */
    .email-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.65);
      backdrop-filter: blur(6px);
      z-index: 99998;
      display: flex; align-items: center; justify-content: center;
      opacity: 0; pointer-events: none;
      transition: opacity .3s ease;
    }
    .email-overlay.show { opacity: 1; pointer-events: all; }
    .email-overlay-box {
      background: #1a1a1a;
      border-radius: 1.5rem;
      padding: 2.5rem 2.25rem;
      max-width: 400px; width: 90%;
      text-align: center;
      box-shadow: 0 16px 64px rgba(0,0,0,0.5);
      transform: translateY(20px);
      transition: transform .35s ease;
      font-family: "Syne", sans-serif;
    }
    .email-overlay.show .email-overlay-box { transform: translateY(0); }
    .email-overlay-icon {
      font-size: 3rem; margin-bottom: 1rem;
      display: block;
    }
    .email-overlay-icon.verify  { color: #1e88e5; }
    .email-overlay-icon.reset   { color: #43a047; }
    .email-overlay-title {
      font-size: 1.2rem; font-weight: 800;
      color: #f5f5f5; margin-bottom: .6rem;
    }
    .email-overlay-msg {
      font-size: .83rem; color: #999;
      line-height: 1.6; margin-bottom: 1.75rem;
      font-family: "Montserrat", sans-serif;
    }
    .email-overlay-msg span { color: #f5f5f5; font-weight: 600; }
    .email-overlay-close {
      display: inline-flex; align-items: center; justify-content: center;
      padding: .65rem 2rem; border-radius: 3rem;
      border: none; cursor: pointer;
      font-family: "Syne", sans-serif; font-size: .85rem; font-weight: 700;
      color: #fff; transition: filter .2s, transform .18s;
    }
    .email-overlay-close.blue  { background: #1e88e5; }
    .email-overlay-close.green { background: #43a047; }
    .email-overlay-close:hover { filter: brightness(1.15); transform: scale(1.03); }
  `;
  document.head.appendChild(toastStyle);
  
  const toastContainer = document.createElement('div');
  toastContainer.id = 'toast-container';
  document.body.appendChild(toastContainer);
  
  function showToast(message, type = 'error', duration = 3500) {
    const icons  = { success: 'ri-checkbox-circle-fill', error: 'ri-error-warning-fill', info: 'ri-information-fill' };
    const titles = { success: 'Success', error: 'Error', info: 'Info' };
    const toast  = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i class="toast-icon ${icons[type]}"></i>
      <div class="toast-body"><div class="toast-title">${titles[type]}</div><div>${message}</div></div>
      <div class="toast-progress"></div>
    `;
    toastContainer.appendChild(toast);

 
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
  const progress = toast.querySelector('.toast-progress');
  progress.style.transition = `transform ${duration}ms linear`;
  requestAnimationFrame(() => requestAnimationFrame(() => { progress.style.transform = 'scaleX(0)'; }));
  setTimeout(() => {
    toast.classList.add('hide');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, duration);
}
  function showEmailOverlay(type, email) {
  // Remove any existing overlay
  document.querySelector('.email-overlay')?.remove();
 
  const isVerify = type === 'verify';
  const overlay  = document.createElement('div');
  overlay.className = 'email-overlay';
  overlay.innerHTML = `
    <div class="email-overlay-box">
      <i class="email-overlay-icon ${isVerify ? 'verify ri-mail-send-line' : 'reset ri-lock-password-line'}"></i>
      <div class="email-overlay-title">${isVerify ? 'Verify your email' : 'Check your email'}</div>
      <div class="email-overlay-msg">
        ${isVerify
          ? `We've sent a verification link to <span>${email}</span>.<br>Please check your inbox and click the link to activate your account.`
          : `We've sent a password reset link to <span>${email}</span>.<br>Please check your inbox and follow the instructions.`
        }
      </div>
      <button class="email-overlay-close ${isVerify ? 'blue' : 'green'}">Got it</button>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('show')));
 
  // Close on button or backdrop click
  overlay.querySelector('.email-overlay-close').addEventListener('click', () => closeOverlay(overlay));
  overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlay(overlay); });
}
 
function closeOverlay(overlay) {
  overlay.classList.remove('show');
  overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
}
  /* ── GSAP entrance ── */
  const tl = gsap.timeline();
  tl.fromTo(card,
    { y: -700, scaleX: .2, scaleY: .35, opacity: 0 },
    { y: 0,    scaleX: .2, scaleY: .35, opacity: 1, duration: 1.45, ease: 'power3.out' }
  )
  .to(card, { scaleY: 1, duration: .55, ease: 'power3.out' }, '-=0.28')
  .to(card, { scaleX: 1, duration: .65, ease: 'power3.out' }, '-=0.15');
 
  /* Ken Burns */
  ['imgFront', 'imgBack'].forEach(id => {
    gsap.to(`#${id}`, {
      scale: 1.09, duration: 7, ease: 'power1.inOut',
      repeat: -1, yoyo: true,
      transformOrigin: 'center center', delay: 2.2
    });
  });
 
  /* Stagger entrance of customer login view */
  gsap.from('#custLoginView > *', {
    opacity: 0, y: -22, duration: 1,
    ease: 'power2.out', stagger: .12, delay: 2.3
  });
  gsap.from('#custImgBody > *', {
    opacity: 0, y: 20, duration: .9,
    ease: 'power2.out', stagger: .14, delay: 2.8
  });
 
  /* ── SLIDE to shop owner ── */
  toOwnerBtn.addEventListener('click', () => {
    card.classList.add('shop-mode');
    gsap.fromTo('#ownerLoginView > *',
      { opacity: 0, y: -20 },
      { opacity: 1, y: 0, duration: .8, ease: 'power2.out', stagger: .1, delay: 0.45 }
    );
    gsap.fromTo('#ownerImgBody > *',
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: .75, ease: 'power2.out', stagger: .12, delay: 0.5 }
    );
  });
 
  /* ── SLIDE back to customer ── */
  toCustomerBtn.addEventListener('click', () => {
    card.classList.remove('shop-mode');
  });
 
  /* ── SWITCH between login ↔ register IN-PANE ── */
  function switchView(hideId, showId) {
    const hideEl = document.getElementById(hideId);
    const showEl = document.getElementById(showId);
 
    /* fade out current */
    gsap.to(hideEl, {
      opacity: 0, y: -18, duration: .28, ease: 'power2.in',
      onComplete: () => {
        hideEl.classList.remove('active');
        /* reset position for next time */
        gsap.set(hideEl, { y: 18 });
 
        /* prepare new view below, then fade in */
        gsap.set(showEl, { opacity: 0, y: 22 });
        showEl.classList.add('active');
        gsap.to(showEl, { opacity: 1, y: 0, duration: .38, ease: 'power2.out' });
      }
    });
  }
 
 
  /* delegate clicks on show-reg / show-login links */
  document.addEventListener('click', e => {
    const reg   = e.target.closest('.show-reg');
    const login = e.target.closest('.show-login');
    if (reg) {
      e.preventDefault();
      /* find the sibling login-view in the same pane */
      const pane     = reg.closest('.form-pane');
      const loginView = pane.querySelector('.login-view');
      const regView   = pane.querySelector('.reg-view');
      switchView(loginView.id, regView.id);
    }
    if (login) {
      e.preventDefault();
      const pane     = login.closest('.form-pane');
      const loginView = pane.querySelector('.login-view');
      const regView   = pane.querySelector('.reg-view');
      switchView(regView.id, loginView.id);
    }
  });

  //System function
  document.querySelectorAll('.forgot').forEach(link => {
  link.addEventListener('click', async (e) => {
    e.preventDefault();
 
    // Figure out which email field is visible (customer or owner)
    const isOwner = card.classList.contains('shop-mode');
    const emailId = isOwner ? 'o-email' : 'c-email';
    const email   = document.getElementById(emailId)?.value?.trim();
 
    if (!email) {
      showToast('Please enter your email address first, then click Forgot Password.', 'error');
      document.getElementById(emailId)?.focus();
      return;
    }
 
    try {
      await sendPasswordResetEmail(auth, email);
      showEmailOverlay('reset', email);
    } catch (error) {
      let msg = 'Could not send reset email.';
      if (error.code === 'auth/user-not-found')  msg = 'No account found with that email.';
      if (error.code === 'auth/invalid-email')   msg = 'Please enter a valid email address.';
      showToast(msg, 'error');
    }
  });
});
document.querySelectorAll('.eye-btn').forEach(btn => {
  // Ensure button has proper styling for clicking
  btn.style.cursor = 'pointer';
  btn.style.minWidth = '32px';
  btn.style.minHeight = '32px';
  
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const inputId = btn.getAttribute('data-target');
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('i');
    
    if (!input) {
      console.error('Input not found for target:', inputId);
      return;
    }
  
    if (input.type === 'password') {
      input.type = 'text';
      if (icon) {
        icon.className = 'ri-eye-line';
      }
    } else {
      input.type = 'password';
      if (icon) {
        icon.className = 'ri-eye-off-line';
      }
    }
  });
});

  //Login customer
  async function loginCustomer() {
  const email    = document.getElementById('c-email').value.trim();
  const password = document.getElementById('c-pass').value;

  const emailError = validateEmail(email);
  if (emailError) { showToast(emailError, 'error'); document.getElementById('c-email').focus(); return; }
  if (!password)  { showToast('Password is required', 'error'); document.getElementById('c-pass').focus(); return; }

  showToast('Signing in...', 'info', 4000);

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    if (!user.emailVerified) {
      showToast('Please verify your email before logging in.', 'error', 5000);
      await sendEmailVerification(user);
      showEmailOverlay('verify', email);
      return;
    }

    // ✅ Check if admin — silent, no one knows this check exists
    if (ADMIN_EMAILS.includes(email)) {
      showToast('Welcome, Admin! Redirecting to dashboard...', 'success', 2000);
      setTimeout(() => { window.location.href = 'admin-dashboard.html'; }, 2000);
      return;
    }

    // Normal customer redirect
    showToast('Welcome back! Redirecting...', 'success', 2000);
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 2000);

  } catch (error) {
    console.error('Login error:', error);
    let msg = '';
    switch (error.code) {
      case 'auth/user-not-found':         msg = 'No account found with that email.'; break;
      case 'auth/wrong-password':         msg = 'Incorrect password. Please try again.'; break;
      case 'auth/invalid-credential':     msg = 'Invalid email or password.'; break;
      case 'auth/too-many-requests':      msg = 'Too many failed attempts. Try again later.'; break;
      case 'auth/network-request-failed': msg = 'Network error. Check your connection.'; break;
      default:                            msg = 'An error occurred: ' + error.message;
    }
    showToast(msg, 'error');
  }
}
  
   const BANNED_WORDS = [
  'fuck', 'shit', 'ass', 'bitch', 'bastard', 'damn',
  'cunt', 'dick', 'cock', 'pussy', 'nigga', 'nigger',
  'bodoh', 'babi', 'anjing', 'anjir',
];

function validateUsername(name) {
  if (!name || name.trim().length < 2)
    return "Please enter a username (at least 2 characters)";
  if (name.trim().length > 50)
    return "Username is too long (maximum 50 characters)";

  // Check for banned words (case-insensitive)
  const lower = name.toLowerCase();
  for (const word of BANNED_WORDS) {
    if (lower.includes(word)) {
      return "Username contains inappropriate language. Please choose another.";
    }
  }

  // Only allow letters, numbers, underscores, hyphens
  if (!/^[a-zA-Z0-9_\-]+$/.test(name.trim())) {
    return "Username can only contain letters, numbers, underscores and hyphens";
  }

  return null;
}
    
    function validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email) {
            return "Email is required";
        }
        if (!emailRegex.test(email)) {
            return "Please enter a valid email address (e.g., name@example.com)";
        }
        return null;
    }
    
    function validatePassword(password) {
        if (!password) {
            return "Password is required";
        }
        if (password.length < 6) {
            return "Password must be at least 6 characters long";
        }
        
        // Check for uppercase letter
        if (!/[A-Z]/.test(password)) {
            return "Password must contain at least one uppercase letter";
        }
        
        // Check for lowercase letter
        if (!/[a-z]/.test(password)) {
            return "Password must contain at least one lowercase letter";
        }
        
        // Check for number
        if (!/[0-9]/.test(password)) {
            return "Password must contain at least one number";
        }
        
        // Check for special character
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            return "Password must contain at least one special character (!@#$%^&* etc.)";
        }
        
        return null;
    }
    
    function validatePasswordMatch(password, confirmPassword) {
        if (password !== confirmPassword) {
            return "Passwords do not match!";
        }
        return null;
    }

    function validatePhoneNumber(phone){
      if(!phone){
        return "Phone number is required";
      }
      if (!/^\d+$/.test(phone)) {
        return "Phone number must only contain numbers";
      }
      if (phone.length < 10) {
          return "Phone number must be at least 10 digits";
      }
      if (phone.length > 12) {
          return "Phone number must not exceed 12 digits";
      }
      return null;
    }

  async function registerCustomer() {
  const username        = document.getElementById('c-username').value;
  const email           = document.getElementById('c-regemail').value;
  const password        = document.getElementById('c-regpass').value;
  const confirmPassword = document.getElementById('c-confirm').value;
 
  const nameError = validateUsername(username);
  if (nameError) { showToast(nameError, 'error'); document.getElementById('c-username').focus(); return; }
 
  const emailError = validateEmail(email);
  if (emailError) { showToast(emailError, 'error'); document.getElementById('c-regemail').focus(); return; }
 
  const passwordError = validatePassword(password);
  if (passwordError) { showToast(passwordError, 'error'); document.getElementById('c-regpass').focus(); return; }
 
  const matchError = validatePasswordMatch(password, confirmPassword);
  if (matchError) { showToast(matchError, 'error'); document.getElementById('c-confirm').focus(); return; }
 
  showToast('Creating your account...', 'info', 5000);
 
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    await sendEmailVerification(user);

    await setDoc(doc(db, "Customers", user.uid), {
      username:  username,
      email:     email,
      userType:  'customer',
      createdAt: new Date()
    });

    showEmailOverlay('verify', email);

} catch (error) {
    console.error('Firebase error:', error);
    let errorMessage = '';
    switch (error.code) {
      case 'auth/email-already-in-use':   errorMessage = 'This email is already registered.'; break;
      case 'auth/weak-password':          errorMessage = 'Password is too weak.'; break;
      case 'auth/invalid-email':          errorMessage = 'Invalid email format.'; break;
      case 'auth/network-request-failed': errorMessage = 'Network error. Check your connection.'; break;
      default:                            errorMessage = 'An error occurred: ' + error.message;
    }
    showToast(errorMessage, 'error');
  }
}

  async function loginShopOwner() {
  const email    = document.getElementById('o-email').value.trim();
  const password = document.getElementById('o-pass').value;
 
  const emailError = validateEmail(email);
  if (emailError) { showToast(emailError, 'error'); document.getElementById('o-email').focus(); return; }
  if (!password)  { showToast('Password is required', 'error'); document.getElementById('o-pass').focus(); return; }
 
  showToast('Signing in...', 'info', 4000);
 
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
 
    // Check email verified
    if (!user.emailVerified) {
      showToast('Please verify your email before logging in.', 'error', 5000);
      // Resend verification
      await sendEmailVerification(user);
      showEmailOverlay('verify', email);
      return;
    }
 
    showToast('Welcome back! Redirecting...', 'success', 2000);
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 2000);
 
  } catch (error) {
    console.error('Login error:', error);
    let msg = '';
    switch (error.code) {
      case 'auth/user-not-found':       msg = 'No account found with that email.'; break;
      case 'auth/wrong-password':       msg = 'Incorrect password. Please try again.'; break;
      case 'auth/invalid-credential':   msg = 'Invalid email or password.'; break;
      case 'auth/too-many-requests':    msg = 'Too many failed attempts. Try again later.'; break;
      case 'auth/network-request-failed': msg = 'Network error. Check your connection.'; break;
      default:                          msg = 'An error occurred: ' + error.message;
    }
    showToast(msg, 'error');
  }
}
  async function registerShopOwner() {
  const phone           = document.getElementById('o-phone').value;
  const email           = document.getElementById('o-regemail').value;
  const password        = document.getElementById('o-regpass').value;
  const confirmPassword = document.getElementById('o-confirm').value;
 
  const phoneError = validatePhoneNumber(phone);
  if (phoneError) { showToast(phoneError, 'error'); document.getElementById('o-phone').focus(); return; }
 
  const emailError = validateEmail(email);
  if (emailError) { showToast(emailError, 'error'); document.getElementById('o-regemail').focus(); return; }
 
  const passwordError = validatePassword(password);
  if (passwordError) { showToast(passwordError, 'error'); document.getElementById('o-regpass').focus(); return; }
 
  const matchError = validatePasswordMatch(password, confirmPassword);
  if (matchError) { showToast(matchError, 'error'); document.getElementById('o-confirm').focus(); return; }
 
  showToast('Creating your account...', 'info', 5000);
 
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    await sendEmailVerification(user);

    await setDoc(doc(db, "ShopOwner", user.uid), {
      email:     email,
      phone:     phone,
      userType:  'shopowner',
      createdAt: new Date()
    });

    showEmailOverlay('verify', email);

} catch (error) {
    console.error('Firebase error:', error);
    let errorMessage = '';
    switch (error.code) {
      case 'auth/email-already-in-use':   errorMessage = 'This email is already registered.'; break;
      case 'auth/weak-password':          errorMessage = 'Password is too weak.'; break;
      case 'auth/invalid-email':          errorMessage = 'Invalid email format.'; break;
      case 'auth/network-request-failed': errorMessage = 'Network error. Check your connection.'; break;
      default:                            errorMessage = 'An error occurred: ' + error.message;
    }
    showToast(errorMessage, 'error');
  }

}


  window.registerCustomer = registerCustomer;
  window.loginCustomer   = loginCustomer;
  window.registerShopOwner = registerShopOwner
  window.loginShopOwner   = loginShopOwner;
