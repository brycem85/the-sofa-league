(() => {
  const ledger = new window.GameDeskScoreLedger();
  const signatures = new WeakMap();
  const esc = value => String(value ?? '').replace(/[&<>"']/g,char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function render(container,{game,logo,phase,networks = [],options = [],fresh = false,scope = '',onDetails,note = ''}) {
    if (!game) { reset(container,'No recommended matchup on this date. Choose another date to explore the schedule.');return; }
    const updates = ledger.observe([game],{scope:window.gameDeskSport + ':' + scope,fresh:fresh && !document.hidden,favorite:window.gameDeskSpotlight.favorite()});
    const context = game.away.name + (game.neutral ? ' vs. ' : ' at ') + game.home.name;
    const focused = container.contains(document.activeElement) ? [...container.querySelectorAll('a,button')].indexOf(document.activeElement) : -1;
    const playback = options[0];
    const markup = '<div class="booth-scoreboard" role="group" aria-label="' + esc(context) + '">' + ['away','home'].map(side =>
      '<div class="booth-feature-club">' + logo(game[side].code) + '<span>' + esc(game[side].name) + '</span><strong class="score" data-score-side="' + side + '" aria-label="' + esc(game[side].name + ' score') + '">' + esc(game[side].score ?? '—') + '</strong></div>').join('') + '</div>' +
      '<div class="booth-feature-meta"><span>' + (fresh ? '' : 'Saved status: ') + phase + '</span><span>' + esc([...new Set(networks)].join(' / ') || 'Check local listings') + '</span></div>' +
      '<div class="booth-feature-actions">' + window.gameDeskBroadcast.buttons(playback,'primary',{context}) + '<button class="booth-details" type="button" data-booth-details>Game details</button></div>' +
      (playback?.scope === 'service' ? '<p class="booth-service-note">Opens the service; choose this game there.</p>' : '') +
      (note ? '<p class="booth-feature-context">' + esc(note) + '</p>' : '');
    if (signatures.get(container) !== markup) {
      container.innerHTML = markup;signatures.set(container,markup);
      if (focused >= 0) container.querySelectorAll('a,button')[focused]?.focus({preventScroll:true});
    }
    container.querySelector('[data-booth-details]').onclick = event => { window.gameDeskMotion.setOrigin(event.currentTarget);onDetails(game); };
    for (const update of updates) for (const side of update.changed) window.gameDeskMotion.rollScore(container.querySelector('[data-score-side="' + side + '"]'),update.old[side],update.scoring.includes(side));
  }
  function reset(container,message) { container.textContent = message;signatures.delete(container);ledger.disarm(); }
  function closePicker() { const picker = document.getElementById('booth-date-picker');picker.open = false;picker.querySelector('summary').focus({preventScroll:true}); }
  for (const picker of document.querySelectorAll('#booth-date-picker,#booth-filters')) {
    picker.addEventListener('toggle',() => { if (picker.open) for (const other of document.querySelectorAll('#booth-date-picker,#booth-filters')) if (other !== picker) other.open = false; });
    picker.addEventListener('keydown',event => { if (event.key === 'Escape' && picker.open) { picker.open = false;picker.querySelector('summary').focus(); } });
  }
  window.addEventListener('game-desk-settings',() => {
    const light = document.documentElement.dataset.appearance === 'light';
    for (const image of document.querySelectorAll('img[src^="https://a.espncdn.com/i/teamlogos/"]')) {
      const src = image.getAttribute('src'),next = src.replace(/\/500(?:-dark)?\//,light ? '/500/' : '/500-dark/');
      if (src !== next) image.src = next;
    }
  });
  window.gameDeskBooth = {render,reset,closePicker};
})();
