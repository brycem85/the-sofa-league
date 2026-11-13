# The Sofa League

A viewing hub for **NHL, NFL, and NBA**, with live scores, schedules, standings, player statistics, team themes, and desktop/mobile layouts. The project began as The Game Desk and is now branded **The Sofa League** in the app.

[Open the live app](https://the-game-desk.ummerrornull.chatgpt.site/)

## Run locally

Requires Node.js 22.12 or newer. The web app has no package dependencies to install.

```sh
git clone https://github.com/brycem85/the-sofa-league.git
cd the-sofa-league
node build.mjs
node server.mjs
```

Open **http://127.0.0.1:4176**. Keep the terminal running. Set the PORT environment variable to change the port. The npm equivalents are `npm run dev`, `npm run build`, and `npm start`.

The interface and bundled sample snapshots run locally. Current scores, stats, odds, highlights, fonts, and remote images require internet and depend on the upstream providers being available.

## Features

- Switch between hockey, football, and basketball in one hub.
- Schedules, scores, standings, player leaders, and sport-specific team pages.
- Expandable player details with regular-season and career stats and recent games.
- League-average comparisons, with position-specific NFL cohorts and separate NHL skater/goalie data.
- Broadcast listings, supported provider links, official highlights, and informational market comparisons where available.
- Team-color themes; light, dark, and device appearance; compact layout; reduced motion; configurable sports, tabs, and sections.
- Responsive phone navigation, web-app install metadata, and an Electron desktop wrapper.

Team choices and preferences are saved on the device. No account credentials or personal saved preferences are included in this repository. Streaming sign-in and playback take place with the provider; this app does not grant subscriptions or bypass regional restrictions. Third-party data coverage can vary, and cached sample snapshots are not live scores.

## Checks

```sh
node build.mjs
node check-mobile.mjs
node check-broadcast.mjs
node check-overhaul.mjs
node check-players.mjs
node check-league-averages.mjs
```

Or run `npm test`. These checks cover mobile assets and bundled routes, broadcast handoff construction, score/motion logic, team palette contrast, player normalization, caching, and league comparisons. They are automated source/route checks, not physical iPhone or native Windows UI tests.

## Source layout

| Path | Purpose |
| --- | --- |
| `sports/` | Per-sport pages, client code, snapshots, and worker routes |
| `shared/` | Settings, appearance, themes, player data, league comparisons, motion, and shared UI |
| `assets/` | App icons and web-app manifest |
| `worker.mjs` | Combined app router |
| `build.mjs` | Bundles all three sports into `dist/server/index.js` |
| `server.mjs` | Dependency-free local HTTP launcher |
| `desktop/` | Electron entrypoint, package metadata, icons, and desktop notes |
| `docs/` | Design and feature notes from development |

## Desktop and hosting

The existing `build-desktop.mjs` helper updates an existing portable Electron runtime:

```sh
node build-desktop.mjs --runtime-dir "path/to/existing/runtime" --output-dir "path/to/new/output"
```

That runtime must contain `The Game Desk.exe`; the runtime and generated executables are not stored in this repository. The Electron entrypoint serves the same built app and keeps device preferences in the user's app-data folder.

Account-specific Sites identity is omitted. Local builds work without `.openai/hosting.json`. To deploy your own copy using Sites, configure your own project; the build preserves that manifest when one is present. Public sports data, team and broadcaster names, and remote media remain subject to their respective providers' rights and terms.
