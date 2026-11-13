(() => {
  const sport = window.gameDeskSport;
  const sports = {hockey:"NHL Hockey",football:"NFL Football",basketball:"NBA Basketball"};
  const tabs = {
    hockey:{"my-team":"My Team",standings:"Standings",stats:"Stats",highlights:"Highlights",betting:"Betting",watch:"Watch guide"},
    football:{"my-team":"My Team",standings:"Standings"},
    basketball:{"my-team":"My Team",standings:"Standings",stats:"Stats",highlights:"Highlights",betting:"Betting",watch:"Watch guide",learn:"Start here"}
  };
  const sections = {
    hockey:{
      hero:["Date heading",".booth-heading>div"],featured:["Must-Watch matchup","#spotlight"],
      sidebar:["Sidebar","aside"],broadcast:["Broadcast card",'aside section:has(a[href="#/watch"])'],
      teams:["Followed teams controls",'#followed-teams-panel'],
      highlights:["Highlights card",'aside section:has(a[href="#/highlights"])']
    },
    football:{
      hero:["Date heading",".booth-heading>div"],sidebar:["Sidebar","aside"],
      featured:["Must-Watch matchup","#football-spotlight"],broadcast:["Broadcast guide","aside section:not(.featured):not(#bye-card)"],
      byes:["Bye teams","#bye-card"]
    },
    basketball:{
      hero:["Date heading",".booth-heading>div"],featured:["Must-Watch matchup",".spotlight"],sidebar:["Sidebar","aside"],
      beginner:["Beginner tips",'aside section:has(a[href="#/learn"])'],stories:["Scoreboard stories",'aside section:has(#stories)'],
      highlights:["Highlights card",'aside section:has(a[href="#/highlights"])']
    }
  };
  const preferences = {
    autoRefresh:["Automatic refresh","Update data every minute while the app is visible."],
    teamColors:["Team colors","Use your team’s palette across the hub."],
    compact:["Compact layout","Use tighter spacing and smaller text."],
    reduceMotion:["Reduce motion","Turn off animations and smooth scrolling."]
  };
  const key = "game-desk-settings-v1";
  const defaults = () => ({
    sports:Object.fromEntries(Object.keys(sports).map(name => [name,true])),
    tabs:Object.fromEntries(Object.entries(tabs).map(([name,entries]) => [name,Object.fromEntries(Object.keys(entries).map(tab => [tab,true]))])),
    sections:Object.fromEntries(Object.entries(sections).map(([name,entries]) => [name,Object.fromEntries(Object.keys(entries).map(section => [section,true]))])),
    autoRefresh:true,teamColors:true,compact:false,reduceMotion:false,appearance:'dark'
  });
  function normalize(raw) {
    const value = defaults();
    if (['dark','light','system'].includes(raw?.appearance)) value.appearance = raw.appearance;
    for (const name of Object.keys(preferences)) if (typeof raw?.[name] === "boolean") value[name] = raw[name];
    for (const name of Object.keys(sports)) {
      if (typeof raw?.sports?.[name] === "boolean") value.sports[name] = raw.sports[name];
      for (const group of ["tabs","sections"]) {
        for (const entry of Object.keys(value[group][name])) {
          if (typeof raw?.[group]?.[name]?.[entry] === "boolean") value[group][name][entry] = raw[group][name][entry];
        }
      }
    }
    if (!Object.values(value.sports).some(Boolean)) value.sports.hockey = true;
    return value;
  }
  let value;
  try { value = normalize(JSON.parse(localStorage.getItem(key))); } catch { value = defaults(); }
  const enabledSports = () => Object.keys(sports).filter(name => value.sports[name]);
  const activeView = () => {
    const name = location.hash.slice(2);
    return name === "settings" || Object.hasOwn(tabs[sport],name) ? name : "games";
  };
  const feedback = document.getElementById("settings-feedback");
  const hidden = (element,hide) => { if (element) element.dataset.hubHidden = String(hide); };
  function apply() {
    const root = document.documentElement;
    root.dataset.currentView = activeView();
    root.dataset.settingsOpen = String(activeView() === "settings");
    root.dataset.compact = String(value.compact);
    root.dataset.reduceMotion = String(value.reduceMotion);
    root.dataset.appearance = value.appearance === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : value.appearance;
    root.style.colorScheme = root.dataset.appearance;
    for (const link of document.querySelectorAll(".sport-switch a")) hidden(link,!value.sports[link.dataset.sport]);
    for (const link of document.querySelectorAll('.app-links a[href^="#/"]')) {
      const name = link.getAttribute("href").slice(2);
      hidden(link,value.tabs[sport][name] === false);
    }
    for (const [name,[,selector]] of Object.entries(sections[sport])) {
      for (const element of document.querySelectorAll(selector)) hidden(element,!value.sections[sport][name]);
    }
    const sidebar = document.querySelector("aside");
    const noSidebar = sidebar && (sidebar.dataset.hubHidden === "true" || [...sidebar.children].every(child => child.dataset.hubHidden === "true" || child.hidden));
    document.querySelector(".layout")?.setAttribute("data-no-sidebar",String(Boolean(noSidebar)));
    for (const label of document.querySelectorAll("#feed-status,#status")) {
      if (/Auto-refresh (on|off)/.test(label.textContent)) {
        for (const node of label.childNodes) if (node.nodeType === Node.TEXT_NODE) {
          node.textContent = node.textContent.replace(/Auto-refresh (on|off)/g,"Auto-refresh " + (value.autoRefresh ? "on" : "off"));
        }
      }
    }
    window.dispatchEvent(new Event("game-desk-settings"));
  }
  function allowedView(name) {
    return name === "settings" || name === "games" || value.tabs[sport][name] !== false;
  }
  function guard(name) {
    if (name === "settings") return true;
    if (!value.sports[sport]) {
      location.replace("/" + enabledSports()[0] + "/#/games");
      return false;
    }
    if (!allowedView(name)) {
      location.replace("#/games");
      return false;
    }
    return true;
  }
  function persist() {
    try { localStorage.setItem(key,JSON.stringify(value)); feedback.textContent = "Settings saved."; }
    catch { feedback.textContent = "These changes apply now, but could not be saved for your next launch."; }
    apply();
    updateCounts();
    guard(activeView());
  }
  const toggle = (path,label,description = "") => '<label class="settings-toggle"><span>' + label +
    (description ? '<small>' + description + '</small>' : '') + '</span><input type="checkbox" data-setting="' + path +
    '" aria-label="' + label + (["tabs","sections"].includes(path.split(".")[0]) ? " — " + sports[path.split(".")[1]] : "") +
    '"' + (path.split(".").reduce((obj,name) => obj[name],value) ? " checked" : "") + '></label>';
  function render() {
    document.getElementById("settings-sports").innerHTML = Object.entries(sports).map(([name,label]) => toggle("sports." + name,label)).join("");
    document.getElementById("settings-preferences").innerHTML = Object.entries(preferences).map(([name,[label,description]]) =>
      toggle(name,label,description)).join("");
    document.getElementById('settings-preferences').insertAdjacentHTML('afterbegin','<label class="settings-toggle appearance-setting"><span>Appearance<small>Choose dark, light, or follow your device.</small></span><select data-setting="appearance" aria-label="Appearance"><option value="dark">Dark</option><option value="light">Light</option><option value="system">Follow device</option></select></label>');
    document.querySelector('[data-setting="appearance"]').value = value.appearance;
    document.getElementById("settings-tabs").innerHTML = Object.entries(tabs).map(([name,entries]) =>
      '<section class="settings-group" data-group="tabs.' + name + '"><h4>' + sports[name] + '<small></small></h4><div>' + Object.entries(entries).map(([tab,label]) => toggle("tabs." + name + "." + tab,label)).join("") + '</div></section>').join("");
    document.getElementById("settings-sections").innerHTML = Object.entries(sections).map(([name,entries]) =>
      '<section class="settings-group" data-group="sections.' + name + '"><h4>' + sports[name] + '<small></small></h4><div>' + Object.entries(entries).map(([section,[label]]) =>
        toggle("sections." + name + "." + section,label)).join("") + '</div></section>').join("");
    updateCounts();
    filterSettings();
  }
  function updateCounts() {
    for (const group of document.querySelectorAll('[data-group]')) {
      const entries = Object.values(group.dataset.group.split('.').reduce((obj,key) => obj[key],value));
      group.querySelector('h4 small').textContent = entries.filter(Boolean).length + ' of ' + entries.length + ' visible';
    }
  }
  function filterSettings() {
    const query = document.getElementById('settings-search').value.trim().toLowerCase();
    let matches = 0;
    for (const row of document.querySelectorAll('.settings-toggle')) {
      const context = row.closest('.settings-group')?.querySelector('h4').textContent || '';
      const found = (row.textContent + ' ' + context).toLowerCase().includes(query);
      row.hidden = !found;
      if (found) matches++;
    }
    for (const group of document.querySelectorAll('.settings-group')) group.hidden = ![...group.querySelectorAll('.settings-toggle')].some(row => !row.hidden);
    for (const card of document.querySelectorAll('.settings-card')) {
      const rows = [...card.querySelectorAll('.settings-toggle')];
      card.hidden = rows.length ? !rows.some(row => !row.hidden) : Boolean(query);
    }
    document.getElementById('settings-no-results').hidden = Boolean(matches);
  }
  document.getElementById('settings-search').oninput = filterSettings;
  document.getElementById('settings-form').onsubmit = event => event.preventDefault();
  document.getElementById("settings-form").onchange = event => {
    const path = event.target.dataset.setting;
    if (!path) return;
    const parts = path.split(".");
    const object = parts.slice(0,-1).reduce((obj,name) => obj[name],value);
    const name = parts.at(-1);
    object[name] = path === 'appearance' ? event.target.value : event.target.checked;
    if (parts[0] === "sports" && !enabledSports().length) {
      object[name] = true;
      event.target.checked = true;
      feedback.textContent = "Keep at least one sport enabled.";
      return;
    }
    persist();
  };
  document.getElementById("settings-reset").onclick = () => {
    value = defaults();
    render();
    persist();
    feedback.textContent = "Default layout restored.";
  };
  window.gameDeskSettings = {
    get value() { return value; },guard,apply,
    setAppearance(mode) {
      if (!['dark','light','system'].includes(mode)) return;
      value.appearance = mode;
      const select = document.querySelector('[data-setting="appearance"]');
      if (select) select.value = mode;
      persist();
    },
    refreshText:() => "Auto-refresh " + (value.autoRefresh ? "on" : "off"),
    watch(refresh) {
      const check = () => { if (value.autoRefresh && !document.hidden && activeView() !== "settings") refresh(); };
      document.addEventListener("visibilitychange",check);
      setInterval(check,60000);
    }
  };
  render();
  apply();
  window.addEventListener("hashchange",apply);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',() => { if (value.appearance === 'system') apply(); });
})();
