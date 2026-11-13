(() => {
  const sport = window.gameDeskSport;
  const palette = window.gameDeskColors;
  const root = document.documentElement;
  let selectedTeam = "";
  let appliedAppearance = '';
  const watermark = document.querySelector(".team-watermark");
  const rgb = hex => hex.match(/../g).map(pair => parseInt(pair,16));
  const luminance = values => values.reduce((sum,value,index) => {
    const channel = value / 255;
    const linear = channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    return sum + linear * [.2126,.7152,.0722][index];
  },0);
  const contrast = (a,b) => (Math.max(luminance(a),luminance(b)) + .05) / (Math.min(luminance(a),luminance(b)) + .05);
  const mix = (a,b,t) => a.map((value,index) => Math.round(value * (1-t) + b[index] * t));
  const css = values => 'rgb(' + values.join(' ') + ')';
  function hsl(values) {
    const [r,g,b] = values.map(value => value / 255), max = Math.max(r,g,b),min = Math.min(r,g,b),d = max-min,l = (max+min)/2;
    const h = !d ? 0 : max === r ? ((g-b)/d + (g < b ? 6 : 0))*60 : max === g ? ((b-r)/d+2)*60 : ((r-g)/d+4)*60;
    return {h,s:d ? d/(1-Math.abs(2*l-1)) : 0,l};
  }
  function color({h,s,l}) {
    const a = s*Math.min(l,1-l);
    const channel = n => {const k = (n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1))));};
    return [channel(0),channel(8),channel(4)];
  }
  function readable(seed,surfaces,target,direction) {
    for (let step=0;step<=100;step++) {
      const candidate = color({...seed,l:Math.max(0,Math.min(1,seed.l+direction*step/100))});
      if (surfaces.every(surface => contrast(candidate,surface)>=target)) return candidate;
    }
    return direction > 0 ? [255,255,255] : [0,0,0];
  }
  function paletteFor(primaryHex,secondaryHex,appearance) {
    const primary = rgb(primaryHex),secondary = rgb(secondaryHex);
    const chromatic = values => Math.max(...values)-Math.min(...values)>45;
    const useSecondary = (!chromatic(primary) || luminance(primary)<.012) && chromatic(secondary);
    const identity = useSecondary ? secondary : primary;
    const seed = hsl(identity);
    const vivid = {...seed,s:seed.s>.18 ? Math.max(.9,seed.s) : seed.s,l:Math.max(.32,Math.min(.58,seed.l))};
    const fill = color(vivid);
    const onFill = contrast(fill,[255,255,255]) >= contrast(fill,[0,0,0]) ? [255,255,255] : [0,0,0];
    const dark = appearance !== 'light';
    const surface = l => {
      let candidate = color({...vivid,l});
      while (luminance(candidate)>.055 && l>.01) { l-=.005;candidate=color({...vivid,l}); }
      return candidate;
    };
    const bg = dark ? mix(surface(.055),[18,20,25],.35) : mix([255,255,255],fill,.12);
    const panel = dark ? mix(surface(.105),[24,27,33],.35) : mix([255,255,255],fill,.04);
    const raised = dark ? mix(surface(.145),[30,33,40],.35) : mix([255,255,255],fill,.09);
    const ink = dark ? [248,250,252] : [15,17,22];
    let muted = mix(ink,raised,.2);
    if (![bg,panel,raised].every(base => contrast(muted,base)>=4.5)) muted=ink;
    const accent = readable(vivid,[bg,panel,raised],4.5,dark ? 1 : -1);
    const trimSeed = hsl(useSecondary ? primary : secondary);
    const lighter = readable(trimSeed,[fill],3,1),darker = readable(trimSeed,[fill],3,-1);
    const trim = [lighter,darker].filter(candidate => contrast(candidate,fill)>=3).sort((a,b) => Math.abs(hsl(a).l-trimSeed.l)-Math.abs(hsl(b).l-trimSeed.l))[0] || onFill;
    return {bg,panel,raised,ink,muted,fill,'on-fill':onFill,accent,trim,live:dark ? [255,209,90] : [99,57,0],line:mix(raised,accent,.4)};
  }
  const themeProperties = ['primary','secondary','bg','panel','raised','ink','muted','fill','on-fill','accent','trim','live','line'];
  function apply(code) {
    const previousCode = root.dataset.teamTheme || '';
    const previousColor = getComputedStyle(root).getPropertyValue('--desk-accent').trim();
    const appearance = root.dataset.appearance || 'dark';
    selectedTeam = code;
    if (!window.gameDeskSettings.value.teamColors) code = "";
    const colors = Object.hasOwn(palette,code) ? palette[code] : null;
    if (!colors) {
      delete root.dataset.teamTheme;
      for (const property of themeProperties) root.style.removeProperty("--team-" + property);
      watermark.hidden = true;
      watermark.removeAttribute("src");
      if (previousCode) window.dispatchEvent(new CustomEvent('game-desk-team-theme',{detail:{code:'',previousCode,previousColor}}));
      return;
    }
    if (root.dataset.teamTheme === code && appliedAppearance === appearance) return;
    appliedAppearance = appearance;
    const [primary,secondary] = colors;
    const colorsForTeam = paletteFor(primary,secondary,appearance);
    root.dataset.teamTheme = code;
    root.style.setProperty("--team-primary","#" + primary);
    root.style.setProperty("--team-secondary","#" + secondary);
    for (const [name,values] of Object.entries(colorsForTeam)) root.style.setProperty('--team-' + name,css(values));
    watermark.src = sport === "hockey" ? "https://assets.nhle.com/logos/nhl/svg/" + code + "_dark.svg" :
      "https://a.espncdn.com/i/teamlogos/" + (sport === "basketball" ? "nba" : "nfl") +
      "/500-dark/scoreboard/" + code.toLowerCase() + ".png";
    watermark.hidden = false;
    window.dispatchEvent(new CustomEvent('game-desk-team-theme',{detail:{code,previousCode,previousColor,newColor:css(colorsForTeam.accent)}}));
  }
  window.gameDeskTheme = {key:"game-desk-my-team-" + sport,apply,paletteFor};
  window.addEventListener("game-desk-settings",() => apply(selectedTeam));
  function linkTabs() {
    const current = location.hash.slice(2);
    const shared = ["games","standings","my-team","settings"].includes(current) ? current : "games";
    for (const link of document.querySelectorAll(".sport-switch a")) {
      const tab = link.dataset.sport === sport && current ? current : shared;
      link.href = "/" + link.dataset.sport + "/#/" + tab;
    }
  }
  linkTabs();
  window.addEventListener("hashchange",linkTabs);
})();
