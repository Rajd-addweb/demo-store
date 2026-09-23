// customer-profile-edit.js
// Gunloupe — Edit Profile Page

(function () {
  "use strict";

  const cfg = window.__profileConfig || {};
  const API_BASE = cfg.apiBase || "https://collaboration-assumes-shed-smoke.trycloudflare.com";
  const customerId = cfg.customerId;

  // ── Copy ─────────────────────────────────────────────────────────────────
  // All text below is resolved server-side (Liquid | t, from es.json /
  // en.default.json) into cfg.fieldLabels / cfg.messages for the current
  // page's language — no locale branching needed here anymore. The English
  // literals are only a last-resort fallback if cfg is ever missing.
  function getProfileMessages() {
    const locale =
      ((cfg.locale || "en") + "").toLowerCase().indexOf("es") === 0
        ? "es"
        : "en";
    const m = cfg.messages || {};
    return {
      locale,
      labels: cfg.fieldLabels || {},
      requiredPrefix: m.requiredFieldsPrefix || "Please fill in all required fields:",
      genericError: m.genericError || "Error saving profile. Please try again.",
      savedMsg: m.savedMsg || "✓ Profile saved! Redirecting…",
      imageTooBig: m.imageTooBig || "Image must be under 5MB.",
      customerNotIdentified: m.customerNotIdentified || "Error: customer not identified.",
      phoneInvalid: m.phoneInvalid || "Phone number must be between 7 and 15 digits.",
      phoneRequired: m.phoneRequired || "Phone is required for business accounts.",
      phoneInvalidChars: m.phoneInvalidChars || "Phone number can only contain digits, spaces, and the characters + - ( ).",
      invalidDate: m.invalidDate || "Invalid date.",
      dobFuture: m.dobFuture || "Date of birth cannot be in the future.",
    };
  }

  // Prefer GunloupeRoutes (locale-aware), fall back to cfg.returnUrl, then hardcode
  function getReturnUrl() {
    // cfg.returnUrl is set by Liquid based on user_type:
    //   business → GunloupeRoutes.myAds  (locale-aware)
    //   private  → GunloupeRoutes.classified (locale-aware)
    if (cfg.returnUrl) return cfg.returnUrl;

    // Fallback if config missing for some reason
    if (isBusiness) {
      return (
        (window.GunloupeRoutes && window.GunloupeRoutes.myAdverts) ||
        "/pages/anuncios"
      );
    }
    return "/";
  }

  // ── User type ─────────────────────────────────────────────────────────────
  const userType = (
    document.getElementById("profileUserType")?.value || ""
  ).trim();
  const isBusiness = userType === "business";

  // ── DOM refs ──────────────────────────────────────────────────────────────
  const saveBtn = document.getElementById("saveProfileBtn");
  const saveMsg = document.getElementById("profileSaveMsg");
  const picInput = document.getElementById("profilePicInput");
  const avatarPreviewImg = document.getElementById("avatarPreviewImg");
  const avatarPlaceholder = document.getElementById("avatarPreviewPlaceholder");
  const avatarRemoveBtn = document.getElementById("avatarRemoveBtn");
  const avatarCircle = document.getElementById("avatarCircle");

  // Private fields
  const inFirstName = document.getElementById("editFirstName");
  const inLastName = document.getElementById("editLastName");
  const inAlias = document.getElementById("editAlias");

  // Business field
  const inShopName = document.getElementById("editShopName");

  // Shared fields
  const inPhone = document.getElementById("editPhone");
  const inAddress1 = document.getElementById("editAddress1");
  const inAddress2 = document.getElementById("editAddress2");
  const inCity = document.getElementById("editCity");
  const inCountry = document.getElementById("editCountry");
  const inZip = document.getElementById("editZip");
  const inMarketing = document.getElementById("editMarketing");
  const inAlerts = document.getElementById("editAlerts");
  const inAddressId = document.getElementById("profileAddressId");
  const inCurrentPic = document.getElementById("profileCurrentPicture");

  // ────────────────────────────────────────────────────────────────────────
  // NEW — Date of Birth & Gender fields (PRIVATE USERS ONLY)
  // ────────────────────────────────────────────────────────────────────────
  const inDateOfBirth = document.getElementById("editDateOfBirth");
  const inGender = document.getElementById("editGender");

  function attachDobPicker() {
    if (!inDateOfBirth || !window.GunloupeDatePicker) return;
    window.GunloupeDatePicker.attach(inDateOfBirth, {
      maxDate: "today",
      labels: {
        set: inDateOfBirth.dataset.datePickerSet,
        cancel: inDateOfBirth.dataset.datePickerCancel,
        clear: inDateOfBirth.dataset.datePickerClear,
      },
    });
  }
  // gunloupe-datepicker.js is deferred too, so its execution order relative
  // to this module isn't guaranteed. DOMContentLoaded only fires once every
  // deferred/module script (this one included) has finished running, so it
  // is always still pending at this point and safe to wait on here.
  document.addEventListener("DOMContentLoaded", attachDobPicker);

  const dobErrorMsg = document.getElementById("dobErrorMsg");

  function showDobError(message) {
    if (!dobErrorMsg) return;

    dobErrorMsg.textContent = message;
    dobErrorMsg.classList.add("show");
    inDateOfBirth.classList.add("profile-input--error");
  }

  function hideDobError() {
    if (!dobErrorMsg) return;

    dobErrorMsg.textContent = "";
    dobErrorMsg.classList.remove("show");
    inDateOfBirth.classList.remove("profile-input--error");
  }

  // Prevent selecting/typing a future DOB
  if (inDateOfBirth) {
    function validateFutureDOB() {
      if (!inDateOfBirth.value) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const selected = new Date(inDateOfBirth.value);
      selected.setHours(0, 0, 0, 0);

      if (selected > today) {
        showDobError(getProfileMessages().dobFuture);
        inDateOfBirth.focus();
        return;
      }
    }
    inDateOfBirth.addEventListener("input", function () {
      if (!inDateOfBirth.value) {
        hideDobError();
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const selected = new Date(inDateOfBirth.value);
      selected.setHours(0, 0, 0, 0);

      if (selected <= today) {
        hideDobError();
      }
    });
    inDateOfBirth.addEventListener("change", hideDobError);
    inDateOfBirth.addEventListener("blur", hideDobError);
    inDateOfBirth.addEventListener("change", validateFutureDOB);
    inDateOfBirth.addEventListener("blur", validateFutureDOB);
  }

  // FIX — hidden ISO country code input (populated by Liquid from addr.country_code)
  const inCountryCode = document.getElementById("profileCountryCode");

  if (!saveBtn) return;

  // Liquid can render a stale value on first login. Re-read from the API.
  (async function hydratePreferences() {
    if (!customerId) return;
    try {
      const r = await fetch(`${API_BASE}/customer-profile/${customerId}`, {
        cache: "no-store",
      });
      const d = await r.json();
      if (!d || !d.success || !d.profile) return;
      if (inMarketing) inMarketing.checked = !!d.profile.acceptsMarketing;
      if (inAlerts) inAlerts.checked = !!d.profile.receiveAlerts;
    } catch (e) {
      console.warn("[Profile] preference hydration failed:", e);
    }
  })();

  // ── Picture state ─────────────────────────────────────────────────────────
  let pictureAction = null;

  // ── Field-level error highlighting ───────────────────────────────────────
  const fieldElements = {
    shopName: inShopName,
    phone: inPhone,
    address: inAddress1,
    zip: inZip,
    city: inCity,
    country: inCountry,
    logo: avatarCircle,
  };

  function markFieldError(key, isError) {
    const el = fieldElements[key];
    if (!el) return;
    el.classList.toggle("profile-input--error", isError);
    if (el.tagName === "INPUT" || el.tagName === "SELECT") {
      if (isError) el.setAttribute("aria-invalid", "true");
      else el.removeAttribute("aria-invalid");
    }
  }

  function clearAllFieldErrors() {
    Object.keys(fieldElements).forEach(function (key) {
      markFieldError(key, false);
    });
  }

  // Clear a field's red state the moment the shopper starts fixing it
  Object.keys(fieldElements).forEach(function (key) {
    const el = fieldElements[key];
    if (!el) return;
    const evt = el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(evt, function () {
      markFieldError(key, false);
    });
  });

  // ── FIX — Keep hidden country code in sync when dropdown changes ──────────
  // When the user picks a different country, look up its ISO code from the
  // countryNameToCode map (embedded in __profileConfig by Liquid) and update
  // the hidden input. This ensures we always send an ISO code to the backend
  // rather than a localized display name that Shopify REST would reject.
  if (inCountry && inCountryCode) {
    inCountry.addEventListener("change", function () {
      const selectedName = inCountry.value;
      const map = cfg.countryNameToCode || {};
      inCountryCode.value = map[selectedName] || "";
    });
  }

  // ── Helper: show image in circle, hide placeholder ────────────────────────
  function showAvatarImage(src) {
    if (avatarPreviewImg) {
      avatarPreviewImg.src = src;
      avatarPreviewImg.style.display = "block";
    }
    if (avatarPlaceholder) avatarPlaceholder.style.display = "none";
    if (avatarRemoveBtn) avatarRemoveBtn.style.display = "flex";
    markFieldError("logo", false);
  }

  // ── Helper: show placeholder, hide image ─────────────────────────────────
  function showAvatarPlaceholder() {
    if (avatarPreviewImg) {
      avatarPreviewImg.src = "";
      avatarPreviewImg.style.display = "none";
    }
    if (avatarPlaceholder) avatarPlaceholder.style.display = "flex";
    if (avatarRemoveBtn) avatarRemoveBtn.style.display = "none";
  }

  // ── File select → preview in circle ──────────────────────────────────────
  if (picInput) {
    picInput.addEventListener("change", function () {
      const file = this.files[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        showMsg(getProfileMessages().imageTooBig, true);
        return;
      }

      fileToBase64(file).then(function (base64) {
        pictureAction = base64;
        showAvatarImage(base64);
        if (inCurrentPic) inCurrentPic.value = base64;
      });
    });
  }

  // ── Remove button → revert to placeholder ────────────────────────────────
  if (avatarRemoveBtn) {
    avatarRemoveBtn.addEventListener("click", function (e) {
      e.preventDefault();
      pictureAction = "REMOVE";
      showAvatarPlaceholder();
      if (picInput) picInput.value = "";
      if (inCurrentPic) inCurrentPic.value = "";
    });
  }

  // ── Message helpers ───────────────────────────────────────────────────────
  function showMsg(text, isError) {
    if (!saveMsg) return;
    saveMsg.textContent = text;
    saveMsg.className =
      "profile-save-msg " +
      (isError ? "profile-save-msg--error" : "profile-save-msg--success");
    saveMsg.style.display = "block";

    // FIX 3 — Scroll to the very top of the page so the banner (which lives
    // at the top of .profile-card) is always visible, regardless of how far
    // down the shopper has scrolled. Using window.scrollTo instead of
    // scrollIntoView because the latter can be a no-op when the browser
    // considers the element "close enough" to the viewport edge.
    requestAnimationFrame(function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (typeof saveMsg.focus === "function") {
        saveMsg.focus({ preventScroll: true });
      }
    });
  }

  function hideMsg() {
    if (saveMsg) saveMsg.style.display = "none";
  }

  // ── Spinner helpers ───────────────────────────────────────────────────────
  function setLoading(on) {
    const label = saveBtn.querySelector(".profile-btn__label");
    const spinner = saveBtn.querySelector(".profile-btn__spinner");
    saveBtn.disabled = on;
    if (label) label.style.display = on ? "none" : "";
    if (spinner) spinner.style.display = on ? "inline-flex" : "none";
  }

  // ── Business validation ───────────────────────────────────────────────────
  function validateBusiness() {
    const shopName = inShopName ? inShopName.value.trim() : "";
    const phone = inPhone ? inPhone.value.trim() : "";
    const address1 = inAddress1 ? inAddress1.value.trim() : "";
    const zip = inZip ? inZip.value.trim() : "";
    const city = inCity ? inCity.value.trim() : "";
    const country = inCountry ? inCountry.value : "";
    const currentPic = inCurrentPic ? inCurrentPic.value : "";
    const hasLogo = currentPic !== "" && currentPic !== null;

    const missing = [];
    if (!shopName) missing.push("shopName");
    if (!phone) missing.push("phone");
    if (!address1) missing.push("address");
    if (!zip) missing.push("zip");
    if (!city) missing.push("city");
    if (!country || country === "---") missing.push("country");
    if (!hasLogo) missing.push("logo");

    return missing;
  }

  function showRequiredFieldsError(missingKeys) {
    const msg = getProfileMessages();
    const labels = missingKeys.map(function (key) {
      return msg.labels[key] || key;
    });
    clearAllFieldErrors();
    missingKeys.forEach(function (key) {
      markFieldError(key, true);
    });
    showMsg(msg.requiredPrefix + " " + labels.join(", "), true);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  saveBtn.addEventListener("click", async function () {
    const msg = getProfileMessages();

    if (!customerId) {
      showMsg(msg.customerNotIdentified, true);
      return;
    }

    // ── Business validation before anything else ──────────────────────────
    if (isBusiness) {
      const missing = validateBusiness();
      if (missing.length) {
        showRequiredFieldsError(missing);
        return;
      }
      clearAllFieldErrors();
    }

    // ── Phone validation (all account types) ─────────────────────────────
    // Allowed characters: digits, spaces, +, -, (, )
    // Must contain 7–15 actual digits.
    // Business required-phone is caught earlier by validateBusiness(); this
    // block adds format checking for both business and private accounts.
    const phoneRaw = inPhone ? inPhone.value.trim() : "";

    if (phoneRaw) {
      // Step 1 — reject letters or other invalid characters immediately
      if (/[a-zA-Z]/.test(phoneRaw)) {
        clearAllFieldErrors();
        markFieldError("phone", true);
        showMsg(msg.phoneInvalidChars, true);
        return;
      }
      // Step 2 — count digits and enforce 7–15 range
      const digits = phoneRaw.replace(/\D/g, "");
      if (digits.length < 7 || digits.length > 15) {
        clearAllFieldErrors();
        markFieldError("phone", true);
        showMsg(msg.phoneInvalid, true);
        return;
      }
    }
    // Private account with no phone: optional — skip silently
    // Business with no phone: already blocked by validateBusiness() above

    // ────────────────────────────────────────────────────────────────────────
    // NEW — Validate DOB age if present (private users only)
    // ────────────────────────────────────────────────────────────────────────
    if (!isBusiness && inDateOfBirth) {
      const dobValue = inDateOfBirth.value.trim();
      if (dobValue) {
        // Only validate if DOB is filled
        if (typeof window.validateDOB === "function") {
          const isValid = window.validateDOB();
          if (!isValid) {
            // Age validation failed, error message already shown by JS
            setLoading(false);
            return;
          }
        }
      }
    }

    if (inDateOfBirth && inDateOfBirth.value) {
      const enteredDate = new Date(inDateOfBirth.value);

      if (isNaN(enteredDate.getTime())) {
        showMsg(msg.invalidDate, true);
        inDateOfBirth.focus();
        return;
      }

      const today = new Date();

      enteredDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);

      if (enteredDate.getTime() > today.getTime()) {
        showDobError(msg.dobFuture);

        inDateOfBirth.focus();
        return;
      }
    }

    setLoading(true);
    hideMsg();

    try {
      // 1. Handle profile picture / logo
      if (pictureAction && pictureAction !== "REMOVE") {
        const picRes = await fetch(
          `${API_BASE}/customer-profile/${customerId}/picture`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: pictureAction }),
          },
        );
        const picData = await picRes.json();
        if (!picData.success) {
          console.error("Picture upload failed:", picData.error);
        }
      } else if (pictureAction === "REMOVE") {
        await fetch(`${API_BASE}/customer-profile/${customerId}/picture`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: "", remove: true }),
        });
      }

      // 2. Build payload — business vs private
      //
      // FIX 4 — Send ISO country code instead of localized display name.
      // inCountryCode.value is kept in sync with the dropdown by the change
      // listener above. On initial page load it is populated by Liquid from
      // addr.country_code (e.g. "ES"). If the user changes the dropdown,
      // the listener updates it via the countryNameToCode map.
      // Shopify REST address API accepts ISO codes ("ES") unambiguously,
      // whereas localized names ("España") are silently rejected or
      // mis-mapped, which was why the country never saved on non-EN storefronts.
      const countryToSend =
        inCountryCode && inCountryCode.value
          ? inCountryCode.value // ISO code e.g. "ES"
          : inCountry
            ? inCountry.value.trim()
            : ""; // fallback for EN locale

      let payload = {
        phone: phoneRaw,
        address1: inAddress1 ? inAddress1.value.trim() : "",
        address2: inAddress2 ? inAddress2.value.trim() : "",
        city: inCity ? inCity.value.trim() : "",
        country: countryToSend,
        zip: inZip ? inZip.value.trim() : "",
        acceptsMarketing: inMarketing ? inMarketing.checked : false,
        receiveAlerts: inAlerts ? inAlerts.checked : false,
        addressId: inAddressId ? inAddressId.value : "",
        // ────────────────────────────────────────────────────────────────
        // NEW — Include DOB and Gender (empty string if not filled)
        // ────────────────────────────────────────────────────────────────
        dateOfBirth: inDateOfBirth ? inDateOfBirth.value.trim() : "",
        gender: inGender ? inGender.value.trim() : "",
      };

      if (isBusiness) {
        payload.shopName = inShopName ? inShopName.value.trim() : "";
        payload.firstName = "";
        payload.lastName = "";
        payload.alias = "";
      } else {
        payload.firstName = inFirstName ? inFirstName.value.trim() : "";
        payload.lastName = inLastName ? inLastName.value.trim() : "";
        payload.alias = inAlias ? inAlias.value.trim() : "";
        var inDisplayAlias = document.getElementById("editDisplayAlias");
        if (!payload.alias && inDisplayAlias) {
          inDisplayAlias.checked = false;
        }
        payload.nameDisplayPreference =
          inDisplayAlias && inDisplayAlias.checked && payload.alias
            ? "alias"
            : "full_name";
      }

      console.log("Sending payload:", payload); // DEBUG: log what we're sending

      const res = await fetch(`${API_BASE}/customer-profile/${customerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      console.log("API Response:", data); // DEBUG: log the response

      if (!res.ok || !data.success) {
        throw new Error(
          Array.isArray(data.errors)
            ? data.errors.join(", ")
            : data.error || msg.genericError,
        );
      }

      // 3. Success → update the hidden country code with what we just saved
      //    so a second save without changing the dropdown still sends the
      //    correct code.
      if (inCountryCode && countryToSend) {
        inCountryCode.value = countryToSend;
      }

      showMsg(msg.savedMsg, false);
      setTimeout(function () {
        window.location.href = getReturnUrl();
      }, 1000);
    } catch (err) {
      console.error("Profile save error:", err);
      showMsg(msg.genericError + " (" + err.message + ")", true);
      setLoading(false);
    }
  });

  // ── Utility ───────────────────────────────────────────────────────────────
  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
})();
