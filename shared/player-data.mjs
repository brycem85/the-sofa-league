// Provider data is normalized once; the client never needs provider-specific stat keys.
export function normalizeEspnPlayer(raw) {
  const table = {...raw.statistics};
  const metrics = (names,labels,values,categories = []) => (names ?? []).flatMap((name,i) => {
    const value = values?.[i];
    let offset = 0;
    const category = categories.find(category => {const start=offset;offset+=category.count || 0;return i>=start && i<offset;})?.name;
    return value == null || value === '' || value === '--' ? [] : [{key:category ? category + '.' + name : name,label:labels?.[i] || name,value:/pct|percentage/i.test(name + ' ' + (labels?.[i] || '')) && !String(value).includes('%') ? String(value)+'%' : String(value)}];
  });
  const passing = table.categories?.some(category=>category.name==='passing');
  if (passing) table.displayNames = (table.displayNames ?? []).map((label,i)=>table.names?.[i]==='sacks' ? 'Sacks taken' : table.names?.[i]==='interceptions' ? 'Interceptions thrown' : label);
  const groups = (table.splits ?? []).filter(split => !/projected/i.test(split.displayName)).map(split => ({
    title:split.displayName,stats:metrics(table.names,table.displayNames,split.stats,table.categories)
  })).filter(group => group.stats.length);
  const logs = raw.gameLog ?? {};
  const games = new Map();
  for (const category of logs.statistics ?? []) for (const row of category.events ?? []) {
    const event = logs.events?.[row.eventId];
    if (!event?.gameDate) continue;
    let game = games.get(row.eventId);
    if (!game) {game={date:event.gameDate,opponent:event.opponent?.displayName ?? event.opponent?.abbreviation ?? '',home:event.atVs !== '@',result:event.gameResult ?? '',score:event.score ?? '',stats:[]};games.set(row.eventId,game);}
    game.stats.push(...metrics(category.names,category.displayNames,row.stats));
  }
  return {label:table.displayName || 'Player statistics',groups,recent:[...games.values()].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,5),source:'ESPN'};
}
export function normalizeHockeyPlayer(raw) {
  const goalie=raw.position === 'G';
  const columns=goalie ? [['gamesPlayed','Games played'],['wins','Wins'],['losses','Losses'],['otLosses','OT losses'],['savePctg','Save percentage'],['savePercentage','Save percentage'],['goalsAgainstAvg','Goals against average'],['goalsAgainstAverage','Goals against average'],['shutouts','Shutouts'],['shotsAgainst','Shots against'],['saves','Saves']] : [['gamesPlayed','Games played'],['goals','Goals'],['assists','Assists'],['points','Points'],['plusMinus','Plus/minus'],['powerPlayGoals','Power-play goals'],['powerPlayPoints','Power-play points'],['shots','Shots'],['shootingPctg','Shooting percentage'],['pim','Penalty minutes'],['toi','Ice time']];
  const metrics=stats=>columns.flatMap(([key,label])=>stats?.[key] == null ? [] : [{key,label,value:/savePctg|savePercentage/.test(key) ? Number(stats[key]).toFixed(3) : key==='shootingPctg' ? (Number(stats[key])*100).toFixed(1)+'%' : String(stats[key])}]).filter((stat,i,all)=>all.findIndex(x=>x.label===stat.label)===i);
  const season=String(raw.featuredStats?.season ?? '');
  const regular=raw.featuredStats?.regularSeason ?? {};
  return {season:raw.featuredStats?.season,label:season.length===8 ? season.slice(0,4)+'–'+season.slice(6)+' regular season' : 'Regular season',groups:[{title:'Regular Season',stats:metrics(regular.subSeason)},{title:'Career',stats:metrics(regular.career ?? raw.careerTotals?.regularSeason)}].filter(group=>group.stats.length),recent:(raw.last5Games ?? []).map(game=>({date:game.gameDate,opponent:game.opponentAbbrev,home:game.homeRoadFlag==='H',result:'',score:'',stats:metrics(game)})),source:'NHL.com'};
}
