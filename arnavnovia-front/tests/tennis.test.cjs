const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const htmlPath = fs.existsSync(`${__dirname}/itennis.html`) ? `${__dirname}/itennis.html` : `${__dirname}/../HTML/tennis.html`;
const script = fs.readFileSync(htmlPath, 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const game = (overrides={}) => ({
  CycleId:157122, CompetitionName:'אזורית סוכות 2026', CategoryName:"בנים 14 מרכז א'",
  GameTime:'2026-09-29T17:30:00', _date:'2026-09-29',
  FirstPlayerId:288466, FirstPlayerName:'Player A', FirstPlayerStatus:null,
  SecondPlayerId:133571, SecondPlayerName:'Player B', SecondPlayerStatus:null,
  AuditoriumId:14153, AuditoriumName:'Court', AuditoriumAddress:'Address', SetsScores:[], ...overrides
});
function browser(store=new Map()){
  const elements=new Map(), events={}, feeds=new Map();
  function element(){
    const classes=new Set();
    return {value:'',textContent:'',children:[],dataset:{},
      set innerHTML(v){this.html=v;this.children=[];}, get innerHTML(){return this.html||'';},
      classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),toggle(){},contains:c=>classes.has(c)},
      appendChild(child){this.children.push(child);},addEventListener(){},focus(){},
      getContext:()=>({beginPath(){},arc(){},fill(){},stroke(){},fillText(){}}),toDataURL:()=>''};
  }
  const ctx=vm.createContext({
    localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)},
    document:{title:'',hidden:false,body:element(),querySelector:s=>{
      if(!elements.has(s))elements.set(s,element());return elements.get(s);
    },querySelectorAll:()=>[],createElement:element,addEventListener:(name,fn)=>events[name]=fn},
    addEventListener:(name,fn)=>events[name]=fn,
    setTimeout(){},setInterval(){},clearInterval(){},
    btoa:s=>Buffer.from(s,'binary').toString('base64'),
    fetch:async url=>{
      const feed=feeds.get(url.split('/').at(-1));
      if(feed instanceof Error)throw feed;
      return {ok:feed!==false,status:feed===false?503:200,json:async()=>({UnionCompetitionGames:feed||[]})};
    }
  });
  ctx.window=ctx;
  vm.runInContext(script,ctx);
  const evaluate=code=>vm.runInContext(code,ctx);
  const pass=games=>{ctx.games=games;return evaluate('computeDiff(games)');};
  return {ctx,store,elements,events,feeds,evaluate,pass};
}

test('configured dates stay on their calendar day in Israel',()=>{
  const b=browser();
  b.evaluate("CFG.from='2026-09-28'; CFG.to='2026-09-30'");
  assert.equal(b.evaluate('dateList().join(",")'),'2026-09-28,2026-09-29,2026-09-30');
});

test('a walkover without scores is completed and identifies either winner',()=>{
  for(const side of [1,2]){
    const b=browser();
    b.ctx.g=game({[side===1?'FirstPlayerStatus':'SecondPlayerStatus']:'W.O.'});
    assert.equal(b.evaluate('played(g)'),true);
    assert.equal(b.evaluate('winner(g)'),side);
    assert.match(b.evaluate('statusPill(g)'),/ניצחון טכני/);
    assert.match(b.evaluate(`setsHtml(g).${side===1?'a':'b'}`),/W\.O\./);
    b.evaluate('ALL=[g]; CFG.scope="all"; render()');
    const card=b.elements.get('#list').children.at(-1).innerHTML;
    assert.match(card,/ניצחון טכני/);
    assert.match(card,/class="pname win/);
  }
});

test('walkover registration generates a result update',()=>{
  const b=browser();b.pass([game()]);
  b.pass([game({FirstPlayerStatus:'W.O.'})]);
  assert.equal(b.evaluate('UNSEEN["157122"].label'),'תוצאה');
});

test('hidden IDs, seconds, spacing, numeric types and set order do not reset unread state',()=>{
  const b=browser();
  const scored=game({SetsScores:[
    {SetNumber:1,FirstPlayerScore:6,SecondPlayerScore:2},
    {SetNumber:2,FirstPlayerScore:6,SecondPlayerScore:3}
  ]});
  b.pass([scored]);
  b.pass([{...scored,GameTime:'2026-09-29T17:30:00.000',AuditoriumId:999,
    FirstPlayerId:999,FirstPlayerName:' Player  A ',
    SetsScores:[{GameSetId:123,SetNumber:2,FirstPlayerScore:'6',SecondPlayerScore:'3'},scored.SetsScores[0]]}]);
  assert.equal(b.evaluate('Object.keys(UNSEEN).length'),0);
});

test('a new opponent updates the same scheduled match',()=>{
  const b=browser();b.pass([game({SecondPlayerId:0,SecondPlayerName:null})]);
  b.pass([game()]);
  assert.equal(b.evaluate('UNSEEN["157122"].label'),'עודכן');
  assert.equal(b.evaluate('Object.keys(storedMatches(stateKey())).length'),1);
});

test('visible score, schedule and venue changes are still detected',()=>{
  for(const [changes,label] of [
    [{SetsScores:[{SetNumber:1,FirstPlayerScore:6,SecondPlayerScore:1}]},'תוצאה'],
    [{GameTime:'2026-09-29T18:30:00'},'שינוי שעה'],
    [{AuditoriumName:'Another court'},'עודכן']
  ]){
    const b=browser();b.pass([game()]);b.pass([game(changes)]);
    assert.equal(b.evaluate('UNSEEN["157122"].label'),label);
  }
});

test('previous snapshot format migrates while preserving acknowledgements',()=>{
  const b=browser();
  b.ctx.old='2026-09-29T17:30:00§288466§133571§Player A§Player B§14153§';
  b.evaluate('localStorage.setItem(stateKey(),JSON.stringify({"157122|133571-288466":old}))');
  b.pass([game()]);
  assert.equal(b.evaluate('Object.keys(UNSEEN).length'),0);
  assert.equal(b.evaluate('Object.keys(storedMatches(stateKey())).join(",")'),'157122');
});

test('returning matches remain read after an empty response or a narrower window',()=>{
  const b=browser();b.pass([game()]);b.pass([]);b.pass([game()]);
  assert.equal(b.evaluate('Object.keys(UNSEEN).length'),0);
});

test('a failed refresh keeps cards and does not generate updates on recovery or reload',async()=>{
  const b=browser();
  b.evaluate("CFG.from='2026-09-29'; CFG.to='2026-09-29'; CFG.scope='all'");
  b.feeds.set('2026-09-29',[game()]);await b.evaluate('run()');
  b.feeds.set('2026-09-29',false);await b.evaluate('run()');
  assert.equal(b.evaluate('ALL.length'),1);
  assert.match(b.elements.get('#status').textContent,/לא ניתן לרענן/);
  b.feeds.set('2026-09-29',[game()]);await b.evaluate('run()');
  assert.equal(b.evaluate('Object.keys(UNSEEN).length'),0);
  const returning=browser(b.store);
  returning.evaluate("CFG.from='2026-09-29'; CFG.to='2026-09-29'");
  returning.feeds.set('2026-09-29',new Error('offline'));await returning.evaluate('run()');
  returning.feeds.set('2026-09-29',[game()]);await returning.evaluate('run()');
  assert.equal(returning.evaluate('Object.keys(UNSEEN).length'),0);
});

test('stale cached data cannot undo a result acknowledged in another tab',async()=>{
  const store=new Map(),a=browser(store),b=browser(store);
  a.evaluate("CFG.from='2026-09-29'; CFG.to='2026-09-29'");
  a.feeds.set('2026-09-29',[game()]);await a.evaluate('run()');
  b.pass([game({FirstPlayerStatus:'W.O.'})]);b.evaluate('markRead()');
  a.feeds.set('2026-09-29',false);await a.evaluate('run()');
  assert.equal(a.evaluate('Object.keys(UNSEEN).length'),0);
  a.feeds.set('2026-09-29',[game({FirstPlayerStatus:'W.O.'})]);await a.evaluate('run()');
  assert.equal(a.evaluate('Object.keys(UNSEEN).length'),0);
});

test('a partial first scan establishes its baseline only after successful loading',async()=>{
  const b=browser();b.evaluate("CFG.from='2026-09-28'; CFG.to='2026-09-29'");
  b.feeds.set('2026-09-28',[game({CycleId:10,GameTime:'2026-09-28T10:00:00'})]);
  b.feeds.set('2026-09-29',false);await b.evaluate('run()');
  assert.equal(b.evaluate('localStorage.getItem(stateKey())'),null);
  b.feeds.set('2026-09-29',[game()]);await b.evaluate('run()');
  assert.equal(b.evaluate('Object.keys(UNSEEN).length'),0);
});

test('acknowledging an update in another tab clears the badge on this tab',()=>{
  const store=new Map(),a=browser(store),b=browser(store);
  a.pass([game()]);a.pass([game({FirstPlayerStatus:'W.O.'})]);
  b.pass([game({FirstPlayerStatus:'W.O.'})]);b.evaluate('markRead()');
  a.events.storage({key:a.evaluate('unseenKey()')});
  assert.equal(a.evaluate('Object.keys(UNSEEN).length'),0);
  assert.equal(a.elements.get('#banner').classList.contains('show'),false);
});
