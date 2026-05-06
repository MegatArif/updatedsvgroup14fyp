const card          = document.getElementById('authCard');
  const toOwnerBtn    = document.getElementById('toOwnerBtn');
  const toCustomerBtn = document.getElementById('toCustomerBtn');
 
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
 
  /* ── EYE TOGGLE ── */
  document.addEventListener('click', e => {
    const btn = e.target.closest('.eye-btn');
    if (!btn) return;
    const input = document.getElementById(btn.dataset.target);
    const icon  = btn.querySelector('i');
    if (input.type === 'password') {
      input.type = 'text';
      icon.className = 'ri-eye-line';
    } else {
      input.type = 'password';
      icon.className = 'ri-eye-off-line';
    }
  });
 
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