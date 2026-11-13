const $ = id => document.getElementById(id);
const snapshot = window.basketballSnapshot;
const clubs = snapshot.teams;
const tabs = ["games","my-team","standings","stats","highlights","betting","watch","learn","settings"];
const mem = new Map();
const esc = value => String(value ?? "").replace(/[&<>"']/g,char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
const fmt = (value,options) => new Intl.DateTimeFormat(undefined,options).format(new Date(value));
const leagueDay = () => new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const offset = (day,days) => new Date(Date.parse(day + "T12:00Z") + days * 86400000).toISOString().slice(0,10);
const dateText = (day,options) => fmt(day + "T12:00Z",{timeZone:"UTC",...options});
const logo = code => /^[A-Z]{2,4}$/.test(code) && code !== "TBD" ?
  '<img alt="" loading="lazy" src="https://a.espncdn.com/i/teamlogos/nba/500-dark/scoreboard/' + code.toLowerCase() + '.png">' : '<span></span>';
const empty = (title,body) => window.gameDeskMotion.placeholder(title,body);
const link = (url,label,className = "nba-link") => '<a target="_blank" rel="noopener" class="' + className + '" href="' +
  esc(url) + '">' + esc(label) + ' ↗</a>';
const matchName = game => game.away.name + (game.neutral ? " vs. " : " at ") + game.home.name;
const networkBadges = game => '<div class="networks">' + (game.networks.map(network =>
  '<span class="network">' + esc(network) + '</span>').join("") || '<span class="network tbd">Check local listings</span>') + '</div>';
const isFinal = game => game.state === "post" && /^Final/i.test(game.status) && game.away.score != null && game.home.score != null;
const isScheduled = game => game.state === "pre" && !/cancel|postpon/i.test(game.status);
const safeGet = key => { try { return localStorage.getItem("nba-" + key) || ""; } catch { return ""; } };
const save = (key,value) => { try { localStorage.setItem("nba-" + key,value); } catch {} };
const metrics = {
  avgPoints:["Points per game","How many points a player scores in an average game."],
  avgRebounds:["Rebounds per game","How often a player collects the ball after a missed shot."],
  avgAssists:["Assists per game","Passes that directly lead to a teammate’s made basket."],
  avgSteals:["Steals per game","How often a defender directly takes possession away."],
  avgBlocks:["Blocks per game","How often a defender deflects a shot attempt."],
  avgThreePointFieldGoalsMade:["Made threes per game","The average number of shots made from beyond the three-point line."],
  threePointFieldGoalPct:["Three-point percentage","The share of three-point attempts that go in. This view requires at least two attempts per game."]
};
let now = leagueDay();
let day = now;
let start = now;
let betDay = now;
let view = "games";
let zone = safeGet("zone");
let team = safeGet("game-team");
let network = "";
let slate = null;
let slateFresh = false;
let standings = null;
let stats = null;
let stamp = 0;
const season = () => Number(now.slice(0,4)) + (Number(now.slice(5,7)) >= 10 ? 1 : 0);
const clock = time => fmt(time,{timeZone:zone || undefined,hour:"numeric",minute:"2-digit",timeZoneName:"short"});
const timeText = game => game.timeValid ? clock(game.time) : "Tipoff TBD";
const phase = game => game.state === "in" ? '<span class="live">Live</span> ' + esc(game.detail) :
  isScheduled(game) ? esc(timeText(game)) : esc(game.detail || game.status);

async function load(path) {
  try {
    const response = await fetch("/basketball/api/" + path,{signal:AbortSignal.timeout(11000)});
    if (!response.ok) throw new Error("Feed unavailable");
    const data = await response.json();
    mem.set(path,data);
    return data;
  } catch {
    const saved = mem.get(path) ?? snapshot.payloads[path];
    return saved ? {...saved,stale:true} : null;
  }
}
function feedStatus(kind,message) {
  $("status").dataset.state = kind;
  $("status").textContent = message;
}
function renderDays() {
  const active = document.activeElement?.dataset.day;
  $("days").innerHTML = Array.from({length:7},(_,i) => {
    const key = offset(start,i);
    return '<button type="button" class="day" data-day="' + key + '" aria-pressed="' + (day === key) +
      '" aria-label="' + esc(dateText(key,{dateStyle:"full"})) + '"><strong>' + esc(dateText(key,{weekday:"short"})) +
      '</strong>' + esc(dateText(key,{month:"short",day:"numeric"})) + '</button>';
  }).join("");
  if (active) $("days").querySelector('[data-day="' + active + '"]')?.focus();
}
function row(club,won,side) {
  return '<div class="club">' + logo(club.code) + '<span>' + esc(club.short) + (club.record ? '<small>' + esc(club.record) + '</small>' : '') +
    '</span><span class="score' + (won ? ' win' : '') + '" data-score-side="' + side + '">' + esc(club.score) + '</span></div>';
}
function renderFeatured(games) {
  const pick = window.gameDeskSpotlight.choose(games,{sport:'basketball',favorite:window.gameDeskSpotlight.favorite(),stale:!slateFresh});
  const game = pick?.game;
  window.gameDeskSpotlight.mount($("featured").closest('section'),pick,game ? matchName(game) : '');
  const note = game ? (game.note ? game.note + '. ' : '') + (game.leaders.length ? 'Watch for ' + game.leaders.map(leader => leader.name).join(' and ') + '.' : 'Watch how each team creates open shots when the defense helps on a drive.') : '';
  window.gameDeskBooth.render($("featured"),{game,logo,phase:game ? phase(game) : '',networks:game?.networks || [],options:game ? window.gameDeskBroadcast.forNetworks(game.networks,{sport:'basketball',eventId:game.id}) : [],fresh:slateFresh,scope:day,onDetails:watchInfo,note});
  const finished = games.filter(isFinal);
  const [close] = [...finished].sort((a,b) => Math.abs(a.home.score - a.away.score) - Math.abs(b.home.score - b.away.score));
  const [high] = [...finished].sort((a,b) => b.home.score + b.away.score - a.home.score - a.away.score);
  $("stories").innerHTML = close ? '<p><strong>Closest finish</strong><br>' + esc(matchName(close) + " · " +
    close.away.score + "–" + close.home.score) + '</p><p><strong>Highest combined score</strong><br>' +
    esc(matchName(high) + " · " + (high.away.score + high.home.score) + " points") + '</p>' : '<p>Stories appear as games finish.</p>';
}
function renderGames(data) {
  window.gameDeskMotion.capture($("games"));
  renderDays();
  document.querySelector('.booth-heading h1').textContent = day === now ? 'Tonight' : dateText(day,{weekday:'long'});
  $("booth-date-label").textContent = dateText(day,{month:'short',day:'numeric'});
  $("all-games").setAttribute('aria-pressed',!team && !network);
  $("booth-team-filter").setAttribute('aria-pressed',Boolean(team && team === window.gameDeskSpotlight.favorite()));
  $("booth-filters").dataset.active = String(Boolean(team || network));
  $("booth-filter-count").textContent = team || network ? ': active' : '';
  const games = data.games;
  const channels = [...new Set(games.flatMap(game => game.networks))].sort();
  if (!channels.includes(network)) network = "";
  $("network").innerHTML = '<option value="">All networks</option>' + channels.map(channel =>
    '<option value="' + esc(channel) + '">' + esc(channel) + '</option>').join("");
  $("network").value = network;
  const visible = games.filter(game => (!team || game.away.code === team || game.home.code === team) &&
    (!network || game.networks.includes(network)));
  $("game-count").textContent = visible.length + (visible.length === 1 ? " game" : " games");
  window.gameDeskMotion.replaceGames($("games"),visible.map(game => '<article class="game nba-game" data-game-id="' + esc(game.id) + '" data-game-state="' + (game.state === 'in' ? 'live' : 'other') + '" aria-label="' + esc(matchName(game)) +
    '"><div class="matchup">' + row(game.away,isFinal(game) && game.away.score > game.home.score,'away') +
    row(game.home,isFinal(game) && game.home.score > game.away.score,'home') + '</div><div><div class="game-phase">' +
    phase(game) + '</div>' + networkBadges(game) + '<div class="venue">' +
    esc((game.note ? game.note + " · " : "") + (game.state !== "pre" ? timeText(game) + " · " : "") + game.venue) +
    '</div></div><div class="game-actions">' + window.gameDeskBroadcast.buttons(window.gameDeskBroadcast.forNetworks(game.networks,{sport:'basketball',eventId:game.id})[0],'watch-button',{context:matchName(game),key:String(game.id)}) + '<button type="button" class="game-info booth-details" data-game="' + esc(game.id) + '">Game details</button></div></article>').join("") ||
    empty(games.length ? "No matching games" : "No games scheduled",games.length ? "Try another team or network." : "Try another date on the schedule."));
  renderFeatured(games);
  window.gameDeskSettings.apply();
  window.gameDeskMotion.commit($("games"),{games,scope:day,fresh:slateFresh});
}
function watchInfo(game) {
  const nba = "https://www.nba.com/schedule";
  const available = window.gameDeskBroadcast.forNetworks(game.networks,{sport:'basketball',eventId:game.id});
  $("dialog-body").innerHTML = window.gameDeskMotion.readout(game,logo,phase(game)) + '<h3 id="dialog-title">' + esc(matchName(game)) + '</h3><p>' +
    esc(dateText(day,{dateStyle:"full"}) + " · " + timeText(game) + (game.venue ? " · " + game.venue : "")) +
    '</p>' + networkBadges(game) + '<p>Use the NBA schedule’s Tap to Watch option for your market. Local and national restrictions may apply.</p>' +
    window.gameDeskBroadcast.note(available) +
    '<div class="nba-dialog-actions">' + available.map(option => window.gameDeskBroadcast.buttons(option,"nba-action",{context:matchName(game)})).join('') + link(nba,"NBA schedule","control") +
    (isScheduled(game) && game.timeValid ? '<button id="nba-calendar" class="control" type="button">Add to calendar</button>' : '') + '</div>';
  $("game-dialog").showModal();
  $("nba-calendar")?.addEventListener("click",() => {
    const stamp = value => new Date(value).toISOString().replace(/[-:]|\.\d{3}/g,"");
    const title = matchName(game).replace(/[;,\\]/g,value => "\\" + value);
    const body = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//The Sofa League//NBA Schedule//EN","BEGIN:VEVENT",
      "UID:nba-" + game.id + "@the-game-desk","DTSTAMP:" + stamp(Date.now()),"DTSTART:" + stamp(game.time),"SUMMARY:" + title,
      "URL:" + nba,"END:VEVENT","END:VCALENDAR",""].join("\r\n");
    const url = URL.createObjectURL(new Blob([body],{type:"text/calendar"}));
    const download = document.createElement("a");
    download.href = url;
    download.download = game.away.code + "-" + game.home.code + ".ics";
    download.click();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  });
}
function renderStandings(data) {
  const filter = $("conference").value;
  $("standings").innerHTML = data.conferences.filter(group => !filter || filter === group.name).map(group =>
    '<section class="division"><h3>' + esc(group.name) + '</h3><table><caption class="sr">' + esc(group.name) +
    '</caption><thead><tr><th>Team</th><th>W</th><th>L</th><th>PCT</th><th>GB</th><th>DIFF</th><th>STREAK</th></tr></thead><tbody>' +
    group.teams.map((club,i) => '<tr' + ([6,10].includes(i) ? ' data-cutoff="true"' : '') +
      '><td><div class="team-cell"><span class="nba-seed">' + (i + 1) + '</span>' + logo(club.code) + esc(club.short) + '</div></td>' +
      [club.wins,club.losses,club.pct,club.gb,club.diff,club.streak].map(value => '<td>' + esc(value) + '</td>').join("") + '</tr>').join("") +
    '</tbody></table></section>').join("");
}
function renderStats(data) {
  const key = $("stat").value;
  const [name,meaning] = metrics[key];
  const maxByTeam = new Map();
  for (const player of data) maxByTeam.set(player.code,Math.max(maxByTeam.get(player.code) ?? 0,player.gp ?? 0));
  const ranked = data.filter(player => player.gp >= Math.ceil(maxByTeam.get(player.code) * .7) &&
    Number.isFinite(player[key]) && (key !== "threePointFieldGoalPct" || player.attempts >= 2))
    .sort((a,b) => b[key] - a[key]).slice(0,15);
  $("stat-note").textContent = meaning + " Players must have appeared in at least 70% of their team’s highest games-played total.";
  $("stats").innerHTML = ranked.length ? '<table><caption class="sr">' + esc(name) + '</caption><thead><tr><th>Player</th><th>Team</th><th>GP</th><th>' +
    esc(name) + '</th></tr></thead><tbody>' + ranked.map((player,i) => '<tr><td><span class="team-cell"><span class="nba-seed">' +
    (i + 1) + '</span>' + logo(player.code) + esc(player.name) + '</span></td><td>' + esc(player.code) + '</td><td>' +
    esc(player.gp) + '</td><td><strong>' + player[key].toFixed(1) + (key === "threePointFieldGoalPct" ? "%" : "") + '</strong></td></tr>').join("") +
    '</tbody></table>' : empty("No qualified players","Try another category as season stats are reported.");
}
function renderHighlight(data) {
  const target = $("highlights");
  if (target.dataset.video === data.id) return;
  target.dataset.video = data.id;
  target.innerHTML = '<article class="nba-recap"><div class="nba-recap-frame"><iframe src="https://www.youtube-nocookie.com/embed/' +
    esc(data.id) + '" title="' + esc(data.matchup + " · NBA highlights") +
    '" referrerpolicy="strict-origin-when-cross-origin" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>' +
    '<div class="nba-recap-info"><div><h3>' + esc(data.matchup) + '</h3><p class="muted">' +
    esc(fmt(data.played,{dateStyle:"medium",timeZone:"UTC"}) + (data.views ? " · " + new Intl.NumberFormat(undefined,{notation:"compact"}).format(data.views) + " views" : "")) +
    '</p></div>' + link("https://www.youtube.com/watch?v=" + data.id,"Watch on YouTube","control") +
    '</div></article><p class="muted">Selected by views from recent full-game recaps on the official NBA channel.</p>';
}
function renderBetting(data) {
  const imply = (line,value) => line.kind !== "Moneyline" ? value : value > 0 ? 100 / (value + 100) : -value / (100 - value);
  const odds = (line,value) => line.kind === "Moneyline" ? (value > 0 ? "+" : "") + value :
    (value * 100).toFixed(1).replace(/\.0$/,"") + "¢";
  const ranked = data.games.filter(game => game.lines.length).map(game => {
    const normalized = game.lines.map(line => {
      const a = imply(line,line.away), h = imply(line,line.home);
      return h / (a + h);
    });
    return {game,gap:normalized.length > 1 ? (Math.max(...normalized) - Math.min(...normalized)) * 100 : -1};
  }).sort((a,b) => b.gap - a.gap);
  $("betting").innerHTML = (data.unavailable.length ? '<p class="muted">' + esc(data.unavailable.join(" and ") + " feed unavailable.") + '</p>' : '') +
    (ranked.map(({game,gap}) => '<article class="division nba-market"><div class="nba-market-top"><div><h3>' + esc(matchName(game)) +
      '</h3><span>' + esc(timeText(game)) + '</span></div>' + (gap >= 0 ? '<span>' + gap.toFixed(1) + ' pts normalized gap</span>' : '') +
      '</div><table><caption class="sr">Pregame prices for ' + esc(matchName(game)) + '</caption><thead><tr><th>Source</th><th>' +
      esc(game.away.code) + '</th><th>' + esc(game.home.code) + '</th></tr></thead><tbody>' +
      game.lines.map(line => '<tr><td>' + esc(line.source) + '<small>' + esc(line.kind) + '</small></td><td>' +
      odds(line,line.away) + '</td><td>' + odds(line,line.home) + '</td></tr>').join("") + '</tbody></table>' +
      game.book.filter(line => line.spread || line.total).map(line => '<p class="spread-note">' + esc(line.source + " · " +
        [line.spread ? "Spread " + line.spread : "",line.total ? "Total " + line.total : ""].filter(Boolean).join(" · ")) + '</p>').join("") +
      '</article>').join("") || empty("No pregame lines available","Choose another date or check again closer to tipoff."));
}

async function refresh() {
  if (view === "my-team") return teamDesk.refresh();
  if (["learn","watch","settings"].includes(view)) return;
  const newDay = leagueDay();
  if (day === now && newDay !== now) day = start = newDay;
  if (betDay === now && newDay !== now) $("bet-date").value = betDay = newDay;
  now = newDay;
  $("season").textContent = "NBA SEASON " + (season() - 1) + "–" + String(season()).slice(-2);
  const id = ++stamp;
  $("refresh").disabled = true;
  const path = view === "games" ? "games/" + day : view === "betting" ? "betting/" + betDay :
    view === "highlights" ? "highlight" : view + "/" + season();
  const payload = await load(path);
  if (id !== stamp) return;
  $("refresh").disabled = false;
  if (!payload) {
    feedStatus("error","Feed temporarily unavailable");
    $(view).innerHTML = empty("Could not load this view","Use Refresh to try again.");
    if (view === "games") { window.gameDeskBooth.reset($("featured"),"Schedule temporarily unavailable.");window.gameDeskSpotlight.mount($("featured").closest('section'),null,''); }
    if (view === "highlights") {
      delete $("highlights").dataset.video;
      $("highlights").insertAdjacentHTML("beforeend",'<p>' + link("https://www.youtube.com/@NBA/videos","NBA on YouTube") + '</p>');
    }
    return;
  }
  if (view === "games") { slateFresh = !payload.stale; renderGames(slate = payload.data); }
  if (view === "standings") renderStandings(standings = payload.data);
  if (view === "stats") renderStats(stats = payload.data);
  if (view === "highlights") renderHighlight(payload.data);
  if (view === "betting") renderBetting(payload.data);
  feedStatus(payload.stale ? "saved" : "fresh",payload.stale ?
    "Saved data · " + fmt(payload.at,{month:"short",day:"numeric"}) + " " + clock(payload.at) :
    "Updated " + clock(payload.at) + " · " + window.gameDeskSettings.refreshText());
}
function selectDay(key,reset = false) {
  window.gameDeskBooth.closePicker();
  day = key;
  if (reset || key < start || key > offset(start,6)) start = key;
  slate = null;
  slateFresh = false;
  renderDays();
  $("game-count").textContent = "";
  $("games").innerHTML = empty("Loading games","Checking the NBA schedule for this date.");
  window.gameDeskBooth.reset($("featured"),"Checking the schedule.");
  window.gameDeskSpotlight.mount($("featured").closest('section'),null,'');
  refresh();
}
function navigate() {
  const next = location.hash.slice(2);
  view = tabs.includes(next) ? next : "games";
  if (!window.gameDeskSettings.guard(view)) return;
  stamp++;
  for (const key of tabs) {
    $("view-" + key).hidden = key !== view;
    const tab = document.querySelector('.app-links a[href="#/' + key + '"]');
    if (key === view) tab.setAttribute("aria-current","page");
    else tab.removeAttribute("aria-current");
  }
  if (view !== "highlights") {
    $("highlights").replaceChildren();
    delete $("highlights").dataset.video;
  }
  const staticView = ["my-team","learn","watch","settings"].includes(view);
  $("refresh").hidden = staticView;
  feedStatus("idle",staticView ? ({ "my-team":"NBA team dashboard",learn:"Beginner’s guide",watch:"U.S. broadcast guide",settings:"App settings" })[view] : "Checking NBA data");
  if (view === "games") {
    renderDays();
    if (slate?.date === day) renderGames(slate);
    else $("games").innerHTML = empty("Loading games","Checking the NBA schedule.");
  }
  if (view === 'standings') {
    if (standings) renderStandings(standings);
    else $("standings").innerHTML = empty('Loading standings','Checking both NBA conferences.');
  }
  if (view === 'stats') {
    if (stats) renderStats(stats);
    else $("stats").innerHTML = empty('Loading player stats','Checking the season’s player leaders.');
  }
  if (view === 'highlights') $("highlights").innerHTML = empty('Loading highlights','Checking the official NBA channel.');
  if (view === 'betting') $("betting").innerHTML = empty('Loading lines','Checking sportsbook and prediction-market listings.');
  refresh();
}

$("zone").value = zone;
if ($("zone").value !== zone) zone = "";
$("zone").onchange = event => {
  zone = event.target.value;
  save("zone",zone);
  if (view === "my-team") return teamDesk.refresh(true);
  refresh();
};
$("game-team").innerHTML = '<option value="">All teams</option>' + clubs.map(club =>
  '<option value="' + esc(club.code) + '">' + esc(club.name) + '</option>').join("");
$("game-team").value = team;
$("game-team").onchange = event => { team = event.target.value; save("game-team",team);$("booth-filters").open = false; if (slate) renderGames(slate); };
$("network").onchange = event => { network = event.target.value;$("booth-filters").open = false; if (slate) renderGames(slate); };
$("days").onclick = event => { const key = event.target.closest("[data-day]")?.dataset.day; if (key) selectDay(key); };
$("prev").onclick = () => selectDay(offset(day,-1));
$("next").onclick = () => selectDay(offset(day,1));
$("today").onclick = () => selectDay(leagueDay(),true);
$("view-games").onclick = event => {
  const id = event.target.closest("[data-game]")?.dataset.game;
  const game = slate?.games.find(game => game.id === id);
  if (game) watchInfo(game);
};
$("conference").onchange = () => { if (standings) renderStandings(standings); };
$("stat").innerHTML = Object.entries(metrics).map(([key,[name]]) => '<option value="' + key + '">' + name + '</option>').join("");
$("stat").onchange = () => { if (stats) renderStats(stats); };
$("bet-date").value = betDay;
$("bet-date").onchange = event => { betDay = event.target.value || now; event.target.value = betDay; refresh(); };
$("refresh").onclick = refresh;
const teamDesk = window.createTeamDesk({
  teams:clubs.map(club => [club.code,club.name]),logo,dateTime:clock,defaultTeam:() => team,
  dateLabel:time => fmt(time,{timeZone:zone || undefined,month:"short",day:"numeric"}),
  loadTeam:code => load("team/" + season() + "/" + clubs.find(club => club.code === code).id)
});
window.addEventListener("hashchange",navigate);
window.gameDeskSettings.watch(refresh);
navigate();

$("all-games").onclick = () => {team = network = '';$("game-team").value = '';save('game-team','');if (slate) renderGames(slate);};
$("booth-team-filter").onclick = () => {
  const favorite = window.gameDeskSpotlight.favorite();
  if (!favorite) {if (window.gameDeskSettings.value.tabs.basketball['my-team'] !== false) location.hash = '#/my-team';else {$("booth-filters").open = true;$("game-team").focus();}return;}
  team = favorite;network = '';$("game-team").value = team;save('game-team',team);if (slate) renderGames(slate);
};
