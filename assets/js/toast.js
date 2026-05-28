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
    font-family: "Syne", sans-serif;
    font-size: .85rem;
    font-weight: 600;
    color: #f5f5f5;
    pointer-events: all;
    border-left: 4px solid transparent;
    opacity: 0;
    transform: translateX(60px);
    transition: opacity .32s ease, transform .32s ease;
  }
  .toast.show {
    opacity: 1;
    transform: translateX(0);
  }
  .toast.hide {
    opacity: 0;
    transform: translateX(60px);
  }
  .toast.success { border-color: #43a047; }
  .toast.error   { border-color: #e53935; }
  .toast.info    { border-color: #1e88e5; }
  .toast-icon {
    font-size: 1.2rem;
    flex-shrink: 0;
    margin-top: .05rem;
  }
  .toast.success .toast-icon { color: #43a047; }
  .toast.error   .toast-icon { color: #e53935; }
  .toast.info    .toast-icon { color: #1e88e5; }
  .toast-body { flex: 1; line-height: 1.45; }
  .toast-title {
    font-size: .75rem;
    font-weight: 700;
    letter-spacing: .06em;
    text-transform: uppercase;
    margin-bottom: .2rem;
    opacity: .6;
  }
  .toast-progress {
    position: absolute;
    bottom: 0; left: 0;
    height: 3px;
    border-radius: 0 0 .85rem .85rem;
    width: 100%;
    transform-origin: left;
  }
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

    #toast-confirm-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.55);
      backdrop-filter: blur(4px);
      z-index: 99999;
      display: flex; align-items: center; justify-content: center;
      opacity: 0; pointer-events: none;
      transition: opacity .25s ease;
    }
    #toast-confirm-overlay.show { opacity: 1; pointer-events: all; }

    .tc-box {
      background: #1a1a1a;
      border-radius: 1rem;
      padding: 1.75rem 1.75rem 1.4rem;
      max-width: 360px; width: 90%;
      box-shadow: 0 16px 64px rgba(0,0,0,0.5);
      transform: translateY(16px);
      transition: transform .3s ease;
      font-family: "Syne", sans-serif;
    }
    #toast-confirm-overlay.show .tc-box { transform: translateY(0); }

    .tc-msg {
      font-size: .92rem; color: #f5f5f5;
      line-height: 1.55; margin-bottom: 1.4rem;
      font-family: "Montserrat", sans-serif;
    }
    .tc-btns {
      display: flex; gap: 10px; justify-content: flex-end;
    }
    .tc-btn-cancel {
      padding: .55rem 1.4rem; border-radius: 3rem;
      border: 1.5px solid rgba(255,255,255,.2);
      background: transparent; color: rgba(255,255,255,.6);
      font-family: "Syne", sans-serif; font-size: .82rem;
      font-weight: 600; cursor: pointer;
      transition: border-color .2s, color .2s;
    }
    .tc-btn-cancel:hover { border-color: rgba(255,255,255,.5); color: #fff; }

    .tc-btn-ok {
      padding: .55rem 1.6rem; border-radius: 3rem;
      border: none; background: #e53935; color: #fff;
      font-family: "Syne", sans-serif; font-size: .82rem;
      font-weight: 700; cursor: pointer;
      transition: filter .2s, transform .15s;
    }
    .tc-btn-ok:hover { filter: brightness(1.15); transform: scale(1.03); }

`;
document.head.appendChild(toastStyle);


const toastContainer = document.createElement('div');
toastContainer.id = 'toast-container';
document.body.appendChild(toastContainer);

// function
function showToast(message, type = 'success', duration = 3500) {

  const icons = {
    success: '✔️',
    error: '❌',
    info: 'ℹ️'
  };

  const titles = {
    success: 'Success',
    error: 'Error',
    info: 'Info'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.style.position = 'relative';
  toast.style.overflow = 'hidden';

  toast.innerHTML = `
    <i class="toast-icon">${icons[type]}</i>
    <div class="toast-body">
      <div class="toast-title">${titles[type]}</div>
      <div>${message}</div>
    </div>
    <div class="toast-progress"></div>
  `;

  toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function showConfirm(message,onConfirm,onCancel){
  document.getElementById('toast-confirm-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'toast-confirm-overlay';
  overlay.innerHTML=`<div class="tc-box">
      <div class="tc-msg">${message}</div>
      <div class="tc-btns">
        <button class="tc-btn-cancel" id="tcCancel">Cancel</button>
        <button class="tc-btn-ok"     id="tcOk">Confirm</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  //animate in 
  requestAnimationFrame(() => overlay.classList.add('show'));

  function close() {
    overlay.classList.remove('show');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
  }

  document.getElementById('tcOk').addEventListener('click', () => {
    close();
    onConfirm();
  });

  document.getElementById('tcCancel').addEventListener('click', () => {
    close();
    if (onCancel) onCancel();
  });

  // Close on backdrop click
  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      close();
      if (onCancel) onCancel();
    }
  });

  // Close on Escape
  function onKey(e) {
    if (e.key === 'Escape') {
      document.removeEventListener('keydown', onKey);
      close();
      if (onCancel) onCancel();
    }
  }
  document.addEventListener('keydown', onKey);
}

export { showToast , showConfirm};