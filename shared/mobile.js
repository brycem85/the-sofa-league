(() => {
  const sourceLinks = [...document.querySelectorAll('.app-links a')];
  const primary = ['games','my-team','standings'];
  const labels = {games:'Games','my-team':'My Team',standings:'Standings'};
  const nav = document.createElement('nav');
  nav.className = 'mobile-nav';
  nav.setAttribute('aria-label','Quick navigation');
  nav.innerHTML = primary.map(name => {
    const source = sourceLinks.find(link => link.hash === '#/' + name);
    return '<a href="#/' + name + '" data-mobile-tab="' + name + '">' + source.querySelector('svg').outerHTML + '<span>' + labels[name] + '</span></a>';
  }).join('') + '<button type="button" aria-haspopup="dialog" aria-controls="desk-menu" aria-expanded="false"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg><span>More</span></button>';
  const more = nav.querySelector('button');
  const sheet = document.createElement('dialog');
  sheet.id = 'desk-menu';
  sheet.className = 'mobile-menu';
  sheet.setAttribute('aria-labelledby','desk-menu-title');
  sheet.innerHTML = '<div class="mobile-menu-top"><div><div class="eyebrow">THE SOFA LEAGUE</div><h2 id="desk-menu-title">More</h2></div><button type="button" class="square" aria-label="Close menu">×</button></div><div class="mobile-menu-links" aria-label="More pages"></div>';
  const menuLinks = sheet.querySelector('.mobile-menu-links');
  const order = ['stats','highlights','betting','watch','learn','settings'];
  for (const name of order) {
    const link = sourceLinks.find(link => link.hash === '#/' + name);
    if (!link) continue;
    const copy = link.cloneNode(true);
    copy.removeAttribute('aria-current');
    copy.dataset.mobileTab = copy.hash.slice(2);
    menuLinks.append(copy);
  }
  const close = () => { if (sheet.open) window.gameDeskMotion.closeDialog(sheet); };
  more.onclick = () => { window.gameDeskMotion.setOrigin(more); sheet.showModal(); more.setAttribute('aria-expanded','true'); };
  sheet.addEventListener('cancel',event => {event.preventDefault();close();});
  sheet.querySelector('button').onclick = close;
  sheet.addEventListener('close',() => {more.setAttribute('aria-expanded','false');more.focus({preventScroll:true});});
  sheet.addEventListener('click',event => {
    if (event.target.closest('a')) close();
    if (event.target === sheet) {
      const rect = sheet.getBoundingClientRect();
      if (event.clientY < rect.top || event.clientX < rect.left || event.clientX > rect.right) close();
    }
  });
  document.body.append(nav,sheet);
  const control = document.querySelector('.app-control');
  const desktopControls = control.parentElement;
  const preferences = document.createElement('div');
  preferences.className = 'mobile-viewing-preferences';
  preferences.innerHTML = '<span class="eyebrow">VIEWING PREFERENCES</span>';
  sheet.append(preferences);
  const mobileSize = matchMedia('(max-width:680px)');
  const placeControl = () => {
    if (mobileSize.matches) preferences.append(control);
    else desktopControls.prepend(control);
    preferences.hidden = !mobileSize.matches;
  };
  placeControl();
  const sync = () => {
    const view = document.documentElement.dataset.currentView || 'games';
    const settings = window.gameDeskSettings.value;
    for (const link of document.querySelectorAll('[data-mobile-tab]')) {
      const name = link.dataset.mobileTab;
      link.dataset.hubHidden = String(settings.tabs[window.gameDeskSport][name] === false);
      if (name === view) link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    }
    more.dataset.active = String(!primary.includes(view));
    more.setAttribute('aria-label',primary.includes(view) ? 'More' : 'More, current page: ' + (sourceLinks.find(link => link.hash === '#/' + view)?.textContent || view));
    if (settings.reduceMotion) sheet.dataset.reduceMotion = 'true';
    else delete sheet.dataset.reduceMotion;
  };
  window.addEventListener('game-desk-settings',sync);
  window.addEventListener('hashchange',() => {close();sync();});
  mobileSize.addEventListener('change',event => { if (!event.matches) close(); placeControl(); });
  sync();
})();
