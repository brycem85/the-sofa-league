const espn = "https://site.api.espn.com/apis/";
const league = espn + "site/v2/sports/basketball/nba/";
const standingsUrl = espn + "v2/sports/basketball/nba/standings?type=2&level=2&season=";
const athletesUrl = espn + "common/v3/sports/basketball/nba/statistics/byathlete?seasontype=2&limit=600&season=";
const nbaChannel = "https://www.youtube.com/@NBA/videos?hl=en&gl=US";
const kalshiUrl = "https://api.elections.kalshi.com/trade-api/v2/markets?series_ticker=KXNBAGAME&status=open&limit=250";
const polyUrl = "https://gamma-api.polymarket.com/events?series_id=10345&active=true&closed=false&limit=100";
const aliases = {GS:"GSW",NO:"NOP",NY:"NYK",SA:"SAS",UTAH:"UTA",WSH:"WAS"};
const team = raw => ({id:raw.id,code:raw.abbreviation,name:raw.displayName,short:raw.shortDisplayName ?? raw.name});
const score = value => value?.value ?? (value != null && Number.isFinite(Number(value)) ? Number(value) : null);
const hasScores = game => game.away.score !== null && game.home.score !== null;
const final = game => game.state === "post" && /^Final/i.test(game.status) && hasScores(game);
const ready = game => game.state === "pre" && !/cancel|postpon/i.test(game.status);
const statNames = {
  avgPoints:"Points",avgRebounds:"Rebounds",avgAssists:"Assists",avgSteals:"Steals",
  avgBlocks:"Blocks",avgThreePointFieldGoalsMade:"Made threes",threePointFieldGoalPct:"Three-point %"
};

async function get(url,format = "json") {
  const response = await fetch(url,{headers:{accept:format === "text" ? "text/html" : "application/json","accept-language":"en-US"},signal:AbortSignal.timeout(7500)});
  if (!response.ok) throw new Error("NBA data source unavailable");
  return format === "text" ? response.text() : response.json();
}
function normalizedGame(event) {
  const match = event.competitions[0];
  const phase = (match.status ?? event.status).type;
  const side = key => {
    const entry = match.competitors.find(club => club.homeAway === key);
    const record = (entry.records ?? entry.record ?? []).find(item => item.type === "total");
    return {...team(entry.team),record:record?.summary ?? record?.displayValue ?? "",score:phase.state === "pre" ? null : score(entry.score)};
  };
  const networks = [...(match.geoBroadcasts ?? []),...(match.broadcasts ?? [])].flatMap(feed =>
    feed.names ?? (feed.region === "us" && feed.type?.shortName !== "Radio" ? [feed.media?.shortName] : []));
  const book = (match.odds ?? []).map(row => {
    const away = Number(row.moneyline?.away?.close?.odds ?? row.awayTeamOdds?.moneyLine);
    const home = Number(row.moneyline?.home?.close?.odds ?? row.homeTeamOdds?.moneyLine);
    return Math.abs(away) >= 100 && Math.abs(home) >= 100 && row.provider?.name ?
      {source:row.provider.name,kind:"Moneyline",away,home,spread:row.details,total:row.overUnder} : null;
  }).filter(Boolean);
  const leaders = (match.leaders ?? []).filter(group => group.name === "points").map(group => ({
    name:group.leaders?.[0]?.athlete?.displayName,value:group.leaders?.[0]?.displayValue
  })).filter(leader => leader.name && leader.value);
  return {
    id:event.id,time:event.date,year:event.season?.year,timeValid:match.timeValid !== false,neutral:match.neutralSite,
    status:phase.description,state:phase.state,detail:phase.shortDetail,
    away:side("away"),home:side("home"),venue:match.venue?.fullName ?? "",
    networks:[...new Set(networks.filter(Boolean))],note:match.notes?.[0]?.headline ?? "",
    leaders,book
  };
}
export function normalizeGames(raw,date) {
  return {date,games:raw.events.map(normalizedGame).sort((a,b) => Date.parse(a.time) - Date.parse(b.time))};
}
export function normalizeStandings(raw) {
  return {conferences:raw.children.map(group => ({
    name:group.name,teams:group.standings.entries.map(entry => {
      const stat = key => entry.stats.find(stat => stat.name === key)?.displayValue ?? "–";
      return {...team(entry.team),wins:stat("wins"),losses:stat("losses"),pct:stat("winPercent"),
        gb:stat("gamesBehind"),streak:stat("streak"),diff:stat("differential"),seed:Number(stat("playoffSeed")),
        pf:stat("avgPointsFor"),pa:stat("avgPointsAgainst")};
    }).sort((a,b) => b.wins / (Number(b.wins) + Number(b.losses)) - a.wins / (Number(a.wins) + Number(a.losses)) ||
      (a.seed || 99) - (b.seed || 99))
  }))};
}
export function normalizePlayers(raw) {
  const columns = new Map(raw.categories.map(category => [category.name,category.names]));
  return raw.athletes.map(entry => {
    const stats = Object.fromEntries(entry.categories.flatMap(category => (columns.get(category.name) ?? [])
      .map((name,index) => [name,category.values[index]])));
    return {name:entry.athlete.displayName,code:entry.athlete.teamShortName,id:entry.athlete.id,
      gp:stats.gamesPlayed,attempts:stats.avgThreePointFieldGoalsAttempted,
      ...Object.fromEntries(Object.keys(statNames).map(key => [key,stats[key]]))};
  });
}
let playerCache = null;
async function players(year) {
  if (playerCache?.year === year && Date.now() - playerCache.at < 300000) return playerCache.pending;
  const pending = get(athletesUrl + year).then(normalizePlayers);
  playerCache = {year,at:Date.now(),pending};
  try { return await pending; } catch (error) {
    if (playerCache?.pending === pending) playerCache = null;
    throw error;
  }
}
const daily = date => get(league + "scoreboard?dates=" + date.replaceAll("-","")).then(raw => normalizeGames(raw,date));
async function clubDesk(year,id) {
  const base = league + "teams/" + id;
  const season = "?season=" + year;
  const results = await Promise.allSettled([
    get(base),get(base + "/schedule" + season + "&seasontype=2"),
    get(base + "/schedule" + season + "&seasontype=3"),
    get(base + "/roster"),get(base + "/statistics" + season + "&seasontype=2"),players(year)
  ]);
  const [info,regular,postseason,rosterFeed,totals,athletes] = results.map(result => result.value);
  const club = info?.team ?? rosterFeed?.team ?? regular?.team;
  if (!club?.abbreviation) throw new Error("NBA team unavailable");
  const code = club.abbreviation;
  const events = [regular,postseason].filter(feed => String(feed?.season?.year) === year && feed.team?.abbreviation === code)
    .flatMap(feed => feed.events ?? []);
  const schedule = [...new Map(events.map(event => [event.id,event])).values()].map(normalizedGame)
    .sort((a,b) => Date.parse(a.time) - Date.parse(b.time));
  const sides = game => game.home.code === code ? [game.home,game.away,true] : [game.away,game.home,false];
  const recent = schedule.filter(final).slice(-5).reverse().map(game => {
    const [own,other,home] = sides(game);
    return {time:game.time,home,opponent:other.name,score:own.score,opponentScore:other.score,
      result:own.score > other.score ? "W" : "L",extra:/OT/i.test(game.detail) ? game.detail.replace(/^Final\/?/i,"") : ""};
  });
  const upcoming = schedule.filter(game => ready(game) || game.state === "in").slice(0,3).map(game => {
    const [,other,home] = sides(game);
    return {time:game.time,timeValid:game.timeValid,home,opponent:other.name,networks:game.networks};
  });
  const rosterRaw = rosterFeed?.athletes ?? [];
  const roster = rosterRaw.map(player => ({id:String(player.id),name:player.fullName ?? player.displayName,number:player.jersey,
    position:player.position?.abbreviation ?? "",bio:[player.displayHeight,player.displayWeight,player.age ? player.age + " years old" : ""].filter(Boolean).join(" · "),detail:player.status?.name ?? ""}));
  const injuries = rosterRaw.flatMap(player => {
    const latest = (player.injuries ?? []).filter(report => Date.parse(report.date) >= Date.now() - 10 * 86400000)
      .sort((a,b) => Date.parse(b.date) - Date.parse(a.date))[0];
    return latest?.status ? [{name:player.displayName,status:latest.status,date:latest.date,detail:player.position?.abbreviation}] : [];
  });
  const teamPlayers = (athletes ?? []).filter(player => player.code === code);
  const leaders = ["avgPoints","avgRebounds","avgAssists","avgSteals","avgBlocks","avgThreePointFieldGoalsMade"].map(key => ({
    title:statNames[key] + " per game",
    rows:teamPlayers.filter(player => Number.isFinite(player[key])).sort((a,b) => b[key] - a[key])
      .slice(0,3).map(player => ({name:player.name,value:player[key].toFixed(1)}))
  })).filter(group => group.rows.length);
  const stat = (key,side = "stats") => totals?.results?.[side]?.categories?.flatMap(group => group.stats)
    .find(stat => stat.name === key)?.displayValue;
  return {
    team:{code,name:club.displayName,record:club.record?.items?.find(item => item.type === "total")?.summary ?? "",
      context:club.standingSummary ?? ""},recent,upcoming,roster,leaders,injuries,
    stats:[
      ["Points/game",stat("avgPoints")],["Allowed/game",stat("avgPoints","opponent")],
      ["Rebounds/game",stat("avgRebounds")],["Assists/game",stat("avgAssists")],
      ["Threes/game",stat("avgThreePointFieldGoalsMade")],["Turnovers/game",stat("avgTurnovers")]
    ].filter(([,value]) => value != null).map(([label,value]) => ({label,value})),
    unavailable:["team record","schedule","","roster","team stats","player leaders"].filter((label,index) => label && results[index].status === "rejected")
  };
}
const cents = (source,kind,away,home) => [away,home].every(value => value > 0 && value < 1) ? {source,kind,away,home} : null;
function kalshiLine(list,date,game) {
  const stamp = new Date(date + "T12:00Z");
  const prefix = "KXNBAGAME-" + date.slice(2,4) + new Intl.DateTimeFormat("en-US",{month:"short",timeZone:"UTC"}).format(stamp).toUpperCase() + date.slice(8);
  const options = code => [...new Set([code,aliases[code]].filter(Boolean))];
  const away = options(game.away.code);
  const home = options(game.home.code);
  const tickers = new Set(away.flatMap(a => home.flatMap(h => [prefix + a + h,prefix + h + a])));
  const entries = list.filter(entry => tickers.has(entry.event_ticker));
  const ask = codes => Number(entries.find(entry => codes.includes(entry.ticker.split("-").at(-1)) &&
    Number(entry.yes_ask_size_fp) > 0)?.yes_ask_dollars);
  return cents("Kalshi","YES ask",ask(away),ask(home));
}
function polyLine(list,date,game) {
  const event = list.find(event => event.eventDate === date && [game.away,game.home].every(club =>
    event.teams?.some(team => [club.code,aliases[club.code]].includes(team.abbreviation?.toUpperCase()))) &&
    Math.abs(Date.parse(event.startTime) - Date.parse(game.time)) <= 3600000);
  const line = event?.markets?.find(market => market.sportsMarketType === "moneyline" && market.acceptingOrders);
  if (!line) return null;
  try {
    const outcomes = JSON.parse(line.outcomes);
    const prices = JSON.parse(line.outcomePrices);
    const find = club => Number(prices[outcomes.indexOf(club.short)]);
    return cents("Polymarket","Outcome price",find(game.away),find(game.home));
  } catch { return null; }
}
async function betting(date) {
  const [score,kalshi,poly] = await Promise.allSettled([daily(date),get(kalshiUrl),get(polyUrl)]);
  if (score.status !== "fulfilled") throw new Error("NBA scoreboard unavailable");
  return {games:score.value.games.filter(ready).map(game => ({...game,lines:[
    ...game.book,kalshiLine(kalshi.value?.markets ?? [],date,game),polyLine(poly.value ?? [],date,game)
  ].filter(Boolean)})),unavailable:[
    ...(kalshi.status === "rejected" ? ["Kalshi"] : []),...(poly.status === "rejected" ? ["Polymarket"] : [])
  ]};
}
export function highlight(html) {
  const initial = html.match(/ytInitialData\s*=\s*({[\s\S]*?});\s*<\/script>/)?.[1];
  if (!initial || !html.includes("UCWJ2lWNubArHWmf3FIHbfcQ")) throw new Error("NBA video feed unavailable");
  const feed = JSON.parse(initial);
  const picks = [];
  const visit = value => {
    if (!value || typeof value !== "object") return;
    const model = value.lockupViewModel;
    const video = value.videoRenderer;
    if (model || video) {
      const meta = model?.metadata?.lockupMetadataViewModel;
      const title = meta?.title?.content ?? video?.title?.runs?.[0]?.text ?? "";
      const id = model?.contentId ?? video?.videoId;
      const [matchup,type,stamp] = title.split(/\s*\|\s*/);
      const played = Date.parse(stamp + " UTC");
      if (!/^[\w-]{11}$/.test(id) || !/^full game highlights$/i.test(type) || !Number.isFinite(played)) return;
      const raw = meta?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text?.content ??
        video?.viewCountText?.simpleText ?? "";
      const count = raw.replaceAll(",","").match(/([\d.]+)\s*([KMB])?/i);
      const views = count ? Math.round(Number(count[1]) * ({K:1e3,M:1e6,B:1e9}[count[2]?.toUpperCase()] ?? 1)) : 0;
      picks.push({id,matchup,played,views});
      return;
    }
    for (const child of Object.values(value)) visit(child);
  };
  visit(feed.contents);
  picks.sort((a,b) => b.played - a.played || b.views - a.views);
  if (!picks.length) throw new Error("No recent NBA recaps");
  return picks[0];
}

const cache = new Map();
const asset = (value,type) => new Response(value,{headers:{"content-type":type + "; charset=utf-8","cache-control":"private, no-cache"}});
const json = (value,status = 200) => Response.json(value,{status,headers:{"cache-control":"no-store"}});
export default {
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/") return asset(PAGE,"text/html");
    if (path === "/desk.js") return asset(SCRIPT,"text/javascript");
    if (path === "/desk.css") return asset(STYLE,"text/css");
    const date = /^\/api\/(games|betting)\/(\d{4}-\d{2}-\d{2})$/.exec(path);
    const season = /^\/api\/(standings|stats)\/(20\d{2})$/.exec(path);
    const club = /^\/api\/team\/(20\d{2})\/(\d{1,2})$/.exec(path);
    const athlete = /^\/api\/player\/(\d{1,10})$/.exec(path);
    if (!date && !season && !club && !athlete && path !== "/api/highlight") return new Response("Not found",{status:404});
    const previous = cache.get(path);
    if (previous && Date.now() - Date.parse(previous.at) < (path === "/api/highlight" || athlete ? 300000 : 45000)) return json(previous);
    try {
      const data = athlete ? await playerWithAverages("basketball",athlete[1],get) : club ? await clubDesk(club[1],club[2]) : date ?
        await (date[1] === "games" ? daily(date[2]) : betting(date[2])) : season ?
        await (season[1] === "stats" ? players(season[2]) : get(standingsUrl + season[2]).then(normalizeStandings)) :
        highlight(await get(nbaChannel,"text"));
      const payload = {data,at:new Date().toISOString(),stale:false};
      if (cache.size >= 90) cache.delete(cache.keys().next().value);
      cache.set(path,payload);
      return json(payload);
    } catch {
      return previous ? json({...previous,stale:true}) : json({error:"NBA feed unavailable"},503);
    }
  }
};
