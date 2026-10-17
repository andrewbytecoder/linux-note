(() => {
  const canvas = document.getElementById('deck-canvas');
  const slides = [...document.querySelectorAll('.slide')];
  const progress = document.getElementById('progress-fill');
  const notesPanel = document.getElementById('notes-panel');
  const notesTitle = document.getElementById('notes-title');
  const notesBody = document.getElementById('notes-body');
  const overview = document.getElementById('overview');
  let index = 0;
  let touchX = null;
  let buildTimer = null;

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

  function replayClass(selector, className = 'is-playing') {
    const element = document.querySelector(selector);
    if (!element) return;
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
  }

  function playPodBuild() {
    const stage = document.getElementById('pod-build');
    if (!stage) return;
    const steps = [...stage.querySelectorAll('.build-step')];
    const caption = document.getElementById('build-caption');
    clearInterval(buildTimer);
    steps.forEach(step => step.classList.remove('active', 'done'));
    let active = 0;

    const paint = () => {
      steps.forEach((step, stepIndex) => {
        step.classList.toggle('done', stepIndex < active);
        step.classList.toggle('active', stepIndex === active);
      });
      if (caption) caption.textContent = steps[active]?.dataset.caption || '';
    };

    paint();
    buildTimer = setInterval(() => {
      active += 1;
      if (active >= steps.length) {
        clearInterval(buildTimer);
        steps.forEach(step => step.classList.add('done'));
        if (caption) caption.textContent = 'Pod 进入 Running，IP 与网络配置写回 kube-apiserver';
        return;
      }
      paint();
    }, 900);
  }

  function setCrossMode(mode) {
    const stage = document.getElementById('cross-stage');
    const directButton = document.getElementById('mode-direct');
    const vxlanButton = document.getElementById('mode-vxlan');
    const summary = document.getElementById('cross-summary');
    if (!stage || !directButton || !vxlanButton || !summary) return;

    stage.dataset.mode = mode;
    directButton.classList.toggle('active', mode === 'direct');
    vxlanButton.classList.toggle('active', mode === 'vxlan');
    directButton.setAttribute('aria-pressed', String(mode === 'direct'));
    vxlanButton.setAttribute('aria-pressed', String(mode === 'vxlan'));

    if (mode === 'direct') {
      summary.innerHTML = '<strong>本实验实际路径：</strong>三个 Kind Node IP 同属 172.18.0.0/16，VXLANCrossSubnet 不封装。外层线上仍能看到原始 Pod 源、目的 IP。';
    } else {
      summary.innerHTML = '<strong>跨 underlay 子网时：</strong>Calico 用 VXLAN 外层 Node IP 运送内层 Pod 包。目的节点解封装后，再根据本地 /32 路由交给 cali*。';
    }
    replayClass('#cross-stage');
  }

  function startSlideAnimations(slide) {
    if (slide.querySelector('#pod-build')) playPodBuild();
    if (slide.querySelector('#node-underlay')) replayClass('#node-underlay');
    if (slide.querySelector('#same-host-stage')) replayClass('#same-host-stage');
    if (slide.querySelector('#cross-stage')) replayClass('#cross-stage');
  }

  function showSlide(nextIndex, updateHash = true) {
    index = Math.max(0, Math.min(slides.length - 1, nextIndex));
    slides.forEach((slide, slideIndex) => slide.classList.toggle('active', slideIndex === index));
    progress.style.width = `${((index + 1) / slides.length) * 100}%`;
    document.title = `${slides[index].dataset.title || 'Calico Pod Networking'} · ${index + 1}/${slides.length}`;
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
    document.getElementById('notes-backdrop').classList.toggle('open', open);
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
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
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
  document.getElementById('notes-backdrop').addEventListener('click', () => setNotesOpen(false));
  document.getElementById('overview-toggle').addEventListener('click', toggleOverview);
  document.getElementById('fullscreen').addEventListener('click', toggleFullscreen);
  document.getElementById('replay-build')?.addEventListener('click', playPodBuild);
  document.getElementById('replay-node')?.addEventListener('click', () => replayClass('#node-underlay'));
  document.getElementById('replay-same')?.addEventListener('click', () => replayClass('#same-host-stage'));
  document.getElementById('replay-cross')?.addEventListener('click', () => replayClass('#cross-stage'));
  document.getElementById('mode-direct')?.addEventListener('click', () => setCrossMode('direct'));
  document.getElementById('mode-vxlan')?.addEventListener('click', () => setCrossMode('vxlan'));

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
    } else if (event.key.toLowerCase() === 'n') {
      toggleNotes();
    } else if (event.key.toLowerCase() === 'o') {
      toggleOverview();
    } else if (event.key.toLowerCase() === 'f') {
      toggleFullscreen();
    } else if (event.key === 'Home') {
      showSlide(0);
    } else if (event.key === 'End') {
      showSlide(slides.length - 1);
    }
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
  setCrossMode('direct');
  showSlide(indexFromHash(), false);
})();
