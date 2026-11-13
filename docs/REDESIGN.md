# The Game Desk — Clubhouse redesign

## Implemented

- Warm dark and warm light appearances, a header toggle, and a Follow device option in the existing Settings page. A small external bootstrap reads the same saved settings before first paint to avoid a dark flash when light mode is saved.
- A clubhouse identity: bold condensed sports headings, an editorial serif wordmark, condensed scoreboard numbers, warm surfaces, ticket perforations, printed rules, and quieter borders. The existing rink, field, court, brand mark, and team logos remain part of the design.
- Sport-specific icon motion using the existing SVGs: a hockey stick strikes a puck with a trail, the football spirals, and the basketball bounces and squashes. Selection is immediate; the destination continues the animation. Each lasts about 560–650 milliseconds.
- A question-mark button beside Must-Watch, opening a keyboard-accessible explanation dialog with entrance and exit motion. Explanations use available records, points percentages, live score margins, broadcast listings, overtime status and the saved team. Missing information receives an explicit fallback. Saved feeds do not claim a confirmed current live status.
- Score rolls, brief row highlights, and logo rebounds for verified changes between consecutive fresh observations. Score corrections receive a neutral number transition. A fresh live-to-final win for the selected team can stamp the visible card once.
- NFL matchup details with scores, team records, venue, kickoff and listed networks. This view contains no streaming links.

## Enhanced

- Game contents deal into place with stagger, rotation and a small rebound; action buttons retain stable hit targets. Newly visible cards can enter as they scroll into view. Filter changes reposition retained cards, and unchanged cards reuse their existing elements rather than rebuilding their contents.
- NHL and NBA Watch info dialogs retain their existing provider links, app handoffs, calendars and restrictions, with a new matchup readout and coordinated logo/content movement.
- Dialog exits release input and focus immediately. An inert, noninteractive visual finishes the exit, so rapid navigation does not get swallowed by a closing modal.
- Must-Watch presentation and ranking now share one implementation across the three sports. A modest favorite-team weighting improves relevance without forcing every selection to the favorite. Live, close games receive emphasis only when the feed is fresh.
- Football’s existing Featured card moved above the slate. Its stored `featured` preference remains the same; the Sidebar setting now governs the remaining broadcast/bye cards. No team or visibility preference was reset.
- Team palettes now produce readable accents for both appearances. All 94 palettes were checked in both modes against the relevant warm background. A team change transitions the colors and sends a short accent sweep through the interface.
- Shared sports-themed loading tickets and empty states replace the existing generic placeholder functions. NFL waits for the current schedule response before displaying a week, preventing an old bundled week from flashing first. NBA standings, stats, highlights and betting show explicit loading states.
- Fresh live and overtime data provide restrained atmosphere and featured-card treatments. There are no continuous game-day flashes or celebration loops.

## Merged

- The requested Daily Spotlight was merged into the existing home Must-Watch card, as requested. No separate Daily Spotlight or new Must-Watch tab was added.
- Existing page entrances, dialog effects, refresh indicators and mobile navigation were retained and coordinated through one motion system. The old competing dialog/sheet entrance effects were removed.
- Favorite-team color personalization, appearance choices, hidden tabs and hidden cards continue using the original settings and team storage keys. The mobile More menu reuses the actual region/time-zone control rather than creating a second selector.
- Web, Home Screen and Windows use the same built interface/worker bundle. The existing hosted project, origin, manifest identity, start URL, scope and icon paths remain unchanged.

## Skipped

- Baseball and soccer icon animations: those sports are not implemented in this app.
- Invented rivalries, star-player duels, playoff stakes or statistical claims unsupported by the available feeds.
- A second spotlight feature, a parallel matchup interface for NHL/NBA, another preference store, or an additional animation library.
- Constant confetti, flashing backgrounds, artificial loading delays and automatic replay of celebrations when historical or cached scores load.

## Validation and remaining work

The build, mobile asset/manifest checks, broadcaster-link checks, and redesign tests pass. Tests cover first-load baselines, unchanged refreshes, corrections, stale/reconnect behavior, dates, one-time wins, verified/fallback Must-Watch reasons and 188 team/appearance contrast combinations. Browser checks cover desktop and 320/375/390/430-pixel phone layouts, appearance persistence, hidden-tab persistence, reduced motion, dialogs, keyboard dismissal, and rapid sport/navigation interactions. Score rolls and a one-time victory stamp were also observed using a clearly labeled local simulation; those simulated feeds are outside the published source and deployment.

Physical iPhone Safari performance, VoiceOver, and broadcaster-app handoffs have not been retested on an actual phone. Feed response time and broadcaster restrictions remain external dependencies. The Windows portable package has been rebuilt with the validated shared bundle, but its native runtime was not relaunched while an older Game Desk window was already running.

The existing Home Screen shortcut remains valid. Refresh the app, or fully close and reopen it, to retrieve the release. Saved teams and settings stay on the device where they were chosen. The updated Windows download should be extracted as a complete folder and opened after closing the older desktop window.

## Sportier refinement

Implemented the requested stronger sports direction by extending the same shared theme: 800-weight condensed uppercase hero, section and matchup titles; brighter sport defaults; solid team-accent sport selectors and primary actions; a stamped Must-Watch label; stronger ticket rails and selected navigation marks. Warm dark/light modes, the serif wordmark, ticket notches and existing animations remain integrated. No new theme switch, duplicate components or dependencies were added.

Team accent colors are adjusted for readability on the stronger selected surfaces. The contrast check now covers canvas, team-tinted panels, raised panels and selected backgrounds across all 94 teams in both appearances, including the colors used by filled buttons. Browser layout checks confirmed the desktop, 390-pixel and 320-pixel layouts and the explanation dialog without horizontal overflow. Screenshot capture repeatedly timed out, so there is no new visual screenshot for this refinement; rendered styles and layout were inspected through the browser. Native Windows and physical iPhone testing remain outstanding as described above.
