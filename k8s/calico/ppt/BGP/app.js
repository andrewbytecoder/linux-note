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
  let bgpTimer = null;
  let requestTimer = null;

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

  function showSlide(nextIndex, updateHash = true) {
    index = Math.max(0, Math.min(slides.length - 1, nextIndex));
    slides.forEach((slide, slideIndex) => slide.classList.toggle('active', slideIndex === index));
    progress.style.width = `${((index + 1) / slides.length) * 100}%`;
    document.title = `${slides[index].dataset.title || 'Calico BGP'} · ${index + 1}/${slides.length}`;
    if (updateHash) history.replaceState(null, '', `#${index + 1}`);
    updateNotes();
    updateOverviewCurrent();
    if (slides[index].querySelector('#bgp-states')) playBgpStates();
    if (slides[index].querySelector('#request-steps')) playRequestSteps();
  }

  function nextSlide() {
    if (index < slides.length - 1) showSlide(index + 1);
  }

  function prevSlide() {
    if (index > 0) showSlide(index - 1);
  }

  function toggleNotes() {
    notesPanel.classList.toggle('open');
    document.getElementById('notes-toggle').setAttribute('aria-pressed', String(notesPanel.classList.contains('open')));
  }

  function toggleOverview() {
    overview.classList.toggle('open');
    document.getElementById('overview-toggle').setAttribute('aria-pressed', String(overview.classList.contains('open')));
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

  function playBgpStates() {
    const states = [...document.querySelectorAll('#bgp-states .state')];
    if (!states.length) return;
    clearInterval(bgpTimer);
    states.forEach(state => state.classList.remove('on', 'done'));
    let step = 0;
    states[0].classList.add('on');
    bgpTimer = setInterval(() => {
      states.forEach((state, stateIndex) => {
        state.classList.toggle('done', stateIndex < step);
        state.classList.toggle('on', stateIndex === step);
      });
      step += 1;
      if (step >= states.length) {
        states.forEach((state, stateIndex) => {
          state.classList.toggle('done', stateIndex < states.length - 1);
          state.classList.toggle('on', stateIndex === states.length - 1);
        });
        clearInterval(bgpTimer);
      }
    }, 820);
  }

  function playRequestSteps() {
    const steps = [...document.querySelectorAll('#request-steps .step')];
    if (!steps.length) return;
    clearInterval(requestTimer);
    steps.forEach(step => step.classList.remove('on'));
    let active = 0;
    steps[0].classList.add('on');
    requestTimer = setInterval(() => {
      active = (active + 1) % steps.length;
      steps.forEach((step, stepIndex) => step.classList.toggle('on', stepIndex === active));
    }, 1200);
  }

  function setRouteMode(mode) {
    const stage = document.getElementById('ecmp-stage');
    const output = document.getElementById('route-output');
    const explain = document.getElementById('route-explain');
    if (!stage || !output || !explain) return;

    stage.classList.toggle('single', mode === 'single');
    stage.classList.toggle('failed-2', mode === 'fail');
    document.getElementById('route-single').classList.toggle('active', mode === 'single');
    document.getElementById('route-ecmp').classList.toggle('active', mode === 'ecmp');
    document.getElementById('route-fail').classList.toggle('active', mode === 'fail');

    if (mode === 'single') {
      output.textContent = 'B E 172.16.0.240/28 [200/0]\n    via 10.10.10.10, Vlan10';
      explain.innerHTML = '<p class="body">现场 BGP RIB 有 3 条 valid external 路径；当前 FIB 只安装 best path 10.10.10.10。</p>';
    } else if (mode === 'ecmp') {
      output.textContent = 'B E 172.16.0.240/28 [200/0]\n    via 10.10.10.10, Vlan10\n    via 10.10.10.11, Vlan10\n    via 10.10.10.12, Vlan10';
      explain.innerHTML = '<p class="body"><code class="mono">maximum-paths 4</code> 允许三个等价下一跳同时进入 FIB。cEOS 通常按流哈希分担，而不是逐包轮询。</p>';
    } else {
      output.textContent = 'B E 172.16.0.240/28 [200/0]\n    via 10.10.10.10, Vlan10\n    via 10.10.10.12, Vlan10';
      explain.innerHTML = '<p class="body">10.10.10.11 的会话或路由撤销后，新流量继续使用 .10 与 .12。已建立连接是否重选取决于故障位置和连接状态。</p>';
    }
  }

  document.getElementById('prev').addEventListener('click', prevSlide);
  document.getElementById('next').addEventListener('click', nextSlide);
  document.getElementById('notes-toggle').addEventListener('click', toggleNotes);
  document.getElementById('overview-toggle').addEventListener('click', toggleOverview);
  document.getElementById('fullscreen').addEventListener('click', toggleFullscreen);
  document.getElementById('replay-bgp')?.addEventListener('click', playBgpStates);
  document.getElementById('replay-request')?.addEventListener('click', playRequestSteps);
  document.getElementById('route-single')?.addEventListener('click', () => setRouteMode('single'));
  document.getElementById('route-ecmp')?.addEventListener('click', () => setRouteMode('ecmp'));
  document.getElementById('route-fail')?.addEventListener('click', () => setRouteMode('fail'));

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
  showSlide(indexFromHash(), false);
})();
