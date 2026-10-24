(() => {
  const origins = ['https://wuwa.south-wall.com', 'https://wuwa-lightstick.pages.dev'];
  const key = 'wuwa.visitor.v1';
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function identity() {
    try {
      let id = localStorage.getItem(key);
      if (!uuid.test(id || '')) {
        localStorage.setItem(key, crypto.randomUUID());
        id = localStorage.getItem(key);
      }
      return uuid.test(id || '') ? id.toLowerCase() : null;
    } catch { return null; }
  }

  async function start() {
    const node = document.getElementById('visitorCount');
    if (!node) return;
    node.hidden = true;
    if (!origins.includes(location.origin)) return;
    let timer;
    try {
      // One identity when a browser opens several tabs for its first visit.
      const id = navigator.locks?.request ? await navigator.locks.request(key, identity) : identity();
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), 6000);
      const options = {method: 'GET', cache: 'no-store', credentials: 'omit',
        mode: 'same-origin', referrerPolicy: 'no-referrer', signal: controller.signal};
      if (id) Object.assign(options, {method: 'POST',
        headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id})});
      const response = await fetch('/api/visitors', options);
      if (!response.ok) return;
      const {total} = await response.json();
      if (!Number.isSafeInteger(total) || total < 0) return;
      node.textContent = `${total.toLocaleString('zh-CN')} 位共鸣者到访`;
      node.hidden = false;
    } catch { /* A counter must never interrupt the controller. */ }
    finally { clearTimeout(timer); }
  }

  const schedule = () => setTimeout(start, 0);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, {once: true});
  else schedule();
})();
