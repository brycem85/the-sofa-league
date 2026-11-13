# Balanced team colors — 1.4.1

## Implemented

A calmer treatment across NHL, NFL and NBA on phone and desktop. Team hues and vivid button fills are retained, while large colored areas are reduced.

## Enhanced

Headers and spotlight labels now use panel surfaces with small team accents. Navigation uses quieter selected states; My Team banners use a colored edge instead of a full jersey fill. Dark backgrounds blend slightly toward charcoal, and light backgrounds use less tint. Browser/Home Screen chrome follows the header panel.

## Merged

The existing shared palette engine, Team colors toggle, My Team selections and appearance controls handle this refinement. No additional intensity control or preference store was added. Turning team colors off still restores the neutral theme; turning it on restores the selected team.

## Skipped

Further saturation increases and additional theme controls were unnecessary. Schedules, standings, stats, odds, viewing links, animation and the approved roomier layout remain intact.

## Remaining and validation

All 188 palettes (94 teams in light and dark mode) pass text, muted text, accent, live-label, filled-control and stripe contrast checks. Toggle cleanup and restoration, score/recommendation logic, mobile assets and broadcast-link checks pass. Browser review covers desktop and narrow phone layouts, both appearances, and representative team palettes.

Web and Windows use the same compiled interface. The existing hosted URL and phone shortcut are preserved. Physical iPhone/VoiceOver and a native Windows launch remain untested; close and reopen the existing app to load the update.
