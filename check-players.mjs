import assert from 'node:assert/strict';
import {normalizeEspnPlayer,normalizeHockeyPlayer} from './shared/player-data.mjs';
import hub from './dist/server/index.js';
const nfl={statistics:{displayName:'2026 Passing',names:['passingYards','interceptions'],displayNames:['Passing Yards','Interceptions'],splits:[{displayName:'Regular Season',stats:['2,027','0']},{displayName:'Projected',stats:['4,000','0']},{displayName:'Career',stats:['20,000','55']}]},gameLog:{statistics:[{names:['passingYards'],displayNames:['Passing Yards'],events:[{eventId:'42',stats:['234']}]},{names:['rushingYards'],displayNames:['Rushing Yards'],events:[{eventId:'42',stats:['15']}]}],events:{42:{gameDate:'2026-11-08',atVs:'@',opponent:{displayName:'Jets'},gameResult:'W',score:'24-20'}}}};
const skater={position:'C',featuredStats:{season:20262027,regularSeason:{subSeason:{goals:0,points:5,shootingPctg:.125},career:{goals:20}}},last5Games:[{gameDate:'2026-11-08',homeRoadFlag:'H',opponentAbbrev:'BOS',goals:0,toi:'20:15'}]};
const goalie={position:'G',featuredStats:{regularSeason:{subSeason:{gamesPlayed:5,savePctg:.925,goalsAgainstAvg:2.11,shutouts:0}}}};
const normalized=normalizeEspnPlayer(nfl);
assert.equal(normalized.groups.length,2,'Projections must not appear as actual results');
assert.equal(normalized.groups[0].stats[1].value,'0','Zero is a real statistic');
assert.equal(normalized.recent.length,1,'Passing and rushing from one game must merge');
assert.deepEqual(normalized.recent[0].stats.map(x=>x.value),['234','15']);
assert.equal(normalizeHockeyPlayer(skater).groups[0].stats.find(x=>x.label==='Shooting percentage').value,'12.5%');
assert.equal(normalizeHockeyPlayer(goalie).groups[0].stats.find(x=>x.label==='Save percentage').value,'0.925');
assert.equal(normalizeHockeyPlayer(goalie).groups[0].stats.some(x=>x.label==='Goals'),false);
assert.deepEqual(normalizeEspnPlayer({}).groups,[]);
const original=globalThis.fetch;let calls=0;globalThis.fetch=async url=>{calls++;return Response.json(String(url).includes('nhle.com')?skater:nfl);};
try{for(const sport of ['hockey','football','basketball']){const path='https://test.invalid/'+sport+'/api/player/12345';const r=await hub.fetch(new Request(path));assert.equal(r.status,200);const payload=await r.json();assert.ok(payload.data.groups.length);await hub.fetch(new Request(path));}assert.equal(calls,6,'Repeat opens should use the server cache');for(const path of ['/football/api/player/abc','/hockey/api/player/12345678901','/basketball/api/player/12/extra'])assert.equal((await hub.fetch(new Request('https://test.invalid'+path))).status,404);assert.equal(calls,6,'Invalid routes must not reach an upstream');}finally{globalThis.fetch=original;}
console.log('Passed: sport-specific player statistics, zero/missing values, no projections, merged recent games, goalie formatting, bounded routes and cached player endpoints.');
