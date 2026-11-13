const $ = id => document.getElementById(id);
const nhl = "https://www.nhl.com";
const guide = nhl + "/info/how-to-watch-and-stream-nhl-games";
const blackout = nhl + "/info/watch-nhl-zipcode-blackout-lookup";
const espn = "https://www.espn.com/watch/";
const espnHockey = espn + "category/1a5f0227-a13e-396c-8cea-8961bc288666";
const nhlVideos = "https://www.youtube.com/@NHL/videos";
const views = ["games","my-team","standings","stats","highlights","betting","watch","settings"];
const sportsnet = "https://www.sportsnetplus.ca/";
const prime = "https://www.primevideo.com/salp/nhl-help";
const regionNames = { US: "United States", CA: "Canada", INT: "International" };
const teamNames = {
  ANA:"Anaheim Ducks", BOS:"Boston Bruins", BUF:"Buffalo Sabres", CAR:"Carolina Hurricanes",
  CBJ:"Columbus Blue Jackets", CGY:"Calgary Flames", CHI:"Chicago Blackhawks", COL:"Colorado Avalanche",
  DAL:"Dallas Stars", DET:"Detroit Red Wings", EDM:"Edmonton Oilers", FLA:"Florida Panthers",
  LAK:"Los Angeles Kings", MIN:"Minnesota Wild", MTL:"Montréal Canadiens", NJD:"New Jersey Devils",
  NSH:"Nashville Predators", NYI:"New York Islanders", NYR:"New York Rangers", OTT:"Ottawa Senators",
  PHI:"Philadelphia Flyers", PIT:"Pittsburgh Penguins", SEA:"Seattle Kraken", SJS:"San Jose Sharks",
  STL:"St. Louis Blues", TBL:"Tampa Bay Lightning", TOR:"Toronto Maple Leafs", UTA:"Utah Mammoth",
  VAN:"Vancouver Canucks", VGK:"Vegas Golden Knights", WPG:"Winnipeg Jets", WSH:"Washington Capitals"
};
const teams = Object.entries(teamNames).sort((a,b) => a[1].localeCompare(b[1]));
const categories = {
  points:["Points","skaters"], goals:["Goals","skaters"], assists:["Assists","skaters"],
  plusMinus:["Plus/minus","skaters"], wins:["Goalie wins","goalies"],
  savePctg:["Save %","goalies"], goalsAgainstAverage:["GAA","goalies"], shutouts:["Shutouts","goalies"]
};
const providers = [
  [/^ESPN|^ABC$|^ESPN\+$/, espn],
  [/^HULU$/i, "https://www.hulu.com/live-sports"],
  [/^DISNEY\+$/i, "https://www.disneyplus.com/"],
  [/^TNT$|^TBS$|^TRUTV$|^HBO MAX$/i, "https://www.hbomax.com/sports"],
  [/^SN(?:\+|[EOPW1])?$/, sportsnet],
  [/^PRIME VIDEO$/i, prime],
  [/^TSN/, "https://www.tsn.ca/"],
  [/^TVAS/, "https://www.tvasports.ca/"],
  [/^RDS/, "https://www.rds.ca/"],
  [/^MSG/, "https://www.gothamsports.com/"]
];
const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const save = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
};
const fmt = (date, options) => new Intl.DateTimeFormat(undefined, options).format(date);
const leagueDate = () => new Intl.DateTimeFormat("en-CA", {
  timeZone:"America/New_York", year:"numeric", month:"2-digit", day:"2-digit"
}).format(new Date());
const utcDate = key => new Date(key + "T12:00:00Z");
const dateText = (key, options) => fmt(utcDate(key), { timeZone:"UTC", ...options });
const offset = (key, days) => {
  const date = utcDate(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0,10);
};
const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
})[char]);
const link = (url, label, className = "") => '<a class="' + className + '" target="_blank" rel="noopener" href="' + escape(url) + '">' + escape(label) + ' ↗</a>';
const logo = code => '<img loading="lazy" alt="" src="https://assets.nhle.com/logos/nhl/svg/' + escape(code) + '_' + (document.documentElement.dataset.appearance === "light" ? "light" : "dark") + '.svg">';
const name = team => teamNames[team.code] || team.name || team.code;
const clock = instant => fmt(new Date(instant), {hour:"numeric",minute:"2-digit",timeZoneName:"short"});
const placeholder = (title, body) => window.gameDeskMotion.placeholder(title,body);

let region = read("desk-region", "US");
if (!regionNames[region]) region = "US";
let followed = new Set(read("desk-followed", []).filter(code => teamNames[code]));
let today = leagueDate();
let day = today;
let start = day;
let betDay = today;
let view = "games";
let category = "points";
let team = "";
let onlyFollowed = false;
let request = 0;
let week = null;
let scoreboard = null;
let espnSchedule = null;
let standings = null;
let highlight = null;
const leaders = {};

const memory = new Map();

function espnStatus(game) {
  const us = game.tv.filter(channel => channel.country === "US");
  if (us.some(channel => /^ESPN\+$/i.test(channel.network))) {
    return ["confirmed","ESPN+ · Listed","ESPN+ is listed for this game in the U.S. A subscription and applicable location restrictions may apply."];
  }
  if (us.some(channel => channel.market === "N" || /^(NHLN|NHL NETWORK|ABC|ESPN2?|TNT|TBS|TRUTV|HBO MAX|HULU|DISNEY\+)$/i.test(channel.network))) {
    return ["","ESPN+ · Not listed","The NHL lists a U.S. national broadcast and does not list ESPN+ for this game. Check the listed network."];
  }
  if (us.length && us.every(channel => ["A","H"].includes(channel.market)) && [2,3].includes(game.type)) {
    return ["market","ESPN+ · Out of market","This U.S. regional game may be available through NHL Power Play on ESPN+ outside the teams’ home markets. Check ESPN and your local blackout rules."];
  }
  return ["","ESPN+ · Unconfirmed","The NHL feed hasn’t confirmed ESPN+ availability. Check the official game listing and ESPN."];
}
function espnPlayback(game, date = day) {
  if (region !== "US" || ["PPD","CNCL"].includes(game.scheduleState)) return null;
  const events = espnSchedule?.date === date ? espnSchedule.games : [];
  const matches = events.filter(event => event.home === game.home.code && event.away === game.away.code &&
    Math.abs(Date.parse(event.time) - Date.parse(game.time)) <= 60 * 60 * 1000);
  if (matches.length === 1) {
    return {url:espn + "player/_/eventCalendarId/" + matches[0].id, eventId:matches[0].id, label:"Watch on ESPN+"};
  }
  if (espnStatus(game)[0]) return {url:espnHockey, label:"Find on ESPN+"};
  return null;
}
function channelsFor(game) {
  return game.tv.filter(channel => channel.country === region);
}
function playbackOptions(game,date = day) {
  const espn = espnPlayback(game,date);
  return window.gameDeskBroadcast.forNetworks(channelsFor(game).map(channel => channel.network),{
    sport:'hockey',allowEspn:region === 'US',includeEspn:Boolean(espn),
    eventId:espn?.eventId,espnWebUrl:espn?.url,espnWebLabel:espn?.label
  });
}
function currentGames() {
  const scheduled = week?.data.days.find(entry => entry.date === day)?.games;
  if (!scheduled) return scoreboard?.data.games ?? null;
  const scores = new Map((scoreboard?.data.games ?? []).map(game => [game.id, game]));
  return scheduled.map(game => {
    const score = scores.get(game.id);
    if (!score) return game;
    return { ...game, ...score, tv: score.tv.length ? score.tv : game.tv };
  });
}
function renderWeek() {
  const focusedDay = document.activeElement?.dataset.day;
  $("week").innerHTML = Array.from({length:7}, (_, index) => {
    const key = offset(start,index);
    const count = week?.data.days.find(entry => entry.date === key)?.games.length;
    return '<button type="button" data-day="' + key + '" aria-pressed="' + (key === day) +
      '" aria-label="' + escape(dateText(key,{dateStyle:"full"})) + '">' +
      dateText(key,{weekday:"short"}) + '<strong>' + Number(key.slice(-2)) +
      '</strong><small>' + (count === undefined ? dateText(key,{month:"short"}) : count + (count === 1 ? ' game' : ' games')) + '</small></button>';
  }).join("");
  if (focusedDay) $("week").querySelector('[data-day="' + focusedDay + '"]')?.focus();
}
function club(team, side) {
  return '<div class="club">' + logo(team.code) + '<span>' + escape(team.name || name(team)) + '<small>' + side +
    '</small></span><span class="score" data-score-side="' + side.toLowerCase() + '">' + escape(team.score ?? "") + '</span></div>';
}
function phase(game) {
  if (["OFF","FINAL"].includes(game.state)) return 'Final' + (["OT","SO"].includes(game.periodType) ? ' / ' + game.periodType : '');
  if (["LIVE","CRIT"].includes(game.state)) return '<span class="live">Live</span> ' + escape(game.periodLabel || "");
  if (game.scheduleState === "PPD") return "Postponed";
  if (game.scheduleState === "CNCL") return "Canceled";
  return escape(clock(game.time));
}
function renderSpotlight(games, table,stale = false) {
  const pick = window.gameDeskSpotlight.choose(games,{sport:'hockey',standings:table,favorite:window.gameDeskSpotlight.favorite(),region,stale});
  const game = pick?.game;
  const body = $("spotlight-body");
  window.gameDeskSpotlight.mount($("spotlight"),pick,game ? name(game.away) + ' at ' + name(game.home) : '');
  window.gameDeskBooth.render(body,{game:game ? {...game,away:{...game.away,name:name(game.away)},home:{...game.home,name:name(game.home)}} : null,logo,phase:game ? phase(game) : '',
    networks:game ? channelsFor(game).map(channel => channel.network) : [],options:game ? playbackOptions(game,day) : [],fresh:!stale,scope:day,onDetails:game => gameDialog(game,day)});
}

function renderBetting(payload) {
  const probability = (value, kind) => kind !== "moneyline" ? value :
    value > 0 ? 100 / (value + 100) : -value / (100 - value);
  const ranked = payload.games.filter(game => game.lines.length).map(game => {
    const weights = game.lines.map(line => {
      const a = probability(line.away,line.kind);
      const h = probability(line.home,line.kind);
      return h / (a + h);
    });
    return {game, gap:weights.length > 1 ? (Math.max(...weights) - Math.min(...weights)) * 100 : null};
  }).sort((a,b) => (b.gap ?? -1) - (a.gap ?? -1) || Date.parse(a.game.time) - Date.parse(b.game.time));
  const quote = (value, kind) => kind === "moneyline" ? (value > 0 ? "+" : "") + value : (value * 100).toFixed(1).replace(/\.0$/,"") + "¢";
  const sourceKind = {moneyline:"Moneyline",ask:"YES ask",quote:"Outcome price"};
  const limited = payload.unavailable.length ? '<p class="muted">' + escape(payload.unavailable.join(" and ") + " feed unavailable. Showing the sources that responded.") + '</p>' : '';
  $("betting").innerHTML = limited + (ranked.map(({game,gap}) => '<article class="bet-card"><div class="bet-heading"><div><h3>' +
    escape(name(game.away) + " at " + name(game.home)) + '</h3><div class="muted">' + escape(clock(game.time)) + '</div></div>' +
    (gap === null ? '' : '<span class="bet-gap">' + gap.toFixed(1) + ' pts normalized gap</span>') +
    '</div><div class="bet-table"><table><caption class="sr">Pregame quotes for ' + escape(name(game.away) + " at " + name(game.home)) +
    '</caption><thead><tr><th scope="col">Source</th><th scope="col">' + escape(game.away.code) +
    '</th><th scope="col">' + escape(game.home.code) + '</th></tr></thead><tbody>' +
    game.lines.map(line => '<tr><td>' + escape(line.provider) + '<small>' + sourceKind[line.kind] +
      '</small></td><td class="bet-quote">' + quote(line.away,line.kind) + '</td><td class="bet-quote">' +
      quote(line.home,line.kind) + '</td></tr>').join("") + '</tbody></table></div></article>').join("") ||
    placeholder("No pregame lines available","Choose another date or check again closer to puck drop."));
}
function renderGames() {
  window.gameDeskMotion.capture($("games"));
  renderWeek();
  const focusedGame = document.activeElement?.dataset.game;
  const focusedStream = document.activeElement?.dataset.stream;
  const games = currentGames();
  $("date-label").textContent = dateText(day,{weekday:"long",month:"short",day:"numeric"});
  $("only-faves").setAttribute("aria-pressed", onlyFollowed);
  $("all-games").setAttribute("aria-pressed",!onlyFollowed && !team);
  $("booth-filters").dataset.active = String(Boolean(team));
  $("booth-filter-count").textContent = team ? ': ' + teamNames[team] : '';
  $("booth-date-label").textContent = dateText(day,{month:'short',day:'numeric'});
  document.querySelector('.booth-heading h1').textContent = day === today ? 'Tonight' : dateText(day,{weekday:'long'});
  $("game-count").textContent = "";
  if (!games) {
    $("games").innerHTML = placeholder("Loading games","Checking the NHL schedule for this date.");
    return;
  }
  const matches = (game, predicate) => [game.away,game.home].some(club => predicate(club.code));
  const following = new Set([...followed,window.gameDeskSpotlight.favorite()].filter(Boolean));
  const visible = games.filter(game => (!team || matches(game, code => code === team)) &&
    (!onlyFollowed || matches(game, code => following.has(code))));
  $("game-count").textContent = visible.length + (visible.length === 1 ? " game" : " games");
  window.gameDeskMotion.replaceGames($("games"),visible.map(game => {
    const [style,label] = espnStatus(game);
    const playback = playbackOptions(game)[0];
    const networks = channelsFor(game).map(channel => channel.network);
    const info = '<button type="button" class="' + (playback ? 'text-button game-info' : 'watch-button') +
      '" data-game="' + game.id + '">Game details</button>';
    const actions = window.gameDeskBroadcast.buttons(playback,'watch-button',{
      key:String(game.id),context:name(game.away) + ' at ' + name(game.home)
    }) + info;
    return '<article class="game" data-game-id="' + game.id + '" data-game-state="' + (game.state === 'LIVE' || game.state === 'CRIT' ? 'live' : 'other') + '" aria-label="' + escape(name(game.away) + ' at ' + name(game.home)) +
      '"><div class="matchup">' + club(game.away,"AWAY") + club(game.home,"HOME") +
      '</div><div><div class="airtime">' + phase(game) + '</div><div class="network">' +
      escape(networks.length ? [...new Set(networks)].join(" · ") : region === "INT" ? "See country guide" : "Check local listings") +
      '</div><span class="espn ' + style + '">' + label + '</span></div><div class="game-actions">' + actions + '</div></article>';
  }).join("") || placeholder(onlyFollowed && !following.size ? "No followed teams yet" : "No matching games",
    onlyFollowed && !following.size ? "Choose teams below to build your Following filter." :
    games.length ? "Try another team filter or choose a different date." : "There are no NHL games on this date."));
  if (onlyFollowed && !following.size) $("games").insertAdjacentHTML('beforeend','<button class="soft-button" type="button" data-manage-following>Choose teams to follow</button>');
  if (focusedGame) $("games").querySelector('[data-game="' + focusedGame + '"]')?.focus({preventScroll:true});
  if (focusedStream) $("games").querySelector('[data-stream="' + focusedStream + '"]')?.focus({preventScroll:true});
  window.gameDeskSettings.apply();
  window.gameDeskMotion.commit($("games"),{games,scope:day,fresh:Boolean(scoreboard && !scoreboard.stale)});
}
function renderFollowed() {
  $("followed").innerHTML = followed.size
    ? '<div class="fave-list">' + teams.filter(([code]) => followed.has(code)).map(([code, label]) =>
      '<button class="fave" type="button" title="' + escape(label) + '" data-team="' + code + '">' + logo(code) + code + '</button>').join("") + '</div>'
    : '<p>Follow your clubs to find their games faster.</p>';
}
function renderStandings() {
  if (!standings) return;
  const group = $("standing-group").value;
  const rows = standings.data.teams.filter(team => group === "league" || team.division === group);
  const rank = team => group === "league" ? team.rank : team.divisionRank;
  rows.sort((a,b) => rank(a) - rank(b));
  $("standings").innerHTML = '<table><caption class="sr">NHL standings for ' + escape(group) +
    '</caption><thead><tr><th>#</th><th>Team</th><th>GP</th><th>W</th><th>L</th><th>OTL</th><th>PTS</th><th>PTS%</th><th>GF</th><th>GA</th><th>Streak</th></tr></thead><tbody>' +
    rows.map(club => '<tr><td>' + rank(club) + '</td><td><span class="standing-team">' + logo(club.code) + escape(club.name) +
    '</span></td><td>' + club.games + '</td><td>' + club.wins + '</td><td>' + club.losses + '</td><td>' + club.ot +
    '</td><td><strong>' + club.points + '</strong></td><td>' + (club.pct * 100).toFixed(1) +
    '%</td><td>' + club.gf + '</td><td>' + club.ga + '</td><td>' + escape(club.streak) + '</td></tr>').join("") + '</tbody></table>';
}
function renderStats() {
  const [label, source] = categories[category];
  const players = leaders[source]?.data[category];
  $("stat-tabs").innerHTML = Object.entries(categories).map(([key,[title]]) =>
    '<button type="button" aria-pressed="' + (key === category) + '" data-stat="' + key + '">' + title + '</button>').join("");
  if (!players?.length) {
    $("stats").innerHTML = placeholder(players ? "No leaders yet" : "Loading player leaders","The NHL leaderboards update as games finish.");
    return;
  }
  const value = stat => category === "savePctg" ? (stat * 100).toFixed(1) + "%" :
    category === "goalsAgainstAverage" ? stat.toFixed(2) : stat;
  $("stats").innerHTML = '<table><caption class="sr">' + label + ' leaders</caption><thead><tr><th>#</th><th>Player</th><th>Team</th><th>' +
    label + '</th></tr></thead><tbody>' + players.map((player,index) => {
      const rank = players.findIndex(other => other.value === player.value) + 1;
      return '<tr><td>' + (rank || index + 1) + '</td><td><span class="player">' +
        (player.photo ? '<img loading="lazy" alt="" src="' + escape(player.photo) + '">' : '') + '<span><strong>' +
        escape(player.name) + '</strong><small>' + escape(player.position) + '</small></span></span></td><td>' +
        escape(player.code) + '</td><td><strong>' + escape(value(player.value)) + '</strong></td></tr>';
    }).join("") + '</tbody></table>';
}
function renderHighlight() {
  const clip = highlight?.data.highlight;
  if (!clip) return;
  const container = $("highlights");
  if (container.dataset.video !== clip.id) {
    container.dataset.video = clip.id;
    container.innerHTML = '<article class="highlight-card"><div class="highlight-player">' +
      '<iframe src="https://www.youtube-nocookie.com/embed/' + escape(clip.id) +
      '" title="' + escape(clip.matchup + " · NHL highlights") +
      '" referrerpolicy="strict-origin-when-cross-origin" allow="encrypted-media; picture-in-picture; web-share; fullscreen" allowfullscreen></iframe></div>' +
      '<div class="highlight-details"><div><div class="eyebrow">GAME RECAP</div><h3>' +
      escape(clip.matchup) + '</h3><p class="muted" id="highlight-meta"></p></div>' +
      link("https://www.youtube.com/watch?v=" + clip.id,"Watch on YouTube","soft-button") +
      '</div></article><p class="highlight-note muted">Picked by YouTube views among recaps for the most recent game day in the official NHL feed.</p>';
  }
  const count = new Intl.NumberFormat(undefined,{notation:"compact"}).format(clip.views);
  $("highlight-meta").textContent = fmt(new Date(clip.played),{dateStyle:"medium",timeZone:"UTC"}) +
    (clip.views ? " · " + count + " views" : "");
}
const watchCards = {
  US: [
    ["STREAMING","ESPN+ & NHL Power Play","Open ESPN and sign in with the account tied to your subscription. For a specific matchup, use Watch on ESPN+ on the game card. Local blackouts and national exclusives can apply.",espnHockey,"Open ESPN+ hockey"],
    ["NATIONAL TV","TNT & HBO Max","Look for TNT or HBO Max on the matchup. The NHL lists its national partners and how to watch.", "https://www.hbomax.com/sports","Open HBO Max"],
    ["LOCAL MARKETS","Regional broadcasts","Check which local network carries your team. The NHL’s broadcast lookup uses your ZIP or postal code.",blackout,"Check broadcast area"]
  ],
  CA: [
    ["STREAMING","Sportsnet+","Find Sportsnet’s national coverage and out-of-market regional games where available.",sportsnet,"Open Sportsnet+"],
    ["NATIONAL STREAMING","Prime Video","Prime Video carries national Wednesday night NHL games in Canada for the 2026–27 regular season.",prime,"Open Prime Video"],
    ["LOCAL MARKETS","Regional & French coverage","Check the matchup for Sportsnet, TSN, RDS and TVA Sports listings. Availability depends on your market.",blackout,"Check broadcast area"]
  ],
  INT: [
    ["BY COUNTRY","Official NHL guide","Find the league’s broadcasters for your country or territory.",guide,"Open NHL viewing guide"],
    ["STREAMING","NHL.TV on DAZN","NHL.TV is available on DAZN in participating territories. Check the NHL’s list for your location.", "https://www.dazn.com/","Open DAZN"]
  ]
};
function renderWatch() {
  $("watch-teaser").textContent = "See official TV and streaming options for " + (region === "INT" ? "your country." : "the " + regionNames[region] + ".");
  $("watch").innerHTML = watchCards[region].map(([tag,title,description,url,label]) =>
    '<article class="watch-card"><div class="eyebrow">' + tag + '</div><h3>' + title + '</h3><p>' +
    description + '</p>' + link(url,label,"inline-link") + '</article>').join("") +
    '<article class="watch-card"><div class="eyebrow">LISTING KEY</div><h3>Reading ESPN+ labels</h3><p>Listed means ESPN+ appears on the U.S. game listing. Out of market means the game may be available on NHL Power Play depending on your location. Not listed and Unconfirmed direct you to the NHL listing.</p>' +
    link(guide,"Official NHL guide","inline-link") + '</article>';
}
function dialog(kicker, body) {
  $("dialog-kicker").textContent = kicker;
  $("dialog-content").innerHTML = body;
  if (!$("dialog").open) $("dialog").showModal();
}
function gameDialog(game, date = day) {
  const channels = channelsFor(game);
  const [style,label,explanation] = espnStatus(game);
  const options = playbackOptions(game,date);
  const playback = options[0];
  const networks = [...new Set(channels.map(channel => channel.network))];
  const badges = networks.map(network => '<span class="channel">' + escape(network) + '</span>').join('');
  const uniqueProviders = [...new Map(networks.map(network => {
    const entry = providers.find(([pattern]) => pattern.test(network));
    return entry ? [entry[1],network] : [null,null];
  }).filter(([url]) => url && !options.some(option => new URL(option.webUrl).hostname === new URL(url).hostname))).entries()];
  const providerLinks = uniqueProviders.map(([url,network]) => link(url,'Open ' + network,'soft-button')).join('');
  const gameLink = game.path?.startsWith("/gamecenter/") ? nhl + game.path : nhl + "/schedule/" + date;
  const calendar = ["FUT","PRE"].includes(game.state) && game.scheduleState === "OK"
    ? '<button class="soft-button" id="calendar" type="button">Add to calendar</button>' : '';
  dialog("Game details / " + regionNames[region],
    window.gameDeskMotion.readout(game,logo,phase(game)) + '<h3>' + escape(name(game.away) + " at " + name(game.home)) + '</h3><p>' +
    escape(dateText(date,{dateStyle:"full"}) + " · " + clock(game.time) + (game.venue ? " · " + game.venue : "")) +
    '</p>' + (badges ? '<div class="channels">' + badges + '</div>' : '<p>See the official NHL guide for viewing options in your area.</p>') +
    '<span class="espn ' + style + '">' + label + '</span><p style="margin-top:7px">' + escape(explanation) +
    '</p>' + window.gameDeskBroadcast.note(options) +
    '<div class="dialog-actions">' + options.map(option => window.gameDeskBroadcast.buttons(option,"primary",{context:name(game.away) + ' at ' + name(game.home)})).join('') +
    providerLinks + link(gameLink,"NHL Gamecenter",playback ? "soft-button" : "primary") +
    link(region === "INT" ? guide : blackout,"Broadcast lookup","soft-button") + calendar + '</div>');
  $("calendar")?.addEventListener("click", () => {
    const title = name(game.away) + " at " + name(game.home);
    const stamp = date => date.toISOString().replace(/[-:]|\.\d{3}/g,"");
    const content = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//The Hockey Desk//NHL Schedule//EN","BEGIN:VEVENT",
      "UID:" + game.id + "@the-hockey-desk","DTSTAMP:" + stamp(new Date()),"DTSTART:" + stamp(new Date(game.time)),
      "SUMMARY:" + title,"URL:" + gameLink,"END:VEVENT","END:VCALENDAR",""].join("\r\n");
    const url = URL.createObjectURL(new Blob([content],{type:"text/calendar;charset=utf-8"}));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = game.away.code + "-" + game.home.code + ".ics";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
function setStatus(state, title) {
  const status = $("feed-status");
  status.dataset.state = state;
  status.lastChild.textContent = " " + title;
}
async function load(path) {
  try {
    const response = await fetch("/hockey/api/" + path, {signal:AbortSignal.timeout(12000)});
    if (!response.ok) throw new Error("Feed unavailable");
    const payload = await response.json();
    memory.set(path,payload);
    return payload;
  } catch {
    const fallback = memory.get(path) || (window.deskSnapshot && snapshotFor(path));
    if (fallback) return {...fallback, stale:true};
    throw new Error("Feed unavailable");
  }
}
function snapshotFor(path) {
  const snapshot = window.deskSnapshot;
  if (!snapshot) return null;
  const [key,date] = path.split("/");
  if (key === "schedule") {
    const days = snapshot.schedule.data.days.filter(entry => entry.date >= date && entry.date < offset(date,7));
    return days.some(entry => entry.date === date) ? {...snapshot.schedule,data:{...snapshot.schedule.data,days}} : null;
  }
  return key === "score" ? (snapshot.score.data.date === date ? snapshot.score : null) : snapshot[key];
}
async function refresh() {
  if (view === "settings") return;
  if (view === "watch") return;
  if (view === "my-team") return teamDesk.refresh();
  const now = leagueDate();
  if (day === today && now !== today) {
    day = start = now;
    week = scoreboard = null;
    if (view === "games") renderGames();
  }
  if (betDay === today && now !== today) $("bet-date").value = betDay = now;
  today = now;
  const id = ++request;
  const selectedDay = day;
  $("refresh").disabled = true;
  let spotlightData = null;
  if (view === "games") {
    load("espn/" + selectedDay).then(payload => {
      if (id !== request || day !== selectedDay) return;
      espnSchedule = payload.data;
      if (currentGames()) renderGames();
      if (spotlightData) renderSpotlight(...spotlightData);
    }).catch(() => {});
  }
  const tasks = view === "games" ? ["schedule/" + start, "score/" + day] :
    view === "standings" ? ["standings"] : view === "highlights" ? ["highlight"] :
    view === "betting" ? ["betting/" + betDay] : [categories[category][1]];
  const pending = tasks.map(load);
  if (view === "games") {
    const selectedScores = pending[1];
    Promise.allSettled([selectedScores,load("standings")]).then(([scores,table]) => {
      if (id !== request) return;
      if (scores.status !== "fulfilled") {

        window.gameDeskSpotlight.mount($("spotlight"),null,"");
        window.gameDeskBooth.reset($("spotlight-body"),"The game recommendation is temporarily unavailable. Use Refresh to try again.");
        return;
      }
      spotlightData = [scores.value.data.games,table.value?.data.teams,Boolean(scores.value.stale)];
      renderSpotlight(...spotlightData);
    });
  }
  const results = await Promise.allSettled(pending);
  if (id !== request) return;
  $("refresh").disabled = false;
  const [first,second] = results.map(result => result.status === "fulfilled" ? result.value : null);
  const data = view === "games" ? first || second : first;
  if (view === "games") {
    week = first;
    scoreboard = second;
    renderGames();
    const season = currentGames()?.[0]?.season;
    if (season) $("season").textContent = "NHL SEASON " + String(season).slice(0,4) + "–" + String(season).slice(-2);
  } else if (view === "standings") {
    standings = first;
    renderStandings();
  } else if (view === "highlights") {
    highlight = first;
    renderHighlight();
  } else if (view === "betting") {
    if (first) renderBetting(first.data);
  } else {
    leaders[tasks[0]] = first;
    renderStats();
  }
  if (!data) {
    if (view === "betting") {
      setStatus("error","Betting feeds unavailable");
      $("betting").innerHTML = placeholder("Lines are temporarily unavailable","Use Refresh to try again.");
      return;
    }
    if (view === "highlights") {
      setStatus("error","YouTube feed unavailable");
      $("highlights").dataset.video = "";
      $("highlights").innerHTML = placeholder("No highlight available","Check the official NHL channel for recent uploads.") +
        '<p class="highlight-note">' + link(nhlVideos,"Open NHL on YouTube","inline-link") + '</p>';
      return;
    }
    setStatus("error","NHL feed unavailable");
    $(view).innerHTML = placeholder("NHL data is temporarily unavailable","Use Refresh to try again.");
    return;
  }
  const updated = clock(data.updatedAt);
  const saved = data.stale || (view === "games" && Boolean(second?.stale));
  setStatus(saved ? "cached" : "fresh", saved ? "Saved data · " + fmt(new Date(data.updatedAt),{month:"short",day:"numeric"}) + ", " + updated : "Updated " + updated + " · " + window.gameDeskSettings.refreshText());
}
function selectDay(key, reset = false) {
  $("booth-date-picker").open = false;
  $("booth-date-picker").querySelector("summary").focus({preventScroll:true});
  if (day !== key) {
    window.gameDeskSpotlight.mount($("spotlight"),null,'');
    window.gameDeskBooth.reset($("spotlight-body"),'Checking games for the selected date.');
  }
  day = key;
  if (reset || day < start || day > offset(start,6)) start = day;
  if (scoreboard?.data.date !== day) scoreboard = null;
  if (!week?.data.days.some(entry => entry.date === day)) week = null;
  renderGames();
  refresh();
}
function selectView() {
  const next = location.hash.slice(2);
  view = views.includes(next) ? next : "games";
  if (!window.gameDeskSettings.guard(view)) return;
  if (view !== "highlights" && $("highlights").dataset.video) {
    $("highlights").replaceChildren();
    delete $("highlights").dataset.video;
  }
  for (const key of views) {
    $("view-" + key).hidden = view !== key;
    const nav = document.querySelector('nav a[href="#/' + key + '"]');
    if (view === key) nav.setAttribute("aria-current","page");
    else nav.removeAttribute("aria-current");
  }
  if (view === "games") renderGames();
  if (view === "standings") {
    if (!standings) $("standings").innerHTML = placeholder("Loading standings","Checking the latest NHL standings.");
    renderStandings();
  }
  if (view === "stats") renderStats();
  if (view === "betting") $("betting").innerHTML = placeholder("Loading lines","Checking today’s sportsbook and prediction-market listings.");
  if (view === "highlights") {
    if (highlight) renderHighlight();
    else $("highlights").innerHTML = placeholder("Loading highlights","Checking the latest recaps from NHL YouTube.");
  }
  $("refresh").hidden = ["watch","my-team","settings"].includes(view);
  if (["watch","my-team","settings"].includes(view)) {
    request++;
    setStatus("fresh",view === "settings" ? "App settings" : view === "watch" ? "Official viewing guide" : "NHL team dashboard");
    if (view === "my-team") refresh();
    return;
  }
  setStatus("loading",view === "highlights" ? "Checking NHL YouTube" : "Checking NHL data");
  refresh();
}

$("region").value = region;
$("region").onchange = event => {
  region = event.target.value;
  save("desk-region",region);
  renderWatch();
  if (view === "games") refresh();
};
$("team").insertAdjacentHTML("beforeend", teams.map(([code,title]) => '<option value="' + code + '">' + escape(title) + '</option>').join(""));
$("team").onchange = event => { team = event.target.value; $("booth-filters").open = false; renderGames(); };
$("all-games").onclick = () => { onlyFollowed = false; team = ""; $("team").value = ""; renderGames(); };
$("only-faves").onclick = () => { onlyFollowed = true; team = ""; $("team").value = ""; renderGames(); };
$("prev").onclick = () => selectDay(offset(day,-1));
$("next").onclick = () => selectDay(offset(day,1));
$("today").onclick = () => selectDay(leagueDate(),true);
$("week").onclick = event => {
  const button = event.target.closest("[data-day]");
  if (button) selectDay(button.dataset.day);
};
$("games").onclick = event => {
  if (event.target.closest("[data-manage-following]")) { $("manage").click(); return; }
  const button = event.target.closest("[data-game]");
  const game = button && currentGames()?.find(game => String(game.id) === button.dataset.game);
  if (game) gameDialog(game);
};
$("manage").onclick = () => dialog("Your teams", '<h3>Other teams you follow</h3><p>Your main team sets the theme and dashboard. Your main team and the clubs you choose here appear in the Following filter. Changes save on this device.</p><div class="team-picker">' +
  teams.filter(([code]) => code !== window.gameDeskSpotlight.favorite()).map(([code,title]) => '<label><input type="checkbox" data-follow="' + code + '"' +
    (followed.has(code) ? " checked" : "") + '> ' + escape(title) + '</label>').join("") + '</div>');
$("manage-filter-teams").onclick = () => { $("booth-filters").open = false; $("manage").click(); };
$("dialog-content").onchange = event => {
  const code = event.target.dataset.follow;
  if (!code) return;
  if (event.target.checked) followed.add(code);
  else followed.delete(code);
  save("desk-followed",[...followed]);
  renderFollowed();
  renderGames();
};
$("followed").onclick = event => {
  const button = event.target.closest("[data-team]");
  if (!button) return;
  $("team").value = team = button.dataset.team;
  onlyFollowed = false;
  if (view !== "games") location.hash = "#/games";
  else renderGames();
};
$("standing-group").onchange = renderStandings;
$("bet-date").value = betDay;
$("bet-date").onchange = event => {
  if (!event.target.value) event.target.value = today;
  betDay = event.target.value;
  $("betting").innerHTML = placeholder("Loading lines","Checking sportsbook and prediction-market listings for this date.");
  refresh();
};
$("stat-tabs").onclick = event => {
  const button = event.target.closest("[data-stat]");
  if (!button) return;
  category = button.dataset.stat;
  renderStats();
  $("stat-tabs").querySelector('[data-stat="' + category + '"]').focus();
  refresh();
};
$("refresh").onclick = refresh;
window.addEventListener("hashchange",selectView);
window.gameDeskSettings.watch(refresh);
renderWatch();
renderFollowed();
const teamDesk = window.createTeamDesk({teams,logo,loadTeam:code => load("team/" + code).catch(() => null),
  dateTime:clock,defaultTeam:() => [...followed][0]});
selectView();

window.addEventListener('game-desk-settings',() => {
  const variant = document.documentElement.dataset.appearance === 'light' ? 'light' : 'dark';
  for (const image of document.querySelectorAll('img[src^="https://assets.nhle.com/logos/nhl/svg/"]')) {
    const source = image.getAttribute('src');
    const next = source.replace(/_(?:light|dark)\.svg$/,'_' + variant + '.svg');
    if (source !== next) image.src = next;
  }
});
