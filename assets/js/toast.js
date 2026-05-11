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

export { showToast };