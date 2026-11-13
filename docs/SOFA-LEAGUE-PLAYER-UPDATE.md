# The Sofa League — 1.5.0

## Implemented

Renamed the public app, sport pages, shared header/footer, mobile install details, calendar export branding and Windows menus to The Sofa League. Kept the existing hosted address, manifest identity, desktop launcher, local connection and preference keys, preserving existing shortcuts and saved teams.

My Team now opens every roster player as an inline disclosure. Player leaders jump directly to that same card rather than creating another detail view. Cards include available biography/availability details, regular-season and career statistics, and expandable recent games. NHL separates skaters and goalies; NFL uses the position-specific categories supplied by ESPN; NBA includes full stat labels and beginner notes. Missing statistics are explained instead of filled with zeroes. Projected totals are excluded.

## Enhanced

The More sheet shares its title, layout, option order, Settings treatment, close behavior, focus handling and viewing-preference area across all sports. It respects hidden tabs and lists only existing sport features; NFL currently has fewer secondary pages.

Compact mode now adjusts relevant typography, row spacing, score sizes, team panels, player metrics and table cells together, with wrapping and usable touch targets. Replaced the conflicting earlier compact rules with one shared set.

Added gentle player expansion, rotating disclosure marks, touch press feedback and small lift/scale effects for selectable options on devices with a mouse. Existing app and operating-system reduced-motion preferences suppress these effects.

## Merged

Extended the existing roster, search, position filter, leaders, shared navigation, theme and motion systems. Player details load only when opened and use bounded numeric-ID routes and a five-minute cache. Expanded players and stat sections survive roster updates and filtering within the current page. Team-color choices and the calmer palette remain intact.

## Skipped

No duplicate player page, second More menu, new theme system or placeholder NFL tabs. No fabricated statistics for positions with limited provider coverage. Kept the original Windows executable filename so existing shortcuts continue working.

## Remaining / validation

Provider coverage varies by player. The latest five reported player appearances may differ from the team's last five games. Use the displayed update time and Refresh player stats to check the current cached feed.

Browser checks cover NHL/NFL/NBA live player expansion, roster search, recent-game sections, shared More layouts, light/dark appearance, compact phone/desktop layouts and reduced motion. Automated checks cover player normalization, zero/missing values, projections, multi-category game merging, goalie formatting, route validation/cache behavior, existing score/recommendation logic, all 188 palettes, mobile assets and broadcast links.

Physical iPhone/VoiceOver and a native Windows launch remain untested. Existing iPhone Home Screen labels may retain the name chosen when the shortcut was installed; this does not affect the updated app or require replacing the shortcut.
