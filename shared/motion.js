(() => {
  const root = document.documentElement;
  const ledger = new window.GameDeskScoreLedger();
  const active = new Set();
  const owned = new WeakMap();
  const snapshots = new WeakMap();
  const signatures = new WeakMap();
  const osMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const spring = 'cubic-bezier(.16,1,.3,1)';
  const reduced = () => Boolean(window.gameDeskSettings?.value.reduceMotion || osMotion.matches);
  const escape = value => String(value ?? '').replace(/[&<>"']/g,char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let origin = null;
  let initialized = false;
  let announce;
  let lastScope = '';
  const removedGhosts = new Set();
  const pendingCards = new Map();
  const cardObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    let index = 0;
    for (const entry of entries) if (entry.isIntersecting && pendingCards.has(entry.target)) {
      pendingCards.delete(entry.target);
      cardObserver.unobserve(entry.target);
      if (!entry.target.contains(document.activeElement)) deal(entry.target,index++ * 25);
    }
  },{threshold:.08,rootMargin:'0px 0px 28px 0px'}) : null;
  function deal(card,delay = 0) {
    // The ticket contents deal in; watch controls retain their hit targets.
    play(card,[{opacity:.35},{opacity:1}],{duration:340,delay});
    [...card.children].filter(element => element.tagName === 'DIV' && !element.classList.contains('game-actions')).forEach((element,index) =>
      play(element,[{opacity:0,transform:'translate(-22px,19px) rotate(-1.4deg) scale(.97)'},{opacity:1,transform:'translate(3px,-2px) rotate(.25deg) scale(1.005)',offset:.72},{opacity:1,transform:'none'}],{duration:560,delay:delay + index * 25}));
  }
  function play(element,frames,options = {}) {
    if (!element?.animate || reduced() || document.hidden) return null;
    owned.get(element)?.cancel();
    const animation = element.animate(frames,{duration:480,easing:spring,...options});
    active.add(animation);
    owned.set(element,animation);
    const done = () => { active.delete(animation); if (owned.get(element) === animation) owned.delete(element); };
    animation.finished.then(done,done);
    return animation;
  }
  function cancelMotion() {
    for (const animation of active) animation.cancel();
    active.clear();
    for (const ghost of removedGhosts) ghost.remove();
    removedGhosts.clear();
    for (const card of pendingCards.keys()) cardObserver?.unobserve(card);
    pendingCards.clear();
  }
  function placeholder(title,description) {
    const loading = /^(Loading|Checking|Connecting)\b/i.test(title);
    if (loading) return '<div class="desk-loading" role="status" aria-live="polite" aria-busy="true"><div class="loading-caption"><span class="loading-disc" aria-hidden="true"></span><span><strong>' + escape(title) + '</strong><small>' + escape(description) + '</small></span></div><div class="skeleton-cards" aria-hidden="true">' + [0,1].map(() => '<div class="skeleton-ticket"><i></i><span><b></b><b></b></span><em></em></div>').join('') + '</div></div>';
    return '<div class="desk-empty"><span class="empty-stamp" aria-hidden="true">' + (/no games|no matching|no followed|pick|choose/i.test(title) ? 'TAKE A BREATHER' : 'FROM THE DESK') + '</span><strong>' + escape(title) + '</strong><p>' + escape(description) + '</p><span class="empty-rule" aria-hidden="true"></span></div>';
  }
  function capture(container) {
    if (!container) return;
    const cards = new Map([...container.querySelectorAll('.game[data-game-id]')].map(card => [card.dataset.gameId,{rect:card.getBoundingClientRect(),card}]));
    const focused = document.activeElement;
    const focusedCard = focused?.closest?.('.game[data-game-id]');
    const focus = focusedCard && container.contains(focusedCard) ? {element:focused,id:focusedCard.dataset.gameId,index:[...focusedCard.querySelectorAll('a,button,input,select')].indexOf(focused)} : null;
    snapshots.set(container,{cards,height:container.getBoundingClientRect().height,route:root.dataset.currentView,focus});
  }
  function replaceGames(container,html) {
    const template = document.createElement('template');
    template.innerHTML = html;
    const oldCards = new Map([...container.querySelectorAll('.game[data-game-id]')].map(card => [card.dataset.gameId,card]));
    for (const incoming of template.content.querySelectorAll('.game[data-game-id]')) {
      const old = oldCards.get(incoming.dataset.gameId);
      const signature = incoming.outerHTML;
      if (old && signatures.get(old) === signature) incoming.replaceWith(old);
      else signatures.set(incoming,signature);
    }
    container.replaceChildren(template.content);
  }
  function commit(container,{games = [],scope = '',fresh = false} = {}) {
    if (!container) return;
    const before = snapshots.get(container) || {cards:new Map(),height:0};
    snapshots.delete(container);
    if (scope !== lastScope) ledger.disarm();
    lastScope = scope;
    const updates = ledger.observe(games,{scope:window.gameDeskSport + ':' + scope,fresh: fresh && !document.hidden,favorite:window.gameDeskSpotlight.favorite()});
    const models = new Map(games.map(game => [String(game.id),game]));
    const cards = [...container.querySelectorAll('.game[data-game-id]')];
    for (const card of pendingCards.keys()) if (!card.isConnected) { cardObserver?.unobserve(card);pendingCards.delete(card); }
    if (before.focus && [document.body,document.documentElement].includes(document.activeElement)) {
      const card = cards.find(card => card.dataset.gameId === before.focus.id);
      const target = before.focus.element.isConnected ? before.focus.element : card?.querySelectorAll('a,button,input,select')[before.focus.index];
      target?.focus({preventScroll:true});
    }
    for (const card of cards) {
      const model = models.get(card.dataset.gameId);
      if (!model) continue;
      card.dataset.overtime = String(window.gameDeskSpotlight.overtime(model));
      card.dataset.gameState = window.gameDeskSpotlight.live(model) ? 'live' : window.gameDeskSpotlight.final(model) ? 'final' : 'scheduled';
      card.dataset.favorite = String([model.away.code,model.home.code].includes(window.gameDeskSpotlight.favorite()));
    }
    const liveGames = fresh ? games.filter(window.gameDeskSpotlight.live) : [];
    root.dataset.liveCount = String(liveGames.length);
    root.dataset.gameDayMood = liveGames.some(window.gameDeskSpotlight.overtime) ? 'overtime' : liveGames.length ? 'live' : 'quiet';
    if (reduced() || document.hidden || root.dataset.currentView !== 'games') return;
    const present = new Set(cards.map(card => card.dataset.gameId));
    const entering = cards.filter(card => !before.cards.has(card.dataset.gameId));
    const leaving = [...before.cards].filter(([id]) => !present.has(id));
    if (before.cards.size && leaving.length && !entering.length) {
      for (const [,old] of leaving.slice(0,3)) {
        if (old.rect.bottom < 0 || old.rect.top > innerHeight) continue;
        const ghost = old.card.cloneNode(true);
        ghost.inert = true;
        ghost.setAttribute('aria-hidden','true');
        ghost.classList.add('game-ghost');
        Object.assign(ghost.style,{position:'fixed',top:old.rect.top + 'px',left:old.rect.left + 'px',width:old.rect.width + 'px',height:old.rect.height + 'px',margin:'0',pointerEvents:'none',zIndex:'8'});
        document.body.append(ghost);
        removedGhosts.add(ghost);
        const animation = play(ghost,[{opacity:.8,transform:'translateY(0) rotate(0)'},{opacity:0,transform:'translate(22px,-7px) rotate(2deg) scale(.96)'}],{duration:220});
        const remove = () => { ghost.remove(); removedGhosts.delete(ghost); };
        if (animation) animation.finished.then(remove,remove); else remove();
      }
    }
    requestAnimationFrame(() => {
      if (reduced() || !container.isConnected || root.dataset.currentView !== 'games') return;
      let index = 0;
      for (const card of cards) {
        const old = before.cards.get(card.dataset.gameId);
        if (!old) {
          if (root.dataset.homeDesign === 'booth' || index >= 12) continue;
          const delay = index++ * 27;
          if (card.getBoundingClientRect().top > innerHeight - 20 && cardObserver) {
            pendingCards.set(card,true);
            cardObserver.observe(card);
          } else deal(card,delay);
        } else {
          const rect = card.getBoundingClientRect();
          const x = old.rect.left - rect.left;
          const y = old.rect.top - rect.top;
          if ((Math.abs(x) > 2 || Math.abs(y) > 2) && Math.abs(y) < innerHeight) play(card,[{transform:'translate(' + x + 'px,' + y + 'px)'},{transform:'translate(0,-2px)',offset:.8},{transform:'none'}],{duration:430});
        }
      }
      const height = container.getBoundingClientRect().height;
      if (before.height && before.cards.size && Math.abs(height - before.height) > 8 && before.route === root.dataset.currentView) {
        play(container,[{height:before.height + 'px',overflow:'clip'},{height:height + 'px',overflow:'clip'}],{duration:370});
      }
      for (const update of updates) {
        const card = cards.find(card => card.dataset.gameId === update.id);
        if (!card || card.getBoundingClientRect().bottom < 0 || card.getBoundingClientRect().top > innerHeight) continue;
        for (const side of update.changed) {
          const value = card.querySelector('[data-score-side="' + side + '"]');
          if (!value) continue;
          const incoming = value.textContent;
          rollScore(value,update.old[side],update.scoring.includes(side));
          if (announce) announce.textContent = (update.game[side].name || update.game[side].code) + ' score updated to ' + incoming + '.';
        }
        if (update.won) victory(card,update.game);
      }
    });
  }
  function rollScore(value,previous,scoring = false) {
    if (!value || reduced() || document.hidden || value.getBoundingClientRect().bottom < 0 || value.getBoundingClientRect().top > innerHeight) return;
    const roll = document.createElement('span');
    roll.className = 'score-roll';
    roll.setAttribute('aria-hidden','true');
    roll.textContent = previous;
    value.append(roll);
    const out = play(roll,[{transform:'translateY(0) rotateX(0)',opacity:1},{transform:'translateY(-110%) rotateX(65deg)',opacity:0}],{duration:430});
    play(value,[{transform:'translateY(9px) scaleY(.65)',color:'var(--desk-accent)'},{transform:'translateY(-3px) scaleY(1.13)',color:'var(--desk-accent)',offset:.65},{transform:'none',color:'var(--ink)'}],{duration:600});
    if (out) out.finished.then(() => roll.remove(),() => roll.remove()); else roll.remove();
    if (scoring) {
      const club = value.closest('.club,.booth-feature-club');
      play(club,[{backgroundColor:'color-mix(in srgb,var(--desk-accent) 25%,transparent)'},{backgroundColor:'transparent'}],{duration:1000});
      play(club?.querySelector('img'),[{transform:'rotate(0) scale(1)'},{transform:'rotate(-9deg) scale(1.2)',offset:.3},{transform:'rotate(4deg) scale(.98)',offset:.7},{transform:'none'}],{duration:630});
    }
  }
  function victory(card,game) {
    const stamp = document.createElement('span');
    stamp.className = 'victory-stamp';
    stamp.textContent = 'YOUR TEAM · W';
    card.append(stamp);
    const animation = play(stamp,[{opacity:0,transform:'scale(1.6) rotate(-18deg)'},{opacity:1,transform:'scale(.94) rotate(-7deg)',offset:.16},{opacity:1,transform:'scale(1) rotate(-7deg)',offset:.84},{opacity:0,transform:'translateY(-7px) rotate(-7deg)'}],{duration:2400});
    if (animation) animation.finished.then(() => stamp.remove(),() => stamp.remove()); else stamp.remove();
    if (announce) announce.textContent = 'Final. Your selected team won: ' + (game.away.name || game.away.code) + ' ' + game.away.score + ', ' + (game.home.name || game.home.code) + ' ' + game.home.score + '.';
  }
  function setOrigin(element) { origin = element?.closest('.game,.spotlight,.featured') || element || null; }
  function closeDialog(dialog) {
    if (!dialog?.open) return Promise.resolve();
    if (reduced() || document.hidden) { dialog.close();return Promise.resolve(); }
    const rect = dialog.getBoundingClientRect();
    const style = getComputedStyle(dialog);
    const ghost = document.createElement('div');
    ghost.className = dialog.className + ' dialog-exit-ghost';
    ghost.innerHTML = dialog.innerHTML;
    ghost.inert = true;
    ghost.setAttribute('aria-hidden','true');
    ghost.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
    Object.assign(ghost.style,{position:'fixed',inset:'auto',top:rect.top + 'px',left:rect.left + 'px',width:rect.width + 'px',height:rect.height + 'px',margin:'0',padding:style.padding,border:style.border,borderRadius:style.borderRadius,background:style.background,color:style.color,boxShadow:style.boxShadow,overflow:'hidden',pointerEvents:'none',zIndex:'1000'});
    const backdrop = document.createElement('div');
    backdrop.className = 'dialog-exit-backdrop';
    backdrop.setAttribute('aria-hidden','true');
    document.body.append(backdrop,ghost);
    removedGhosts.add(ghost);removedGhosts.add(backdrop);
    // Release focus and input immediately; only a noninteractive visual exits.
    dialog.close();
    const animation = play(ghost,[{opacity:1,transform:'none'},{opacity:0,transform:'translateY(16px) scale(.97)'}],{duration:180,easing:'cubic-bezier(.4,0,1,1)'});
    play(backdrop,[{opacity:1},{opacity:0}],{duration:180});
    const remove = () => {ghost.remove();backdrop.remove();removedGhosts.delete(ghost);removedGhosts.delete(backdrop);};
    if (!animation) { remove();return Promise.resolve(); }
    const done = animation.finished.catch(() => {}).then(remove);
    return done;
  }
  function openDialog(dialog) {
    if (!dialog.open) return;
    const rect = dialog.getBoundingClientRect();
    const from = origin?.isConnected ? origin.getBoundingClientRect() : null;
    const x = from ? Math.max(-65,Math.min(65,from.left + from.width / 2 - rect.left - rect.width / 2)) : 0;
    const y = from ? Math.max(-60,Math.min(60,from.top + from.height / 2 - rect.top - rect.height / 2)) : 22;
    if (origin?.matches('.game')) origin.dataset.selected = 'true';
    play(dialog,[{opacity:0,transform:'translate(' + x + 'px,' + y + 'px) scale(.88)'},{opacity:1,transform:'translate(0,-3px) scale(1.015)',offset:.75},{opacity:1,transform:'none'}],{duration:460});
    const sourceImages = origin?.querySelectorAll('.matchup .club img,.spotlight-matchup img,.spotlight-logos img,.featured-logos img,.booth-feature-club img');
    const targetImages = dialog.querySelectorAll('.matchup-readout img');
    [...targetImages].forEach((image,index) => {
      const source = sourceImages?.[index]?.getBoundingClientRect();
      if (!source) return;
      const destination = image.getBoundingClientRect();
      const dx = Math.max(-220,Math.min(220,source.left - destination.left));
      const dy = Math.max(-150,Math.min(150,source.top - destination.top));
      play(image,[{transform:'translate(' + dx + 'px,' + dy + 'px) scale(.65)',opacity:.4},{transform:'translate(0,-5px) scale(1.08)',opacity:1,offset:.75},{transform:'none',opacity:1}],{duration:610,delay:index * 45});
    });
    const content = dialog.querySelectorAll('h2,h3,.why-reasons li,.broadcast-note,.dialog-actions,.nba-dialog-actions');
    [...content].slice(0,8).forEach((element,index) => play(element,[{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'none'}],{duration:390,delay:70 + index * 32}));
  }
  function wireDialog(dialog) {
    if (dialog.dataset.motionWired) return;
    dialog.dataset.motionWired = 'true';
    dialog.addEventListener('cancel',event => { event.preventDefault(); closeDialog(dialog); });
    dialog.addEventListener('close',() => { document.querySelectorAll('.game[data-selected]').forEach(card => delete card.dataset.selected); });
    new MutationObserver(records => { if (records.some(record => record.attributeName === 'open') && dialog.open) openDialog(dialog); }).observe(dialog,{attributes:true,attributeFilter:['open']});
    if (dialog.open) openDialog(dialog);
  }
  let indicator;
  function moveIndicator() {
    const navigation = document.querySelector('.app-links nav');
    const link = navigation?.querySelector('a[aria-current]');
    if (!link || navigation.getBoundingClientRect().width === 0) return;
    if (!indicator) {
      indicator = document.createElement('span');
      indicator.className = 'nav-selection';
      indicator.setAttribute('aria-hidden','true');
      navigation.prepend(indicator);
    }
    indicator.style.width = link.offsetWidth + 'px';
    indicator.style.transform = 'translateX(' + link.offsetLeft + 'px)';
  }
  function navigate({closeDialogs = true} = {}) {
    if (closeDialogs) document.querySelectorAll('dialog[open]').forEach(closeDialog);
    moveIndicator();
    const name = root.dataset.currentView || 'games';
    if (name !== 'games') ledger.disarm();
    const section = document.getElementById('view-' + name) || document.getElementById(name + '-view');
    if (!section || section.hidden) return;
    if (root.dataset.homeDesign === 'booth' && name === 'games') return;
    const pieces = section.querySelectorAll('.section-head,.spotlight,.team-banner,.stat-tabs,.team-panel,.nba-guide>.side,aside>section');
    [...pieces].slice(0,12).forEach((element,index) => {
      const interactive = element.querySelector('button,a,input,select,summary');
      if (interactive) {
        play(element,[{opacity:.4},{opacity:1}],{duration:360,delay:Math.min(index * 24,120)});
        element.querySelectorAll('h2,h3,.spotlight-matchup,.spotlight-logos').forEach(content =>
          play(content,[{opacity:0,transform:'translate(0,19px) rotate(-.4deg)'},{opacity:1,transform:'translate(0,-2px) rotate(.1deg)',offset:.8},{opacity:1,transform:'none'}],{duration:530,delay:Math.min(index * 34,180)}));
      } else play(element,[{opacity:0,transform:'translate(0,20px) rotate(-.35deg)'},{opacity:1,transform:'translate(0,-2px) rotate(.08deg)',offset:.8},{opacity:1,transform:'none'}],{duration:530,delay:Math.min(index * 34,200)});
    });
  }
  function animateSport(sport) {
    const icon = document.querySelector('.sport-switch [data-sport="' + sport + '"] svg');
    if (!icon) return;
    if (sport === 'hockey') {
      play(icon.querySelector('.stick-group'),[{transform:'rotate(0)'},{transform:'rotate(-14deg)',offset:.22},{transform:'rotate(8deg)',offset:.45},{transform:'none'}],{duration:560});
      play(icon.querySelector('.sport-puck'),[{opacity:0,transform:'translate(4px,0)'},{opacity:1,transform:'translate(0,0)',offset:.25},{opacity:1,transform:'translate(-22px,-1px)',offset:.65},{opacity:0,transform:'translate(-28px,-1px)'}],{duration:620});
      play(icon.querySelector('.puck-trail'),[{opacity:0,strokeDashoffset:16},{opacity:.8,strokeDashoffset:0,offset:.55},{opacity:0,strokeDashoffset:-8}],{duration:620});
    } else if (sport === 'football') {
      play(icon.querySelector('.ball-body'),[{transform:'translate(-5px,3px) rotate(-25deg) scaleY(.8)'},{transform:'translate(3px,-4px) rotate(140deg) scaleY(1.1)',offset:.45},{transform:'translate(0,1px) rotate(350deg) scaleY(.87)',offset:.8},{transform:'none'}],{duration:650});
    } else {
      play(icon.querySelector('.ball-body'),[{transform:'translateY(-10px) scale(.92,1.06)'},{transform:'translateY(3px) scale(1.17,.78)',offset:.28},{transform:'translateY(-5px) scale(.96,1.04)',offset:.6},{transform:'translateY(1px) scale(1.05,.94)',offset:.83},{transform:'none'}],{duration:650});
      play(icon.querySelector('.ball-shadow'),[{opacity:.1,transform:'scaleX(.5)'},{opacity:.45,transform:'scaleX(1.15)',offset:.28},{opacity:.12,transform:'scaleX(.65)',offset:.6},{opacity:0,transform:'scaleX(1)'}],{duration:650});
    }
  }
  function init() {
    if (initialized) return;
    initialized = true;
    announce = document.createElement('div');
    announce.className = 'sr';
    announce.setAttribute('aria-live','polite');
    announce.setAttribute('aria-atomic','true');
    document.body.append(announce);
    document.querySelectorAll('dialog').forEach(wireDialog);
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) if (node.nodeType === 1 && node.matches('dialog')) wireDialog(node);
    }).observe(document.body,{childList:true});
    document.addEventListener('click',event => {
      const close = event.target.closest('dialog form[method="dialog"] button,[data-dialog-close]');
      if (close) { event.preventDefault(); closeDialog(close.closest('dialog')); return; }
      const trigger = event.target.closest('[data-game],[data-matchup],#spotlight-info,.why-button');
      if (trigger) setOrigin(trigger);
      const sportLink = event.target.closest('.sport-switch a');
      if (sportLink && !event.ctrlKey && !event.metaKey && event.button === 0) {
        try { sessionStorage.setItem('game-desk-sport-motion',JSON.stringify({sport:sportLink.dataset.sport,at:Date.now()})); } catch {}
        animateSport(sportLink.dataset.sport);
        if (sportLink.href === location.href) event.preventDefault();
      }
      const pressed = event.target.closest('button,.watch-button,.nba-action,.primary');
      if (pressed && !pressed.disabled) play(pressed,[{transform:'scale(1)'},{transform:'scale(.95,.97)',offset:.25},{transform:'scale(1.025,1.01)',offset:.65},{transform:'none'}],{duration:280});
    },true);
    window.addEventListener('game-desk-settings',() => { if (reduced()) cancelMotion(); moveIndicator(); });
    osMotion.addEventListener('change',() => { if (reduced()) cancelMotion(); });
    document.addEventListener('visibilitychange',() => { if (document.hidden) cancelMotion(); });
    window.addEventListener('resize',moveIndicator);
    window.addEventListener('game-desk-team-theme',event => {
      if (reduced() || !event.detail.previousCode && !event.detail.code) return;
      const wash = document.createElement('div');
      wash.className = 'team-color-sweep';
      wash.setAttribute('aria-hidden','true');
      document.body.append(wash);
      removedGhosts.add(wash);
      const animation = play(wash,[{opacity:0,transform:'translateX(-110%) skewX(-20deg)'},{opacity:.2,transform:'translateX(0) skewX(-20deg)',offset:.4},{opacity:0,transform:'translateX(110%) skewX(-20deg)'}],{duration:800});
      const remove = () => { wash.remove(); removedGhosts.delete(wash); };
      if (animation) animation.finished.then(remove,remove); else remove();
    });
    try {
      const pending = JSON.parse(sessionStorage.getItem('game-desk-sport-motion'));
      sessionStorage.removeItem('game-desk-sport-motion');
      if (pending?.sport === window.gameDeskSport && Date.now() - pending.at < 15000) animateSport(pending.sport);
    } catch {}
    requestAnimationFrame(() => {moveIndicator();navigate({closeDialogs:false});});
  }
  function readout(game,logo,phase) {
    return '<div class="matchup-readout">' + ['away','home'].map(side => '<div class="readout-club">' + logo(game[side].code) +
      '<span>' + escape(game[side].code) + '</span><strong>' + escape(game[side].score ?? '—') + '</strong></div>').join('') +
      '<div class="readout-phase">' + phase + '</div></div>';
  }
  window.gameDeskMotion = {capture,commit,replaceGames,placeholder,navigate,init,reduced,closeDialog,setOrigin,animateSport,readout,rollScore};
})();
