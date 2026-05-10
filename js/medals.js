// medals.js - home page gallantry medal slideshow
(function() {
  const medals = [
    {
      name: 'Param Vir Chakra',
      src: 'assets/images/PVC_medal.png',
      alt: 'Param Vir Chakra Medal',
      info: "India's highest wartime gallantry award, given for the most conspicuous bravery or self-sacrifice in the presence of the enemy."
    },
    {
      name: 'Maha Vir Chakra',
      src: 'assets/images/MVC_Medal.png',
      alt: 'Maha Vir Chakra Medal',
      info: "India's second-highest wartime gallantry award, given for acts of conspicuous bravery in the presence of the enemy."
    },
    {
      name: 'Ashoka Chakra',
      src: 'assets/images/AC_Medal.png',
      alt: 'Ashoka Chakra Medal',
      info: "India's highest peacetime gallantry award, given for valour, courageous action, or self-sacrifice away from the battlefield."
    }
  ];

  document.addEventListener('DOMContentLoaded', () => {
    const image = document.getElementById('heroMedalImage');
    const name = document.getElementById('heroMedalName');
    const info = document.getElementById('heroMedalInfo');
    const wrapper = document.querySelector('.medal-emblem');
    if (!image || !name || !info || !wrapper) return;

    let index = 0;

    function renderMedal(nextIndex) {
      index = nextIndex % medals.length;
      const medal = medals[index];
      wrapper.classList.add('is-changing');
      setTimeout(() => {
        image.src = medal.src;
        image.alt = medal.alt;
        name.textContent = medal.name;
        info.textContent = medal.info;
        wrapper.setAttribute('aria-label', medal.name + ' information');
        wrapper.classList.remove('is-changing');
      }, 220);
    }

    renderMedal(0);
    setInterval(() => renderMedal(index + 1), 4200);
  });
})();