# Marlowe Bay — Open-World Heist

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/risadeden76/gta6/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/risadeden76/gta6/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in the spirit of GTA 6, built for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01) on make.fun. You are Dana Reyes, getaway driver for the fixer Sal Kestrel, working five jobs across Marlowe Bay — a sun-soaked coastal city of your own, with traffic, pedestrians, police, missions, combat and a minimap.

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No network request is made: the game is static files under `game/`, with three.js vendored as `game/vendor/three.module.min.js`.

## Controls

- **WASD** — move on foot / drive · **SHIFT** — run · **Mouse drag** — look
- **Click** — shoot the pistol · **E** — enter / exit a car (any car can be stolen)
- **SPACE** — handbrake · **M** — missions · **P** — pause · **H** — help

## The game

- **A city to explore on foot and by car** — Marlowe Bay: a procedural grid city with a beach, a marina, a bank, docks and a hideout, built fresh from a seed.
- **Traffic and pedestrians** — cars follow the road grid; locals stroll the sidewalks and flee from gunfire and speeding cars.
- **Cars to steal** — walk up to any parked or driving car and press E. Stealing raises your wanted level.
- **Wanted level and police** — 0 to 5 stars. Patrol cars chase and ram you; at 3+ stars officers shoot. Break line of sight to cool the heat off.
- **Missions and a story** — five jobs for Sal: steal the Comet GT, rob Marlowe Trust Bank, silence the rat at the East Docks, survive the Heat Wave, and pull the Big One with an armored van.
- **Combat** — a pistol with hitscan shooting, rival shooters with health bars, and health and cash pickups around the city.
- **HUD with a minimap** — cash, health, wanted stars, mission objective, speed, and a live top-down map with police dots and the mission marker.
- **Start and save** — a title screen, pause, busted/wasted screens, and progress that saves in the browser.

## Tech

- three.js (vendored `three.module.min.js`) for 3D, plain WebAudio synthesis for engine, sirens, gunshots and music — no audio files.
- `main.ts` copies `game/` and `screenshots/` to `/output` and writes `dossier.json` with the kit's `buildDossier`.

---

Optional: earn referral rewards, a second way to make money — [enter make.fun with my referral](https://make.fun/r/ekkx10fx).
