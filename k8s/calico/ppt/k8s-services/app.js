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
  let controlTimer = null;

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

  function replayClass(selector, className = 'is-playing') {
    const element = document.querySelector(selector);
    if (!element) return;
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
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

  function playControlFlow() {
    const stage = document.getElementById('control-flow');
    const caption = document.getElementById('control-caption');
    if (!stage || !caption) return;
    const steps = [...stage.querySelectorAll('.control-step')];
    clearInterval(controlTimer);
    steps.forEach(step => step.classList.remove('active', 'done'));
    const messages = [
      'kubectl 把 Deployment 和 Service 交给 kube-apiserver',
      'API Server 验证对象并把期望状态写入 etcd',
      'EndpointSlice controller 根据 selector 与 readiness 维护后端',
      '每台节点的 kube-proxy watch 到 Service 和 EndpointSlice 变化',
      'kube-proxy 把新状态同步为本节点 iptables 规则'
    ];
    let active = 0;

    const paint = () => {
      steps.forEach((step, stepIndex) => {
        step.classList.toggle('done', stepIndex < active);
        step.classList.toggle('active', stepIndex === active);
      });
      caption.textContent = messages[active];
    };

    paint();
    controlTimer = setInterval(() => {
      active += 1;
      if (active >= steps.length) {
        clearInterval(controlTimer);
        steps.forEach(step => step.classList.add('done'));
        caption.textContent = 'Service 数据面已在每台节点更新完成';
        return;
      }
      paint();
    }, 900);
  }

  function setBackend(backend) {
    const stage = document.getElementById('selection-stage');
    const buttonA = document.getElementById('backend-a');
    const buttonB = document.getElementById('backend-b');
    if (!stage || !buttonA || !buttonB) return;
    stage.dataset.backend = backend;
    buttonA.classList.toggle('active', backend === 'a');
    buttonB.classList.toggle('active', backend === 'b');
    buttonA.setAttribute('aria-pressed', String(backend === 'a'));
    buttonB.setAttribute('aria-pressed', String(backend === 'b'));
    replayClass('#selection-stage');
  }

  function startSlideAnimations(slide) {
    if (slide.querySelector('#control-flow')) playControlFlow();
    if (slide.querySelector('#chain-stage')) replayClass('#chain-stage');
    if (slide.querySelector('#selection-stage')) replayClass('#selection-stage');
    if (slide.querySelector('#local-path')) replayClass('#local-path');
    if (slide.querySelector('#remote-path')) replayClass('#remote-path');
  }

  function showSlide(nextIndex, updateHash = true) {
    index = Math.max(0, Math.min(slides.length - 1, nextIndex));
    slides.forEach((slide, slideIndex) => slide.classList.toggle('active', slideIndex === index));
    progress.style.width = `${((index + 1) / slides.length) * 100}%`;
    document.title = `${slides[index].dataset.title || 'Kubernetes Services'} · ${index + 1}/${slides.length}`;
    if (updateHash) history.replaceState(null, '', `#${index + 1}`);
    updateNotes();
    updateOverviewCurrent();
    startSlideAnimations(slides[index]);
  }

  function nextSlide() {
    if (index < slides.length - 1) showSlide(index + 1);
  }

  function prevSlide() {
    if (index > 0) showSlide(index - 1);
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

  document.getElementById('prev').addEventListener('click', prevSlide);
  document.getElementById('next').addEventListener('click', nextSlide);
  document.getElementById('notes-toggle').addEventListener('click', toggleNotes);
  document.getElementById('notes-close').addEventListener('click', () => setNotesOpen(false));
  notesBackdrop.addEventListener('click', () => setNotesOpen(false));
  document.getElementById('overview-toggle').addEventListener('click', toggleOverview);
  document.getElementById('fullscreen').addEventListener('click', toggleFullscreen);
  document.getElementById('replay-control')?.addEventListener('click', playControlFlow);
  document.getElementById('replay-chain')?.addEventListener('click', () => replayClass('#chain-stage'));
  document.getElementById('replay-local')?.addEventListener('click', () => replayClass('#local-path'));
  document.getElementById('replay-remote')?.addEventListener('click', () => replayClass('#remote-path'));
  document.getElementById('backend-a')?.addEventListener('click', () => setBackend('a'));
  document.getElementById('backend-b')?.addEventListener('click', () => setBackend('b'));

  document.addEventListener('keydown', event => {
    if (overview.classList.contains('open') && event.key === 'Escape') {
      toggleOverview();
      return;
    }
    if (notesPanel.classList.contains('open') && event.key === 'Escape') {
      toggleNotes();
      return;
    }
    if (['ArrowRight', 'PageDown', ' '].includes(event.key)) {
      event.preventDefault();
      nextSlide();
    } else if (['ArrowLeft', 'PageUp'].includes(event.key)) {
      event.preventDefault();
      prevSlide();
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
    if (delta < 0) nextSlide(); else prevSlide();
  }, { passive: true });

  window.addEventListener('resize', fitDeck);
  window.addEventListener('hashchange', () => showSlide(indexFromHash(), false));

  buildOverview();
  fitDeck();
  setBackend('a');
  showSlide(indexFromHash(), false);
})();
