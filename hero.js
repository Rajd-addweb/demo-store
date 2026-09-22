// Hero workstream tabs: auto-rotating slide/tab sync, matches the reference recording.
document.addEventListener("DOMContentLoaded", () => {
  const slides = document.querySelectorAll(".hero-slide");
  const railItems = document.querySelectorAll(".rail-item");
  const bgImg = document.getElementById("heroBgImg");
  if (!slides.length || !railItems.length) return;

  let active = 0;
  let timer = null;
  const AUTOPLAY_MS = 5000;

  function goTo(index) {
    if (index === active) return;
    slides[active].classList.remove("is-active");
    railItems[active].classList.remove("is-on");
    active = index;
    slides[active].classList.add("is-active");
    railItems[active].classList.add("is-on");

    const bg = slides[active].getAttribute("data-bg");
    if (bg && bgImg) {
      bgImg.style.opacity = "0";
      setTimeout(() => {
        bgImg.src = bg;
        bgImg.style.opacity = "1";
      }, 250);
    }
  }

  function next() {
    goTo((active + 1) % slides.length);
  }

  function startAutoplay() {
    stopAutoplay();
    timer = setInterval(next, AUTOPLAY_MS);
  }
  function stopAutoplay() {
    if (timer) clearInterval(timer);
  }

  railItems.forEach((item, i) => {
    item.addEventListener("click", () => {
      goTo(i);
      startAutoplay();
    });
  });

  startAutoplay();
});
