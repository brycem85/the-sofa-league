const upstream = "https://api-web.nhle.com/v1/";
const espnScoreboard = "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard";
const espnAliases = { LA:"LAK", NJ:"NJD", SJ:"SJS", TB:"TBL", UTAH:"UTA" };
const nhlYouTube = "https://www.youtube.com/feeds/videos.xml?channel_id=UCqFMzb-4AUf6WAIbl132QKA";
const kalshiMarkets = "https://api.elections.kalshi.com/trade-api/v2/markets?series_ticker=KXNHLGAME&status=open&limit=250";
const polyEvents = "https://gamma-api.polymarket.com/events?series_id=10346&active=true&closed=false&limit=100";
const marketAliases = {LAK:"LA",NJD:"NJ",SJS:"SJ",TBL:"TB",VGK:"VEG"};
const local = value => value?.default ?? "";
const broadcast = channel => ({network:channel.network,country:channel.countryCode,market:channel.market});
const club = team => ({code:team.abbrev,name:local(team.commonName ?? team.name),score:team.score});

function game(raw) {
  const period = raw.periodDescriptor;
  const clock = raw.clock;
  let periodLabel = "";
  if (period && clock) {
    const name = period.periodType === "REG" ? "P" + period.number : period.periodType;
    periodLabel = clock.inIntermission ? name + " intermission" : name + " · " + clock.timeRemaining;
  }
  return {
    id:raw.id, type:raw.gameType, season:raw.season, time:raw.startTimeUTC,
    venue:local(raw.venue), state:raw.gameState, scheduleState:raw.gameScheduleState,
    periodType:period?.periodType, periodLabel, path:raw.gameCenterLink,
    away:club(raw.awayTeam), home:club(raw.homeTeam), tv:(raw.tvBroadcasts ?? []).map(broadcast)
  };
}
const standing = team => ({
  rank:team.leagueSequence, divisionRank:team.divisionSequence, division:team.divisionName,
  name:local(team.teamName), code:local(team.teamAbbrev), games:team.gamesPlayed,
  wins:team.wins, losses:team.losses, ot:team.otLosses, points:team.points, pct:team.pointPctg,
  gf:team.goalFor, ga:team.goalAgainst, streak:(team.streakCode ?? "") + (team.streakCount || "")
});
const player = raw => ({
  name:local(raw.firstName) + " " + local(raw.lastName), photo:raw.headshot,
  code:raw.teamAbbrev, position:raw.position, value:raw.value
});
const playerName = raw => local(raw.firstName) + " " + local(raw.lastName);
async function hockeyTeam(code) {
  const settled = await Promise.allSettled([
    getJson(upstream + "standings/now"),getJson(upstream + "club-schedule-season/" + code + "/now"),
    getJson(upstream + "club-stats/" + code + "/now"),getJson(upstream + "roster/" + code + "/current")
  ]);
  const [table,schedule,stats,players] = settled.map(result => result.value);
  const entry = table?.standings?.find(row => local(row.teamAbbrev) === code);
  const games = (schedule?.games ?? []).filter(game => [2,3].includes(game.gameType));
  if (!entry && !games.length && !stats && !players) throw new Error("Team unavailable");
  const sides = game => game.homeTeam.abbrev === code ? [game.homeTeam,game.awayTeam,true] : [game.awayTeam,game.homeTeam,false];
  const opponent = team => local(team.placeName) + " " + local(team.commonName);
  const recent = games.filter(game => ["OFF","FINAL"].includes(game.gameState) &&
    Number.isFinite(game.homeTeam.score) && Number.isFinite(game.awayTeam.score)).slice(-5).reverse().map(game => {
    const [own,other,home] = sides(game);
    const extra = ["OT","SO"].includes(game.gameOutcome?.lastPeriodType) ? game.gameOutcome.lastPeriodType : "";
    return {time:game.startTimeUTC,home,opponent:opponent(other),score:own.score,opponentScore:other.score,
      result:own.score > other.score ? "W" : extra && game.gameType === 2 ? "OTL" : "L",extra};
  });
  const upcoming = games.filter(game => ["FUT","PRE","LIVE","CRIT"].includes(game.gameState) &&
    game.gameScheduleState === "OK").slice(0,3).map(game => {
    const [,other,home] = sides(game);
    return {time:game.startTimeUTC,home,opponent:opponent(other),networks:(game.tvBroadcasts ?? [])
      .filter(channel => channel.countryCode === "US" || channel.countryCode === "CA")
      .map(channel => channel.network + " (" + channel.countryCode + ")")};
  });
  const leaders = [
    {title:"Skaters · season points",rows:[...(stats?.skaters ?? [])].sort((a,b) => b.points - a.points || b.goals - a.goals)
      .slice(0,8).map(p => ({name:playerName(p),value:p.points + " P · " + p.goals + " G · " + p.assists + " A"}))},
    {title:"Goalies · season stats",rows:[...(stats?.goalies ?? [])].sort((a,b) => b.gamesPlayed - a.gamesPlayed)
      .slice(0,5).map(p => ({name:playerName(p),value:p.wins + " W · " + (p.savePercentage * 100).toFixed(1) + "% SV"}))}
  ].filter(group => group.rows.length);
  const roster = ["forwards","defensemen","goalies"].flatMap(key => players?.[key] ?? []).map(p => ({
    id:String(p.id),name:playerName(p),number:p.sweaterNumber,position:p.positionCode,bio:[p.heightInCentimeters ? p.heightInCentimeters + " cm" : "",p.weightInKilograms ? p.weightInKilograms + " kg" : ""].filter(Boolean).join(" · "),detail:p.shootsCatches ? "Shoots/catches " + p.shootsCatches : ""
  }));
  return {
    team:{code,name:entry ? local(entry.teamName) : games.length ? opponent(sides(games[0])[0]).trim() : code,
      record:entry ? [entry.wins,entry.losses,entry.otLosses].join("-") : "",
      context:entry ? "#" + entry.divisionSequence + " in " + entry.divisionName : ""},
    recent,upcoming,leaders,roster,injuries:[],
    stats:entry ? [
      ["Points",entry.points],["Points %",(entry.pointPctg * 100).toFixed(1) + "%"],["Goals for",entry.goalFor],
      ["Goals against",entry.goalAgainst],["Streak",(entry.streakCode ?? "") + (entry.streakCount ?? "")]
    ].map(([label,value]) => ({label,value})) : [],
    unavailable:["standings","schedule","player stats","roster"].filter((_,i) => settled[i].status === "rejected")
  };
}
const statGroups = {
  skaters:["points","goals","assists","plusMinus"],
  goalies:["wins","savePctg","goalsAgainstAverage","shutouts"]
};
export function normalize(key, raw) {
  if (key === "schedule") return {days:raw.gameWeek.map(day => ({date:day.date,games:day.games.map(game)}))};
  if (key === "score") return {date:raw.currentDate,games:raw.games.map(game)};
  if (key === "standings") return {teams:raw.standings.map(standing)};
  return Object.fromEntries(statGroups[key].map(stat => [stat,(raw[stat] ?? []).slice(0,10).map(player)]));
}

function espnGames(raw, date) {
  return {date, games:raw.events.flatMap(event => {
    const competition = event.competitions?.[0];
    const listed = competition?.broadcasts?.some(broadcast => broadcast.names?.includes("ESPN+"));
    if (!listed || !/^\d+$/.test(event.id)) return [];
    const team = side => {
      const code = competition.competitors?.find(club => club.homeAway === side)?.team?.abbreviation;
      return espnAliases[code] ?? code;
    };
    const home = team("home");
    const away = team("away");
    if (!home || !away || !Number.isFinite(Date.parse(event.date))) return [];
    return [{id:event.id, time:event.date, home, away}];
  })};
}

export function featuredHighlight(xml) {
  if (!xml.includes("<yt:channelId>UCqFMzb-4AUf6WAIbl132QKA</yt:channelId>")) {
    throw new Error("Unexpected YouTube feed");
  }
  const recaps = Array.from(xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g), ([, entry]) => {
    const id = entry.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/)?.[1];
    const title = entry.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
    const published = entry.match(/<published>([^<]+)<\/published>/)?.[1];
    const [matchup, type, date] = title.split(/\s*\|\s*/);
    const played = Date.parse(date + " UTC");
    if (!id || type !== "NHL Highlights" || !Number.isFinite(played) || !Number.isFinite(Date.parse(published))) {
      return null;
    }
    const views = Number(entry.match(/<media:statistics\b[^>]*\bviews="(\d+)"/)?.[1] ?? 0);
    return {id, matchup:matchup.replace(/&(amp|apos|quot|lt|gt);/g, (_, key) =>
      ({amp:"&",apos:"'",quot:'"',lt:"<",gt:">"})[key]), played, published, views};
  }).filter(Boolean);
  recaps.sort((a,b) => b.played - a.played || b.views - a.views || Date.parse(b.published) - Date.parse(a.published));
  const [highlight] = recaps;
  if (!highlight) throw new Error("No game highlights in the NHL feed");
  return {highlight};
}

async function getJson(url) {
  const response = await fetch(url, {
    headers:{accept:"application/json"}, signal:AbortSignal.timeout(6500)
  });
  if (!response.ok) throw new Error("Feed unavailable");
  return response.json();
}
function pair(provider, kind, away, home) {
  if (![away, home].every(value => Number.isFinite(value) &&
    (kind === "moneyline" ? Math.abs(value) >= 100 : value > 0 && value < 1))) return null;
  return {provider,kind,away,home};
}
function bookQuote(provider, game) {
  const price = club => Number(club.odds?.find(odds => odds.providerId === provider.partnerId)?.value);
  return pair(provider.name + " " + provider.country, "moneyline", price(game.awayTeam), price(game.homeTeam));
}
function kalshiQuote(markets, date, game) {
  const stamp = new Date(date + "T12:00:00Z");
  const month = new Intl.DateTimeFormat("en-US",{month:"short",timeZone:"UTC"}).format(stamp).toUpperCase();
  const day = date.slice(2,4) + month + date.slice(8);
  const aliases = club => [...new Set([club.abbrev,marketAliases[club.abbrev]].filter(Boolean))];
  const away = aliases(game.awayTeam);
  const home = aliases(game.homeTeam);
  const events = new Set(away.flatMap(a => home.flatMap(h => [a + h,h + a])).map(codes => "KXNHLGAME-" + day + codes));
  const contracts = markets.filter(market => events.has(market.event_ticker));
  const ask = codes => Number(contracts.find(contract =>
    codes.includes(contract.ticker.split("-").at(-1)) && Number(contract.yes_ask_size_fp) > 0
  )?.yes_ask_dollars);
  return pair("Kalshi", "ask", ask(away), ask(home));
}
function polyQuote(events, date, game) {
  const event = events.find(event => event.eventDate === date &&
    [game.awayTeam,game.homeTeam].every(club => event.teams?.some(team =>
      [club.abbrev,marketAliases[club.abbrev]].includes(team.abbreviation?.toUpperCase()))) &&
    Math.abs(Date.parse(event.startTime) - Date.parse(game.startTimeUTC)) <= 60 * 60 * 1000);
  const market = event?.markets?.find(market => market.sportsMarketType === "moneyline" && market.acceptingOrders);
  if (!market) return null;
  try {
    const outcomes = JSON.parse(market.outcomes);
    const prices = JSON.parse(market.outcomePrices);
    const price = club => Number(prices[outcomes.indexOf(local(club.name ?? club.commonName))]);
    return pair("Polymarket", "quote", price(game.awayTeam), price(game.homeTeam));
  } catch { return null; }
}
async function betting(date) {
  const [nhl,kalshi,poly] = await Promise.allSettled([
    getJson(upstream + "score/" + date),getJson(kalshiMarkets),getJson(polyEvents)
  ]);
  if (nhl.status !== "fulfilled") throw new Error("NHL feed unavailable");
  const raw = nhl.value;
  const books = (raw.oddsPartners ?? []).filter(provider =>
    (provider.name === "DraftKings" && provider.country === "US") ||
    (provider.name === "FanDuel" && provider.country === "CA"));
  const kalshiList = kalshi.value?.markets ?? [];
  const polyList = poly.value ?? [];
  const games = raw.games.filter(game => ["FUT","PRE"].includes(game.gameState) && game.gameScheduleState === "OK")
    .map(rawGame => ({...game(rawGame), lines:[
      ...books.map(book => bookQuote(book,rawGame)),
      kalshiQuote(kalshiList,date,rawGame),
      polyQuote(polyList,date,rawGame)
    ].filter(Boolean)}));
  return {date,games,unavailable:[
    ...(kalshi.status === "rejected" ? ["Kalshi"] : []),
    ...(poly.status === "rejected" ? ["Polymarket"] : [])
  ]};
}

const routes = {
  standings:"standings/now",
  skaters:"skater-stats-leaders/current",
  goalies:"goalie-stats-leaders/current"
};
async function loadData(key, date) {
  if (key === "betting") return betting(date);
  if (key === "highlight") {
    const response = await fetch(nhlYouTube,{headers:{accept:"application/atom+xml"},signal:AbortSignal.timeout(7500)});
    if (!response.ok) throw new Error("YouTube feed unavailable");
    return featuredHighlight(await response.text());
  }
  if (key === "espn") {
    return espnGames(await getJson(espnScoreboard + "?dates=" + date.replaceAll("-","")),date);
  }
  return normalize(key,await getJson(upstream + (date ? key + "/" + date : routes[key])));
}
const headers = {"x-content-type-options":"nosniff"};
const cache = new Map();
const asset = (body, type) => new Response(body, {headers:{...headers,"content-type":type + "; charset=utf-8","cache-control":"private, no-cache"}});

export default {
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/") return asset(PAGE, "text/html");
    if (path === "/desk.js") return asset(SCRIPT, "text/javascript");
    if (path === "/desk.css") return asset(STYLE, "text/css");
    if (path === "/favicon.ico") return new Response(null,{status:204});
    const dated = /^\/api\/(schedule|score|espn|betting)\/(\d{4}-\d{2}-\d{2})$/.exec(path);
    const named = /^\/api\/(standings|skaters|goalies|highlight)$/.exec(path);
    const team = /^\/api\/team\/([A-Z]{3})$/.exec(path);

    const athlete = /^\/api\/player\/(\d{1,10})$/.exec(path);
    const key = athlete ? "player" : team ? "team" : (dated || named)?.[1];
    if (!key) return new Response("Not found",{status:404});
    const old = cache.get(path);
    const ttl = key === "score" ? 25000 : ["espn","highlight","player"].includes(key) ? 300000 : 55000;
    if (old && Date.now() - Date.parse(old.updatedAt) < ttl) {
      return Response.json(old, {headers:{...headers,"cache-control":"no-store"}});
    }
    try {
      const data = athlete ? await playerWithAverages("hockey",athlete[1],getJson) : team ? await hockeyTeam(team[1]) : await loadData(key,dated?.[2]);
      const payload = {data,updatedAt:new Date().toISOString(),stale:false};
      if (cache.size >= 100) cache.delete(cache.keys().next().value);
      cache.set(path,payload);
      return Response.json(payload, {headers:{...headers,"cache-control":"no-store"}});
    } catch {
      if (old) return Response.json({...old,stale:true}, {headers:{...headers,"cache-control":"no-store"}});
      return Response.json({error:"Sports feed unavailable"},{status:503,headers});
    }
  }
};
