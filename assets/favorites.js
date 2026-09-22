// favorites.js
// Gunloupe — Favorites
// Uses backend API (shopify-gunloupe.addwebprojects.com) to read/write
// customer metafield custom.favorites_items

(function () {
  const BACKEND_URL = 'https://shopify-gunloupe.addwebprojects.com';
  const CACHE_KEY = 'gunloupe_favorites_cache';
  const CACHE_TTL = 30000; // 30 seconds

  // ─── Get customer ID ──────────────────────────────────────────────────────
  // In theme.liquid inside {% if customer %} add:
  // <meta name="customer-id" content="{{ customer.id }}">
  function getCustomerId() {
    const meta = document.querySelector('meta[name="customer-id"]');
    return meta ? meta.content : null;
  }

  // ─── Session cache ────────────────────────────────────────────────────────

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
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ items, ts: Date.now() }));
    } catch {}
  }

  function clearCache() {
    try { sessionStorage.removeItem(CACHE_KEY); } catch {}
  }

  // ─── Fetch with retry ─────────────────────────────────────────────────────

  async function fetchWithRetry(url, options = {}, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(url, options);
        if (res.ok) return res;
        if (res.status >= 400 && res.status < 500) return res;
      } catch (e) {
        if (i === retries - 1) throw e;
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, i)));
      }
    }
  }

  // ─── Read favorites from backend ──────────────────────────────────────────

  async function getFavoriteItems(forceRefresh = false) {
    const customerId = getCustomerId();
    if (!customerId) return [];

    if (!forceRefresh) {
      const cached = getCached();
      if (cached !== null) return cached;
    }

    try {
      const res = await fetchWithRetry(`${BACKEND_URL}/favorites/${customerId}`);
      const data = await res.json();
      const items = data.success ? (data.items || []) : [];
      setCache(items);
      return items;
    } catch (e) {
      console.error('Favorites: GET error', e);
      try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (raw) return JSON.parse(raw).items || [];
      } catch {}
      return [];
    }
  }

  // ─── Save favorites to backend ────────────────────────────────────────────

  async function saveFavoriteItems(items) {
    const customerId = getCustomerId();
    if (!customerId) return false;

    setCache(items);

    try {
      const res = await fetchWithRetry(`${BACKEND_URL}/favorites/${customerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!data.success) {
        clearCache();
        return false;
      }
      return true;
    } catch (e) {
      console.error('Favorites: POST error', e);
      clearCache();
      return false;
    }
  }

  // ─── Add to favorites ─────────────────────────────────────────────────────

  async function addToFavorites(favData) {
    const items = await getFavoriteItems();

    // Already in list → remove (toggle off)
    if (items.find(i => i.productHandle === favData.productHandle && i.title === favData.title)) {
      return removeFromFavorites(favData.productHandle, favData.title);
    }

    items.push(favData);
    const saved = await saveFavoriteItems(items);

    if (saved) {
      updateButtonState(favData.productHandle, favData.title, true);
      updateFavoritesBadge(items.length);
    }
    return saved;
  }

  // ─── Remove from favorites ────────────────────────────────────────────────

  async function removeFromFavorites(productHandle, title = null) {
    let items = await getFavoriteItems();

    if (title) {
      // Remove specific variant entry (matched by handle + title)
      items = items.filter(i => !(i.productHandle === productHandle && i.title === title));
    } else {
      // Remove all entries for this product handle
      items = items.filter(i => i.productHandle !== productHandle);
    }

    const saved = await saveFavoriteItems(items);
    if (saved) {
      updateButtonState(productHandle, title, false);
      updateFavoritesBadge(items.length);
    }
    return saved;
  }

  // ─── Update button visual state ───────────────────────────────────────────

  function updateButtonState(productHandle, title, isAdded) {
    document.querySelectorAll(`[data-fav-handle="${productHandle}"]`).forEach(btn => {
      // If button has a title attribute, only update if titles match
      const btnTitle = btn.dataset.favTitle;
      if (btnTitle && title && btnTitle !== title) return;

      const addText = btn.querySelector('[data-fav-text="add"]');
      const removeText = btn.querySelector('[data-fav-text="remove"]');

      if (isAdded) {
        btn.classList.add('is-active');
        if (addText) addText.style.display = 'none';
        if (removeText) removeText.style.display = '';
      } else {
        btn.classList.remove('is-active');
        if (addText) addText.style.display = '';
        if (removeText) removeText.style.display = 'none';
      }
    });
  }

  // ─── Sync all button states ───────────────────────────────────────────────

  async function syncAllButtonStates() {
    const items = await getFavoriteItems();
    updateFavoritesBadge(items.length);

    document.querySelectorAll('[data-fav-handle]').forEach(btn => {
      const handle = btn.dataset.favHandle;
      const btnTitle = btn.dataset.favTitle || null;

      let isAdded;
      if (btnTitle) {
        isAdded = items.some(i => i.productHandle === handle && i.title === btnTitle);
      } else {
        isAdded = items.some(i => i.productHandle === handle);
      }

      const addText = btn.querySelector('[data-fav-text="add"]');
      const removeText = btn.querySelector('[data-fav-text="remove"]');

      if (isAdded) {
        btn.classList.add('is-active');
        if (addText) addText.style.display = 'none';
        if (removeText) removeText.style.display = '';
      } else {
        btn.classList.remove('is-active');
        if (addText) addText.style.display = '';
        if (removeText) removeText.style.display = 'none';
      }
    });
  }

  // ─── Update nav badge ─────────────────────────────────────────────────────

  function updateFavoritesBadge(count) {
    document.querySelectorAll('.favorites-nav-badge').forEach(badge => {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
    });
  }

  // ─── Bind favorite buttons ────────────────────────────────────────────────

  function bindFavoriteButtons() {
    document.querySelectorAll('[data-fav-handle]').forEach(btn => {
      if (btn.dataset.favBound) return;
      btn.dataset.favBound = '1';

      btn.addEventListener('click', async function () {
        const handle = this.dataset.favHandle;
        const title = this.dataset.favTitle || null;

        if (!handle) return;

        // Check if already added
        const items = await getFavoriteItems();
        const isAdded = title
          ? items.some(i => i.productHandle === handle && i.title === title)
          : items.some(i => i.productHandle === handle);

        this.disabled = true;

        if (isAdded) {
          await removeFromFavorites(handle, title);
        } else {
          const favData = {
            productHandle: handle,
            variantId: this.dataset.favVariantId || '',
            title: this.dataset.favProductTitle || title || handle,
            brand: this.dataset.favBrand || '',
            barrel: this.dataset.favBarrel || '',
            model: this.dataset.favModel || '',
            image: this.dataset.favImage || '',
            price: this.dataset.favPrice || '',
            type: this.dataset.favType || '',
            subtype: this.dataset.favSubtype || '',
            category: this.dataset.favCategory || '',
            status: this.dataset.favStatus || '',
          };
          await addToFavorites(favData);
        }

        this.disabled = false;
      });
    });
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  async function init() {
    const customerId = getCustomerId();
    if (!customerId) return;

    // Step 1: Apply cached state instantly
    const cached = getCached();
    if (cached !== null && cached.length > 0) {
      updateFavoritesBadge(cached.length);
      cached.forEach(({ productHandle, title }) => updateButtonState(productHandle, title, true));
    }

    // Step 2: Fetch fresh + sync all buttons
    await syncAllButtonStates();

    // Step 3: Bind click handlers
    bindFavoriteButtons();
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  window.GunloupeFavorites = {
    add: addToFavorites,
    remove: removeFromFavorites,
    getItems: getFavoriteItems,
    sync: syncAllButtonStates,
    bindButtons: bindFavoriteButtons,
    clearCache,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
