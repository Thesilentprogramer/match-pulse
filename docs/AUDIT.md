# Match Pulse audit

Reviewed 10 Nov 2026 against the live deploy at https://match-pulse-nine.vercel.app and a local production build. Phone viewport 390×844, desktop 1440×900, Playwright (Chromium). Lighthouse mobile, performance and accessibility only.

Screenshots live next to this file.

## High

1. **The phone could not see the page.** At 390px the document was 665px wide. The header was one nowrap row (badge, native `<select>`, Match Summary, Story, Demo), so the score card and the actions sat off the right edge. A fan mid-over had to scroll sideways to find the score. Desktop did not overflow.

   ![Before, mobile](before-mobile.png)

2. **First paint was the wrong match, and it did not say what this is.** The catalog from production was Cricbuzz and included PAK vs SL (a Test, 434/9 and a second innings) and a women's T20. The screen still opened on the Harbor Cup demo. The title is "Match Pulse". The sections were Pulse, War, Pod, Ask. Nothing in the first screen told a fan to pick the live match or what the companion will and will not do.

3. **A Test with no target was drawn as a chase.** Cricbuzz has no chase target on day 2. The parser invented one by adding the balls left in a 450-over budget to the runs. The live page then read "2690 needed from 2685" and a 99% win chance. The win model is a T20 model, so a long innings looks like a stroll. The companion repeated that number. That is a false score, not a styling issue.

## Medium

4. **Two status pills.** "DEMO" sat next to a separate "LIVE" dot, so the demo looked live. The real source badge and the connection state were the same visual weight as Match Summary.

5. **The match switcher was a 220px native select.** Long names ("HBHW vs ADSW 17th Match") were clipped, and LIVE vs DEMO was not on the row.

6. **Muted grey on the score card.** `text-white/40` and `text-white/45` on `#141414` for CRR labels and the Pulse Points line. Small text failed a glance test even where the computed muted token (`#c8c8c8`) was fine.

7. **Companion failure was a lie, and a betting question looked ignored.** A body that failed the schema (including a missing voice) returned "Ask a shorter question." The panel did not check `response.ok`, so that JSON could render as the answer. A real betting question on the live deploy was answered with the score and no odds, and a made-up "Mehta is 87 off 40" was corrected to the log. The panel never said it had refused a tip.

8. **Match Summary could be opened over itself.** Three fast clicks started overlapping voice fetches. The film is a 1080×1920 SVG; unconstrained, it covered the page and blocked the button. Switching matches left that dialog on the previous film until the component was remounted.

9. **No chase chart and no over strip,** even though `winSeries` and the moment cards were already computed. The only "timeline" was the balls of the current over.

10. **Screen-reader line bypassed the equation.** The visible card could be fixed and the polite live region still said "10000 needed from 6", because the announcement was built from `toWin` directly.

11. **Short network cut did not flip the status.** Two and a half seconds offline left the pill on "live". The feed session only notices once the read fails. Twelve concurrent SSE clients against one local match all received the same payload (8.4 KB each, one shared poller). That dedupe held.

12. **Lighthouse mobile, production before the rebuild.** Performance 60, accessibility 96. FCP 0.9 s, LCP 6.1 s, TBT 480 ms, CLS 0.092, TTI 6.1 s. No console errors and no hydration errors on the home screen. The static client bundle is about 2.5 MB on disk (Remotion is in that graph). LCP is the score, not a missing font.

## Low

13. MP4 render on Vercel returns 501 with a clear message. The player is the film. That path is fine.

14. Both current batters can share a surname ("Udara" and "Udara") because the card keeps the last token of the name. Readable, not distinct.

15. Placeholder strike names ("Earlier batter") leaked as "batter" before the commentary window caught up.

## What the stress pass got right

- Production catalog was Cricbuzz, not a blank screen. Failover to the demo is still in the poller when a fetch fails.
- Grounding held for a betting question and a hallucinated batting figure on the live deploy.
- The feed reconnects by replacing the log (`sync`), so a rebuilt scoreboard does not append a second innings on top of the first.
- Reduced motion is already a global kill-switch on animations.

## After the rebuild

Local production, same Lighthouse flags.

| | Before (live deploy) | After (local prod) |
| --- | --- | --- |
| Performance | 60 | 53 |
| Accessibility | 96 | 97 |
| LCP | 6.1 s | 6.6 s |
| TBT | 480 ms | 360 ms |
| CLS | 0.092 | 0.302 |
| Document width at 390px | 665 px | 390 px |

CLS is worse on the local run because the page now waits for the catalog and then paints a live Test that is still moving. LCP did not improve. The phone no longer scrolls sideways, and the score it paints is the live match rather than a fake chase.

![After, mobile](after-mobile.png)

![After, desktop](after-desktop.png)

![After, Match Summary](after-mobile-summary.png)

Fixed from the list above: 1, 2 (live match is selected once the catalog arrives; the first line names the series and the city), 3 (no invented chase; the card shows the Cricbuzz status and RRR is "—"), 4 (one live chip, connection reads "In play"), 5 (a scrolling match row), 6 (labels at 70% white), 7 (errors surface, betting questions are prefixed "No betting tips."), 8 (one open at a time, dialog scrolls, film is height-capped, remount on match change cancels speech), 9 (win bar, sparkline, over strip), 10 (the polite region uses the same "No target yet" line). 11 and 12 stay: a short offline blip is still quiet, and Lighthouse LCP is still the score card.

Twelve SSE clients on `cb-170703` all got `: open` plus a sync, identical body length. One poller.

## Libraries

BoardUI chip, status dot, segmented control, progress, and skeleton. Opensource UI music-player card (the summary transport) and spin loader. The live badge follows the 21st.dev live-badge shape; that registry requires an API key, so the dot and chip are the BoardUI pieces.
