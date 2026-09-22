// comparator.js — FINAL v2
function t(key) {
  return (window.GunloupeI18n && window.GunloupeI18n[key]) || key;
}

(function () {
  const BACKEND_URL = 'https://collaboration-assumes-shed-smoke.trycloudflare.com';
  const MAX_ITEMS   = 2;
  const CACHE_KEY   = 'gunloupe_comparator_cache';
  const CACHE_TTL   = 300000; // 5 min

  function getComparatorPageUrl() {
    return (window.GunloupeRoutes && window.GunloupeRoutes.comparator) || '/pages/comparator';
  }
  function getCustomerId() {
    const m = document.querySelector('meta[name="customer-id"]');
    return m ? m.content : null;
  }

  // ── Cache ──────────────────────────────────────────────────────────────────
  function getCached() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const { items, ts } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL) return null;
      return items;
    } catch { return null; }
  }
  function setCache(items) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ items, ts: Date.now() })); } catch {}
  }
  function clearCache() {
    try { sessionStorage.removeItem(CACHE_KEY); } catch {}
  }

  // ── Fetch with retry ───────────────────────────────────────────────────────
  async function fetchWithRetry(url, opts = {}, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(url, opts);
        if (res.ok || (res.status >= 400 && res.status < 500)) return res;
      } catch (e) {
        if (i === retries - 1) throw e;
        await new Promise(r => setTimeout(r, 400 * Math.pow(2, i)));
      }
    }
  }

  // ── Backend read ───────────────────────────────────────────────────────────
  async function getComparatorItems(forceRefresh = false) {
    const customerId = getCustomerId();
    if (!customerId) return [];
    if (!forceRefresh) {
      const cached = getCached();
      if (cached !== null) return cached;
    }
    try {
      const res  = await fetchWithRetry(`${BACKEND_URL}/comparator/${customerId}`);
      const data = await res.json();
      const items = data.success ? (data.items || []) : [];
      setCache(items);
      return items;
    } catch (e) {
      // On network error, return stale cache rather than empty
      try { const raw = sessionStorage.getItem(CACHE_KEY); if (raw) return JSON.parse(raw).items || []; } catch {}
      return [];
    }
  }

  // ── Backend write ──────────────────────────────────────────────────────────
  async function saveComparatorItems(items) {
    const customerId = getCustomerId();
    if (!customerId) return false;
    // Optimistic: update cache immediately so UI responds instantly
    setCache(items);
    try {
      const res  = await fetchWithRetry(`${BACKEND_URL}/comparator/${customerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!data.success) {
        // POST failed — do NOT clear cache, keep optimistic update
        console.error('Comparator: POST failed');
        return false;
      }
      return true;
    } catch (e) {
      // Network error — keep optimistic update, don't clear
      console.error('Comparator: POST error', e);
      return false;
    }
  }

  // ── Visual state helpers ───────────────────────────────────────────────────
  function _applyBtnState(btn, isAdded) {
    btn.querySelectorAll('.before-added').forEach(el => el.style.display = isAdded ? 'none' : '');
    btn.querySelectorAll('.after-added').forEach(el  => el.style.display = isAdded ? '' : 'none');
    btn.classList.toggle('is-added', isAdded);
  }

  // Update by exact numeric variantId
  function updateButtonState(variantId, isAdded) {
    document.querySelectorAll(`[data-compare-variant="${variantId}"]`).forEach(btn => _applyBtnState(btn, isAdded));
  }

  // Update ALL buttons for a productHandle (both resolved & unresolved formats)
  function applyStateToHandle(productHandle, isAdded) {
    if (!productHandle) return;
    document.querySelectorAll('[data-compare-btn]').forEach(btn => {
      const cv = btn.dataset.compareVariant || '';
      const ph = btn.dataset.productHandle  || '';
      if (ph === productHandle || (cv.includes('--') && cv.split('--')[0] === productHandle)) {
        _applyBtnState(btn, isAdded);
      }
    });
  }

  // ── Full sync — re-reads cache, updates every button ──────────────────────
  // forceRefresh=true fetches fresh from backend (use after add/remove)
  async function syncAllButtonStates(forceRefresh = false) {
    const items = await getComparatorItems(forceRefresh);
    updateComparatorBadge(items.length);
    document.querySelectorAll('[data-compare-btn]').forEach(btn => {
      const cv = btn.dataset.compareVariant || '';
      const ph = btn.dataset.productHandle  || '';
      if (!cv && !ph) return;
      let isAdded = false;
      if (cv.includes('--')) {
        // Unresolved: "handle--caliber--barrel" → match by productHandle
        isAdded = items.some(i => i.productHandle === cv.split('--')[0]);
      } else if (cv) {
        // Resolved numeric variantId
        isAdded = items.some(i => i.variantId === cv);
      }
      _applyBtnState(btn, isAdded);
    });
  }

  function updateComparatorBadge(count) {
    document.querySelectorAll('.comparator-nav-badge').forEach(b => {
      b.textContent = count;
      b.style.display = count > 0 ? 'inline-flex' : 'none';
    });
  }

  // ── Add ────────────────────────────────────────────────────────────────────
  async function addToComparator(variantId, productHandle) {
    // Always fetch fresh before adding to avoid stale count
    const items = await getComparatorItems(true);

    if (items.find(i => i.variantId === String(variantId))) {
      window.location.href = getComparatorPageUrl();
      return;
    }
    if (items.length >= MAX_ITEMS) { showLimitPopup(); return; }

    const newItems = [...items, { variantId: String(variantId), productHandle }];

    // 1. Update cache immediately
    setCache(newItems);
    // 2. Update all matching buttons immediately (both locales see same sessionStorage)
    updateButtonState(String(variantId), true);
    applyStateToHandle(productHandle, true);
    updateComparatorBadge(newItems.length);
    // 3. Persist to backend
    await saveComparatorItems(newItems);
    // 4. Force full sync with fresh backend data to ensure consistency
    await syncAllButtonStates(true);
  }

  // ── Remove ─────────────────────────────────────────────────────────────────
  async function removeFromComparator(variantId) {
    const items   = await getComparatorItems(true);
    const removed = items.find(i => i.variantId === String(variantId));
    const newItems = items.filter(i => i.variantId !== String(variantId));

    // 1. Update cache immediately
    setCache(newItems);
    // 2. Update all matching buttons immediately
    updateButtonState(String(variantId), false);
    if (removed?.productHandle) applyStateToHandle(removed.productHandle, false);
    updateComparatorBadge(newItems.length);
    // 3. Persist to backend
    await saveComparatorItems(newItems);
    // 4. Force full sync with fresh backend data
    await syncAllButtonStates(true);
    return true;
  }

  // ── Limit popup ────────────────────────────────────────────────────────────
  function showLimitPopup()  { document.getElementById('comparator-limit-popup')?.classList.add('is-visible'); }
  function hideLimitPopup()  { document.getElementById('comparator-limit-popup')?.classList.remove('is-visible'); }

  function injectLimitPopup() {
    if (document.getElementById('comparator-limit-popup')) return;
    const el = document.createElement('div');
    el.id = 'comparator-limit-popup';
    el.innerHTML = `
      <div class="comparator-popup-overlay"></div>
      <div class="comparator-popup-box">
        <div class="comparator-popup-icon">
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
            <circle cx="22" cy="22" r="21" stroke="#295A31" stroke-width="2"/>
            <path d="M22 13v12M22 28v2" stroke="#295A31" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
        </div>
        <h3>${t('limit_title')}</h3>
        <p>${t('limit_message')}</p>
        <div class="comparator-popup-actions">
          <button class="button is-small comparator-popup-goto" id="comparator-popup-goto-btn">${t('go_to_comparison')}</button>
          <button class="button button-secondary is-small comparator-popup-close">${t('close')}</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    el.querySelector('.comparator-popup-overlay').addEventListener('click', hideLimitPopup);
    el.querySelector('.comparator-popup-close').addEventListener('click', hideLimitPopup);
    el.querySelector('#comparator-popup-goto-btn').addEventListener('click', () => window.location.href = getComparatorPageUrl());
    const s = document.createElement('style');
    s.textContent = `
      #comparator-limit-popup{display:none;position:fixed;inset:0;z-index:99999;align-items:center;justify-content:center}
      #comparator-limit-popup.is-visible{display:flex}
      .comparator-popup-overlay{position:absolute;inset:0;background:rgba(0,0,0,.45);backdrop-filter:blur(3px)}
      .comparator-popup-box{position:relative;background:#fff;border-radius:14px;padding:40px 36px;max-width:420px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.15);animation:cmpPopIn .25s ease}
      @keyframes cmpPopIn{from{opacity:0;transform:scale(.92) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}
      .comparator-popup-icon{margin-bottom:16px;width:100%;justify-content:center;display:flex}
      .comparator-popup-box h3{color:#1a1a1a;margin:0 0 10px}
      .comparator-popup-box p{margin:0 0 24px}
      .comparator-popup-actions{display:flex;gap:10px;justify-content:center}
      [data-compare-btn].is-loading{opacity:.6;pointer-events:none}`;
    document.head.appendChild(s);
  }

  // ── Bind buttons ───────────────────────────────────────────────────────────
  function bindCompareButtons() {
    document.querySelectorAll('[data-compare-btn]').forEach(btn => {
      if (btn.dataset.compareBound) return;
      btn.dataset.compareBound = '1';
      btn.addEventListener('click', async function () {
        const variantId     = this.dataset.compareVariant;
        const productHandle = this.dataset.productHandle;
        if (!variantId || !productHandle) return;
        if (variantId.includes('--')) return; // handled by armorer resolver

        if (this.classList.contains('is-added')) {
          if (this.dataset.compareRemovable === 'true') {
            this.disabled = true;
            await removeFromComparator(variantId);
            this.disabled = false;
          } else {
            window.location.href = getComparatorPageUrl();
          }
          return;
        }
        this.disabled = true;
        this.classList.add('is-loading');
        await addToComparator(variantId, productHandle);
        this.disabled = false;
        this.classList.remove('is-loading');
      });
    });
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  async function init() {
    injectLimitPopup();
    if (!getCustomerId()) return;

    // Step 1: Apply cached state instantly (no async wait)
    const cached = getCached();
    if (cached && cached.length > 0) {
      updateComparatorBadge(cached.length);
      cached.forEach(({ variantId, productHandle }) => {
        if (variantId)     updateButtonState(variantId, true);
        if (productHandle) applyStateToHandle(productHandle, true);
      });
    }

    // Step 2: Fetch fresh from backend and sync all buttons
    await syncAllButtonStates(true);
    bindCompareButtons();
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  window.GunloupeComparator = {
    add:         addToComparator,
    remove:      removeFromComparator,
    getItems:    getComparatorItems,
    sync:        syncAllButtonStates,
    bindButtons: bindCompareButtons,
    clearCache,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
