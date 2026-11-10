# Why Match Pulse exists

## What changed at Dream11

In August 2025, after India's Promotion and Regulation of Online Gaming Act 2025 banned real-money games, Dream11 stopped paid contests and pivoted to a free sports-engagement app: "Dream11: Watch. Play. Compete." The public pillars are creator-led Watch Along streams (chat, polls, Shout Outs, DreamBucks virtual gifts), free fantasy and Flex private leagues with no cash, Rhea AI for quizzes and snackable content, and FanCode-powered live cricket in the app. A further "brand new Dream11" has been teased for the end of December 2026.

CEO Harsh Jain has framed the product around company, not cash: "It's damn depressing to watch a match alone... we all want to watch a match alone together." He has called the second screen "popcorn to your movie," and Dream Sports has said roughly 80% of fans already second-screen. Sources: [Dream Sports on the pivot](https://www.dreamsports.group/media-and-blog/dream11-pivots-from-gaming-to-a-sports-entertainment-platform), [Storyboard18](https://www.storyboard18.com/gaming-news/harsh-jain-says-dream-sports-has-moved-on-from-gaming-as-it-launches-new-fan-engagement-platform-85342.htm), [Forbes India](https://www.forbesindia.com/article/news/dream11s-second-innings-betting-big-on-indias-watch-party-economy/2989851/1), [Mint](https://www.livemint.com/companies/start-ups/dream11-completes-pivot-to-a-global-sports-engagement-platform-after-real-money-gaming-ban-11787825081003.html).

## The fan problems, with the evidence we used

These are complaints, not measurements we ran.

1. **The post-pivot engagement gap.** Without money on the line, fans describe the app as empty or as a place that mainly serves streamers. See the [Dream11 subreddit thread](https://www.reddit.com/r/dream11/comments/1sy4ih4/is_it_me_or_has_this_platform_actually_become_the/), [AppVulture reviews](https://appvulture.com/apps/dream11-android/), and [BestMediaInfo on whether Watch Alongs can replace the fantasy habit](https://bestmediainfo.com/mediainfo/mediainfo-marketing/dream11-bets-on-watch-alongs-and-creators-this-ipl-can-they-replace-the-old-fantasy-habit-11436241).
2. **Spoilers and stream delay.** The OTT picture lags. Cricbuzz, WhatsApp, and phone alerts announce the wicket first. Sometimes the audio is ahead of the video. See [syncing a live match to your stream](https://www.reddit.com/r/JKreacts/comments/1sbkl6i/whats_the_point_of_syncing_live_match_to_your/), [Hotstar sound versus video](https://www.reddit.com/r/IndiaCricket/comments/1gwxfep/sound_vs_video_lag_on_hotstar/), and [a JioHotstar telecast complaint](https://www.reddit.com/r/JioHotstar/comments/1ri2f7s/b_grade_telecast_by_jio_hotstar/).
3. **Info overload.** Score, chat, fantasy, and ads compete. A casual fan cannot tell what matters in this over. The Finch's [sports-app UX notes](https://thefinch.design/sports-app-ux-design-cricket-fantasy-live-score-platforms/) describe that pile-up.
4. **Points that move without an explanation.** Rank and fantasy points jump and the app does not say why. See [a ranking-shift thread](https://www.reddit.com/r/dream11/comments/1cosvz8/wierd_shift_in_ranking/).
5. **New fans who will not ask.** Someone watching cricket for the first time does not know what a required rate is, and the room is a bad place to admit it. See [a first-time viewer's post](https://www.reddit.com/r/Cricket/comments/z7hl97/i_watched_cricket_for_the_first_time_and_felt/).

The precedents we borrowed from, without copying their economies, are [Twitch Channel Points Predictions](https://blog.twitch.tv/en/2020/12/12/channel-points-predictions-let-your-viewers-guess-your-destiny/) and Sleeper's free Pick'em pools: a call you can be right about, with friends, and nothing to cash out.

## Who this is for

The primary fan is watching a T20 chase with a phone in hand and three or four friends who want a call on the next over, not a payout. A secondary fan is new to cricket and will not ask what a required rate is out loud.

Watch Along is a room if you want a creator. It is a bad place to ask a basic question, and the chat is a pile of everything at once. A score app is fresh and unexplained. Fantasy points move and the screen does not say why.

## The take

Replace the lost cash thrill with a call, a companion, and a story, all from one live log.

- **Stakes without money.** Over-War is a call you can be wrong about. Pulse Points are an in-match currency with a streak and a pod, not a wallet.
- **A companion that can only see the log.** Questions are answered from the balls already received. Tools return the score, the rate, the win chance, and the players. A check rejects betting language and any number the tools did not return.
- **Alone together, privately.** A pod of four to eight is the room. The demo fills it with simulated friends so a reviewer can see callouts without inviting anyone.
- **The match becomes something you can send.** At the whistle, that same log and the pod's calls become a 9:16 story.

## What we built, and what we left out

Shipped:

- Pulse cards as each ball arrives: what happened, why the over matters, a simple win-chance and its swing, who is on strike. Whisper Mode expands any card. Commentary switches among English, Hinglish, and plain.
- Over-War: two or three micro-calls before the over, locked when the over starts, settled after, with streaks and badges.
- A pod leaderboard, a stand meter for the over, and a take-of-the-over line.
- A sample Flex XI and a plain-English "why did my points move?" using Dream11-like T20 scoring. It is a reading aid, not a contest entry.
- A companion that answers in English, Hinglish, or plain language from the received log only. It calls tools for the numbers. A check rejects betting language and any number the tools did not return.
- A Match Story: the same log rendered as a 9:16 Remotion film (title, win-chance chart, calls, pod, MVP, final score, outro), with an in-app player, an MP4 render on Node, a WebM fallback, a PNG card, and share. Anime inserts, when a model is attached, come from a typed shot plan of the beats. The prompt uses kits and roles, never a player's face, and Remotion draws the numbers.
- Match Summary: one button builds that shot plan into a pencil-sketch film with a voiceover. The words are the beats, checked so every number is already in the match. espeak speaks them with no API key. The AI clip port stays, unused, until a video model is attached.

Left out on purpose:

- Real money, deposits, withdrawals, and anything that can be bought. DreamBucks are someone else's virtual gift. Pulse Points are not DreamBucks.
- Accounts, push notifications, and a real friend graph. The pod is simulated so the demo has a room.
- A live vendor feed. The innings is a recorded Harbor Cup final (fictional teams) behind a `MatchDataSource` port.
- Creator video inside this app. Match Pulse is the second screen, not the broadcast.
- Economy and strike-rate bonuses are applied at the end of an over, not tick-by-tick, so the explanation stays readable.

## Compliance

Pulse Points start at 1,000 for the session. The only stakes are 25, 50, and 100. They cannot be purchased, cashed out, or converted. The Over-War panel says this in the product, not only in this document. Odds are a fair price of the model's probability, floored at 1.25, so the call feels like a call. They are not a betting price and the copy is rejected if it drifts into wagering language.

## How Dream11 would know it worked

These are hypotheses, not results.

- **Session length during the match** rises versus a score-only second screen, because each over break is a decision and the companion gives a reason to stay.
- **Pod creation** (or, later, private-league attach) per match, as a proxy for "I did not watch alone."
- **Prediction participation**: share of overs in which a fan makes at least one call, and the share who are still calling after over 15.
- **D7 return**: fans who open Match Pulse for a second match within seven days. The habit we want is the next match, not a midweek deposit.
- **Whisper opens** and **companion questions** among fans who have never played fantasy, as a proxy for "I could follow this."
- **Stories shared** after the whistle, as a proxy for "I was in this match with other people." A story that is never sent did not close the loop.
## Risks

- The live feed can run ahead of a lagging video. Match Pulse does not hide that. The over break is still long enough, even at 20×, that a call can be placed before the next ball.
- Simulated friends are honest in a demo and hollow in production. The next step is a real pod of people you already watch with.
- The win-chance model is a transparent logistic, not a bookmaker. If we present it as more than that, we recreate the thing the law removed.
- AI copy can invent a shot. The model is only allowed to rewrite language. Probabilities, resolution, and points stay in code, and unsafe copy falls back to the desk voice.

## How it would sit inside Dream11

Watch Along keeps the creator, the chat, and the picture. Match Pulse sits beside that picture: the live log, a call each over, a companion that will only quote what has arrived, and a story at the whistle. Flex private leagues are the natural pod. Rhea, or the same model adapter, can write the Whisper line. Pulse Points should stay non-redeemable even if DreamBucks continue to exist beside them. Mixing the two would put a cash-shaped object back in the hand.
