/**
 * GunloupeDatePicker
 * Lightweight popover calendar that replaces native <input type="date">
 * so the calendar language always follows the site's manual language
 * selector (window.GunloupeRoutes.prefix) instead of the OS/browser locale.
 */
(function () {
  'use strict';

  function getLocale() {
    var isEN = window.GunloupeRoutes && window.GunloupeRoutes.prefix === '/en';
    return isEN ? 'en-US' : 'es-ES';
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function toISO(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function parseISO(str) {
    if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
    var parts = str.split('-');
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return isNaN(d.getTime()) ? null : d;
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function sameDay(a, b) {
    return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function resolveMaxDate(maxDate) {
    if (maxDate === 'today') return startOfDay(new Date());
    if (maxDate instanceof Date) return startOfDay(maxDate);
    if (typeof maxDate === 'string') return parseISO(maxDate);
    return null;
  }

  function attach(inputEl, options) {
    if (!inputEl || inputEl.dataset.gldpAttached === '1') return;
    inputEl.dataset.gldpAttached = '1';

    options = options || {};
    var labels = options.labels || {};
    var LABEL_SET = labels.set || 'Set';
    var LABEL_CANCEL = labels.cancel || 'Cancel';
    var LABEL_CLEAR = labels.clear || 'Clear';

    var isEN = window.GunloupeRoutes && window.GunloupeRoutes.prefix === '/en';

    inputEl.setAttribute('type', 'text');
    inputEl.setAttribute('readonly', 'readonly');
    inputEl.setAttribute('inputmode', 'none');
    inputEl.setAttribute('autocomplete', 'off');
    inputEl.removeAttribute('max');
    if (!inputEl.placeholder) {
      inputEl.placeholder = isEN ? 'mm/dd/yyyy' : 'dd/mm/aaaa';
    }
    inputEl.classList.add('gldp-input');

    // Wrap the input so a calendar icon can be laid over it (native
    // `type="date"` shows one by default; `type="text"` does not).
    var wrapper = document.createElement('span');
    wrapper.className = 'gldp-field-wrapper';
    inputEl.parentNode.insertBefore(wrapper, inputEl);
    wrapper.appendChild(inputEl);

    var icon = document.createElement('span');
    icon.className = 'gldp-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>';
    wrapper.appendChild(icon);

    var panel = null;
    var viewDate = null;   // first-of-month Date currently displayed
    var pendingDate = null; // Date selected in-panel, not yet committed
    var view = 'days';     // 'days' | 'months' | 'years' — drill-down level
    var yearRangeStart = null; // first year shown on the years grid

    function maxDate() {
      return resolveMaxDate(options.maxDate);
    }

    function commit(date) {
      inputEl.value = date ? toISO(date) : '';
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function close() {
      if (!panel) return;
      panel.remove();
      panel = null;
      document.removeEventListener('mousedown', onOutsideClick, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close, true);
    }

    function onOutsideClick(e) {
      if (panel && !panel.contains(e.target) && e.target !== inputEl) close();
    }

    function position() {
      var rect = inputEl.getBoundingClientRect();
      var panelHeight = panel.offsetHeight;
      var spaceBelow = window.innerHeight - rect.bottom;
      var spaceAbove = rect.top;
      var top = spaceBelow >= panelHeight + 8 || spaceBelow >= spaceAbove
        ? rect.bottom + 4
        : rect.top - panelHeight - 4;
      var left = Math.min(rect.left, window.innerWidth - panel.offsetWidth - 8);
      panel.style.top = Math.max(4, top) + 'px';
      panel.style.left = Math.max(4, left) + 'px';
    }

    function dayCellClass(date, isOtherMonth) {
      var classes = ['gldp-day'];
      if (isOtherMonth) classes.push('gldp-day--muted');
      if (pendingDate && sameDay(date, pendingDate)) classes.push('gldp-day--selected');
      var max = maxDate();
      if (max && date > max) classes.push('gldp-day--disabled');
      return classes.join(' ');
    }

    function render() {
      panel.innerHTML = '';
      if (view === 'years') renderYearsView();
      else if (view === 'months') renderMonthsView();
      else renderDaysView();
    }

    // Clicking the month/year label in the day view drills down to a
    // 12-month grid for that year; clicking the year number there drills
    // down further to a 12-year grid. Picking a year returns to the month
    // grid, picking a month returns to the day grid — the fast path to a
    // date like a decades-old birthday, instead of stepping one month at
    // a time via the ‹ › arrows.
    function renderDaysView() {
      var locale = getLocale();

      var header = document.createElement('div');
      header.className = 'gldp-header';

      var prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.className = 'gldp-nav gldp-nav--prev';
      prevBtn.setAttribute('aria-label', 'Previous month');
      prevBtn.textContent = '‹';
      prevBtn.addEventListener('click', function () {
        viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
        render();
      });

      var label = document.createElement('button');
      label.type = 'button';
      label.className = 'gldp-month-label gldp-month-label--btn';
      var monthYearLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(viewDate);
      label.textContent = monthYearLabel.charAt(0).toUpperCase() + monthYearLabel.slice(1);
      label.setAttribute('aria-label', 'Choose month and year');
      label.addEventListener('click', function () {
        view = 'months';
        render();
      });

      var nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'gldp-nav gldp-nav--next';
      nextBtn.setAttribute('aria-label', 'Next month');
      nextBtn.textContent = '›';
      nextBtn.addEventListener('click', function () {
        viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
        render();
      });

      header.appendChild(prevBtn);
      header.appendChild(label);
      header.appendChild(nextBtn);
      panel.appendChild(header);

      var weekdaysRow = document.createElement('div');
      weekdaysRow.className = 'gldp-weekdays';
      // Monday-start grid, consistent regardless of locale.
      var refSunday = new Date(2023, 0, 1); // a known Sunday
      for (var w = 1; w <= 7; w++) {
        var wd = new Date(refSunday);
        wd.setDate(refSunday.getDate() + w);
        var cell = document.createElement('div');
        cell.className = 'gldp-weekday';
        cell.textContent = new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(wd);
        weekdaysRow.appendChild(cell);
      }
      panel.appendChild(weekdaysRow);

      var grid = document.createElement('div');
      grid.className = 'gldp-grid';

      var firstOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
      var firstWeekday = (firstOfMonth.getDay() + 6) % 7; // 0 = Monday
      var gridStart = new Date(firstOfMonth);
      gridStart.setDate(firstOfMonth.getDate() - firstWeekday);

      var focusableSet = false;
      for (var i = 0; i < 42; i++) {
        var cellDate = new Date(gridStart);
        cellDate.setDate(gridStart.getDate() + i);
        var isOtherMonth = cellDate.getMonth() !== viewDate.getMonth();

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = dayCellClass(cellDate, isOtherMonth);
        btn.textContent = String(cellDate.getDate());
        btn.dataset.date = toISO(cellDate);

        var isDisabled = btn.className.indexOf('gldp-day--disabled') !== -1;
        if (isDisabled) {
          btn.disabled = true;
        } else {
          btn.addEventListener('click', (function (d) {
            return function () {
              pendingDate = d;
              render();
            };
          })(cellDate));
        }

        if (!isDisabled && !focusableSet && (pendingDate ? sameDay(cellDate, pendingDate) : !isOtherMonth)) {
          btn.tabIndex = 0;
          focusableSet = true;
        } else {
          btn.tabIndex = -1;
        }

        grid.appendChild(btn);
      }
      panel.appendChild(grid);

      grid.addEventListener('keydown', function (e) {
        var focused = document.activeElement;
        if (!focused || !focused.dataset || !focused.dataset.date) return;
        var current = parseISO(focused.dataset.date);
        var deltaDays = null;
        if (e.key === 'ArrowLeft') deltaDays = -1;
        else if (e.key === 'ArrowRight') deltaDays = 1;
        else if (e.key === 'ArrowUp') deltaDays = -7;
        else if (e.key === 'ArrowDown') deltaDays = 7;
        else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          focused.click();
          return;
        } else if (e.key === 'Escape') {
          e.preventDefault();
          close();
          return;
        }
        if (deltaDays !== null) {
          e.preventDefault();
          var next = new Date(current);
          next.setDate(current.getDate() + deltaDays);
          if (next.getMonth() !== viewDate.getMonth() || next.getFullYear() !== viewDate.getFullYear()) {
            viewDate = new Date(next.getFullYear(), next.getMonth(), 1);
          }
          pendingDate = pendingDate || next;
          render();
          var target = grid.querySelector('[data-date="' + toISO(next) + '"]');
          if (target && !target.disabled) {
            grid.querySelectorAll('.gldp-day').forEach(function (el) { el.tabIndex = -1; });
            target.tabIndex = 0;
            target.focus();
          }
        }
      });

      var footer = document.createElement('div');
      footer.className = 'gldp-footer';

      var clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'gldp-action gldp-action--clear';
      clearBtn.textContent = LABEL_CLEAR;
      clearBtn.addEventListener('click', function () {
        pendingDate = null;
        commit(null);
        close();
      });

      var cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'gldp-action gldp-action--cancel';
      cancelBtn.textContent = LABEL_CANCEL;
      cancelBtn.addEventListener('click', close);

      var setBtn = document.createElement('button');
      setBtn.type = 'button';
      setBtn.className = 'gldp-action gldp-action--set';
      setBtn.textContent = LABEL_SET;
      setBtn.addEventListener('click', function () {
        if (pendingDate) commit(pendingDate);
        close();
      });

      footer.appendChild(clearBtn);
      footer.appendChild(cancelBtn);
      footer.appendChild(setBtn);
      panel.appendChild(footer);

      if (!focusableSet) {
        var firstEnabled = grid.querySelector('.gldp-day:not(.gldp-day--disabled)');
        if (firstEnabled) firstEnabled.tabIndex = 0;
      }
    }

    function renderMonthsView() {
      var locale = getLocale();
      var year = viewDate.getFullYear();
      var max = maxDate();

      var header = document.createElement('div');
      header.className = 'gldp-header';

      var prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.className = 'gldp-nav gldp-nav--prev';
      prevBtn.setAttribute('aria-label', 'Previous year');
      prevBtn.textContent = '‹';
      prevBtn.addEventListener('click', function () {
        viewDate = new Date(year - 1, viewDate.getMonth(), 1);
        render();
      });

      var label = document.createElement('button');
      label.type = 'button';
      label.className = 'gldp-month-label gldp-month-label--btn';
      label.textContent = String(year);
      label.setAttribute('aria-label', 'Choose year');
      label.addEventListener('click', function () {
        yearRangeStart = Math.floor(year / 12) * 12;
        view = 'years';
        render();
      });

      var nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'gldp-nav gldp-nav--next';
      nextBtn.setAttribute('aria-label', 'Next year');
      nextBtn.textContent = '›';
      nextBtn.addEventListener('click', function () {
        viewDate = new Date(year + 1, viewDate.getMonth(), 1);
        render();
      });

      header.appendChild(prevBtn);
      header.appendChild(label);
      header.appendChild(nextBtn);
      panel.appendChild(header);

      var grid = document.createElement('div');
      grid.className = 'gldp-grid gldp-grid--months';

      for (var m = 0; m < 12; m++) {
        var monthLabel = new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(year, m, 1));
        monthLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1).replace('.', '');

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'gldp-cell gldp-cell--month';
        if (year === viewDate.getFullYear() && m === viewDate.getMonth()) btn.classList.add('gldp-cell--current');
        btn.textContent = monthLabel;

        var isDisabled = !!(max && new Date(year, m, 1) > new Date(max.getFullYear(), max.getMonth(), 1));
        if (isDisabled) {
          btn.disabled = true;
          btn.classList.add('gldp-cell--disabled');
        } else {
          btn.addEventListener('click', (function (mi) {
            return function () {
              viewDate = new Date(year, mi, 1);
              view = 'days';
              render();
            };
          })(m));
        }

        grid.appendChild(btn);
      }
      panel.appendChild(grid);
    }

    function renderYearsView() {
      if (yearRangeStart === null) yearRangeStart = Math.floor(viewDate.getFullYear() / 12) * 12;
      var max = maxDate();
      var maxYear = max ? max.getFullYear() : null;

      var header = document.createElement('div');
      header.className = 'gldp-header';

      var prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.className = 'gldp-nav gldp-nav--prev';
      prevBtn.setAttribute('aria-label', 'Previous years');
      prevBtn.textContent = '‹';
      prevBtn.addEventListener('click', function () {
        yearRangeStart -= 12;
        render();
      });

      var label = document.createElement('div');
      label.className = 'gldp-month-label';
      label.textContent = yearRangeStart + ' - ' + (yearRangeStart + 11);

      var nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'gldp-nav gldp-nav--next';
      nextBtn.setAttribute('aria-label', 'Next years');
      nextBtn.textContent = '›';
      nextBtn.addEventListener('click', function () {
        yearRangeStart += 12;
        render();
      });

      header.appendChild(prevBtn);
      header.appendChild(label);
      header.appendChild(nextBtn);
      panel.appendChild(header);

      var grid = document.createElement('div');
      grid.className = 'gldp-grid gldp-grid--years';

      for (var i = 0; i < 12; i++) {
        var y = yearRangeStart + i;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'gldp-cell gldp-cell--year';
        if (y === viewDate.getFullYear()) btn.classList.add('gldp-cell--current');
        btn.textContent = String(y);

        var isDisabled = maxYear !== null && y > maxYear;
        if (isDisabled) {
          btn.disabled = true;
          btn.classList.add('gldp-cell--disabled');
        } else {
          btn.addEventListener('click', (function (yy) {
            return function () {
              viewDate = new Date(yy, viewDate.getMonth(), 1);
              view = 'months';
              render();
            };
          })(y));
        }

        grid.appendChild(btn);
      }
      panel.appendChild(grid);
    }

    function open() {
      if (panel) return;

      var current = parseISO(inputEl.value);
      pendingDate = current;
      viewDate = current ? new Date(current.getFullYear(), current.getMonth(), 1) : (function () {
        var t = maxDate() || new Date();
        return new Date(t.getFullYear(), t.getMonth(), 1);
      })();
      view = 'days';
      yearRangeStart = null;

      panel = document.createElement('div');
      panel.className = 'gldp-panel';
      panel.setAttribute('role', 'dialog');
      document.body.appendChild(panel);

      render();
      position();

      var firstFocusable = panel.querySelector('[tabindex="0"]') || panel.querySelector('button');
      if (firstFocusable) firstFocusable.focus();

      setTimeout(function () {
        document.addEventListener('mousedown', onOutsideClick, true);
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close, true);
      }, 0);
    }

    inputEl.addEventListener('click', open);
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  }

  window.GunloupeDatePicker = { attach: attach };
})();
