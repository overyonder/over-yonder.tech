document.addEventListener('DOMContentLoaded', function () {
  const logo = document.querySelector('.logo');
  const contentSections = document.querySelectorAll('.content section');
  const initialLogoTop = window.innerHeight / 2;
  const finalLogoTop = 50; // Final position from top in pixels

  // Handle scroll for logo and header
  window.addEventListener('scroll', () => {
    window.requestAnimationFrame(animate);
  });

  function animate() {
    const scrollY = window.scrollY;

    // Animate logo
    const logoTop = Math.max(finalLogoTop, initialLogoTop - scrollY);
    logo.style.top = `${logoTop}px`;

    // Animate content sections
    contentSections.forEach(section => {
      const rect = section.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const posY = rect.top / viewportHeight * 100; // Position as a percentage of viewport height

      let opacity = 0;

      if (posY >= 90) {
        opacity = 0;
      } else if (80 <= posY < 90) {
        opacity = (90 - posY) / 10;
      } else if (40 <= posY < 80) {
        opacity = 1;
      } else if (posY >= 20 && posY <= 30) {
        opacity = (posY - 20) / 10;
      } else {
        opacity = 0;
      }

      section.style.opacity = Math.max(0, Math.min(1, opacity));
    });
  }

  window.requestAnimationFrame(animate);
});
