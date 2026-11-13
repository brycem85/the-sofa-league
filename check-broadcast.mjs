import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('shared/broadcast.js',import.meta.url),'utf8');
function client(userAgent,platform = '',maxTouchPoints = 0) {
  const context = vm.createContext({window:{},navigator:{userAgent,platform,maxTouchPoints}});
  vm.runInContext(source,context);
  return context.window.gameDeskBroadcast;
}
const ios = client('Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)');
const [game] = ios.forNetworks(['ESPN+'],{sport:'hockey',eventId:'401892683'});
assert.equal(game.scope,'game');
const native = new URL(game.appUrl);
assert.equal(native.protocol,'sportscenter:');
assert.equal(native.searchParams.get('playGameID'),'401892683');
assert.equal(new URL(game.webUrl).pathname,'/watch/player/_/eventCalendarId/401892683');
const markup = ios.buttons(game,'primary',{context:'Away <test> at Home "Team"',key:'2026020001'});
assert.match(markup,/target="_self"/);
assert.match(markup,/Watch on web/);
assert.match(markup,/&lt;test&gt;/);
assert.doesNotMatch(markup,/<test>/);
assert.equal(ios.forNetworks(['NBA TV'],{sport:'basketball',eventId:'401892683'}).length,0);
assert.equal(ios.forNetworks(['NBC'],{sport:'hockey'}).length,0);
const [regional] = ios.forNetworks(['ALT'],{sport:'hockey',includeEspn:true,eventId:'401892683'});
assert.equal(regional.scope,'game');
const [unmatched] = ios.forNetworks(['ESPN+'],{sport:'hockey',eventId:'401892683&other=1'});
assert.equal(unmatched.scope,'service');
assert.doesNotMatch(unmatched.appUrl,/sportscenter:/);
assert.equal(ios.forNetworks(['ESPN+'],{sport:'hockey',allowEspn:false}).length,0);
for (const [channel,sport,name] of [['NBC','basketball','Peacock'],['Prime Video','basketball','Prime Video'],['TNT','hockey','HBO Max']]) {
  const options = ios.forNetworks([channel,channel],{sport,eventId:'401892683'});
  assert.equal(options.length,1);
  assert.equal(options[0].name,name);
  assert.equal(options[0].scope,'service');
  assert.equal(new URL(options[0].appUrl).protocol,'https:');
  assert.match(ios.note(options),/select this matchup/);
}
const desktop = client('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
assert.equal(desktop.appleMobile,false);
assert.doesNotMatch(desktop.buttons(game),/sportscenter:|Watch on web/);
assert.match(desktop.buttons(game),/target="_blank"/);
assert.equal(client('Mozilla/5.0 (Macintosh)','MacIntel',5).appleMobile,true);

// An ESPN app route is only game-specific when the separate ESPN feed
// unambiguously matches both NHL teams and the start time.
const hockey = await readFile(new URL('sports/hockey/site/desk.js',import.meta.url),'utf8');
const matchFunction = hockey.match(/function espnPlayback\([\s\S]*?\r?\n}\r?\n/)[0];
const context = vm.createContext({region:'US',day:'2026-11-10',espn:'https://www.espn.com/watch/',
  espnHockey:'https://www.espn.com/watch/category/hockey',espnStatus:() => ['market'],
  espnSchedule:{date:'2026-11-10',games:[{id:'401892683',home:'TOR',away:'COL',time:'2026-11-10T00:00:00Z'}]}});
vm.runInContext(matchFunction,context);
const nhl = {id:'2026020001',home:{code:'TOR'},away:{code:'COL'},time:'2026-11-10T00:00:00Z',scheduleState:'OK'};
assert.equal(context.espnPlayback(nhl).eventId,'401892683');
context.espnSchedule.games.push({...context.espnSchedule.games[0],id:'401892684'});
assert.equal(context.espnPlayback(nhl).eventId,undefined);
context.espnSchedule.games.pop();
assert.equal(context.espnPlayback({...nhl,home:{code:'BOS'}}).eventId,undefined);
assert.equal(context.espnPlayback({...nhl,time:'2026-11-10T03:00:00Z'}).eventId,undefined);
assert.equal(context.espnPlayback({...nhl,scheduleState:'CNCL'}),null);
context.region = 'CA';
assert.equal(context.espnPlayback(nhl),null);
console.log('Passed: exact game mapping, ambiguous/opponent/time rejection, regional eligibility, app/web fallbacks, provider selection, escaping, iPhone/iPad and desktop behavior.');
