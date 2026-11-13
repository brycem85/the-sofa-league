const espn = "https://site.api.espn.com/apis/";
const channelNames = {"Fox":"FOX","NFL Net":"NFL Network","ABC/ESPN":"ABC / ESPN"};
const club = team => ({id:team.id,code:team.abbreviation, name:team.displayName, short:team.shortDisplayName ?? team.name});
const broadcast = name => channelNames[name] ?? name;

function game(event) {
  const contest = event.competitions[0];
  const state = contest.status?.type ?? event.status.type;
  const teams = side => {
    const entry = contest.competitors.find(entry => entry.homeAway === side);
    return {...club(entry.team), record:entry.records?.find(record => record.type === "total")?.summary ?? "",
      score:state.state === "pre" ? null : entry.score?.displayValue ?? entry.score, winner:entry.winner === true};
  };
  const networks = (contest.geoBroadcasts ?? []).filter(feed => feed.region === "us" && feed.type?.shortName !== "Radio")
    .map(feed => feed.media.shortName);
  networks.push(...(contest.broadcasts ?? []).flatMap(feed => feed.names ??
    (feed.region === "us" && feed.type?.shortName !== "Radio" ? [feed.media?.shortName] : [])));
  return {
    id:event.id,time:event.date,timeValid:contest.timeValid !== false, away:teams("away"),home:teams("home"),
    venue:contest.venue?.fullName ?? "", neutral:contest.neutralSite,
    state:state.state,status:state.description,detail:state.shortDetail,
    networks:[...new Set(networks.filter(Boolean).map(broadcast))]
  };
}
export function schedule(raw) {
  return {
    year:raw.season.year,type:raw.season.type,week:raw.week?.number,
    calendar:(raw.leagues[0].calendar ?? []).flatMap(phase => (phase.entries ?? []).map(entry =>
      ({type:Number(phase.value),week:Number(entry.value),name:entry.label}))),
    byes:(raw.week?.teamsOnBye ?? []).map(club),
    games:raw.events.map(game).sort((a,b) => Date.parse(a.time) - Date.parse(b.time))
  };
}
export function standings(raw) {
  return {year:raw.season.year, divisions:raw.children.flatMap(conference => conference.children.map(division => ({
    conference:conference.abbreviation,
    name:division.name,
    teams:division.standings.entries.map(entry => {
      const get = key => entry.stats.find(stat => stat.name === key)?.displayValue ?? "–";
      return {...club(entry.team),w:get("wins"),l:get("losses"),t:get("ties"),pct:get("winPercent"),
        diff:get("pointDifferential"),division:get("divisionRecord")};
    })
  })))};
}
async function readJson(url,timeout = 7500) {
  const response = await fetch(url,{headers:{accept:"application/json"},signal:AbortSignal.timeout(timeout)});
  if (!response.ok) throw new Error("NFL feed unavailable");
  return response.json();
}
async function footballTeam(year,id) {
  const base = espn + "site/v2/sports/football/nfl/teams/" + id;
  const season = "?season=" + year;
  const regularSeason = readJson(base + "/schedule" + season + "&seasontype=2",4500);
  const postseason = readJson(base + "/schedule" + season + "&seasontype=3",4500);
  const gameLeaders = Promise.allSettled([regularSeason,postseason]).then(async schedules => {
    const games = schedules.flatMap(result => String(result.value?.season?.year) === year ? result.value.events ?? [] : [])
      .sort((a,b) => Date.parse(a.date) - Date.parse(b.date));
    const state = game => (game.competitions[0]?.status ?? game.status)?.type?.state;
    const preview = games.find(game => state(game) === "pre" && Date.parse(game.date) > Date.now());
    const selected = preview ?? games.findLast(game => state(game) === "post");
    if (!selected) return null;
    const summary = await readJson(espn + "site/v2/sports/football/nfl/summary?event=" + selected.id,4500);
    return {summary,label:preview ? "Season" : "Last game"};
  });
  const results = await Promise.allSettled([
    readJson(base),regularSeason,postseason,
    readJson(base + "/roster"),readJson(base + "/statistics" + season + "&seasontype=2"),
    readJson("https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/" + year + "/types/2/teams/" + id + "/leaders",4000),
    gameLeaders
  ]);
  const [info,regular,playoffs,rosterFeed,totals,leadersFeed,fallback] = results.map(result => result.value);
  const team = info?.team ?? rosterFeed?.team ?? regular?.team;
  if (!team?.abbreviation) throw new Error("Team unavailable");
  const code = team.abbreviation;
  const events = [regular,playoffs].filter(feed => String(feed?.season?.year) === year)
    .flatMap(feed => feed.events ?? []);
  const slate = [...new Map(events.map(event => [event.id,event])).values()].map(game)
    .sort((a,b) => Date.parse(a.time) - Date.parse(b.time));
  const sides = game => game.home.code === code ? [game.home,game.away,true] : [game.away,game.home,false];
  const recent = slate.filter(game => game.state === "post" && /^Final/i.test(game.status) &&
    [game.away.score,game.home.score].every(score => score != null && Number.isFinite(Number(score))))
    .slice(-5).reverse().map(game => {
      const [own,other,home] = sides(game);
      const a = Number(own.score);
      const b = Number(other.score);
      return {time:game.time,home,opponent:other.name,score:a,opponentScore:b,result:a > b ? "W" : a === b ? "T" : "L",
        extra:/\/OT/i.test(game.detail) ? "OT" : ""};
    });
  const upcoming = slate.filter(game => ["pre","in"].includes(game.state) && !/postpon|cancel/i.test(game.status))
    .slice(0,3).map(game => {
      const [,other,home] = sides(game);
      return {time:game.time,timeValid:game.timeValid,home,opponent:other.name,networks:game.networks};
    });
  const rosterGroups = rosterFeed?.athletes ?? [];
  const athletes = new Map(rosterGroups.flatMap(group => group.items ?? []).map(player => [player.id,player]));
  const roster = [...athletes.values()].map(player => ({
    id:String(player.id),name:player.fullName,number:player.jersey,position:player.position?.abbreviation ?? "",
    bio:[player.displayHeight,player.displayWeight,player.age ? player.age + " years old" : ""].filter(Boolean).join(" · "),detail:player.status?.name ?? ""
  })).sort((a,b) => Number(a.number || 100) - Number(b.number || 100) || a.name.localeCompare(b.name));
  const injuries = [...athletes.values()].flatMap(player => {
    const report = (player.injuries ?? []).filter(report => Date.now() - Date.parse(report.date) < 10 * 86400000)
      .sort((a,b) => Date.parse(b.date) - Date.parse(a.date))[0];
    if (!report?.status) return [];
    return [{name:player.fullName,status:report.status,detail:player.position?.abbreviation ?? "",date:report.date}];
  }).sort((a,b) => Date.parse(b.date) - Date.parse(a.date));
  const keys = {passingLeader:"Passing",rushingLeader:"Rushing",receivingLeader:"Receiving",
    totalTackles:"Tackles",sacks:"Sacks",interceptions:"Interceptions"};
  let leaders = (leadersFeed?.categories ?? []).filter(group => keys[group.name]).map(group => ({
    title:keys[group.name],rows:group.leaders.flatMap(row => {
      const playerId = row.athlete?.$ref?.match(/\/athletes\/(\d+)/)?.[1];
      const name = athletes.get(playerId)?.fullName;
      return name ? [{name,value:row.displayValue}] : [];
    }).slice(0,3)
  })).filter(group => group.rows.length);
  if (!leaders.length && fallback) {
    const sections = fallback.summary.leaders?.find(entry => String(entry.team?.id) === id)?.leaders ?? [];
    leaders = sections.map(group => ({
      title:fallback.label + " · " + group.displayName,
      rows:(group.leaders ?? []).filter(row => row.athlete?.displayName)
        .slice(0,3).map(row => ({name:row.athlete.displayName,value:row.displayValue}))
    })).filter(group => group.rows.length);
  }
  const stat = (section,key) => totals?.results?.stats?.categories?.find(group => group.name === section)
    ?.stats.find(stat => stat.name === key)?.displayValue;
  return {
    team:{code,name:team.displayName,record:info?.team?.record?.items?.find(item => item.type === "total")?.summary ?? "",
      context:info?.team?.standingSummary ?? ""},
    recent,upcoming,leaders,roster,injuries,
    stats:[
      ["Points/game",stat("scoring","totalPointsPerGame")],["Yards/game",stat("passing","yardsPerGame")],
      ["Rush yards/game",stat("rushing","rushingYardsPerGame")],["Third down %",stat("miscellaneous","thirdDownConvPct")],
      ["Turnover margin",stat("miscellaneous","turnOverDifferential")]
    ].filter(([,value]) => value != null).map(([label,value]) => ({label,value})),
    unavailable:[
      ...["team record","schedule","","roster","team stats"].filter((label,i) => label && results[i].status === "rejected"),
      ...(!leaders.length && [results[5],results[6]].some(result => result.status === "rejected") ? ["player leaders"] : [])
    ]
  };
}
const cache = new Map();
const asset = (body,type) => new Response(body,{headers:{"content-type":type + "; charset=utf-8","cache-control":"private, no-cache","x-content-type-options":"nosniff"}});
const json = (value,status = 200) => Response.json(value,{status,headers:{"cache-control":"no-store"}});
export default {
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/") return asset(PAGE,"text/html");
    if (path === "/desk.css") return asset(STYLE,"text/css");
    if (path === "/desk.js") return asset(SCRIPT,"text/javascript");
    if (path === "/favicon.ico") return new Response(null,{status:204});
    const week = /^\/api\/schedule\/(20\d{2})\/([123])\/(\d{1,2})$/.exec(path);
    const table = /^\/api\/standings\/(20\d{2})$/.exec(path);
    const team = /^\/api\/team\/(20\d{2})\/(\d{1,2})$/.exec(path);
    const athlete = /^\/api\/player\/(\d{1,10})$/.exec(path);
    if (!week && !table && !team && !athlete && path !== "/api/schedule") return new Response("Not found",{status:404});
    const saved = cache.get(path);
    if (saved && Date.now() - Date.parse(saved.at) < (athlete ? 300000 : 45000)) return json(saved);
    try {
      const url = table ? "v2/sports/football/nfl/standings?level=3&type=2&season=" + table[1] :
        "site/v2/sports/football/nfl/scoreboard" + (week ? "?dates=" + week[1] + "&seasontype=" + week[2] + "&week=" + week[3] : "");
      const data = athlete ? await playerWithAverages("football",athlete[1],readJson) : team ? await footballTeam(team[1],team[2]) :
        await readJson(espn + url).then(table ? standings : schedule);
      const result = {data,at:new Date().toISOString(),stale:false};
      if (cache.size >= 64) cache.delete(cache.keys().next().value);
      cache.set(path,result);
      return json(result);
    } catch {
      return saved ? json({...saved,stale:true}) : json({error:"NFL feed unavailable"},503);
    }
  }
};
