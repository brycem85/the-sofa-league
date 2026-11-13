window.createTeamDesk = function createTeamDesk({teams,logo,loadTeam,dateTime,dateLabel,defaultTeam}) {
  const select = document.getElementById("my-team-select");
  const body = document.getElementById("my-team-body");
  const status = document.getElementById("my-team-status");
  const reload = document.getElementById("my-team-refresh");
  const theme = window.gameDeskTheme;
  const entities = {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"};
  const html = value => String(value ?? "").replace(/[&<>"']/g,char => entities[char]);
  const date = dateLabel || (instant => new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric"}).format(new Date(instant)));
  const tile = (title,value) => '<div class="team-tile"><span>' + html(title) + '</span><strong>' + html(value) + '</strong></div>';
  const panel = (title,content) => '<section class="team-panel"><h3>' + html(title) + '</h3>' + content + '</section>';
  const muted = text => '<p class="team-muted">' + html(text) + '</p>';
  let selected = "";
  let loaded = "";
  let latest = null;
  let sequence = 0;
  let position = "";
  let search = "";
  let rosterOpen = false;
  let useDefault = true;
  const playerCache = new Map();
  const playerRequests = new Map();
  const expanded = new Set();
  const statStates = new Map();
  let currentRoster = [];
  let availability = [];
  const statsHtml = stats => '<dl class="player-stats">' + stats.map(stat => {
    const comparison = stat.comparison;
    const standing = comparison?.direction === 'up' ? 'above average' : comparison?.direction === 'down' ? 'below average' : 'equal to average at the shown precision';
    const explanation = comparison ? comparison.cohort + ' average ' + comparison.average + '; player is ' + standing + '. Based on ' + comparison.count + ' players.' : '';
    return '<div><dt>' + html(stat.label) + '</dt><dd>' + html(stat.value) + (comparison ? '<span class="player-benchmark" title="' + html(explanation) + '"><span>' + html(comparison.label) + ' <b>' + html(comparison.average) + '</b></span><span class="benchmark-arrow" data-direction="' + html(comparison.direction) + '" aria-hidden="true">' + (comparison.direction === 'up' ? '↑' : comparison.direction === 'down' ? '↓' : '=') + '</span><span class="sr">Player is ' + html(standing) + '. Sample: ' + html(comparison.count) + ' players.</span></span>' : '') + '</dd></div>';
  }).join('') + '</dl>';
  const playerKey = player => String(player.id || player.name);
  function playerContent(payload,id) {
    const player = currentRoster.find(player=>String(player.id)===id);
    const report = availability.find(report=>report.name===player?.name);
    const state = statStates.get(id);
    const opened = (key,fallback=false) => state?.has(key) ? state.get(key) : fallback;
    const data = payload.data;
    return (player?.bio ? muted(player.bio) : '') + (report ? muted('Availability: ' + report.status + (report.date ? ' · ' + date(report.date) : '')) : '') + '<p class="player-source">' + html(data.label) + ' · ' + html(data.source) + ((payload.at || payload.updatedAt) ? ' · Updated ' + html(dateTime(payload.at || payload.updatedAt)) : '') + (payload.stale ? ' · Saved data' : '') + '</p>' +
      (data.comparison ? '<details class="player-comparison-note"><summary>League comparison · ' + html(data.comparison.season) + '</summary><p>' + html(data.comparison.cohort) + ' with at least one appearance. Each benchmark is the mean per player for that same regular-season stat; rates require attempts, and sample counts vary by stat. Season totals and per-game averages stay separate. Career and recent-game stats are not compared.</p><p>Green ↑ means higher, red ↓ means lower, and = means equal at the shown precision. Direction describes the number; lower can be better for stats such as turnovers or goals against.</p><p>Benchmarks updated ' + html(dateTime(data.comparison.at)) + '.</p></details>' : data.comparisonStatus ? muted(data.comparisonStatus) : '') +
      (data.groups.length ? data.groups.map((group,index) => '<details class="player-stat-group" data-stat-key="' + html(group.title) + '"' + (opened(group.title,index === 0) ? ' open' : '') + '><summary>' + html(group.title) + '</summary>' + statsHtml(group.stats) + '</details>').join('') : muted('No season statistics reported yet.')) +
      (data.recent.length ? '<details class="player-stat-group" data-stat-key="recent"' + (opened('recent') ? ' open' : '') + '><summary>Recent games <span>Last ' + data.recent.length + '</span></summary>' + data.recent.map(game => '<details class="player-game" data-stat-key="' + html(game.date) + '"' + (opened(game.date) ? ' open' : '') + '><summary>' + html(date(game.date)) + ' · ' + html((game.home ? 'vs. ' : '@ ') + game.opponent) + '<span>' + html([game.result,game.score].filter(Boolean).join(' · ')) + '</span></summary>' + statsHtml(game.stats) + '</details>').join('') + '</details>' : '') +
      (window.gameDeskSport === 'basketball' ? muted('Per-game stats describe an average, not a prediction. Shooting percentages measure made shots out of attempts; rebounds recover missed shots, and assists lead directly to a basket.') : '') +
      '<button type="button" class="player-refresh" data-player-retry>Refresh player stats</button>';
  }
  async function hydratePlayer(disclosure,force = false) {
    const id = disclosure.dataset.player;
    const content = disclosure.querySelector('.player-detail-body');
    if (!/^\d{1,10}$/.test(id)) { content.innerHTML = muted('Detailed statistics are unavailable for this player.'); return; }
    const cached = playerCache.get(id);
    if (!force && cached && Date.now() - cached.time < 300000) { content.innerHTML = playerContent(cached.payload,id); return; }
    content.innerHTML = '<p class="team-muted" role="status">Loading player statistics…</p>';
    let request = playerRequests.get(id);
    if (!request) {
      request = fetch('/' + window.gameDeskSport + '/api/player/' + id,{signal:AbortSignal.timeout(10000)}).then(response => { if (!response.ok) throw new Error('Unavailable'); return response.json(); });
      playerRequests.set(id,request);
    }
    try {
      const payload = await request;
      playerCache.set(id,{time:Date.now(),payload});
      if (disclosure.isConnected) content.innerHTML = playerContent(payload,id);
    } catch {
      if (disclosure.isConnected) content.innerHTML = cached ? playerContent({...cached.payload,stale:true},id) : muted('Player statistics are temporarily unavailable.') + '<button type="button" class="player-refresh" data-player-retry>Try again</button>';
    } finally { if (playerRequests.get(id) === request) playerRequests.delete(id); }
  }
  try {
    const saved = localStorage.getItem(theme.key);
    selected = saved || "";
    useDefault = saved === null;
  } catch {}
  select.innerHTML = '<option value="">Choose a team</option>' + teams.map(([code,name]) =>
    '<option value="' + html(code) + '">' + html(name) + '</option>').join("");
  if (!teams.some(([code]) => code === selected)) selected = "";
  theme.apply(selected);

  function renderRoster(roster) {
    const target = document.getElementById("team-roster-rows");
    if (!target) return;
    const query = search.trim().toLowerCase();
    const visible = roster.filter(player => (!position || player.position === position) &&
      (!query || (player.name + " " + (player.number ?? "")).toLowerCase().includes(query)));
    target.innerHTML = visible.map(player => '<details class="team-player" data-player="' + html(player.id || '') + '" data-player-key="' + html(playerKey(player)) + '"' + (expanded.has(playerKey(player)) ? ' open' : '') + '><summary><span class="player-number">' + html(player.number ?? '–') + '</span><span class="player-name">' + html(player.name) + '<small>' + html([player.position,player.detail].filter(Boolean).join(' · ')) + '</small></span><span class="player-expand" aria-hidden="true">+</span></summary><div class="player-detail-body"></div></details>').join('') || muted('No matching players');
    for (const disclosure of target.querySelectorAll('.team-player')) {
      disclosure.addEventListener('toggle',() => {
        const key = disclosure.dataset.playerKey;
        if (disclosure.open) { expanded.add(key); hydratePlayer(disclosure); }
        else expanded.delete(key);
      });
      if (disclosure.open) hydratePlayer(disclosure);
    }
  }
  function render(data) {
    currentRoster = data.roster;
    availability = data.injuries;
    const recent = data.recent;
    const tally = ["W","L","OTL","T"].map(result => [result,recent.filter(game => game.result === result).length]);
    const momentum = recent.length ? tally.filter(([,count]) => count).map(([key,count]) => count + key).join(" · ") : "";
    const results = recent.map(game => '<div class="team-game"><b class="team-result ' +
      (game.result === "W" ? 'won' : '') + '">' + html(game.result) + '</b><div><strong>' +
      html((game.home ? "vs. " : "@ ") + game.opponent) + '</strong><small>' + html(date(game.time)) +
      '</small></div><span>' + html(game.score + "–" + game.opponentScore + (game.extra ? " " + game.extra : "")) + '</span></div>').join("");
    const upcoming = data.upcoming.map(game => '<div class="team-game"><div><strong>' +
      html((game.home ? "vs. " : "@ ") + game.opponent) + '</strong><small>' +
      html(date(game.time) + " · " + (game.timeValid === false ? "Time TBD" : dateTime(game.time))) +
      '</small></div><span>' + html(game.networks.join(" · ") || "Network TBD") + '</span></div>').join("");
    const players = data.leaders.map(group => '<section class="team-leaders"><h4>' + html(group.title) + '</h4>' +
      group.rows.map(player => {
        const match = data.roster.find(row => row.name === player.name);
        return match ? '<button type="button" class="team-leader-player" data-open-player="' + html(playerKey(match)) + '" aria-label="View ' + html(player.name) + ' stats"><span>' + html(player.name) + '</span><b>' + html(player.value) + '</b></button>' : '<div><span>' + html(player.name) + '</span><b>' + html(player.value) + '</b></div>';
      }).join("") + '</section>').join("");
    const injuries = data.injuries.map(player => '<div class="team-game"><div><strong>' + html(player.name) +
      '</strong><small>' + html([player.detail,player.date ? date(player.date) : ""].filter(Boolean).join(" · ")) +
      '</small></div><span>' + html(player.status) + '</span></div>').join("");
    const positions = [...new Set(data.roster.map(player => player.position).filter(Boolean))].sort();
    if (!positions.includes(position)) position = "";
    const focusedPlayer = document.activeElement?.closest('.team-player')?.dataset.playerKey;
    const focused = document.activeElement?.id;
    const cursor = focused === "team-player-search" ? document.activeElement.selectionStart : null;
    body.innerHTML = '<section class="team-banner"><div class="team-emblem">' + logo(data.team.code) +
      '</div><div><div class="eyebrow">TEAM DASHBOARD</div><h3>' + html(data.team.name) + '</h3>' +
      muted([data.team.record, data.team.context].filter(Boolean).join(" · ")) + '</div></section>' +
      (data.stats.length ? '<div class="team-metrics">' + data.stats.map(stat => tile(stat.label,stat.value)).join("") + '</div>' : '') +
      '<div class="team-grid">' + panel("Recent form", (momentum ? '<p class="team-form">Last ' + recent.length + ' · ' +
        html(momentum) + '</p>' : '') + (results || muted("No completed games available."))) +
      panel("Upcoming games",upcoming || muted("No upcoming games listed.")) + '</div>' +
      (players ? panel("Player leaders",'<div class="team-leader-grid">' + players + '</div>') : '') +
      (injuries ? panel("Roster availability",injuries) : '') +
      (data.roster.length ? '<details class="team-panel team-roster" id="team-roster"' + (rosterOpen ? ' open' : '') +
        '><summary>Roster <span>' + data.roster.length + ' players</span></summary><div class="team-roster-controls">' +
        '<label><span class="sr">Search roster</span><input id="team-player-search" placeholder="Search players" value="' + html(search) + '"></label>' +
        '<label><span class="sr">Filter roster by position</span><select id="team-position"><option value="">All positions</option>' +
        positions.map(code => '<option value="' + html(code) + '"' + (code === position ? ' selected' : '') + '>' +
          html(code) + '</option>').join("") +
        '</select></label></div><p class="team-muted">Select a player for season stats, career numbers and recent games where available.</p><div id="team-roster-rows"></div></details>' : '') +
      (data.unavailable.length ? muted("Some data is temporarily unavailable: " + data.unavailable.join(", ") + ".") : '');
    renderRoster(data.roster);
    const input = document.getElementById("team-player-search");
    const filter = document.getElementById("team-position");
    const roster = document.getElementById("team-roster");
    if (input) input.oninput = () => { search = input.value; renderRoster(data.roster); };
    if (filter) filter.onchange = () => { position = filter.value; renderRoster(data.roster); };
    if (roster) roster.ontoggle = () => { rosterOpen = roster.open; };
    if (focused === "team-player-search" && input) {
      input.focus();
      input.setSelectionRange(cursor,cursor);
    } else if (focused === "team-position" && filter) filter.focus();
    else if (focusedPlayer) [...body.querySelectorAll('.team-player')].find(row => row.dataset.playerKey === focusedPlayer)?.querySelector('summary').focus({preventScroll:true});
  }
  async function refresh(force = false) {
    const id = ++sequence;
    if (!selected && useDefault) {
      const fallback = defaultTeam?.();
      if (teams.some(([code]) => code === fallback)) selected = fallback;
      select.value = selected;
      theme.apply(selected);
    }
    if (!selected) {
      loaded = "";
      latest = null;
      status.textContent = "Choose a team to get started";
      reload.disabled = true;
      body.innerHTML = '<div class="team-panel">' + muted("Pick a team to see its recent form, next games, and player stats.") + '</div>';
      return;
    }
    if (loaded !== selected) {
      status.textContent = "Loading team data";
      body.innerHTML = window.gameDeskMotion.placeholder('Loading team data','Checking recent form, the next games, and the roster.');
    }
    reload.disabled = true;
    const payload = await loadTeam(selected);
    if (id !== sequence) return;
    reload.disabled = false;
    if (!payload) {
      status.textContent = loaded === selected ? "Could not refresh · Showing saved data" : "Team feed unavailable";
      if (loaded !== selected) body.innerHTML = '<div class="team-panel">' + muted("Team data is temporarily unavailable. Use Refresh to try again.") + '</div>';
      return;
    }
    const at = payload.at || payload.updatedAt;
    status.textContent = payload.stale ? "Saved data · " + date(at) + ", " + dateTime(at) :
      "Updated " + dateTime(at) + " · " + window.gameDeskSettings.refreshText();
    const next = JSON.stringify(payload.data);
    if (force || loaded !== selected || next !== latest) render(payload.data);
    loaded = selected;
    latest = next;
  }
  select.value = selected;
  select.onchange = () => {
    selected = select.value;
    useDefault = false;
    loaded = "";
    latest = null;
    position = search = "";
    rosterOpen = false;
    try { localStorage.setItem(theme.key,selected); } catch {}
    theme.apply(selected);
    refresh();
  };
  reload.onclick = () => refresh();
  body.addEventListener('toggle',event => {
    const key = event.target.dataset.statKey;
    const id = event.target.closest('.team-player')?.dataset.player;
    if (key && id) { if (!statStates.has(id)) statStates.set(id,new Map()); statStates.get(id).set(key,event.target.open); }
  },true);
  body.addEventListener('click',event => {
    const retry = event.target.closest('[data-player-retry]');
    if (retry) { hydratePlayer(retry.closest('.team-player'),true); return; }
    const leader = event.target.closest('[data-open-player]');
    if (!leader) return;
    const key = leader.dataset.openPlayer;
    search = position = '';
    document.getElementById('team-player-search').value = '';
    document.getElementById('team-position').value = '';
    const roster = document.getElementById('team-roster');
    roster.open = rosterOpen = true;
    expanded.add(key);
    renderRoster(currentRoster);
    const disclosure = [...body.querySelectorAll('.team-player')].find(row => row.dataset.playerKey === key);
    if (disclosure) { disclosure.querySelector('summary').focus(); disclosure.scrollIntoView({block:'nearest',behavior:window.gameDeskSettings.value.reduceMotion || matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth'}); }
  });
  return {refresh};
};
