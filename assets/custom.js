// header JS
document.addEventListener("DOMContentLoaded", () => {
  const settingsBtn = document.getElementById("settingsToggle");
  const userBtn = document.getElementById("userToggle");

  const settingsPopup = document.getElementById("settingsPopup");
  const userPopup = document.getElementById("userPopup");

  const menuBtn = document.getElementById("menuToggle");
  const drawer = document.getElementById("mobileDrawer");
  const closeBtn = document.getElementById("closeDrawer");

  const isDesktop = window.matchMedia("(min-width: 1024px)").matches;

  // =========================
  // DESKTOP → HOVER
  // =========================
  if (isDesktop) {
    // SETTINGS HOVER
    settingsBtn?.addEventListener("mouseenter", () => {
      settingsPopup?.classList.remove("hidden");
      userPopup?.classList.add("hidden");
    });

    settingsBtn?.addEventListener("mouseleave", () => {
      setTimeout(() => {
        if (!settingsPopup?.matches(":hover")) {
          settingsPopup?.classList.add("hidden");
        }
      }, 150);
    });

    settingsPopup?.addEventListener("mouseleave", () => {
      settingsPopup.classList.add("hidden");
    });

    // USER HOVER
    userBtn?.addEventListener("mouseenter", () => {
      userPopup?.classList.remove("hidden");
      settingsPopup?.classList.add("hidden");
    });

    userBtn?.addEventListener("mouseleave", () => {
      setTimeout(() => {
        if (!userPopup?.matches(":hover")) {
          userPopup?.classList.add("hidden");
        }
      }, 150);
    });

    userPopup?.addEventListener("mouseleave", () => {
      userPopup.classList.add("hidden");
    });
  }

  // =========================
  // MOBILE → CLICK
  // =========================
  else {
    settingsBtn?.addEventListener("click", () => {
      settingsPopup?.classList.toggle("hidden");
      userPopup?.classList.add("hidden");
    });

    userBtn?.addEventListener("click", () => {
      userPopup?.classList.toggle("hidden");
      settingsPopup?.classList.add("hidden");
    });

    // Click outside close (only mobile)
    document.addEventListener("click", (e) => {
      if (
        !e.target.closest("#settingsToggle") &&
        !e.target.closest("#settingsPopup")
      ) {
        settingsPopup?.classList.add("hidden");
      }

      if (!e.target.closest("#userToggle") && !e.target.closest("#userPopup")) {
        userPopup?.classList.add("hidden");
      }
    });
  }

  // =========================
  // MOBILE DRAWER (always click)
  // =========================
  menuBtn?.addEventListener("click", () => {
    drawer?.classList.add("open");
  });

  closeBtn?.addEventListener("click", () => {
    drawer?.classList.remove("open");
  });
});
// header JS

/**
 * ============================================================
 * Gunloupe — Post-Login Account Type Selection
 * File: login-entry.js
 *
 * New flow (replaces dropdown approach):
 * - After login, if customer has no user_type metafield set,
 *   a full-screen blocking overlay is shown (rendered server-side
 *   by Liquid in theme.liquid before JS loads).
 * - User selects Private or Business — cannot proceed without selecting.
 * - Selection is saved to customer metafield via backend API.
 * - Overlay is removed and page reloads to show correct nav.
 * - Returning users who already have a type skip this entirely.
 * - No cookie dependency. No localStorage bridge.
 * ============================================================
 */

(function () {
  /* ──────────────────────────────────────────────
     HANDLE POST-LOGIN OVERLAY
     Runs on every page load.
     Only acts when overlay is present in DOM
     (which only happens when Liquid detects user_type is blank).
  ────────────────────────────────────────────── */

  function handleUserTypeOverlay() {
    const overlay = document.getElementById("gl-user-type-overlay");
    if (!overlay) return; // No overlay = user already has type, nothing to do

    window.addEventListener("popstate", function () {
      window.location.replace(window.location.href);
    });

    // Intercept any link clicks on the page behind the overlay
    document.addEventListener(
      "click",
      function (e) {
        const link = e.target.closest("a[href]");
        if (!link) return;
        // Allow clicks inside the overlay panel itself
        if (overlay.contains(link)) return;
        e.preventDefault();
        e.stopPropagation();
      },
      true,
    ); // capture phase — fires before any other handler

    const customerId = window.gl_customer_id;
    if (!customerId) return;

    const cards = overlay.querySelectorAll(".gl-type-card");
    const confirmBtn = overlay.querySelector("#gl-type-confirm");
    const loadingEl = overlay.querySelector("#gl-type-loading");
    const errorEl = overlay.querySelector("#gl-type-error");

    let selectedType = null;

    // ── Card selection ──
    cards.forEach(function (card) {
      card.addEventListener("click", function () {
        cards.forEach(function (c) {
          c.classList.remove("is-selected");
        });
        card.classList.add("is-selected");
        selectedType = card.dataset.type;
        if (confirmBtn) {
          confirmBtn.removeAttribute("disabled");
          confirmBtn.classList.remove("is-disabled");
        }
      });
    });

    // ── "Ver detalles" toggle (mobile only, issue #103 follow-up) ──
    // Independent of card selection above: this only expands/collapses the
    // feature checklist. stopPropagation() keeps the click from also
    // bubbling up and triggering the card's own selection handler.
    // Accordion: expanding one collapses the other, at most one open at a time.
    const featureToggles = overlay.querySelectorAll("[data-toggle-features]");
    function collapseOtherToggles(except) {
      featureToggles.forEach(function (t) {
        if (t === except) return;
        t.setAttribute("aria-expanded", "false");
        const c = t.closest(".gl-type-card");
        if (c) c.classList.remove("is-expanded");
      });
    }
    featureToggles.forEach(function (toggle) {
      function activateToggle(e) {
        e.preventDefault();
        e.stopPropagation();
        const card = toggle.closest(".gl-type-card");
        if (!card) return;
        const willExpand = !card.classList.contains("is-expanded");
        collapseOtherToggles(toggle);
        card.classList.toggle("is-expanded", willExpand);
        toggle.setAttribute("aria-expanded", String(willExpand));
      }
      toggle.addEventListener("click", activateToggle);
      toggle.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") activateToggle(e);
      });
    });

    // ── Confirm button ──
    if (confirmBtn) {
      confirmBtn.addEventListener("click", async function () {
        if (!selectedType) return;

        // Show loading state
        confirmBtn.setAttribute("disabled", "disabled");
        if (loadingEl) loadingEl.style.display = "flex";
        if (errorEl) errorEl.style.display = "none";

        try {
          const res = await fetch(
            "https://shopify-gunloupe.addwebprojects.com/customer-user-type/" +
              customerId,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userType: selectedType,
                email: window.gl_customer_email || "",
                firstName: window.gl_customer_first || "",
                lastName: window.gl_customer_last || "",
              }),
            },
          );
          const data = await res.json();

          if (data.success) {
            overlay.style.opacity = "0";
            overlay.style.transition = "opacity 0.3s ease";
            setTimeout(function () {
              overlay.remove();
              document.body.style.overflow = "";
              // Both types now land on the profile page — business mandatory, private optional
              const isEN =
                window.GunloupeRoutes && window.GunloupeRoutes.prefix === "/en";
              window.location.href = isEN
                ? "/en/pages/edit-profile"
                : "/pages/editar-perfil";
            }, 300);
          } else {
            throw new Error(data.error || "Save failed");
          }
        } catch (err) {
          console.error("[Gunloupe] User type save error:", err);
          if (loadingEl) loadingEl.style.display = "none";
          if (errorEl) errorEl.style.display = "block";
          confirmBtn.removeAttribute("disabled");
        }
      });
    }
  }

  /* ──────────────────────────────────────────────
     INIT
  ────────────────────────────────────────────── */
  document.addEventListener("DOMContentLoaded", function () {
    handleUserTypeOverlay();
  });
})();

// ctmhig custom js
function initCustomMobileSlider() {
  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  if (!isMobile) return;

  const wrapper = document.querySelector(".gird-height-full.ctmhigh");
  if (!wrapper) return;

  if (wrapper.classList.contains("slider-initialized")) return;
  wrapper.classList.add("slider-initialized");

  const slider = wrapper.querySelector(".mobile-column");
  if (!slider) return;

  /* =========================
     👉 CREATE ARROWS
  ========================== */
  const nav = document.createElement("div");
  nav.className = "ctm-slider-nav";

  const prevBtn = document.createElement("button");
  prevBtn.className = "ctm-prev";
  prevBtn.innerHTML = "‹";

  const nextBtn = document.createElement("button");
  nextBtn.className = "ctm-next";
  nextBtn.innerHTML = "›";

  nav.append(prevBtn, nextBtn);
  wrapper.appendChild(nav);

  /* =========================
     👉 SCROLL HELPER
     Uses scrollTo with exact index instead of scrollBy
     — much more reliable on Safari/Chrome mobile
  ========================== */
  let currentIndex = 0;

  function getItemWidth() {
    const firstItem = slider.children[0];
    if (!firstItem) return slider.offsetWidth;
    // includes margin/gap if any
    return firstItem.getBoundingClientRect().width;
  }

  function getTotalItems() {
    return slider.children.length;
  }

  function scrollToIndex(index) {
    const total = getTotalItems();
    // Clamp index
    currentIndex = Math.max(0, Math.min(index, total - 1));

    const itemWidth = getItemWidth();
    const targetLeft = itemWidth * currentIndex;

    // Force scroll — works across Safari, Chrome mobile
    slider.style.scrollBehavior = "auto"; // reset first
    requestAnimationFrame(() => {
      slider.style.scrollBehavior = "smooth";
      slider.scrollLeft = targetLeft;

      // Fallback for Safari where scrollLeft assignment may be ignored
      if (Math.abs(slider.scrollLeft - targetLeft) > 5) {
        slider.scrollTo({ left: targetLeft, behavior: "smooth" });
      }
    });
  }

  /* =========================
     👉 AUTO SCROLL
  ========================== */
  let autoScroll = null;

  function startAutoScroll() {
    stopAutoScroll();
    autoScroll = setInterval(() => {
      const total = getTotalItems();
      const next = currentIndex + 1 >= total ? 0 : currentIndex + 1;
      scrollToIndex(next);
    }, 3000);
  }

  function stopAutoScroll() {
    if (autoScroll) {
      clearInterval(autoScroll);
      autoScroll = null;
    }
  }

  /* =========================
     👉 ARROW CLICK
     Stop auto-scroll on manual nav
  ========================== */
  nextBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    stopAutoScroll();
    const total = getTotalItems();
    const next = currentIndex + 1 >= total ? 0 : currentIndex + 1;
    scrollToIndex(next);
  });

  prevBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    stopAutoScroll();
    const prev = currentIndex - 1 < 0 ? getTotalItems() - 1 : currentIndex - 1;
    scrollToIndex(prev);
  });

  /* =========================
     👉 DRAG SUPPORT (mouse)
  ========================== */
  let isDown = false;
  let startX;
  let scrollLeftStart;

  slider.addEventListener("mousedown", (e) => {
    isDown = true;
    stopAutoScroll();
    startX = e.pageX - slider.offsetLeft;
    scrollLeftStart = slider.scrollLeft;
    slider.style.cursor = "grabbing";
  });

  slider.addEventListener("mouseleave", () => {
    isDown = false;
    slider.style.cursor = "";
  });

  slider.addEventListener("mouseup", () => {
    isDown = false;
    slider.style.cursor = "";
    snapToNearest(); // snap after drag release
  });

  slider.addEventListener("mousemove", (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - slider.offsetLeft;
    const walk = (x - startX) * 1.5;
    slider.scrollLeft = scrollLeftStart - walk;
  });

  /* =========================
     👉 SNAP TO NEAREST after touch/drag
  ========================== */
  function snapToNearest() {
    const itemWidth = getItemWidth();
    if (!itemWidth) return;
    const nearest = Math.round(slider.scrollLeft / itemWidth);
    currentIndex = Math.max(0, Math.min(nearest, getTotalItems() - 1));
    scrollToIndex(currentIndex);
  }

  /* =========================
     👉 TOUCH SUPPORT
  ========================== */
  slider.addEventListener("touchstart", () => stopAutoScroll(), {
    passive: true,
  });

  slider.addEventListener(
    "touchend",
    () => {
      // small delay to let native scroll settle before snapping
      setTimeout(snapToNearest, 50);
    },
    { passive: true },
  );

  /* =========================
     👉 SYNC INDEX on native scroll
     (handles swipe or scroll-snap CSS)
  ========================== */
  slider.addEventListener(
    "scroll",
    () => {
      const itemWidth = getItemWidth();
      if (!itemWidth) return;
      currentIndex = Math.round(slider.scrollLeft / itemWidth);
    },
    { passive: true },
  );

  /* =========================
     👉 START
  ========================== */
  startAutoScroll();
}

/* =========================
   👉 INIT (Shopify Safe)
========================= */
document.addEventListener("DOMContentLoaded", initCustomMobileSlider);
document.addEventListener("shopify:section:load", initCustomMobileSlider);

// ctmhig custom js

/* ---------- SCROLL SPY (NO SKIP) ---------- */

document.addEventListener("DOMContentLoaded", function () {
  const main = document.querySelector('main[data-template="product"]');
  if (!main) return;

  const HEADER_OFFSET = 115;
  const tocLinks = main.querySelectorAll(".toc_link");
  if (!tocLinks.length) return;

  const sections = [];
  let isClickScrolling = false;

  // Map sections using the section element itself (not h2)
  tocLinks.forEach((link) => {
    const id = link.getAttribute("href");
    const section = main.querySelector(id);
    if (section) {
      sections.push({
        id: id.replace("#", ""),
        el: section,
      });
    }
  });

  // CLICK HANDLER
  tocLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      isClickScrolling = true;

      tocLinks.forEach((l) => l.classList.remove("active"));
      link.classList.add("active");

      const target = main.querySelector(link.getAttribute("href"));
      if (!target) return;

      const y =
        target.getBoundingClientRect().top + window.pageYOffset - HEADER_OFFSET;

      window.scrollTo({ top: y, behavior: "smooth" });

      setTimeout(() => {
        isClickScrolling = false;
      }, 800);
    });
  });

  // SCROLL SPY — viewport 50% trigger + last section support
  function onScroll() {
    if (isClickScrolling) return;

    const scrollY = window.pageYOffset;
    const windowHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;

    // Check if near bottom of page — activate last section
    const isAtBottom = scrollY + windowHeight >= docHeight - 50;

    if (isAtBottom) {
      tocLinks.forEach((l) => l.classList.remove("active"));
      const lastLink = main.querySelector(
        `.toc_link[href="#${sections[sections.length - 1].id}"]`,
      );
      lastLink?.classList.add("active");
      return;
    }

    // Find which section covers 50% of the viewport
    const triggerPoint = scrollY + HEADER_OFFSET + windowHeight * 0.5;

    let current = null;

    sections.forEach((section) => {
      const sectionTop = section.el.getBoundingClientRect().top + scrollY;
      const sectionBottom = sectionTop + section.el.offsetHeight;

      if (sectionTop <= triggerPoint && sectionBottom > sectionTop) {
        current = section;
      }
    });

    // Fallback: use last section whose top is above trigger
    if (!current) {
      for (let i = sections.length - 1; i >= 0; i--) {
        const sectionTop = sections[i].el.getBoundingClientRect().top + scrollY;
        if (sectionTop <= triggerPoint) {
          current = sections[i];
          break;
        }
      }
    }

    if (current) {
      tocLinks.forEach((l) => l.classList.remove("active"));
      const activeLink = main.querySelector(`.toc_link[href="#${current.id}"]`);
      activeLink?.classList.add("active");
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });

  // Run once on load to set initial active state
  onScroll();
});

// --------------------------- END OF TOC FOR PRODUCT DETAIL PAGE -----------------------------------

// ------------------- Blog filter Tab UI ----------------------
document.addEventListener("DOMContentLoaded", function () {
  const buttons = document.querySelectorAll(".tab-btn");
  const cards = document.querySelectorAll(".resource-list__item");

  buttons.forEach((button) => {
    button.addEventListener("click", function () {
      // Active state
      buttons.forEach((btn) => btn.classList.remove("active"));
      this.classList.add("active");

      const selectedTag = this.dataset.tag;

      cards.forEach((card) => {
        if (selectedTag === "all") {
          card.style.display = "block";
        } else {
          const tags = card.dataset.tags;
          if (tags.includes(selectedTag)) {
            card.style.display = "block";
          } else {
            card.style.display = "none";
          }
        }
      });
    });
  });
});

// ------------------- Blog filter Tab UI ----------------------

// open sidebar in on mobile

// document.addEventListener('DOMContentLoaded', function () {
//   const openBtn = document.getElementById('open-filter');
//   const closeBtn = document.getElementById('filters-sidebar-close');
//   const sidebar = document.querySelector('.filters-sidebar');

//   if (!sidebar) return;

//   // Open sidebar
//   if (openBtn) {
//     openBtn.addEventListener('click', function () {
//       sidebar.classList.add('open-sidebar');
//     });
//   }

//   // Close sidebar
//   if (closeBtn) {
//     closeBtn.addEventListener('click', function () {
//       sidebar.classList.remove('open-sidebar');
//     });
//   }
// });

document.addEventListener("DOMContentLoaded", function () {
  const input = document.getElementById("purchaseDate");

  if (input) {
    const today = new Date().toISOString().split("T")[0];
    input.setAttribute("max", today);
  }
});

document.addEventListener("DOMContentLoaded", function () {
  const input = document.getElementById("ad-purchase-date");

  if (input) {
    const today = new Date().toISOString().split("T")[0];
    input.setAttribute("max", today);
  }
});

// open sidebar in on mobile

//--------------------------- PRODUCT LISTING FILTER JS ----------------------------------//

document.addEventListener("DOMContentLoaded", function () {
  buildActiveFiltersUI(new URLSearchParams(window.location.search));

  const grid = document.querySelector("#productGrid");
  const loadTrigger = document.querySelector("#loadMoreTrigger");
  const sidebar = document.querySelector(".filters-sidebar");

  if (!grid || !sidebar) return;

  let page = 2;
  let loading = false;

  // ================= ACCORDION =================
  function closeAll() {
    document
      .querySelectorAll(".filter-group")
      .forEach((group) => group.classList.remove("open"));
  }

  document.addEventListener("click", function (e) {
    const toggleBtn = e.target.closest(".filter-toggle, .filter-arrow");

    if (toggleBtn) {
      if (e.target.closest(".filter-arrow")) {
        e.preventDefault();
        e.stopPropagation();
      }

      const parent = toggleBtn.closest(".filter-group");
      if (!parent) return;

      const isOpen = parent.classList.contains("open");

      document
        .querySelectorAll(".filter-group")
        .forEach((group) => group.classList.remove("open"));

      if (!isOpen) {
        parent.classList.add("open");
      }
    }
  });

  // Open search dropdown on focus
  document.addEventListener("focusin", function (e) {
    if (e.target.classList.contains("filter-search")) {
      const parent = e.target.closest(".filter-group");
      closeAll();
      parent.classList.add("open");
    }
  });

  // ================= FILTER APPLY (AJAX) =================
  document.addEventListener("change", function (e) {
    if (e.target.closest(".filters-sidebar")) {
      if (e.target.type === "checkbox") {
        const li = e.target.closest("li");
        if (li) li.classList.toggle("is-active", e.target.checked);
      }

      // MOBILE: defer — View Results button applies filters
      if (window.matchMedia("(max-width: 767px)").matches) return;

      applyFilters();
    }
  });

  function syncActiveClasses() {
    document
      .querySelectorAll(".filters-sidebar input[type='checkbox']")
      .forEach((input) => {
        const li = input.closest("li");
        if (li) {
          li.classList.toggle("is-active", input.checked);
        }
      });
  }

  function applyFilters() {
    // ✅ KEEP existing params (including price)
    const params = new URLSearchParams(window.location.search);

    // ❗ Remove old checkbox params first
    document
      .querySelectorAll(".filters-sidebar input[type='checkbox']")
      .forEach((input) => {
        params.delete(input.name);
      });

    // ✅ Add checked ones
    document
      .querySelectorAll(".filters-sidebar input:checked")
      .forEach((input) => {
        params.append(input.name, input.value);
      });

    const newUrl = window.location.pathname + "?" + params.toString();

    history.replaceState(null, "", newUrl);

    buildActiveFiltersUI(params);

    // When a text search (?q=) is active, weapons-collection.liquid's own
    // script owns re-fetching #productGrid (via /search, which actually
    // honors q). Fetching the plain collection URL here would ignore q and
    // clobber those correct results with an unfiltered-by-search listing —
    // hand off to that script's own re-search instead.
    if (params.get("q")) {
      if (window.GunloupeRunSearch) window.GunloupeRunSearch();
      return;
    }

    fetch(newUrl)
      .then((res) => res.text())
      .then((html) => {
        const doc = new DOMParser().parseFromString(html, "text/html");

        const newGrid = doc.querySelector("#productGrid");
        const newSidebar = doc.querySelector(".filters-sidebar");

        if (newGrid) {
          grid.innerHTML = newGrid.innerHTML;
        }

        if (newSidebar) {
          const currentSidebar = document.querySelector(".filters-sidebar");
          currentSidebar.innerHTML = newSidebar.innerHTML;

          // ✅ ADD THIS
          if (window.GunloupeFilters && window.GunloupeFilters.init) {
            window.GunloupeFilters.init();
          }
        }

        page = 2;
      });
  }

  // ================= ACTIVE FILTER CHIPS =================
  function buildActiveFiltersUI(params) {
    const container = document.querySelector("#activeFilters");
    if (!container) return;

    container.innerHTML = "";

    params.forEach((value, key) => {
      // Only handle filter params
      if (!key.includes("filter.")) return;

      // Find matching checkbox
      const input = document.querySelector(
        `.filters-sidebar input[name="${key}"][value="${CSS.escape(value)}"]`,
      );

      if (!input) return;

      // Get filter label
      const filterGroup = input.closest(".filter-group");
      let filterLabel = "";

      if (filterGroup) {
        const title = filterGroup.querySelector(".filter-title span");
        if (title) {
          filterLabel = title.textContent.trim();
        }
      }

      const chip = document.createElement("span");
      chip.className = "filter-chip";

      chip.innerHTML = `
        <strong>${filterLabel}:</strong> ${value}
        <button data-key="${key}" data-value="${value}">×</button>
      `;

      container.appendChild(chip);
    });

    // ─── PRICE FILTER CHIP ─────────────────────────────
    const gte = params.get("filter.v.price.gte");
    const lte = params.get("filter.v.price.lte");

    if (gte || lte) {
      let label = "Price";
      let valueText = "";

      if (gte && lte) {
        valueText = `${gte} – ${lte}`;
      } else if (gte) {
        label = "Price From";
        valueText = gte;
      } else if (lte) {
        valueText = lte;
      }

      const chip = document.createElement("span");
      chip.className = "filter-chip";

      chip.innerHTML = `
        <strong>${label}:</strong> ${valueText}
        <button class="remove-price">×</button>
      `;

      container.appendChild(chip);
    }
  }

  document.addEventListener("click", function (e) {
    if (e.target.matches(".filter-chip button")) {
      const key = e.target.dataset.key;
      const value = e.target.dataset.value;

      const checkbox = document.querySelector(
        `input[name="${key}"][value="${value}"]`,
      );

      if (checkbox) {
        checkbox.checked = false;
        // Programmatic .checked doesn't fire a native "change" event, so the
        // sidebar's own change-listener (which normally toggles this) never
        // runs — do it here too, or the option stays visually highlighted.
        const li = checkbox.closest("li");
        if (li) li.classList.remove("is-active");
        // Same reason: refresh the dropdown's own "(1) Rifle" summary label,
        // since the group's change-listener that normally does this won't fire.
        if (window.GunloupeUpdateFilterGroupUI) {
          window.GunloupeUpdateFilterGroupUI(checkbox.closest(".filter-group"));
        }
        applyFilters();
      }
    }

    // REMOVE PRICE FILTER
    if (e.target.matches(".remove-price")) {
      const params = new URLSearchParams(window.location.search);

      params.delete("filter.v.price.gte");
      params.delete("filter.v.price.lte");

      const newUrl =
        window.location.pathname +
        (params.toString() ? "?" + params.toString() : "");

      window.location.href = newUrl;
    }
  });

  // ================= INFINITE SCROLL =================
  if (loadTrigger) {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loading) {
        loadMore();
      }
    });

    observer.observe(loadTrigger);
  }

  function loadMore() {
    loading = true;

    const currentParams = new URLSearchParams(window.location.search);
    currentParams.set("page", page);

    fetch(window.location.pathname + "?" + currentParams.toString())
      .then((res) => res.text())
      .then((html) => {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const items = doc.querySelectorAll("#productGrid .resource-list__item");

        items.forEach((item) => {
          grid.appendChild(item);
        });

        page++;
        loading = false;
      });
  }

  // ================= SEARCH INSIDE DROPDOWN =================
  document.addEventListener("input", function (e) {
    if (e.target.classList.contains("filter-search")) {
      const search = e.target.value.toLowerCase();

      const filterGroup = e.target.closest(".filter-group");
      const listItems = filterGroup.querySelectorAll(".filter-content li");

      listItems.forEach((li) => {
        li.style.display = li.textContent.toLowerCase().includes(search)
          ? ""
          : "none";
      });
    }
  });
});

//--------------------------- PRODUCT LISTING FILTER JS ----------------------------------//

//--------------------------- Adver product sldier -------------------------------------- //

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".gun-card__media").forEach((card) => {
    const slider = card.querySelector("[data-slider]");
    const slides = slider.querySelectorAll(".gun-slide");
    const prevBtn = card.querySelector(".gun-prev");
    const nextBtn = card.querySelector(".gun-next");

    let index = 0;
    const total = slides.length;
    let interval;

    // Hide buttons if only 1 slide
    if (total <= 1) {
      card.classList.add("single");
      return;
    }

    function updateSlider() {
      slider.style.transform = `translateX(-${index * 100}%)`;
    }

    function nextSlide() {
      index = (index + 1) % total;
      updateSlider();
    }

    function prevSlide() {
      index = (index - 1 + total) % total;
      updateSlider();
    }

    // 👉 Auto slide start
    function startAutoSlide() {
      interval = setInterval(nextSlide, 2000); // 3 sec
    }

    // 👉 Stop auto slide
    function stopAutoSlide() {
      clearInterval(interval);
    }

    // Buttons
    nextBtn.addEventListener("click", () => {
      nextSlide();
      restartAuto();
    });

    prevBtn.addEventListener("click", () => {
      prevSlide();
      restartAuto();
    });

    function restartAuto() {
      stopAutoSlide();
      startAutoSlide();
    }

    // 👉 Pause on hover (desktop UX)
    card.addEventListener("mouseenter", stopAutoSlide);
    card.addEventListener("mouseleave", startAutoSlide);

    // 👉 Pause on touch (mobile UX)
    card.addEventListener("touchstart", stopAutoSlide);
    card.addEventListener("touchend", startAutoSlide);

    // Init
    startAutoSlide();
  });
});
//--------------------------- Adver product sldier -------------------------------------- //

//--------------------------- Advert Popup open/close -------------------------------------- //

// document.addEventListener('DOMContentLoaded', () => {

//   const popup = document.querySelector('.ad-popup-overlay');

//   // Open
//   document.querySelectorAll('.open-ad-popup').forEach(btn => {
//     btn.addEventListener('click', () => {
//       popup.style.display = 'flex';
//     });
//   });

//   // Close (cancel button or overlay click)
//   document.querySelector('.btn-cancel')?.addEventListener('click', () => {
//     popup.style.display = 'none';
//   });

//    // Close (cancel button or overlay click)
//   document.querySelector('.btn-cancel-cross')?.addEventListener('click', () => {
//     popup.style.display = 'none';
//   });

//   popup?.addEventListener('click', (e) => {
//     if (e.target.classList.contains('ad-popup-overlay')) {
//       popup.style.display = 'none';
//     }
//   });

// });
//--------------------------- Advert Popup open/close -------------------------------------- //

document.addEventListener("DOMContentLoaded", function () {
  const hamburger = document.querySelector(".classifieds-filter-label");
  const popup = document.querySelector(".filter-tabs");
  const closeBtn = document.getElementById("closeDrawer2");

  // ✅ Required guard
  if (!hamburger || !popup) {
    return;
  }

  function isMobile() {
    return window.matchMedia("(max-width: 768px)").matches;
  }

  function openDrawer() {
    if (!isMobile()) return;

    popup.classList.add("is-open");
    document.documentElement.classList.add("overflow-locked");
    document.body.classList.add("overflow-locked");
  }

  function closeDrawer() {
    popup.classList.remove("is-open");
    document.documentElement.classList.remove("overflow-locked");
    document.body.classList.remove("overflow-locked");
  }

  hamburger.addEventListener("click", function () {
    if (!isMobile()) return;

    popup.classList.contains("is-open") ? closeDrawer() : openDrawer();
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", closeDrawer);
  }

  document.addEventListener("click", function (e) {
    const option = e.target.closest(".clf-option");

    if (!option) return;

    if (popup.classList.contains("is-open") && isMobile()) {
      closeDrawer();
    }
  });

  window.addEventListener("resize", function () {
    if (!isMobile()) {
      closeDrawer();
    }
  });
});

function withLocale(url) {
  const locale = window.Shopify?.locale || "";
  if (!locale || locale === "es") return url;

  // avoid double prefix
  if (url.startsWith(`/${locale}`)) return url;

  return `/${locale}${url}`;
}

// filtersidebar close on click ------------------------------------
// ── Mobile: close sidebar on filter selection ─────────────────────────────
var sidebar = document.querySelector(".filters-sidebar");

// Close on checkbox selection
// document.addEventListener("change", function (e) {
//   if (!e.target.matches('.filter-item input[type="checkbox"]')) return;
//   if (window.innerWidth < 1024) {
//     // adjust breakpoint to match your CSS
//     if (sidebar) sidebar.classList.remove("open-sidebar");
//   }
// });

// Close on reset link click (individual filter reset)
document.addEventListener("click", function (e) {
  if (!e.target.closest(".filter-reset a")) return;
  if (window.innerWidth < 1024) {
    if (sidebar) sidebar.classList.remove("open-sidebar");
  }
});

// Close on "Reset all" button
document.addEventListener("click", function (e) {
  if (!e.target.closest(".reset-all-btn")) return;
  if (window.innerWidth < 1024) {
    if (sidebar) sidebar.classList.remove("open-sidebar");
  }
});

// ── Open filter sidebar ────────────────────────────────────────────────────
var openFilterBtn = document.getElementById("open-filter");
if (openFilterBtn) {
  openFilterBtn.addEventListener("click", function () {
    if (sidebar) sidebar.classList.add("open-sidebar");
  });
}

// ── Close filter sidebar via X button ─────────────────────────────────────
var closeFilterBtn = document.getElementById("filters-sidebar-close");
if (closeFilterBtn) {
  closeFilterBtn.addEventListener("click", function () {
    if (sidebar) sidebar.classList.remove("open-sidebar");
  });
}
// filtersidebar close on click ------------------------------------

/* ─────────────────────────────────────────
   DATE INPUT — Cross Browser Placeholder Fix
   Safari + Android Chrome both handled
   Zero impact on Windows Chrome/Firefox
───────────────────────────────────────────*/

(function () {
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isAndroid = /android/i.test(navigator.userAgent);
  const needsFix = isSafari || isAndroid;

  if (!needsFix) return;

  // ── Inject styles once ──
  const style = document.createElement("style");
  style.textContent = `
    input[type="date"].custom-input::-webkit-datetime-edit-fields-wrapper,
    input[type="date"].custom-input::-webkit-datetime-edit,
    input[type="date"].custom-input::-webkit-datetime-edit-text,
    input[type="date"].custom-input::-webkit-datetime-edit-month-field,
    input[type="date"].custom-input::-webkit-datetime-edit-day-field,
    input[type="date"].custom-input::-webkit-datetime-edit-year-field {
      color: transparent;
    }

    input[type="date"].custom-input.has-value::-webkit-datetime-edit-fields-wrapper,
    input[type="date"].custom-input.has-value::-webkit-datetime-edit,
    input[type="date"].custom-input.has-value::-webkit-datetime-edit-text,
    input[type="date"].custom-input.has-value::-webkit-datetime-edit-month-field,
    input[type="date"].custom-input.has-value::-webkit-datetime-edit-day-field,
    input[type="date"].custom-input.has-value::-webkit-datetime-edit-year-field {
      color: inherit;
    }

    .input-wrapper.ctm-date-wrapper {
      position: relative;
    }

    .input-wrapper.ctm-date-wrapper .ctm-date-placeholder {
      position: absolute;
      top: 50%;
      left: 20px;
      transform: translateY(-50%);
      color: #aaa;
      font-size: 14px;
      pointer-events: none;
      z-index: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: calc(100% - 40px);
      transition: opacity 0.15s ease;
    }

    .input-wrapper.ctm-date-wrapper.has-value .ctm-date-placeholder {
      opacity: 0;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);

  // ── Per-input setup ──
  function setupDateInput(input) {
    // Skip if already initialized
    if (input.dataset.ctmDateFixed) return;
    input.dataset.ctmDateFixed = "true";

    const wrapper = input.closest(".input-wrapper");
    if (!wrapper) return;

    wrapper.classList.add("ctm-date-wrapper");

    const placeholderText = input.getAttribute("placeholder") || "dd/mm/yyyy";
    input.removeAttribute("placeholder");

    const fakeLabel = document.createElement("span");
    fakeLabel.className = "ctm-date-placeholder";
    fakeLabel.textContent = placeholderText;
    wrapper.appendChild(fakeLabel);

    function updateState() {
      if (input.value) {
        input.classList.add("has-value");
        wrapper.classList.add("has-value");
      } else {
        input.classList.remove("has-value");
        wrapper.classList.remove("has-value");
      }
    }

    updateState();
    input.addEventListener("change", updateState);
    input.addEventListener("input", updateState);
    input.addEventListener("blur", updateState);
  }

  // ── Apply to all current inputs ──
  function applyToAll(container = document) {
    container.querySelectorAll('input[type="date"]').forEach(setupDateInput);
  }

  // ── Run on page load ──
  applyToAll();

  // ── Watch for dynamically added inputs (modals, drawers, etc.) ──
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return; // only elements

        // If the added node itself is a date input
        if (node.matches('input[type="date"].custom-input')) {
          setupDateInput(node);
        }

        // If the added node contains date inputs (e.g. a modal was injected)
        if (node.querySelectorAll) {
          node
            .querySelectorAll('input[type="date"].custom-input')
            .forEach(setupDateInput);
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
})();

// ─────────fancy box init ─────────────────────────────────────
document.addEventListener("click", function (e) {
  const link = e.target.closest("[data-fancybox]");
  if (!link) return;

  e.preventDefault();

  Fancybox.show([
    {
      src: link.href,
      type: "image",
    },
  ]);
});
