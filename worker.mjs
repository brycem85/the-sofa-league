const desks = {hockey,football,basketball};
const redirect = path => new Response(null,{status:302,headers:{location:path,"cache-control":"private, no-store"}});

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const assets = {"/app.webmanifest":[APP_MANIFEST,"application/manifest+json"],"/app-icon.svg":[VECTOR_ICON,"image/svg+xml"],"/appearance.js":[APPEARANCE_SCRIPT,"text/javascript"]};
    if (assets[url.pathname]) {
      const [body,type] = assets[url.pathname];
      return new Response(body,{headers:{"content-type":type,"cache-control":"private, no-cache","x-content-type-options":"nosniff"}});
    }
    if (url.pathname === "/app-icon.png") return new Response(Uint8Array.from(atob(APP_ICON),char => char.charCodeAt(0)),{
      headers:{"content-type":"image/png","cache-control":"private, no-cache","x-content-type-options":"nosniff"}
    });
    if (url.pathname === "/") {
      const lastSport = request.headers.get("cookie")?.match(/(?:^|;\s*)game_desk_sport=(hockey|football|basketball)(?:;|$)/)?.[1];
      return redirect("/" + (lastSport || "hockey") + "/");
    }
    if (url.pathname === "/favicon.ico") return new Response(null,{status:204});
    const path = /^\/(hockey|football|basketball)(\/.*)?$/.exec(url.pathname);
    if (!path) return new Response("Not found",{status:404});
    const [,sport,tail] = path;
    if (!tail) return redirect("/" + sport + "/");
    url.pathname = tail;
    const response = await desks[sport].fetch(new Request(url,request));
    if (tail !== "/" || !response.ok) return response;
    const headers = new Headers(response.headers);
    headers.set("cache-control","private, no-store");
    headers.append("set-cookie","game_desk_sport=" + sport + "; Path=/; Max-Age=31536000; SameSite=Lax;" +
      (url.protocol === "https:" ? " Secure;" : "") + " HttpOnly");
    return new Response(response.body,{status:response.status,headers});
  }
};
