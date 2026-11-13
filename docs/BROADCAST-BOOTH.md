# The Game Desk — Broadcast booth

## Implemented

The approved Broadcast booth design is now shared by NHL, NFL and NBA on phone, web and Windows. The cool navy/ice palette supports dark/light/device appearances and keeps each sport’s selected-team colors. Barlow Condensed carries scores; DM Sans carries names, controls and the wordmark. Shared colors and typography also carry into My Team, standings, stats, highlights, betting, guides and settings.

Each home screen contains date/week selection, simple team filters, a score-led Must-Watch feature, and a running schedule. After reviewing the phone preview, the user chose roomier rows: more vertical space and larger team/broadcast text, while the upper controls and feature remain compact. The first NHL schedule game starts around 567px down in the checked 390 × 844 layout, compared with roughly 970px before. Position varies with content, platform and saved settings.

## Enhanced

Must-Watch shows actual scores, status/clock and broadcast listings, with Game details and available viewing actions. Date changes clear old recommendations while the selected date loads. NFL retains weekly/day selection, byes, kickoff times and listed networks with no streaming links. NBA retains beginner notes, player references from the feed, scoreboard stories, video, betting and its primer.

The existing score ledger and roll animation are reused across all three featured scoreboards and schedules, including fresh/stale/correction safeguards and reduced motion. Team logo variants follow appearance. Calendar actions, exact matched ESPN links, service-opening links, web fallbacks, blackout explanations and official lookup links remain available where previously supported.

## Merged

One shared scoreboard renderer and one shared theme serve all sports. Windows uses the exact same compiled interface bundle as the hosted phone/web app. Responsive layouts place scores and actions beside one another on wide screens and stack them for phones. Native Windows menus and mobile bottom navigation retain their platform behavior. Settings remain saved per device, as before.

NHL main-team and followed-team controls are grouped in My Team. Following includes the main team plus the existing additional clubs; no stored selection is reset or migrated. NFL/NBA My team filters reuse the existing selection rather than creating another store. Team colors can still be turned off and back on in Settings without losing the main team.

Network badges are informational; provider actions are deduplicated by destination host while retaining distinct services. The old NHL teams-card visibility key governs the relocated controls. Hero visibility keys govern the date heading; date/week selection remains available. Settings now calls these Page sections to reflect their actual locations.

## Skipped

The large welcome banners, repeated recommendation labels, schedule-heading stacks, individual ticket shadows/notches on every game, scroll-triggered card entrances, and duplicate provider destinations were unnecessary. Each featured game keeps one ticket edge. Sport-switch motion, verified score feedback, selected-team win stamps and user-triggered detail transitions remain.

## Validation and remaining work

Build, client syntax, mobile/manifest, broadcast mapping and score/recommendation checks pass. Contrast checks cover 376 team/appearance combinations across the old and new surfaces. Browser checks cover all sports, phone/desktop layouts, date/week controls, filters, team-color on/off behavior, explanation/detail dialogs, preserved calendar tools and official logo variants. NFL’s home and matchup details contain no streaming links.

Physical iPhone Safari/VoiceOver and broadcaster-app handoffs still need device testing. The Windows interface bundle is verified against the hosted build, but the native runtime has not been launched as part of this validation. The existing hosted project, audience, URL and Home Screen identity are preserved. Reopen the existing phone app after publication; no replacement shortcut is needed.
