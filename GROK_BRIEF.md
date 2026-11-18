# Keeper's Voyage v2: hand over brief for Grok

Paste this whole file into Grok, together with the zip contents.

## What this is
A private family installable web app (PWA) for Ell, aged 10 to 11, an U11 Wigan Athletic academy goalkeeper who also fishes, is preparing for his KS2 SATs (10 to 13 May 2027) and uses Purple Mash at school. His dad Wardy is a UEFA qualified youth coach. UK English only. No hyphens in any text you write, use commas, colons or brackets instead.

## What is already built (do not rewrite, extend)
Vanilla HTML, CSS and JavaScript. Files: index.html, style.css, app.js, sw.js, manifest.json, icons folder. Five tabs: Deck (home), Train, Study, Chill, Coach.
- Deck: daily voyage with Body, Brain and Downtime tiles, XP (doubloons), streak, ranks, character card.
- Train: Keeper (skills, drills, logs, coach notes from Gilero Goalkeeping, GK Calls game), Speed Lab (6 week plan and 5 metre test), Fitness, Match day, Bounce Back (resilience).
- Study: daily mission, maths blitz, spelling spotter, grammar quickfire, reading log, toolbox, SATs plan.
- Chill: fishing (carp and tench, method feeder, knots, five home waters, catch log), Calm corner (box breathing), media.
- Coach: keyword answer bot that links into the right section.
Everything saves in localStorage on the phone. Works offline. Bump CACHE in sw.js every time any file changes.

## Style rules
Original pirate adventure and manga look: halftone dots, speed lines, thick ink borders, sound effect bursts. Deep ocean navy (#0a1a33), sun yellow (#ffd23f), red (#e63329), ink (#14142b), paper (#fff6dc). DO NOT use One Piece or any other franchise characters, logos, names, quotes or ship designs. Original designs only.

## Your jobs (pick up in this order)
1. Character art set. Create original manga style character sprites based on a boy goalkeeper (short dark hair, freckles, big smile, tall and slim). Poses: ready stance, big save dive, celebration, determined bounce back (muddy, getting up), fishing with a carp, studying with a book, calm breathing. Transparent PNG, 512 pixels square, names like char_ready.png, char_save.png, char_win.png, char_bounce.png, char_fishing.png, char_study.png, char_calm.png. Put them in an assets folder.
2. Wire the sprites into the app: show char_win or char_bounce on the Deck character card and Bounce Back page, char_study on the Study tab header, char_fishing on the Chill tab header. Keep the existing photo upload as an option and keep photos on the phone only.
3. Pirate themed graphics: a crest or badge for each rank (7 ranks in RANKS in app.js), a treasure chest for the catch log, a ship's wheel header. All original.
4. Fishing diagrams to replace the grey placeholders: method feeder rig, Palomar knot, knotless knot, uni knot, carp and tench illustrations. Simple clean line art that reads well on a phone.
5. Goalkeeper diagrams for the GK Calls (KEEPER, AWAY, UP, MAN ON, TIME): original pitch diagrams drawn in our colours, not copies of any social media post.
6. Sound and motion (optional): short original sound effects for XP gain and rank up, with a mute switch in settings. Respect reduced motion.
7. Add the new files to the SHELL list in sw.js and bump CACHE.

## Do not
- Put any photo of Ell or other children into the hosted files. Photos are uploaded by the family on the device only.
- Add accounts, tracking, analytics, adverts or any server upload. Keep GDPR and child safety first.
- Add medical or clinical claims. Resilience content is supportive only and tells him to talk to a coach or trusted adult if worry lasts.
- Rename data attributes (data-act, data-view, data-sub), the click handler depends on them.

## Facts to keep accurate
- Training: Monday and Thursday 5 to 7pm club, Saturday 10 to 12 mostly games, plus one weekly keeper session with Gilero Goalkeeping (day set in app settings).
- Waters: Gorses (Aspull), Wrightington Fisheries, Charity Farm, Beacon View, Coppull Mill. Prices and rules must be checked with each venue.
- Under 13s need no rod licence in England, but an adult who handles the rod needs one.

## Test before returning
Open index.html in a browser, tap every tab and sub tab, log a setback and a comeback, run the GK Calls game, add the app to an iPhone home screen, then switch to flight mode and check it still opens.

## Added late (also built)
Deck has an "What do you want to do?" quick button grid and a daily feelings check in. Train, Keeper now has a Quick test (16 question bank, 8 per round), Calls, and a Clips tab with free FA Bootroom videos, YouTube topic searches and a think while you watch note box. Extra jobs for you: icons for the eight quick buttons (original, matching our style), and a short animated character reaction for each feelings answer (great, ok, tired, rough). Add more quiz questions to GKQ in app.js, keep each with a one line explanation.
