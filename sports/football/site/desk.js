const $ = id => document.getElementById(id);
const snapshot = window.footballSnapshot;
const memory = new Map();
const escapes = {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"};
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => escapes[char]);
const get = key => { try { return localStorage.getItem("football-" + key) || ""; } catch { return ""; } };
const save = (key,value) => { try { localStorage.setItem("football-" + key,value); } catch {} };
const dateFormat = (time, options) => new Intl.DateTimeFormat(undefined,options).format(new Date(time));
const dayLabel = (day, options) => dateFormat(day + "T12:00:00Z",{timeZone:"UTC",...options});
const image = code => /^[A-Z0-9]{2,4}$/.test(code) && code !== "TBD"
  ? '<img alt="" loading="lazy" src="https://a.espncdn.com/i/teamlogos/nfl/500-dark/scoreboard/' + code.toLowerCase() + '.png">' : '<span></span>';
const empty = (title,message) => window.gameDeskMotion.placeholder(title,message);
const identity = data => data.type + "/" + data.week;
const weekKey = entry => "/api/schedule/" + current.data.year + "/" + identity(entry);

let current = snapshot["/api/schedule"];
let slate = current;
let scheduleReady = false;
let table = snapshot["/api/standings/" + current.data.year];
let pickedWeek = "";
let day = "";
let zone = get("zone");
let team = get("team");
let network = "";
let view = "games";
let request = 0;

function dayKey(time) {
  const parts = new Intl.DateTimeFormat("en-US",{timeZone:zone || undefined,year:"numeric",month:"2-digit",day:"2-digit"})
    .formatToParts(new Date(time));
  const value = key => parts.find(part => part.type === key).value;
  return value("year") + "-" + value("month") + "-" + value("day");
}
function kickoff(game) {
  return game.timeValid ? dateFormat(game.time,{timeZone:zone || undefined,hour:"numeric",minute:"2-digit",timeZoneName:"short"}) : "Kickoff TBD";
}
function state(game) {
  if (game.state === "in") return '<span class="live">Live</span> ' + esc(game.detail || game.status);
  if (game.state === "post" || (game.status && game.status !== "Scheduled")) return esc(game.detail || game.status);
  return esc(kickoff(game));
}
function networks(game) {
  return '<div class="networks">' + (game.networks.map(name => '<span class="network">' + esc(name) + '</span>').join("") ||
    '<span class="network tbd">Network TBD</span>') + '</div>';
}
function setStatus(type,text) {
  $("status").dataset.state = type;
  $("status").textContent = text;
}
async function load(path) {
  try {
    const result = await fetch("/football" + path,{signal:AbortSignal.timeout(10000)});
    if (!result.ok) throw new Error("Feed unavailable");
    const payload = await result.json();
    memory.set(path,payload);
    return payload;
  } catch {
    const saved = memory.get(path) || snapshot[path];
    return saved ? {...saved,stale:true} : null;
  }
}
function populateTeams() {
  if (!table) return;
  const teams = table.data.divisions.flatMap(division => division.teams).sort((a,b) => a.name.localeCompare(b.name));
  $("team").innerHTML = '<option value="">All teams</option>' +
    teams.map(club => '<option value="' + esc(club.code) + '">' + esc(club.name) + '</option>').join("");
  if (!teams.some(club => club.code === team)) team = "";
  $("team").value = team;
}
function renderWeek() {
  const season = current.data;
  const calendar = season.calendar;
  const selected = pickedWeek || identity(season);
  const index = calendar.findIndex(entry => identity(entry) === selected);
  document.querySelector('.booth-heading h1').textContent = pickedWeek ? 'NFL games' : 'This week';
  $("booth-date-label").textContent = !scheduleReady && !pickedWeek ? 'Checking week' : calendar.find(entry => identity(entry) === selected)?.name || 'Choose week';
  if (day) $("booth-date-label").textContent += ' / ' + dayLabel(day,{weekday:'short'});
  $("season").textContent = season.year + " NFL SEASON";
  $("week").innerHTML = '<option value="">Current week</option>' + calendar.map(entry =>
    '<option value="' + identity(entry) + '">' + esc(entry.name) + '</option>').join("");
  $("week").value = pickedWeek;
  $("prev").disabled = index <= 0;
  $("next").disabled = index < 0 || index >= calendar.length - 1;
}
function renderDays(games) {
  const dates = [...new Set(games.map(game => dayKey(game.time)))];
  const active = document.activeElement?.dataset.day;
  if (!dates.includes(day)) day = "";
  $("days").innerHTML = ['<button type="button" class="day" data-day="" aria-pressed="' + !day + '"><strong>All games</strong>' +
    games.length + (games.length === 1 ? ' game' : ' games') + '</button>', ...dates.map(date =>
    '<button type="button" class="day" data-day="' + date + '" aria-pressed="' + (date === day) +
    '" aria-label="' + esc(dayLabel(date,{dateStyle:"full"})) + '"><strong>' +
    esc(dayLabel(date,{weekday:"short"})) + '</strong>' + esc(dayLabel(date,{month:"short",day:"numeric"})) + '</button>')].join("");
  if (active !== undefined) [...$("days").querySelectorAll("button")].find(button => button.dataset.day === active)?.focus();
}
function clubRow(club,side) {
  return '<div class="club">' + image(club.code) + '<span>' + esc(club.short) +
    (club.record ? '<small>' + esc(club.record) + '</small>' : '') + '</span><span class="score' +
    (club.winner ? ' win' : '') + '" data-score-side="' + side + '">' + esc(club.score) + '</span></div>';
}
function gameCard(game) {
  return '<article class="game" data-game-id="' + esc(game.id) + '" data-game-state="' + (game.state === 'in' ? 'live' : 'other') + '" aria-label="' + esc(game.away.name + (game.neutral ? " vs. " : " at ") + game.home.name) +
    '"><div class="matchup">' + clubRow(game.away,'away') + clubRow(game.home,'home') + '</div><div><div class="game-phase">' +
    state(game) + '</div>' + networks(game) + '<div class="venue">' +
    esc((game.state !== "pre" ? kickoff(game) + (game.venue ? " · " : "") : "") + game.venue +
      (game.neutral ? " · Neutral site" : "")) + '</div></div><button class="control game-details" type="button" data-matchup="' + esc(game.id) + '" aria-label="Game details: ' + esc(game.away.name + ' at ' + game.home.name) + '">Game details</button></article>';
}
function renderFeatured(games) {
  const pick = window.gameDeskSpotlight.choose(games.filter(game => !day || dayKey(game.time) === day),{sport:'football',favorite:window.gameDeskSpotlight.favorite(),stale:Boolean(slate.stale)});
  const game = pick?.game;
  window.gameDeskSpotlight.mount($("football-spotlight"),pick,game ? game.away.name + ' at ' + game.home.name : '');
  window.gameDeskBooth.render($("featured"),{game,logo:image,phase:game ? dayLabel(dayKey(game.time),{weekday:'short',month:'short',day:'numeric'}) + ' ' + state(game) : '',networks:game?.networks || [],fresh:!slate.stale,scope:slate.data.year + '/' + identity(slate.data),onDetails:matchupDetails});
}
function renderGames() {
  window.gameDeskMotion.capture($("games"));
  renderWeek();
  $("all-games").setAttribute('aria-pressed',!team && !network);
  $("booth-team-filter").setAttribute('aria-pressed',Boolean(team && team === window.gameDeskSpotlight.favorite()));
  $("booth-filters").dataset.active = String(Boolean(team || network));
  $("booth-filter-count").textContent = team || network ? ': active' : '';
  if (!scheduleReady) {
    $("games").innerHTML = empty('Loading this week’s games','Checking the current NFL schedule and broadcast listings.');
    $("count").textContent = 'Checking the current week';
    return;
  }
  if (!slate) return;
  const games = slate.data.games;
  renderDays(games);
  const available = [...new Set(games.flatMap(game => game.networks))].sort();
  if (!available.includes(network)) network = "";
  $("network").innerHTML = '<option value="">All networks</option>' + available.map(name =>
    '<option value="' + esc(name) + '">' + esc(name) + '</option>').join("");
  $("network").value = network;
  const visible = games.filter(game => (!day || dayKey(game.time) === day) &&
    (!team || game.away.code === team || game.home.code === team) &&
    (!network || game.networks.includes(network)));
  $("count").textContent = visible.length + (visible.length === 1 ? " game" : " games");
  const grouped = Map.groupBy(visible,game => dayKey(game.time));
  window.gameDeskMotion.replaceGames($("games"),[...grouped].map(([date,entries]) => '<section aria-label="' +
    esc(dayLabel(date,{dateStyle:"full"})) + '"><h3 class="day-title">' +
    esc(dayLabel(date,{weekday:"long",month:"long",day:"numeric"})) + '</h3>' + entries.map(gameCard).join("") + '</section>').join("") ||
    empty(games.length ? "No matching games" : "No games listed",
      games.length ? "Try another day, team, or network." : "Check another week for scheduled matchups."));
  $("bye-card").hidden = !slate.data.byes.length;
  $("byes").textContent = slate.data.byes.map(club => club.short).join(" · ");
  renderFeatured(games);
  window.gameDeskSettings.apply();
  window.gameDeskMotion.commit($("games"),{games,scope:slate.data.year + '/' + identity(slate.data),fresh:!slate.stale});
}
function matchupDetails(game) {
  $("football-dialog-body").innerHTML = window.gameDeskMotion.readout(game,image,state(game)) +
    '<h3 id="football-dialog-title">' + esc(game.away.name + (game.neutral ? ' vs. ' : ' at ') + game.home.name) + '</h3><p>' +
    esc(dayLabel(dayKey(game.time),{dateStyle:'full'}) + ' · ' + kickoff(game)) + '</p>' + networks(game) +
    '<p>' + esc(game.venue || 'Venue not listed') + '</p><div class="matchup-records"><span>' + esc(game.away.code + ' · ' + (game.away.record || 'Record unavailable')) + '</span><span>' + esc(game.home.code + ' · ' + (game.home.record || 'Record unavailable')) + '</span></div><p class="muted">Broadcast availability depends on your local market. Listings may change.</p>';
  $("football-dialog").showModal();
}
function renderStandings() {
  if (!table) return;
  const conference = $("conference").value;
  $("standings").innerHTML = table.data.divisions.filter(division => !conference || division.conference === conference).map(division =>
    '<section class="division"><h3>' + esc(division.name) + '</h3><table><caption class="sr">' + esc(division.name) +
    ' standings</caption><thead><tr><th>Team</th><th>W</th><th>L</th><th>T</th><th>PCT</th><th>DIFF</th><th>DIV</th></tr></thead><tbody>' +
    division.teams.map(club => '<tr><td><span class="team-cell">' + image(club.code) + esc(club.short) +
      '</span></td>' + [club.w,club.l,club.t,club.pct,club.diff,club.division].map(value => '<td>' + esc(value) + '</td>').join("") +
      '</tr>').join("") + '</tbody></table></section>').join("");
}
async function refresh() {
  if (view === "settings") return;
  if (view === "my-team") return teamDesk.refresh();
  const id = ++request;
  $("refresh").disabled = true;
  const path = view === "standings" ? "/api/standings/" + current.data.year :
    pickedWeek ? weekKey(current.data.calendar.find(entry => identity(entry) === pickedWeek)) : "/api/schedule";
  const payload = await load(path);
  if (id !== request) return;
  $("refresh").disabled = false;
  if (!payload) {
    setStatus("error","NFL feed unavailable");
    if (view === "games") {$("games").innerHTML = empty("Schedule unavailable","Use Refresh to try again.");window.gameDeskBooth.reset($("featured"),"Recommendation unavailable. Use Refresh to try again.");window.gameDeskSpotlight.mount($("football-spotlight"),null,"");}
    else $("standings").innerHTML = empty("Standings unavailable","Use Refresh to try again.");
    return;
  }
  if (view === "standings") {
    table = payload;
    renderStandings();
    populateTeams();
  } else {
    scheduleReady = true;
    if (!pickedWeek) current = payload;
    slate = payload;
    renderGames();
  }
  const options = {timeZone:zone || undefined,hour:"numeric",minute:"2-digit",timeZoneName:"short"};
  setStatus(payload.stale ? "saved" : "fresh",payload.stale
    ? "Saved data · " + dateFormat(payload.at,{...options,month:"short",day:"numeric"})
    : "Updated " + dateFormat(payload.at,options) + " · " + window.gameDeskSettings.refreshText());
}
function changeWeek(key) {
  pickedWeek = key;
  day = "";
  slate = key ? memory.get(weekKey(current.data.calendar.find(entry => identity(entry) === key))) : current;
  renderWeek();
  if (slate) renderGames();
  else {
    $("days").replaceChildren();
    $("count").textContent = "";
    $("games").innerHTML = empty("Loading games","Checking the NFL schedule for this week.");
    window.gameDeskBooth.reset($("featured"),"Checking this week’s games.");
    window.gameDeskSpotlight.mount($("football-spotlight"),null,"");
    $("bye-card").hidden = true;
  }
  refresh();
}
function moveWeek(delta) {
  const calendar = current.data.calendar;
  const index = calendar.findIndex(entry => identity(entry) === (pickedWeek || identity(current.data)));
  const next = calendar[index + delta];
  if (next) changeWeek(identity(next) === identity(current.data) ? "" : identity(next));
}
function navigate() {
  const tabs = ["games","my-team","standings","settings"];
  const next = location.hash.slice(2);
  view = tabs.includes(next) ? next : "games";
  if (!window.gameDeskSettings.guard(view)) return;
  for (const tab of tabs) {
    $(tab + "-view").hidden = tab !== view;
    const link = document.querySelector('nav a[href="#/' + tab + '"]');
    if (tab === view) link.setAttribute("aria-current","page");
    else link.removeAttribute("aria-current");
  }
  $("refresh").hidden = view === "my-team" || view === "settings";
  if (view === "my-team" || view === "settings") {
    request++;
    setStatus("fresh",view === "settings" ? "App settings" : "NFL team dashboard");
  }
  if (view === "games") renderGames();
  else if (view === "standings") renderStandings();
  refresh();
}
$("zone").value = zone;
if ($("zone").value !== zone) zone = "";
populateTeams();
$("zone").onchange = event => {
  zone = event.target.value;
  save("zone",zone);
  day = "";
  if (view === "my-team") return teamDesk.refresh(true);
  if (view === "games") renderGames();
  refresh();
};
$("week").onchange = event => { changeWeek(event.target.value);window.gameDeskBooth.closePicker(); };
$("prev").onclick = () => moveWeek(-1);
$("next").onclick = () => moveWeek(1);
$("days").onclick = event => { const button = event.target.closest("[data-day]"); if (button) { day = button.dataset.day; renderGames();window.gameDeskBooth.closePicker(); } };
$("team").onchange = event => { team = event.target.value; save("team",team); $("booth-filters").open = false;renderGames(); };
$("network").onchange = event => { network = event.target.value;$("booth-filters").open = false; renderGames(); };
$("conference").onchange = renderStandings;
$("refresh").onclick = refresh;
document.addEventListener('click',event => {
  const id = event.target.closest('[data-matchup]')?.dataset.matchup;
  const game = id && slate?.data.games.find(game => String(game.id) === id);
  if (game) matchupDetails(game);
});
window.addEventListener("hashchange",navigate);
window.gameDeskSettings.watch(refresh);
const footballTeams = table.data.divisions.flatMap(division => division.teams);
const teamDesk = window.createTeamDesk({
  teams:footballTeams.map(club => [club.code,club.name]).sort((a,b) => a[1].localeCompare(b[1])),
  logo:image, defaultTeam:() => team,
  loadTeam:code => load("/api/team/" + current.data.year + "/" + footballTeams.find(club => club.code === code).id),
  dateLabel:instant => dateFormat(instant,{timeZone:zone || undefined,month:"short",day:"numeric"}),
  dateTime:instant => dateFormat(instant,{timeZone:zone || undefined,hour:"numeric",minute:"2-digit",timeZoneName:"short"})
});
navigate();

$("all-games").onclick = () => {team = network = '';$("team").value = '';save('team','');renderGames();};
$("booth-team-filter").onclick = () => {
  const favorite = window.gameDeskSpotlight.favorite();
  if (!favorite) {if (window.gameDeskSettings.value.tabs.football['my-team'] !== false) location.hash = '#/my-team';else {$("booth-filters").open = true;$("team").focus();}return;}
  team = favorite;network = '';$("team").value = team;save('team',team);renderGames();
};
