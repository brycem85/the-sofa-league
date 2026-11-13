import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";

const read = path => readFile(new URL(path,import.meta.url),"utf8");
const write = (path,value) => writeFile(new URL(path,import.meta.url),value);
const fingerprint = content => createHash("sha256").update(content).digest("hex").slice(0,12);
const icons = {
  hockey:'<svg viewBox="0 0 28 28" fill="none" aria-hidden="true"><g class="stick-group"><path d="M18 4 10 20H4M23 8l-7 14H9" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/></g><path class="puck-trail" d="M21 23H2" stroke="currentColor" stroke-width="1.2" stroke-dasharray="3 3"/><ellipse class="sport-puck" cx="23" cy="23" rx="3" ry="1.5" fill="currentColor"/></svg>',
  football:'<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><g class="ball-body"><path d="M26 6c-4-1-10 0-15 5S5 22 6 26c4 1 10 0 15-5s6-11 5-15Z" stroke="currentColor" stroke-width="2"/><path d="m12 20 8-8m-6 2 4 4m-6-2 4 4m0-8 4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></g></svg>',
  basketball:'<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><ellipse class="ball-shadow" cx="16" cy="29" rx="8" ry="1.4" fill="currentColor"/><g class="ball-body"><circle cx="16" cy="16" r="11" stroke="currentColor" stroke-width="2"/><path d="M8 8l16 16M8 24 24 8M6 13c8 1 13-3 13-7M13 26c1-8 5-13 13-13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></g></svg>'
};
const leagues = {hockey:"NHL",football:"NFL",basketball:"NBA"};
const [teamJs,teamCss,themeJs,sharedCss,palettes,main,manifest,settingsJs,settingsCss,settingsHtml,designCss,uiJs,mobileCss,mobileJs,appManifest,appIcon,vectorIcon,broadcastJs,spotlightJs,scoreCore,motionJs,motionCss,appearanceJs,boothJs] = await Promise.all([
  read("shared/team.js"),read("shared/team.css"),read("shared/theme.js"),read("shared/desk.css"),
  read("shared/team-colors.json").then(JSON.parse),read("worker.mjs"),read(".openai/hosting.json").catch(error => { if (error.code === "ENOENT") return "{}"; throw error; }),
  read("shared/settings.js"),read("shared/settings.css"),read("shared/settings.html"),read("shared/design.css"),read("shared/ui.js"),
  read("shared/mobile.css"),read("shared/mobile.js"),read("assets/app.webmanifest"),
  readFile(new URL("assets/app-icon.png",import.meta.url)).then(buffer => buffer.toString("base64")),read("assets/app-icon.svg"),read("shared/broadcast.js"),
  read('shared/spotlight.js'),read('shared/motion-core.js'),read('shared/motion.js'),read('shared/motion.css'),read('shared/appearance.js'),read('shared/booth.js')
]);
const switcher = active => '<nav class="sport-switch" aria-label="Switch sport">' +
  Object.entries(leagues).map(([sport,label]) => '<a href="/' + sport + '/#/games" data-sport="' + sport + '"' +
    (sport === active ? ' aria-current="page"' : '') + ' aria-label="' + label + ' ' + sport + '">' +
    icons[sport] + '<span>' + label + '</span></a>').join("") + '</nav>';
const snapshotKeys = {hockey:"deskSnapshot",football:"footballSnapshot",basketball:"basketballSnapshot"};

async function bundleSport(sport) {
  const folder = "sports/" + sport + "/";
  const [page,style,script,snapshot,worker] = await Promise.all([
    read(folder + "site/index.html"),read(folder + "site/desk.css"),read(folder + "site/desk.js"),
    read(folder + "site/snapshot.json"),read(folder + "worker.mjs")
  ]);
  const client = [
    "window." + snapshotKeys[sport] + " = " + JSON.stringify(JSON.parse(snapshot)) + ";",
    "window.gameDeskSport = " + JSON.stringify(sport) + ";",
    "window.gameDeskColors = " + JSON.stringify(palettes[sport]) + ";",
    settingsJs,themeJs,teamJs,broadcastJs,scoreCore,spotlightJs,motionJs,boothJs,script,uiJs,mobileJs,'window.gameDeskMotion.init();'
  ].join("\n");
  const base = sport === "basketball" ? await read("sports/football/site/desk.css") : "";
  const homeCss = await read("shared/booth.css");
  const css = [base,style,teamCss,sharedCss,settingsCss,designCss,mobileCss,motionCss,homeCss].join("\n");
  const html = page.replace("<!-- DESK_SWITCH -->",switcher(sport))
    .replace("/desk.js","/" + sport + "/desk.js?v=" + fingerprint(client))
    .replace("/desk.css","/" + sport + "/desk.css?v=" + fingerprint(css))
    .replace(/(<div class="app-links"><nav[^>]*>)([\s\S]*?)(<\/nav>)/,
      '$1$2<a href="#/settings">Settings</a>$3')
    .replace('content="width=device-width, initial-scale=1"','content="width=device-width, initial-scale=1, viewport-fit=cover"')
    .replace('<link rel="stylesheet"','<script src="/appearance.js"></script><link rel="stylesheet"')
    .replace('</head>','<link rel="manifest" href="/app.webmanifest"><link rel="apple-touch-icon" href="/app-icon.png"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Sofa League"></head>')
    .replace(/<meta name="theme-color" content="[^"]+">/,'<meta name="theme-color" content="#1d1c18">')
    .replace("</main>",settingsHtml.replace("SETTINGS_VIEW_ID",sport === "football" ? "settings-view" : "view-settings") + "\n</main>");
  const prefix = ["const PAGE = " + JSON.stringify(html) + ";","const STYLE = " + JSON.stringify(css) + ";",
    "const SCRIPT = " + JSON.stringify(client) + ";"].join("\n");
  return "const " + sport + " = (() => {\n" + prefix + "\n" +
    (await read("shared/player-data.mjs")).replaceAll("export function ","function ") + "\n" + (await read("shared/league-averages.mjs")).replaceAll("export function ","function ").replaceAll("export async function ","async function ") + "\n" + worker.replaceAll("export function ","function ").replace("export default {","return {") + "\n})();\n";
}

const bundles = await Promise.all(Object.keys(leagues).map(bundleSport));
await Promise.all([
  mkdir(new URL("dist/server/",import.meta.url),{recursive:true}),
  mkdir(new URL("dist/.openai/",import.meta.url),{recursive:true})
]);
await Promise.all([
  write("dist/server/index.js","const APP_MANIFEST = " + JSON.stringify(appManifest) + ";\nconst APP_ICON = " + JSON.stringify(appIcon) + ";\nconst VECTOR_ICON = " + JSON.stringify(vectorIcon) + ";\nconst APPEARANCE_SCRIPT = " + JSON.stringify(appearanceJs) + ";\n" + bundles.join("\n") + main),
  write("dist/.openai/hosting.json",manifest)
]);
