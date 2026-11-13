import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const core = await readFile(new URL('shared/motion-core.js',import.meta.url),'utf8');
const context = vm.createContext({window:{}});
vm.runInContext(core,context);
const Ledger = context.window.GameDeskScoreLedger;
const ledger = new Ledger();
const live = (away = 0,home = 0) => ({id:'401892683',state:'in',status:'In Progress',away:{code:'BOS',score:away},home:{code:'NYR',score:home}});
const options = {scope:'today',fresh:true,favorite:'BOS'};
assert.equal(ledger.observe([live(2,1)],options).length,0,'Initial values must not animate');
assert.equal(ledger.observe([live(2,1)],options).length,0,'Unchanged refresh must stay calm');
const changed = ledger.observe([live(3,1)],options);
assert.equal(changed.length,1);
assert.deepEqual([...changed[0].scoring],['away']);
const correction = ledger.observe([live(2,1)],options)[0];
assert.equal(correction.scoring.length,0,'Score corrections must not celebrate');
assert.equal(ledger.observe([live(3,1)],{...options,fresh:false}).length,0,'Cached payload must not celebrate');
assert.equal(ledger.observe([live(4,1)],options).length,0,'Reconnecting establishes a fresh baseline');
const result = {...live(4,1),state:'post',status:'Final'};
assert.equal(ledger.observe([result],options)[0].won,true,'Fresh live-to-final win should stamp once');
assert.equal(ledger.observe([result],options).length,0,'Do not repeat a victory stamp');
const newDate = {scope:'other-day',fresh:true};
assert.equal(ledger.observe([live(10,4)],newDate).length,0,'Changing dates must not count as a score update');
ledger.disarm();
assert.equal(ledger.observe([live(11,4)],newDate).length,0,'Returning to a view establishes a baseline');
const historical = new Ledger();
assert.equal(historical.observe([result],options).length,0);

const spotlightCode = await readFile(new URL('shared/spotlight.js',import.meta.url),'utf8');
vm.runInContext(spotlightCode,context);
const spotlight = context.window.gameDeskSpotlight;
const scheduled = {id:'a',state:'pre',status:'Scheduled',time:'2026-11-11T23:00:00Z',away:{code:'BOS',name:'Boston',record:'9-3',score:null},home:{code:'NYR',name:'New York',record:'9-4',score:null},networks:['ESPN']};
const other = {...scheduled,id:'b',state:'in',away:{code:'COL',name:'Colorado',record:'6-5',score:2},home:{code:'TOR',name:'Toronto',record:'7-5',score:2}};
const selected = spotlight.choose([scheduled,other],{sport:'football',favorite:'BOS'});
assert.equal(selected.game.id,'b','A saved team must not force every pick to that team');
assert.ok(selected.reasons.some(reason => reason.kind === 'live'));
assert.ok(selected.reasons.every(reason => !/rival|playoff|star player/i.test(reason.text)));
const unknown = {...scheduled,networks:[],away:{code:'AAA',record:'—'},home:{code:'BBB',record:''}};
assert.equal(spotlight.choose([unknown],{sport:'football'}).reasons[0].kind,'fallback');
assert.equal(spotlight.choose([{...scheduled,status:'Postponed'}],{sport:'football'}),null);
const hockey = {...scheduled,state:'FUT',away:{code:'BOS'},home:{code:'NYR'},tv:[]};
const hockeyPick = spotlight.choose([hockey],{sport:'hockey',standings:[{code:'BOS',pct:0},{code:'NYR',pct:.05}]});
assert.ok(hockeyPick.reasons.some(reason => /0\.0%/.test(reason.text)),'A real zero percentage is valid data');
assert.equal(spotlight.recordPct('0-0'),null);
assert.equal(spotlight.recordPct('6-3-1'),.65);
assert.equal(spotlight.recordPct('bad data'),null);

const themeCode = await readFile(new URL('shared/theme.js',import.meta.url),'utf8');
const palettes = JSON.parse(await readFile(new URL('shared/team-colors.json',import.meta.url),'utf8'));
const lum = rgb => rgb.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum,value,index) => sum + value * [.2126,.7152,.0722][index],0);
let checked = 0;
for (const appearance of ['dark','light']) for (const [sport,palette] of Object.entries(palettes)) {
  const values = new Map();
  const root = {dataset:{appearance},style:{setProperty:(key,value) => values.set(key,value),removeProperty:key => values.delete(key)}};
  const mock = vm.createContext({document:{documentElement:root,querySelector:() => ({removeAttribute(){}}),querySelectorAll:() => []},location:{hash:'#/games'},
    window:{gameDeskSport:sport,gameDeskColors:palette,gameDeskSettings:{value:{teamColors:true}},dispatchEvent(){},addEventListener(){}},
    getComputedStyle:() => ({getPropertyValue:() => '#c2e779'}),CustomEvent:class{constructor(type,detail){this.type=type;this.detail=detail;}}});
  vm.runInContext(themeCode,mock);
  for (const code of Object.keys(palette)) {
    mock.window.gameDeskTheme.apply(code);
    const token = name => values.get('--team-' + name).match(/[\d.]+/g).map(Number);
    const contrast = (a,b) => (Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
    const surfaces = ['bg','panel','raised'].map(token);
    for (const name of ['ink','muted','accent','live']) for (const background of surfaces) {
      assert.ok(contrast(token(name),background)>=4.5,code + ' ' + appearance + ' ' + name + ': insufficient body contrast');
    }
    for (const arrow of appearance === 'dark' ? [[121,230,181],[255,153,153]] : [[18,98,63],[167,33,50]]) assert.ok(contrast(arrow,token('raised'))>=4.5,code + ' ' + appearance + ': insufficient league-arrow contrast');
    assert.ok(contrast(token('fill'),token('on-fill'))>=4.5,code + ' ' + appearance + ': insufficient jersey-fill contrast');
    assert.ok(contrast(token('fill'),token('trim'))>=3,code + ' ' + appearance + ': invisible secondary stripe');
    assert.notDeepEqual(token('bg'),appearance === 'dark' ? [21,43,67] : [240,245,247],'A team selection must change the canvas');
    if (sport === 'hockey' && code === 'BOS') assert.deepEqual(token('trim'),[35,31,32],'Gold Bruins fill should keep the black jersey stripe');
    checked++;
    mock.window.gameDeskSettings.value.teamColors = false;
    mock.window.gameDeskTheme.apply(code);
    assert.equal(root.dataset.teamTheme,undefined,'Turning off team colors restores the neutral theme');
    assert.equal(values.size,0,'No jersey tokens should remain after disabling team colors');
    mock.window.gameDeskSettings.value.teamColors = true;
    mock.window.gameDeskTheme.apply(code);
    assert.equal(root.dataset.teamTheme,code,'Re-enabling restores the selected team');

  }
}
console.log('Passed: score baselines, unchanged refreshes, corrections, stale/reconnect handling, one-time wins, dates, verified Must-Watch reasons and ' + checked + ' full-team palettes, text/fill/stripe contrast, and color-toggle restoration.');
