// Complete cohorts, matching stat keys and explicit sample sizes keep comparisons honest.
export function leagueRows(raw) {
  const columns = new Map((raw.categories ?? []).map(category=>[category.name,category.names]));
  return (raw.athletes ?? []).map(entry=>{
    const stats = {};
    for (const category of entry.categories ?? []) for (const [i,name] of (columns.get(category.name) ?? []).entries()) {
      const value = category.values?.[i];
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      stats[category.name + '.' + name] = value;
      if (!(name in stats)) stats[name]=value;
      else if (stats[name] !== value) stats[name]=null;
    }
    return {id:String(entry.athlete.id),position:entry.athlete.position?.abbreviation ?? '',stats};
  });
}
export function hockeyLeagueRows(raw,goalie) {
  const aliases = goalie ? {savePctg:'savePct',savePercentage:'savePct',goalsAgainstAvg:'goalsAgainstAverage'} : {powerPlayGoals:'ppGoals',powerPlayPoints:'ppPoints',pim:'penaltyMinutes',shootingPctg:'shootingPct'};
  return (raw.data ?? []).map(row=>({id:String(row.playerId),position:goalie?'G':row.positionCode,stats:{...row,...Object.fromEntries(Object.entries(aliases).map(([key,source])=>[key,row[source]]))}}));
}
const metricNumber = value => typeof value === 'number' ? value : /^[-+]?\d+(?:\.\d+)?%?$/.test(String(value).replaceAll(',','')) ? Number(String(value).replaceAll(',','').replace('%','')) : NaN;
export function addLeagueBenchmarks(data,league,sport,id) {
  const own = league.rows.find(row=>row.id===String(id));
  if (!own || (sport==='football' && !own.position)) return {...data,comparisonStatus:'League comparisons are unavailable for this player.'};
  if (data.season && Number(data.season)!==Number(league.season)) return {...data,comparisonStatus:'Matching-season league comparisons are unavailable.'};
  if (sport==='football') {
    const year=data.label.match(/\b20\d{2}\b/)?.[0];
    if (year && Number(year)!==Number(league.season)) return {...data,comparisonStatus:'Matching-season league comparisons are unavailable.'};
  }
  const goalie=sport==='hockey' && own.position==='G';
  const rows=league.rows.filter(row=>(row.stats.gamesPlayed ?? 0)>0 && (sport!=='football' || row.position===own.position));
  const cohort=sport==='football' ? 'NFL '+own.position+' players' : sport==='hockey' ? 'NHL '+(goalie?'goalies':'skaters') : 'NBA players';
  const short=sport==='football' ? own.position+' avg' : sport==='hockey' ? (goalie?'Goalie avg':'Skater avg') : 'NBA avg';
  const alias={threePointPct:'threePointFieldGoalPct'};
  const attempts={fieldGoalPct:'fieldGoalsAttempted',threePointPct:'threePointFieldGoalsAttempted',freeThrowPct:'freeThrowsAttempted',completionPct:'passingAttempts',yardsPerPassAttempt:'passingAttempts',QBRating:'passingAttempts',QBR:'passingAttempts',adjQBR:'passingAttempts',yardsPerRushAttempt:'rushingAttempts',yardsPerReception:'receptions',extraPointPct:'extraPointAttempts',grossAvgPuntYards:'punts',netAvgPuntYards:'punts',yardsPerKickReturn:'kickReturns',yardsPerPuntReturn:'puntReturns',shootingPctg:'shots',savePctg:'shotsAgainst',savePercentage:'shotsAgainst',goalsAgainstAverage:'timeOnIce',goalsAgainstAvg:'timeOnIce'};
  if(sport==='football')attempts.fieldGoalPct='fieldGoalAttempts';
  let compared=0;
  const groups=data.groups.map(group=>group.title!=='Regular Season'?group:{...group,stats:group.stats.map(stat=>{
    const key=alias[stat.key] ?? stat.key;
    const name=stat.key?.split('.').at(-1);
    const denominator=attempts[name];
    const values=rows.filter(row=>!denominator || row.stats[denominator]>0).map(row=>row.stats[key]).filter(value=>typeof value==='number' && Number.isFinite(value));
    const value=metricNumber(stat.value);
    if(values.length<2 || !Number.isFinite(value))return stat;
    let average=values.reduce((sum,value)=>sum+value,0)/values.length;
    const percent=String(stat.value).includes('%');
    if(sport==='hockey' && percent)average*=100;
    const digits=goalie && /savePctg|savePercentage/.test(name)?3:goalie && /goalsAgainstAvg|goalsAgainstAverage/.test(name)?2:1;
    average=Number(average.toFixed(digits));
    const displayed=Number(value.toFixed(digits));
    const direction=displayed>average?'up':displayed<average?'down':'equal';
    compared++;
    return {...stat,comparison:{average:average.toFixed(digits)+(percent?'%':''),direction,count:values.length,cohort,label:short}};
  })});
  return {...data,groups,comparison:compared?{cohort,count:rows.length,season:league.label,at:league.at}:null,comparisonStatus:compared?'':'Matching league averages are not reported for these stats.'};
}
const leagueBenchmarkCache=new Map();
async function completeEspnLeague(sport,read) {
  const path='https://site.api.espn.com/apis/common/v3/sports/'+(sport==='football'?'football/nfl':'basketball/nba')+'/statistics/byathlete?seasontype=2&isqualified=false&limit=1000';
  let page=await read(path);
  const pages=Number(page.pagination?.pages);
  const count=Number(page.pagination?.count);
  const season=page.requestedSeason?.year;
  const label=page.requestedSeason?.displayName;
  if(!Number.isInteger(pages) || pages<1 || pages>8 || !season || !count)throw new Error('Incomplete league cohort');
  const rows=leagueRows(page);
  let received=page.athletes?.length ?? 0;
  // Normalize and release each large provider page before reading the next one.
  page=null;
  for(let index=2;index<=pages;index++){
    page=await read(path+'&season='+season+'&page='+index);
    if(page.requestedSeason?.year!==season || page.pagination?.count!==count)throw new Error('League feed changed during pagination');
    received+=page.athletes?.length ?? 0;
    rows.push(...leagueRows(page));
    page=null;
  }
  const unique=[...new Map(rows.map(row=>[row.id,row])).values()];
  if(received<count || unique.length!==count)throw new Error('Incomplete league cohort');
  return {rows:unique,season,label,at:new Date().toISOString()};
}
async function cachedLeague(key,load) {
  const existing=leagueBenchmarkCache.get(key);
  if(existing && Date.now()-existing.at<300000)return existing.pending;
  const pending=load();
  if(leagueBenchmarkCache.size>=8)leagueBenchmarkCache.delete(leagueBenchmarkCache.keys().next().value);
  leagueBenchmarkCache.set(key,{at:Date.now(),pending});
  try{return await pending;}catch(error){if(leagueBenchmarkCache.get(key)?.pending===pending)leagueBenchmarkCache.delete(key);throw error;}
}
export async function playerWithAverages(sport,id,read) {
  if(sport==='hockey'){
    const raw=await read('https://api-web.nhle.com/v1/player/'+id+'/landing');
    const data=normalizeHockeyPlayer(raw);
    try{
      const goalie=raw.position==='G';const season=raw.featuredStats?.season;
      if(!/^20\d{6}$/.test(String(season)))throw new Error('Missing season');
      const league=await cachedLeague('nhl:'+season+':'+goalie,async()=>{
        const feed=await read('https://api.nhle.com/stats/rest/en/'+(goalie?'goalie':'skater')+'/summary?isAggregate=false&isGame=false&start=0&limit=-1&cayenneExp=seasonId='+season+'%20and%20gameTypeId=2');
        if(!feed.total || feed.data?.length!==feed.total || feed.data.some(row=>Number(row.seasonId)!==Number(season)))throw new Error('Incomplete league cohort');
        return {rows:hockeyLeagueRows(feed,goalie),season,label:String(season).slice(0,4)+'–'+String(season).slice(6),at:new Date().toISOString()};
      });
      return addLeagueBenchmarks(data,league,sport,id);
    }catch{return {...data,comparisonStatus:'League averages are temporarily unavailable. Player statistics are still shown.'};}
  }
  const leagueRequest=cachedLeague(sport,()=>completeEspnLeague(sport,read));
  const [player,league]=await Promise.allSettled([read('https://site.api.espn.com/apis/common/v3/sports/'+(sport==='football'?'football/nfl':'basketball/nba')+'/athletes/'+id+'/overview'),leagueRequest]);
  if(player.status==='rejected')throw player.reason;
  const data=normalizeEspnPlayer(player.value);
  return league.status==='fulfilled'?addLeagueBenchmarks(data,league.value,sport,id):{...data,comparisonStatus:'League averages are temporarily unavailable. Player statistics are still shown.'};
}
