(() => {
  const canvas = document.getElementById('deck-canvas');
  const slides = [...document.querySelectorAll('.slide')];
  const progress = document.getElementById('progress-fill');
  const notesPanel = document.getElementById('notes-panel');
  const notesTitle = document.getElementById('notes-title');
  const notesBody = document.getElementById('notes-body');
  const notesBackdrop = document.getElementById('notes-backdrop');
  const overview = document.getElementById('overview');
  let index = 0;
  let touchX = null;

  slides.forEach((slide, slideIndex) => {
    const number = slide.querySelector('.slide-number');
    if (number) number.textContent = String(slideIndex + 1).padStart(2, '0');
  });

  function fitDeck() {
    const scale = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
    canvas.style.transform = `translate(${(window.innerWidth - 1600 * scale) / 2}px, ${(window.innerHeight - 900 * scale) / 2}px) scale(${scale})`;
  }

  function indexFromHash() {
    const match = window.location.hash.match(/^#(\d+)$/);
    return match ? Math.max(0, Math.min(slides.length - 1, Number(match[1]) - 1)) : 0;
  }

  function replayClass(selector) {
    const element = document.querySelector(selector);
    if (!element) return;
    element.classList.remove('is-playing');
    void element.offsetWidth;
    element.classList.add('is-playing');
  }

  function updateNotes() {
    const slide = slides[index];
    const copy = slide.querySelector('.speaker-copy');
    notesTitle.textContent = `第 ${index + 1} 页讲稿 · ${slide.dataset.title || ''}`;
    notesBody.innerHTML = copy ? copy.innerHTML : '<p>本页没有补充讲稿。</p>';
  }

  function updateOverviewCurrent() {
    [...overview.querySelectorAll('button')].forEach((button, i) => button.classList.toggle('current', i === index));
  }

  function startSlideAnimations(slide) {
    if (slide.querySelector('#advertise-animation')) replayClass('#advertise-animation');
    if (slide.querySelector('#reflect-animation')) replayClass('#reflect-animation');
    if (slide.querySelector('#collector-animation')) replayClass('#collector-animation');
    if (slide.querySelector('#native-ping-animation')) replayClass('#native-ping-animation');
  }

  function showSlide(nextIndex, updateHash = true) {
    index = Math.max(0, Math.min(slides.length - 1, nextIndex));
    slides.forEach((slide, i) => slide.classList.toggle('active', i === index));
    progress.style.width = `${((index + 1) / slides.length) * 100}%`;
    document.title = `${slides[index].dataset.title || 'Calico BGP IPPool'} · ${index + 1}/${slides.length}`;
    if (updateHash) history.replaceState(null, '', `#${index + 1}`);
    updateNotes();
    updateOverviewCurrent();
    startSlideAnimations(slides[index]);
  }

  function setNotesOpen(open) {
    notesPanel.classList.toggle('open', open);
    notesPanel.setAttribute('aria-hidden', String(!open));
    notesBackdrop.classList.toggle('open', open);
    document.getElementById('notes-toggle').setAttribute('aria-pressed', String(open));
  }

  function toggleNotes() {
    const opening = !notesPanel.classList.contains('open');
    if (opening && overview.classList.contains('open')) toggleOverview();
    setNotesOpen(opening);
  }

  function toggleOverview() {
    const opening = !overview.classList.contains('open');
    if (opening) setNotesOpen(false);
    overview.classList.toggle('open', opening);
    document.getElementById('overview-toggle').setAttribute('aria-pressed', String(opening));
  }

  async function toggleFullscreen() {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
    else await document.exitFullscreen?.();
  }

  slides.forEach((slide, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = `<span class="ov-num">${String(i + 1).padStart(2, '0')}</span><span class="ov-title">${slide.dataset.title || ''}</span>`;
    button.addEventListener('click', () => { showSlide(i); toggleOverview(); });
    overview.appendChild(button);
  });

  document.getElementById('prev').addEventListener('click', () => showSlide(index - 1));
  document.getElementById('next').addEventListener('click', () => showSlide(index + 1));
  document.getElementById('notes-toggle').addEventListener('click', toggleNotes);
  document.getElementById('notes-close').addEventListener('click', () => setNotesOpen(false));
  notesBackdrop.addEventListener('click', () => setNotesOpen(false));
  document.getElementById('overview-toggle').addEventListener('click', toggleOverview);
  document.getElementById('fullscreen').addEventListener('click', toggleFullscreen);
  document.getElementById('replay-advertise')?.addEventListener('click', () => replayClass('#advertise-animation'));
  document.getElementById('replay-reflect')?.addEventListener('click', () => replayClass('#reflect-animation'));
  document.getElementById('replay-collector')?.addEventListener('click', () => replayClass('#collector-animation'));
  document.getElementById('replay-ping')?.addEventListener('click', () => replayClass('#native-ping-animation'));

  document.addEventListener('keydown', event => {
    if (overview.classList.contains('open') && event.key === 'Escape') { toggleOverview(); return; }
    if (notesPanel.classList.contains('open') && event.key === 'Escape') { toggleNotes(); return; }
    if (['ArrowRight', 'PageDown', ' '].includes(event.key)) { event.preventDefault(); showSlide(index + 1); }
    else if (['ArrowLeft', 'PageUp'].includes(event.key)) { event.preventDefault(); showSlide(index - 1); }
    else if (event.key.toLowerCase() === 'n') toggleNotes();
    else if (event.key.toLowerCase() === 'o') toggleOverview();
    else if (event.key.toLowerCase() === 'f') toggleFullscreen();
    else if (event.key === 'Home') showSlide(0);
    else if (event.key === 'End') showSlide(slides.length - 1);
  });

  document.addEventListener('touchstart', event => { touchX = event.changedTouches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', event => {
    if (touchX === null) return;
    const delta = event.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(delta) >= 70) showSlide(index + (delta < 0 ? 1 : -1));
  }, { passive: true });

  window.addEventListener('resize', fitDeck);
  window.addEventListener('hashchange', () => showSlide(indexFromHash(), false));
  fitDeck();
  showSlide(indexFromHash(), false);
})();
