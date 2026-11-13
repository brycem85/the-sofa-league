(() => {
  const score = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
  const isLive = state => ['LIVE','CRIT','in'].includes(state);
  const isFinal = game => ['OFF','FINAL'].includes(game.state) || (game.state === 'post' && /^Final/i.test(game.status ?? ''));
  class ScoreLedger {
    constructor() { this.entries = new Map(); this.wins = new Set(); }
    disarm() { for (const entry of this.entries.values()) entry.armed = false; }
    observe(games,{scope = '',fresh = false,favorite = ''} = {}) {
      const updates = [];
      for (const game of games) {
        const key = scope + ':' + game.id;
        const next = {away:score(game.away.score),home:score(game.home.score),state:game.state,armed:fresh};
        const old = this.entries.get(key);
        this.entries.set(key,next);
        if (!fresh || !old?.armed) continue;
        const active = isLive(old.state) || isLive(next.state);
        if (!active) continue;
        const changed = ['away','home'].filter(side => old[side] !== null && next[side] !== null && old[side] !== next[side]);
        const scoring = changed.filter(side => next[side] > old[side]);
        const own = game.away.code === favorite ? 'away' : game.home.code === favorite ? 'home' : null;
        const won = Boolean(own && isLive(old.state) && isFinal(game) && next.away !== null && next.home !== null &&
          next[own] > next[own === 'away' ? 'home' : 'away'] && !this.wins.has(key));
        if (won) this.wins.add(key);
        if (changed.length || won) updates.push({id:String(game.id),old,next,changed,scoring,won,game});
      }
      if (this.entries.size > 250) for (const key of [...this.entries.keys()].slice(0,this.entries.size - 250)) this.entries.delete(key);
      return updates;
    }
  }
  window.GameDeskScoreLedger = ScoreLedger;
})();
