# League comparisons — 1.6.0

## Implemented

Regular-season player stat tiles now show the matching league player average and a green up arrow when the player's number is higher, a red down arrow when lower, or a neutral equals sign when equal at the displayed precision. The My Team icon is now a house throughout NHL, NFL and NBA navigation, including the phone's bottom bar.

## Enhanced

The existing player cards keep their season/career/recent-game layout and add benchmarks directly beneath each comparable season value. Each comparison exposes its cohort, sample size and numeric standing to assistive technology and hover help. Colors pass contrast checks across all 188 team/appearance palettes. Compact mode wraps the comparison labels; team themes and reduced motion remain intact.

## Merged

Extended the existing player endpoint and shared card renderer. NBA uses all reported players with at least one appearance; NHL separates skaters and goalies; NFL uses the same position across the league. The calculation is an unweighted mean of the matching player stat, not a leaderboard-only sample. Rates require recorded attempts. Real zeroes count, missing values do not. Percentages retain their units, goalie save percentages use three decimal places, and category-specific keys keep passing sacks separate from defensive sacks.

Complete ESPN pagination is verified before calculating, and NHL summary row counts/seasons are checked. League data is normalized one page at a time, cached for five minutes and shared between player requests. If a benchmark source fails, the player statistics remain usable with an explanation.

## Skipped

No duplicate comparison page or additional settings. Career and recent-game figures are not compared against current-season totals. Single-player samples, incomplete league feeds and mismatched seasons do not produce invented benchmarks. Arrows represent numerical direction; lower can be preferable for turnovers, fouls or goals against. The expandable comparison explanation describes this distinction and the averaging method.

## Remaining / validation

Provider coverage varies by player and metric; sample counts can differ between tiles. Totals reflect appearances to date and are not adjusted to a common number of games. League averages refresh on the existing five-minute cache cycle.

Automated checks cover arithmetic means, exact position cohorts, zero/missing values, attempt eligibility, all three directions, goalie precision, season matching, career exclusion, complete pagination and shared caching. Existing player, mobile, broadcasting, score/recommendation and palette checks remain passing. Browser review covers comparison cards at phone and desktop widths, light/dark appearance, compact mode and the house icon. Native Windows launch and physical iPhone/VoiceOver testing remain unverified.

The public URL, Home Screen identity, desktop launcher and saved preferences remain unchanged.
