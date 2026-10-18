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
  let bucketTimer = null;

  slides.forEach((slide, slideIndex) => {
    const number = slide.querySelector('.slide-number');
    if (number) number.textContent = String(slideIndex + 1).padStart(2, '0');
  });

  function fitDeck() {
    const scale = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
    const x = (window.innerWidth - 1600 * scale) / 2;
    const y = (window.innerHeight - 900 * scale) / 2;
    canvas.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }

  function indexFromHash() {
    const match = window.location.hash.match(/^#(\d+)$/);
    if (!match) return 0;
    return Math.max(0, Math.min(slides.length - 1, Number(match[1]) - 1));
  }

  function replay(target) {
    const element = typeof target === 'string' ? document.querySelector(target) : target;
    if (!element) return;
    element.classList.remove('is-playing');
    void element.offsetWidth;
    element.classList.add('is-playing');
  }

  function playBucket() {
    const stage = document.getElementById('bucket-sim');
    const caption = document.getElementById('bucket-caption');
    if (!stage || !caption) return;
    const bars = [...stage.querySelectorAll('.bucket-bars i')];
    const heights = [100, 22, 22, 22, 22];
    const captions = [
      '0–1 秒：消耗桶内已有 token，短时达到约 299 Mbit/s',
      '1–2 秒：bucket 接近耗尽，速率回落到约 10.5 Mbit/s',
      '2–3 秒：按 10M 的 token 补充节奏持续发送',
      '3–4 秒：稳定区间保持约 10.5 Mbit/s',
      '4–5 秒：限速持续生效，重传保持为 0'
    ];
    clearInterval(bucketTimer);
    bars.forEach(bar => {
      bar.style.height = '0';
      bar.classList.remove('active');
    });
    caption.textContent = '准备开始';
    let current = 0;

    const paint = () => {
      bars.forEach((bar, barIndex) => {
        if (barIndex <= current) bar.style.height = `${heights[barIndex]}%`;
        bar.classList.toggle('active', barIndex === current);
      });
      caption.textContent = captions[current];
    };

    paint();
    bucketTimer = setInterval(() => {
      current += 1;
      if (current >= bars.length) {
        clearInterval(bucketTimer);
        bars.forEach(bar => bar.classList.remove('active'));
        caption.textContent = '稳定结论：burst 结束后，持续速率接近配置的 10 Mbit/s';
        return;
      }
      paint();
    }, 850);
  }

  function replaySlideAnimations(slide) {
    slide.querySelectorAll('.is-playing').forEach(replay);
    if (slide.querySelector('#bucket-sim')) playBucket();
  }

  function updateNotes() {
    const slide = slides[index];
    const copy = slide.querySelector('.speaker-copy');
    notesTitle.textContent = `第 ${index + 1} 页讲稿 · ${slide.dataset.title || ''}`;
    notesBody.innerHTML = copy ? copy.innerHTML : '<p>本页没有补充讲稿。</p>';
  }

  function updateOverviewCurrent() {
    [...overview.querySelectorAll('button')].forEach((button, buttonIndex) => {
      button.classList.toggle('current', buttonIndex === index);
    });
  }

  function showSlide(nextIndex, updateHash = true) {
    index = Math.max(0, Math.min(slides.length - 1, nextIndex));
    clearInterval(bucketTimer);
    slides.forEach((slide, slideIndex) => slide.classList.toggle('active', slideIndex === index));
    progress.style.width = `${((index + 1) / slides.length) * 100}%`;
    document.title = `${slides[index].dataset.title || 'Calico Network QoS'} · ${index + 1}/${slides.length}`;
    if (updateHash) history.replaceState(null, '', `#${index + 1}`);
    updateNotes();
    updateOverviewCurrent();
    replaySlideAnimations(slides[index]);
  }

  function setNotesOpen(open) {
    notesPanel.classList.toggle('open', open);
    notesPanel.setAttribute('aria-hidden', String(!open));
    notesBackdrop.classList.toggle('open', open);
    notesBackdrop.tabIndex = open ? 0 : -1;
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

  function buildOverview() {
    slides.forEach((slide, slideIndex) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.innerHTML = `<span class="ov-num">${String(slideIndex + 1).padStart(2, '0')}</span><span class="ov-title">${slide.dataset.title || ''}</span>`;
      button.addEventListener('click', () => {
        showSlide(slideIndex);
        toggleOverview();
      });
      overview.appendChild(button);
    });
  }

  document.getElementById('prev').addEventListener('click', () => showSlide(index - 1));
  document.getElementById('next').addEventListener('click', () => showSlide(index + 1));
  document.getElementById('notes-toggle').addEventListener('click', toggleNotes);
  document.getElementById('notes-close').addEventListener('click', () => setNotesOpen(false));
  notesBackdrop.addEventListener('click', () => setNotesOpen(false));
  document.getElementById('overview-toggle').addEventListener('click', toggleOverview);
  document.getElementById('fullscreen').addEventListener('click', toggleFullscreen);
  document.querySelectorAll('[data-replay]').forEach(button => {
    button.addEventListener('click', () => replay(button.dataset.replay));
  });
  document.getElementById('replay-bucket').addEventListener('click', playBucket);

  document.addEventListener('keydown', event => {
    if (overview.classList.contains('open') && event.key === 'Escape') {
      toggleOverview();
      return;
    }
    if (notesPanel.classList.contains('open') && event.key === 'Escape') {
      setNotesOpen(false);
      return;
    }
    if (['ArrowRight', 'PageDown', ' '].includes(event.key)) {
      event.preventDefault();
      showSlide(index + 1);
    } else if (['ArrowLeft', 'PageUp'].includes(event.key)) {
      event.preventDefault();
      showSlide(index - 1);
    } else if (event.key.toLowerCase() === 'n') toggleNotes();
    else if (event.key.toLowerCase() === 'o') toggleOverview();
    else if (event.key.toLowerCase() === 'f') toggleFullscreen();
    else if (event.key === 'Home') showSlide(0);
    else if (event.key === 'End') showSlide(slides.length - 1);
  });

  document.addEventListener('touchstart', event => {
    touchX = event.changedTouches[0].clientX;
  }, { passive: true });

  document.addEventListener('touchend', event => {
    if (touchX === null) return;
    const delta = event.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(delta) < 70) return;
    showSlide(index + (delta < 0 ? 1 : -1));
  }, { passive: true });

  window.addEventListener('resize', fitDeck);
  window.addEventListener('hashchange', () => showSlide(indexFromHash(), false));

  buildOverview();
  fitDeck();
  showSlide(indexFromHash(), false);
})();
