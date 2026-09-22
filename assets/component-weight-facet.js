// (function () {
//   'use strict';

//   const WEIGHT_MIN = 0;
//   const WEIGHT_MAX = 15;
//   const SECTION_ID = document.querySelector('[data-section-id]')?.dataset.sectionId || '';

//   // ── Storefront API fetch all products in collection ───────────────────────
//   // Uses Shopify's /collections/{handle}/products.json (no token needed, public)
//   async function fetchAllProductsInCollection(collectionHandle, weightMin, weightMax) {
//     let page = 1;
//     let allProducts = [];
//     let keepGoing = true;

//     while (keepGoing) {
//       const url = `/collections/${collectionHandle}/products.json?limit=250&page=${page}`;
//       const res = await fetch(url);
//       if (!res.ok) break;
//       const data = await res.json();
//       const products = data.products || [];
//       allProducts = allProducts.concat(products);
//       keepGoing = products.length === 250;
//       page++;
//     }

//     return allProducts;
//   }

//   // ── Get variant metafield values via /products/{handle}.json ─────────────
//   // Shopify's products.json doesn't include metafields, so we use
//   // the collection filter approach — read active filter values from the page
//   // and do AJAX section rendering with the correct params

//   function pct(val) {
//     return ((val - WEIGHT_MIN) / (WEIGHT_MAX - WEIGHT_MIN)) * 100;
//   }

//   function clamp(val, lo, hi) {
//     return Math.min(Math.max(parseFloat(val) || 0, lo), hi);
//   }

//   // ── Core: apply filter by reloading with correct params ───────────────────
//   function applyWeightFilter(facet, lo, hi) {
//     const minInput = facet.querySelector('[data-weight-min-input]');
//     const maxInput = facet.querySelector('[data-weight-max-input]');

//     const params = new URLSearchParams(window.location.search);

//     // Wipe ALL existing peso_kg params
//     const toDelete = [...params.keys()].filter(k => k.includes('peso_kg'));
//     toDelete.forEach(k => params.delete(k));
//     params.delete('page');

//     const isDefault = lo <= WEIGHT_MIN && hi >= WEIGHT_MAX;

//     if (!isDefault) {
//       // Read exact param names from Liquid-rendered input[name] attributes
//       const minParam = minInput?.name; // e.g. filter.v.m.custom.peso_kg.gte
//       const maxParam = maxInput?.name; // e.g. filter.v.m.custom.peso_kg.lte
//       if (minParam) params.set(minParam, lo);
//       if (maxParam) params.set(maxParam, hi);
//     }

//     const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');

//     // ── AJAX section render (same pattern as your price filter) ──────────────
//     const resultsEl = document.getElementById('ResultsList');
//     if (!resultsEl) {
//       window.location.href = newUrl;
//       return;
//     }

//     history.replaceState(null, '', newUrl);
//     resultsEl.style.opacity = '0.5';
//     resultsEl.style.pointerEvents = 'none';

//     const fetchUrl = newUrl + (newUrl.includes('?') ? '&' : '?') + 'section_id=' + SECTION_ID;

//     fetch(fetchUrl)
//       .then(r => r.text())
//       .then(html => {
//         const doc = new DOMParser().parseFromString(html, 'text/html');
//         const newResults = doc.getElementById('ResultsList');
//         const newFilters = doc.querySelector('.gl-filters');
//         if (newResults) resultsEl.innerHTML = newResults.innerHTML;
//         if (newFilters) document.querySelector('.gl-filters').innerHTML = newFilters.innerHTML;
//       })
//       .catch(() => { window.location.href = newUrl; })
//       .finally(() => {
//         resultsEl.style.opacity = '';
//         resultsEl.style.pointerEvents = '';

//         // Re-init everything after AJAX swap
//         boot();

//         // Re-open weight panel
//         const wGroup = document.querySelector('[data-price-filter]');
//         const weightGroup = document.querySelector('[data-weight-content]');
//         if (weightGroup) {
//           weightGroup.style.display = 'block';
//           const btn = weightGroup.previousElementSibling;
//           if (btn) btn.setAttribute('aria-expanded', 'true');
//         }
//       });
//   }

//   // ── Client-side product filtering after AJAX ──────────────────────────────
//   // Since Shopify's range filter for variant metafields is unreliable,
//   // after AJAX renders the new HTML we additionally hide cards that don't match
//   function clientSideFilterProducts(lo, hi) {
//     // Products rendered in ResultsList — each card has weight shown
//     // We read the data-peso attribute we'll add to each card (see note below)
//     const cards = document.querySelectorAll('[data-product-peso]');
//     if (!cards.length) return; // cards don't have data attr, skip

//     cards.forEach(card => {
//       const weights = (card.dataset.productPeso || '').split(',').map(parseFloat).filter(Boolean);
//       // Show card if ANY variant weight falls in range
//       const matches = weights.some(w => w >= lo && w <= hi);
//       card.style.display = matches ? '' : 'none';
//     });
//   }

//   // ── Init a single facet ───────────────────────────────────────────────────
//   function initWeightFacet(facet) {
//     if (facet._weightReady) return;
//     facet._weightReady = true;

//     const minInput  = facet.querySelector('[data-weight-min-input]');
//     const maxInput  = facet.querySelector('[data-weight-max-input]');
//     const sliderMin = facet.querySelector('[data-weight-slider-min]');
//     const sliderMax = facet.querySelector('[data-weight-slider-max]');
//     const rangeEl   = facet.querySelector('[data-weight-range]');
//     const labelMin  = facet.querySelector('[data-weight-label-min]');
//     const labelMax  = facet.querySelector('[data-weight-label-max]');

//     function getLo() { return parseFloat(sliderMin.value); }
//     function getHi() { return parseFloat(sliderMax.value); }

//     function updateVisuals() {
//       const lo = getLo(), hi = getHi();
//       if (rangeEl) {
//         rangeEl.style.left  = pct(lo) + '%';
//         rangeEl.style.right = (100 - pct(hi)) + '%';
//       }
//       if (labelMin) labelMin.textContent = lo + ' kg';
//       if (labelMax) labelMax.textContent = hi + ' kg';
//     }

//     function updateButtonLabel() {
//       const group = facet.closest('.filter-group');
//       if (!group) return;
//       const display = group.querySelector('[data-weight-label]');
//       const lo = getLo(), hi = getHi();
//       const isDefault = lo <= WEIGHT_MIN && hi >= WEIGHT_MAX;
//       if (display) {
//         display.style.display = isDefault ? 'none' : '';
//         if (!isDefault) display.textContent = lo + '–' + hi + ' kg';
//       }
//       group.classList.toggle('withSelectedValue', !isDefault);
//     }

//     // Slider input (drag) → update visuals only
//     sliderMin.addEventListener('input', () => {
//       let lo = getLo(), hi = getHi();
//       if (lo > hi) { lo = hi; sliderMin.value = lo; }
//       if (minInput) minInput.value = lo;
//       updateVisuals();
//     });

//     sliderMax.addEventListener('input', () => {
//       let lo = getLo(), hi = getHi();
//       if (hi < lo) { hi = lo; sliderMax.value = hi; }
//       if (maxInput) maxInput.value = hi;
//       updateVisuals();
//     });

//     // Slider change (release) → apply filter
//     sliderMin.addEventListener('change', () => {
//       updateButtonLabel();
//       applyWeightFilter(facet, getLo(), getHi());
//     });

//     sliderMax.addEventListener('change', () => {
//       updateButtonLabel();
//       applyWeightFilter(facet, getLo(), getHi());
//     });

//     // Number inputs → apply on blur/enter
//     [minInput, maxInput].forEach(input => {
//       if (!input) return;

//       input.addEventListener('keydown', (e) => {
//         if (e.metaKey || e.ctrlKey) return;
//         const ok = /^[0-9]$|^\.$/.test(e.key) ||
//           ['Backspace','Delete','Tab','Enter','Escape',
//            'ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key);
//         if (!ok) e.preventDefault();
//       });

//       input.addEventListener('change', () => {
//         let lo = clamp(minInput?.value, WEIGHT_MIN, WEIGHT_MAX);
//         let hi = clamp(maxInput?.value, WEIGHT_MIN, WEIGHT_MAX);
//         if (lo > hi) lo = hi;
//         if (minInput) { minInput.value = lo; sliderMin.value = lo; }
//         if (maxInput) { maxInput.value = hi; sliderMax.value = hi; }
//         updateVisuals();
//         updateButtonLabel();
//         applyWeightFilter(facet, lo, hi);
//       });
//     });

//     // Sync Liquid-set values → sliders on init
//     if (minInput?.value) sliderMin.value = minInput.value;
//     if (maxInput?.value) sliderMax.value = maxInput.value;

//     updateVisuals();
//     updateButtonLabel();
//   }

//   // ── Boot ──────────────────────────────────────────────────────────────────
//   function boot() {
//     document.querySelectorAll('[data-weight-facet]').forEach(initWeightFacet);
//   }

//   if (document.readyState === 'loading') {
//     document.addEventListener('DOMContentLoaded', boot);
//   } else {
//     boot();
//   }

//   window.GunloupeFilters = window.GunloupeFilters || {};
//   window.GunloupeFilters.reinitWeight = boot;

// })();