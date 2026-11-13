const { app, BrowserWindow, Menu, dialog, session, shell } = require("electron");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

app.setName("The Sofa League");
const profile = path.join(app.getPath("appData"),"The Game Desk");
fs.mkdirSync(profile,{recursive:true});
app.setPath("userData",profile);
app.enableSandbox();
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();

const port = 47826;
const origin = "http://127.0.0.1:" + port;
const statePath = path.join(profile,"window.json");
let window = null;
let server = null;
const externalDomains = [
  "nba.com","nhl.com","espn.com","youtube.com","youtube-nocookie.com","peacocktv.com",
  "amazon.com","primevideo.com","hulu.com","disneyplus.com","hbomax.com","sportsnetplus.ca",
  "tsn.ca","tvasports.ca","rds.ca","gothamsports.com","dazn.com","kalshi.com","polymarket.com"
];
function external(url) {
  try {
    const target = new URL(url);
    if (target.protocol !== "https:" || target.username || target.password) return;
    if (!externalDomains.some(host => target.hostname === host || target.hostname.endsWith("." + host))) return;
    shell.openExternal(target.href).catch(() => dialog.showErrorBox("Could not open this link","Try opening the provider in your usual browser."));
  } catch {}
}
function ownPage(url) {
  try { return new URL(url).origin === origin; } catch { return false; }
}
function settings() {
  if (!window) return;
  const current = new URL(window.webContents.getURL());
  const sport = current.pathname.split("/")[1];
  window.loadURL(origin + "/" + (["hockey","football","basketball"].includes(sport) ? sport : "hockey") + "/#/settings");
}
function saveWindow() {
  if (!window) return;
  const state = {bounds:window.getNormalBounds(),maximized:window.isMaximized()};
  try {
    const temporary = statePath + ".tmp";
    fs.writeFileSync(temporary,JSON.stringify(state));
    fs.renameSync(temporary,statePath);
  } catch {}
}
function createWindow() {
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(statePath,"utf8")); } catch {}
  const bounds = saved.bounds;
  const size = bounds && Number.isFinite(bounds.width) && Number.isFinite(bounds.height)
    ? {width:Math.max(820,Math.min(2200,bounds.width)),height:Math.max(640,Math.min(1600,bounds.height))}
    : {width:1320,height:920};
  window = new BrowserWindow({
    ...size,minWidth:760,minHeight:600,title:"The Sofa League",backgroundColor:"#152b43",
    icon:path.join(__dirname,"icon.png"),
    webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,spellcheck:false}
  });
  window.webContents.setWindowOpenHandler(({url}) => { external(url); return {action:"deny"}; });
  window.webContents.on("will-navigate",(event,url) => {
    if (!ownPage(url)) { event.preventDefault(); external(url); }
  });
  window.webContents.on("did-fail-load",(_event,code,_description,url,isMainFrame) => {
    if (isMainFrame && code !== -3 && ownPage(url)) {
      dialog.showErrorBox("The Sofa League could not open","Close the app and launch The Game Desk.exe again.");
    }
  });
  if (saved.maximized) window.maximize();
  window.on("close",saveWindow);
  window.on("closed",() => { window = null; });
  window.loadURL(origin + "/");
}
async function start() {
  await app.whenReady();
  session.defaultSession.setPermissionRequestHandler((_contents,_permission,callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  const {default:hub} = await import(pathToFileURL(path.join(__dirname,"hub.mjs")).href);
  server = http.createServer(async (request,response) => {
    try {
      if (request.headers.host !== "127.0.0.1:" + port || !["GET","HEAD"].includes(request.method) ||
        (request.headers.origin && request.headers.origin !== origin)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }
      const result = await hub.fetch(new Request(new URL(request.url,origin),{
        method:request.method,headers:request.headers
      }));
      const headers = Object.fromEntries(result.headers);
      headers["content-security-policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https: data:; connect-src 'self'; frame-src https://www.youtube-nocookie.com https://www.youtube.com; object-src 'none'; base-uri 'self'; form-action 'self'";
      headers["referrer-policy"] = "strict-origin-when-cross-origin";
      headers["x-content-type-options"] = "nosniff";
      headers["cross-origin-resource-policy"] = "same-origin";
      response.writeHead(result.status,headers);
      response.end(request.method === "HEAD" ? undefined : Buffer.from(await result.arrayBuffer()));
    } catch {
      response.writeHead(500,{"content-type":"application/json"});
      response.end(JSON.stringify({error:"The local data service could not complete this request."}));
    }
  });
  await new Promise((resolve,reject) => {
    server.once("error",reject);
    server.listen(port,"127.0.0.1",resolve);
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label:"File",submenu:[
      {label:"Settings",accelerator:"CmdOrCtrl+,",click:settings},
      {type:"separator"},{role:"quit",label:"Quit The Sofa League"}
    ]},
    {label:"View",submenu:[{role:"reload"},{type:"separator"},{role:"resetZoom"},{role:"zoomIn"},{role:"zoomOut"},{role:"togglefullscreen"}]},
    {label:"Help",submenu:[{label:"About The Sofa League",click:() => dialog.showMessageBox(window,{
      type:"info",title:"The Sofa League",message:"The Sofa League",detail:"Version 1.6.0 — Broadcast booth\nNHL, NFL and NBA viewing hub.\nSettings and team choices are saved on this computer.\nLive data and video require an internet connection."
    })}]}
  ]));
  createWindow();
}
app.on("second-instance",() => {
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
});
app.on("window-all-closed",() => app.quit());
app.on("before-quit",() => server?.close());
if (singleInstance) start().catch(error => {
  dialog.showErrorBox("The Sofa League could not start",error.code === "EADDRINUSE"
    ? "The app’s local connection is already in use. Close any other Sofa League windows, then try again."
    : "The local app could not start. Extract the complete download into one folder and try again.");
  app.quit();
});
