(() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g,char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const live = game => ['LIVE','CRIT','in'].includes(game.state);
  const final = game => ['OFF','FINAL'].includes(game.state) || (game.state === 'post' && /^Final/i.test(game.status ?? ''));
  const overtime = game => ['OT','SO'].includes(game.periodType) || /\b(?:OT|overtime|shootout)\b/i.test([game.detail,game.periodLabel].join(' '));
  const number = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
  function recordPct(record) {
    if (!/^\d+-\d+(?:-\d+)?$/.test(String(record ?? ''))) return null;
    const [wins,losses,ties = 0] = record.split('-').map(Number);
    return wins + losses + ties ? (wins + ties / 2) / (wins + losses + ties) : null;
  }
  function favorite() {
    try {
      const code = localStorage.getItem(window.gameDeskTheme.key);
      return Object.hasOwn(window.gameDeskColors,code) ? code : '';
    } catch { return ''; }
  }
  function choose(games,{sport,standings = [],favorite:team = '',region = 'US',stale = false} = {}) {
    const table = new Map(standings.map(row => [row.code,row]));
    const candidates = games.filter(game => game.away?.code && game.home?.code &&
      ![game.away.code,game.home.code].includes('TBD') && !['PPD','CNCL'].includes(game.scheduleState) &&
      !/cancel|postpon|suspend/i.test(game.status ?? ''));
    const rated = candidates.map(game => {
      const a = sport === 'hockey' ? number(table.get(game.away.code)?.pct) : recordPct(game.away.record);
      const h = sport === 'hockey' ? number(table.get(game.home.code)?.pct) : recordPct(game.home.record);
      const known = a !== null && h !== null && a >= 0 && a <= 1 && h >= 0 && h <= 1;
      const quality = known ? (a + h) / 2 - Math.abs(a - h) * .65 : .35;
      const includesTeam = Boolean(team && [game.away.code,game.home.code].includes(team));
      const networks = sport === 'hockey' ? [...new Set((game.tv ?? []).filter(channel => channel.country === region).map(channel => channel.network))] : game.networks ?? [];
      const national = sport === 'hockey' ? (game.tv ?? []).some(channel => channel.country === region && channel.market === 'N') :
        networks.some(name => /^(ESPN\+?|ABC|NBC|Peacock|Prime Video)$/i.test(name));
      const margin = number(game.away.score) !== null && number(game.home.score) !== null ? Math.abs(Number(game.away.score) - Number(game.home.score)) : null;
      const close = !stale && live(game) && margin !== null && margin <= ({hockey:1,football:8,basketball:6}[sport] ?? 0);
      const reasons = [];
      if (live(game)) reasons.push({kind:'live',text:stale ? 'The latest saved feed reported this game live; its present status is not confirmed.' : close ? 'It is live and within ' + margin + (sport === 'hockey' ? (margin === 1 ? ' goal.' : ' goals.') : (margin === 1 ? ' point.' : ' points.')) : 'The game is currently live in the available score feed.'});
      if (overtime(game)) reasons.push({kind:'overtime',text:final(game) ? 'The game reached overtime or a shootout, according to the final game status.' : (stale ? 'The saved game status' : 'The current game status') + ' lists overtime or a shootout.'});
      if (known) {
        const unit = sport === 'hockey' ? 'points percentages' : 'win percentages';
        reasons.push({kind:'record',text:game.away.code + ' and ' + game.home.code + ' have season ' + unit + ' of ' + (a * 100).toFixed(1) + '% and ' + (h * 100).toFixed(1) + '% in the available feed.'});
        if (Math.abs(a - h) <= .10) reasons.push({kind:'balance',text:'Their season ' + unit + ' are within ' + (Math.abs(a - h) * 100).toFixed(1) + ' percentage points, making this one of the more evenly matched options.'});
      }
      if (includesTeam) reasons.push({kind:'favorite',text:'It includes ' + ((game.away.code === team ? game.away.name : game.home.name) || team) + ', your selected team.'});
      if (national && networks.length) reasons.push({kind:'broadcast',text:'The broadcast feed lists ' + networks.join(' · ') + '.'});
      if (!reasons.length) reasons.push({kind:'fallback',text:'Selected from the available schedule using start time and broadcast information. There is not enough reliable data for a more specific storyline.'});
      const score = quality + (live(game) && !stale ? 2 : final(game) ? 0 : 1) + (close ? .10 : 0) +
        (overtime(game) && live(game) ? .12 : 0) + (national ? .035 : 0) + (includesTeam ? .065 : 0);
      return {game,reasons,score,includesTeam,mood:stale ? 'saved' : overtime(game) ? 'overtime' : live(game) ? 'live' : final(game) ? 'final' : 'scheduled',
        summary:stale ? 'A pick from the saved feed; check the latest game status.' : known ? (Math.abs(a - h) <= .10 ? 'A close match on season form.' : 'Season form puts this one on our radar.') : includesTeam ? 'Your team is part of this one.' : live(game) ? 'A live matchup worth checking in on.' : 'A pick from the available slate.'};
    });
    rated.sort((a,b) => b.score - a.score || (Date.parse(a.game.time) || 0) - (Date.parse(b.game.time) || 0) || String(a.game.id).localeCompare(String(b.game.id)));
    return rated[0] ?? null;
  }
  let current = null;
  let reasonDialog;
  function createDialog() {
    if (reasonDialog) return reasonDialog;
    reasonDialog = document.createElement('dialog');
    reasonDialog.className = 'why-dialog';
    reasonDialog.id = 'why-must-watch';
    reasonDialog.setAttribute('aria-labelledby','why-title');
    document.body.append(reasonDialog);
    reasonDialog.addEventListener('click',event => { if (event.target.closest('[data-dialog-close]')) window.gameDeskMotion.closeDialog(reasonDialog); });
    return reasonDialog;
  }
  function updateDialog() {
    const dialog = createDialog();
    const restoreCloseFocus = dialog.contains(document.activeElement);
    dialog.innerHTML = '<div class="dialog-top"><span class="eyebrow">THE THINKING BEHIND THE PICK</span><button type="button" class="square" data-dialog-close aria-label="Close explanation">×</button></div>' +
      '<h2 id="why-title">Why this game?</h2><p class="why-match">' + escape(current?.title || 'Must-Watch') + '</p>' +
      '<ul class="why-reasons">' + (current?.pick?.reasons ?? [{kind:'fallback',text:'The current schedule does not provide enough reliable information to explain this pick.'}]).map(reason =>
        '<li><span class="reason-mark" aria-hidden="true">' + ({live:'↗',overtime:'+',record:'%',balance:'≈',favorite:'★',broadcast:'↗',fallback:'•'}[reason.kind]) + '</span><span>' + escape(reason.text) + '</span></li>').join('') +
      '</ul><p class="why-footnote">Based on the schedule, game status, season records, broadcast listings and your saved team when available. This is a viewing suggestion, not a prediction.</p>';
    if (restoreCloseFocus) dialog.querySelector('button').focus({preventScroll:true});
  }
  function mount(container,pick,title) {
    current = pick ? {pick,title} : null;
    container.dataset.mood = pick?.mood || 'quiet';
    container.dataset.favoriteMatch = String(Boolean(pick?.includesTeam));
    const label = container.querySelector(':scope > .eyebrow');
    if (label) {
      label.classList.add('spotlight-kicker');
      if (!label.querySelector('.spotlight-label')) label.innerHTML = container.classList.contains('booth-spotlight')
        ? '<span class="spotlight-label">Must-Watch</span><button type="button" class="why-button" aria-label="Why is this game Must-Watch?" aria-haspopup="dialog">Why this game?</button>'
        : '<span class="spotlight-label">MUST-WATCH</span><button type="button" class="why-button" aria-label="Why is this game Must-Watch?" aria-haspopup="dialog">?</button><span class="ticket-edition">THE CLUBHOUSE PICK</span>';
      const button = label.querySelector('button');
      button.disabled = !pick;
      button.onclick = () => { updateDialog(); window.gameDeskMotion.setOrigin(container); createDialog().showModal(); };
    }
    if (reasonDialog?.open) updateDialog();
  }
  window.gameDeskSpotlight = {choose,favorite,mount,live,final,overtime,recordPct};
})();
