// Delegated so it also works after navigation while the persistent player is running.
if (!window.bookRequestsInstalled) {
  window.bookRequestsInstalled = true;
  document.addEventListener('submit', async event => {
    const form = event.target.closest('[data-book-request]'); if (!form) return;
    event.preventDefault();
    const button = form.querySelector('button[type=submit]'), status = form.querySelector('[data-request-status]');
    if (button.disabled) return;
    button.disabled = true; status.textContent = 'Submitting your request…';
    try {
      const data = Object.fromEntries(new FormData(form)); data.slug = form.dataset.slug;
      const response = await fetch('/api/library-requests', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)});
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Request failed. Please try again.');
      status.textContent = result.message;
      form.querySelector('input[name=email]').value = '';
    } catch (e) { status.textContent = e.message || 'Request failed. Please try again.'; }
    finally { button.disabled = false; }
  });
}
