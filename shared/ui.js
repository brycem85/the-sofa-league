(() => {
  const paths = {
    games:'M3 5h18v16H3zM3 10h18M8 3v4m8-4v4M7 14h2m4 0h2m-8 3h2',
    'my-team':'m3 11 9-8 9 8M5 10v11h5v-7h4v7h5V10',
    standings:'M4 20V10h5v10m1 0V4h5v16m1 0v-6h5v6M2 20h21',
    stats:'M4 20V4m0 16h17M8 15l4-6 4 3 5-7',
    highlights:'M4 5h16v14H4zM10 9l5 3-5 3z',
    betting:'M4 17l5-5 4 3 7-10m-5 0h5v5M4 5v4m-2-2h4',
    watch:'M3 6h18v13H3zM9 22h6M8 2l4 4 4-4',
    learn:'M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3zM12 7v12',
    settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z'
  };
  const svg = path => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + path + '"/></svg>';
  document.querySelector('.game-mark').innerHTML = svg('M5 14h3v6H5zm6-9h3v15h-3zm6 4h3v11h-3z');
  document.querySelector('.game-brand>span:last-child').innerHTML = 'The Sofa League<b>.</b>';
  for (const link of document.querySelectorAll('.app-links a')) {
    const name = link.hash.slice(2);
    if (paths[name]) link.insertAdjacentHTML('afterbegin',svg(paths[name]));
  }
  const sport = window.gameDeskSport;
  if (document.documentElement.dataset.homeDesign === 'booth') document.querySelector('.game-brand>span:last-child').textContent = 'Sofa League';
  const titles = {hockey:'Your seat at <em>center ice.</em>',football:'Your seat for <em>game day.</em>',basketball:'Your seat for <em>tip-off.</em>'};
  const title = document.querySelector('.hero h1');
  title.id = 'hero-title';
  if (document.documentElement.dataset.homeDesign !== 'booth') title.innerHTML = titles[sport];
  const control = document.querySelector('.app-control');
  const controls = document.createElement('div');
  controls.className = 'app-controls';
  control.before(controls);
  controls.append(control);
  const appearance = document.createElement('button');
  appearance.type = 'button';
  appearance.className = 'appearance-toggle';
  appearance.id = 'appearance-toggle';
  controls.append(appearance);
  function appearanceLabel() {
    const dark = document.documentElement.dataset.appearance === 'dark';
    appearance.innerHTML = svg(dark ? 'M12 3v2m0 14v2M3 12h2m14 0h2M5.5 5.5 7 7m10 10 1.5 1.5M5.5 18.5 7 17M17 7l1.5-1.5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0' : 'M20 15A8 8 0 0 1 9 4a8.5 8.5 0 1 0 11 11');
    appearance.setAttribute('aria-label','Switch to ' + (dark ? 'light' : 'dark') + ' mode');
    appearance.title = appearance.getAttribute('aria-label');
    const booth = document.documentElement.dataset.homeDesign === 'booth';
    const fill = document.documentElement.dataset.teamTheme && document.documentElement.style.getPropertyValue('--team-panel').match(/\d+/g);
    const themeColor = fill ? '#' + fill.map(channel => Number(channel).toString(16).padStart(2,'0')).join('') : booth ? (dark ? '#152b43' : '#f0f5f7') : (dark ? '#1d1c18' : '#eee7d8');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',themeColor);
  }
  appearance.onclick = () => window.gameDeskSettings.setAppearance(document.documentElement.dataset.appearance === 'dark' ? 'light' : 'dark');
  window.addEventListener('game-desk-settings',appearanceLabel);
  window.addEventListener('game-desk-team-theme',appearanceLabel);
  appearanceLabel();
  const header = document.querySelector('.top');
  const markScroll = () => { header.dataset.scrolled = String(scrollY > 12); };
  window.addEventListener('scroll',markScroll,{passive:true});
  markScroll();
  let previous = location.hash;
  function enter() {
    if (previous === location.hash) return;
    previous = location.hash;
    window.gameDeskMotion?.navigate();
    window.scrollTo({top:0,behavior:'instant'});
  }
  window.addEventListener('hashchange',enter);
  const observeRefresh = button => {
    const update = () => {
      button.dataset.refreshing = String(button.disabled);
      button.setAttribute('aria-busy',String(button.disabled));
    };
    new MutationObserver(update).observe(button,{attributes:true,attributeFilter:['disabled']});
    update();
  };
  document.querySelectorAll('#refresh,#my-team-refresh').forEach(observeRefresh);
})();
