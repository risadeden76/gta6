// Marlowe Bay — Open-World Heist. Boot, the one game loop, the camera, the
// screens (title, pause, missions, busted, wasted, victory) and the wiring
// between driving, shooting, police, missions and the HUD.
//
// ?seed=N fixes the city. ?shot=cover|drive|mission|street (with &seed=N)
// stages that scene instead of running the loop, paints it and sets
// window.__shotReady for a screenshot.

import * as THREE from 'three';
import { createRandom, clamp } from './rng.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_MISSIONS, ACTION_HELP } from './input.js';
import { createCity } from './city.js';
import { createPlayer } from './player.js';
import { createVehicles } from './vehicles.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createPedestrians } from './pedestrians.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { loadSave, saveGame, clearSave } from './save.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1337;
const rng = createRandom(seed);

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 8, -10);

const city = createCity(scene, rng);
const effects = createEffects(scene);
const audio = createAudio();
const hud = createHud();
const input = createInput(canvas);
const player = createPlayer(scene, city);
const vehicles = createVehicles(scene, city, rng);
const police = createPolice(scene, city, vehicles, rng);
const combat = createCombat(scene, city, effects, audio, rng);
const missions = createMissions(scene, city, rng);
const pedestrians = createPedestrians(scene, city, rng);

const saved = loadSave();

const world = {
  scene, camera, renderer, city, player, vehicles, police, combat, missions,
  pedestrians, effects, audio, hud, rng,
  cash: saved ? saved.cash : 0,
  time: 0,
  timeSinceHurt: 99,
  recentShot: 0,
  carsStolen: saved ? saved.carsStolen : 0,
  bestWanted: saved ? saved.bestWanted : 0,
  screen: 'title',
  shootCooldown: 0,
  lastBump: 0,
  onCarBump() {
    if (world.time - world.lastBump > 0.4) {
      world.lastBump = world.time;
      audio.crash();
      effects.sparks(player.state.inCar.x, 1, player.state.inCar.z);
    }
  },
  onBusted() {
    if (world.screen !== 'play') return;
    world.screen = 'busted';
    const lost = Math.floor(world.cash * 0.1);
    world.cash -= lost;
    police.setWanted(0);
    police.clearCops();
    world.saveProgress();
    hud.showScreen(`
      <h1>BUSTED</h1>
      <h2>THE PD TOOK YOU IN</h2>
      <p>Sal bailed you out. The cops kept $${lost.toLocaleString('en-US')} as "evidence".
      Your car is impounded — you are back at the garage on foot.</p>
      <button data-action="retry">BACK ON THE STREET</button>`);
    hud.announce('Busted. Press Enter to keep playing.');
  },
  onWasted() {
    if (world.screen !== 'play') return;
    world.screen = 'wasted';
    const lost = Math.floor(world.cash * 0.1);
    world.cash -= lost;
    police.setWanted(0);
    police.clearCops();
    world.saveProgress();
    hud.showScreen(`
      <h1>WASTED</h1>
      <h2>MARLOWE BAY IS UNFORGIVING</h2>
      <p>You woke up at the hospital, $${lost.toLocaleString('en-US')} lighter.
      The jobs are still waiting.</p>
      <button data-action="retry">BACK ON THE STREET</button>`);
    hud.announce('Wasted. Press Enter to keep playing.');
  },
  onAllMissionsDone() {
    world.screen = 'victory';
    hud.showScreen(`
      <h1>KING OF MARLOWE BAY</h1>
      <h2>ALL FIVE JOBS DONE</h2>
      <p>Dana Reyes owns this city now. Sal is pouring the good stuff at the garage.
      Free roam continues — keep the cash coming, or start over for a clean run.</p>
      <p>Cash: $${world.cash.toLocaleString('en-US')} &nbsp;·&nbsp; Cars stolen: ${world.carsStolen}</p>
      <button data-action="resume">KEEP PLAYING</button>
      <button data-action="restart">NEW GAME</button>`);
    hud.announce('All missions done. You are the King of Marlowe Bay.');
  },
  saveProgress() {
    saveGame({
      cash: world.cash,
      missionsDone: missions.state.done,
      bestWanted: world.bestWanted,
      carsStolen: world.carsStolen,
    });
  },
};

combat.setWorld(world);
if (saved && saved.missionsDone.length > 0) {
  missions.state.done = [...saved.missionsDone];
  missions.state.index = Math.min(saved.missionsDone.length, 4);
}

function titleHtml() {
  const hasSave = !!saved && (saved.cash > 0 || saved.missionsDone.length > 0);
  return `
    <h1>MARLOWE BAY</h1>
    <h2>AN OPEN-WORLD HEIST &nbsp;·&nbsp; SUN, SEA AND SIRENS</h2>
    <p>You are <b>Dana Reyes</b>, getaway driver. The fixer <b>Sal Kestrel</b> has five jobs
    for you across Marlowe Bay — steal the Comet GT, rob the bank, silence the rat,
    outrun the whole PD, and pull the Big One. Steal cars, mind the wanted stars,
    and do not get caught.</p>
    <div class="keys">WASD — move / drive &nbsp;·&nbsp; SHIFT — run &nbsp;·&nbsp; MOUSE drag — look<br>
    CLICK — shoot &nbsp;·&nbsp; E — enter / exit car &nbsp;·&nbsp; SPACE — brake<br>
    M — missions &nbsp;·&nbsp; P — pause &nbsp;·&nbsp; H — help</div><br>
    <button data-action="start">START ENGINE</button>
    ${hasSave ? '<button data-action="continue">CONTINUE ($' + saved.cash.toLocaleString('en-US') + ')</button>' : ''}
    <p class="small">100% original: its own city, names, story and sounds. Nothing from Rockstar Games.<br>
    Progress saves in this browser.</p>`;
}

function missionsHtml() {
  const rows = missions.defs.map((def, i) => {
    const done = missions.state.done.includes(def.id);
    const unlocked = i <= missions.state.done.length;
    const active = missions.state.active && missions.state.index === i;
    return `<p style="text-align:left;margin:8px 0">
      <b style="color:${done ? '#7dff9b' : '#ffd23e'}">${done ? '✓' : (active ? '▶' : '○')} ${def.title}</b>
      — $${def.reward} — ${done ? 'done' : (unlocked ? `<button data-action="mission" data-index="${i}" style="font-size:14px;padding:4px 14px;margin:0">START</button>` : 'finish the previous job first')}</p>`;
  }).join('');
  return `
    <h1 style="font-size:34px">JOBS FOR SAL</h1>
    <p>Five jobs. Finish them in order — each one pays in cash.</p>
    ${rows}
    <button data-action="resume">BACK TO THE STREET</button>`;
}

function helpHtml() {
  return `
    <h1 style="font-size:34px">HOW TO PLAY</h1>
    <div class="keys" style="text-align:left">
    <b>On foot:</b> WASD to move, SHIFT to run, drag the mouse to look, CLICK to shoot.<br>
    <b>In a car:</b> W/S accelerate and reverse, A/D steer, SPACE handbrake.<br>
    <b>E</b> near any car to steal it and drive. Stealing, hitting people and shooting raise your wanted level.<br>
    <b>Wanted stars:</b> 1–2 stars, patrol cars chase you. 3+, officers shoot. Break line of sight for 9 seconds and the heat cools off.<br>
    <b>Missions:</b> press M, start a job, follow the gold beacon and the minimap marker. Finish all five to rule Marlowe Bay.<br>
    <b>Pickups:</b> green crates heal, gold crates pay $150. <b>P</b> pauses. Progress saves automatically.</div>
    <button data-action="resume">BACK TO THE STREET</button>`;
}

function respawn() {
  const p = player.state;
  if (p.inCar) player.exitCar();
  player.reset(city.places.garage.x, city.places.garage.z + 12);
  p.health = 100;
  p.dead = false;
  combat.clearEnemies();
  world.screen = 'play';
  hud.hideScreen();
  hud.setMission('FREE ROAM', 'Find Sal at the garage to start a job. Press M for missions.');
}

function startGame(fresh) {
  if (fresh) {
    clearSave();
    world.cash = 0;
    world.carsStolen = 0;
    world.bestWanted = 0;
    missions.state.done = [];
    missions.state.index = 0;
    missions.state.active = false;
  }
  audio.start();
  player.reset(city.places.garage.x, city.places.garage.z + 12);
  world.screen = 'play';
  hud.hideScreen();
  hud.setMission('FREE ROAM', 'Find Sal at the garage to start a job. Press M for missions.');
  hud.announce('Marlowe Bay. Press M for missions, E near a car to drive.');
  // Starter pickups around the garage, once per page load.
  if (!world.pickupsSpawned) {
    world.pickupsSpawned = true;
    combat.spawnPickup(city.places.garage.x + 10, city.places.garage.z + 6, 'health');
    combat.spawnPickup(city.places.garage.x - 12, city.places.garage.z - 4, 'cash');
    combat.spawnPickup(city.places.bank.x + 12, city.places.bank.z + 8, 'health');
    combat.spawnPickup(city.places.marina.x - 8, city.places.marina.z + 4, 'cash');
    combat.spawnPickup(city.places.park.x + 6, city.places.park.z - 6, 'health');
    combat.spawnPickup(city.places.docks.x + 10, city.places.docks.z - 10, 'cash');
  }
}

document.getElementById('screen-card').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'start') startGame(true);
  else if (action === 'continue') startGame(false);
  else if (action === 'resume') { world.screen = 'play'; hud.hideScreen(); }
  else if (action === 'restart') { world.screen = 'title'; hud.showScreen(titleHtml()); }
  else if (action === 'retry') respawn();
  else if (action === 'mission') {
    const index = Number.parseInt(button.dataset.index, 10);
    world.screen = 'play';
    hud.hideScreen();
    missions.startMission(world, index);
  }
});

function stealCar(car) {
  player.enterCar(car);
  world.carsStolen += 1;
  police.addHeat(12);
  hud.toast(`Stole the ${car.name}! +HEAT`);
  hud.announce(`Stole the ${car.name}. The police noticed.`);
  audio.pickup();
}

function tryEnterExit() {
  const p = player.state;
  if (p.inCar) {
    player.exitCar();
    return;
  }
  const car = vehicles.nearestCar(p.x, p.z, 4.5, (c) => !c.wrecked);
  if (car) {
    if (car.traffic || car.police) {
      // Jacking a moving car is a crime like any other.
      stealCar(car);
      car.traffic = false;
    } else if (car.player) {
      player.enterCar(car);
    } else {
      stealCar(car);
    }
  }
}

function tryShoot() {
  const p = player.state;
  if (p.inCar || p.dead || world.shootCooldown > 0) return;
  world.shootCooldown = 0.28;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  combat.shoot(p.x, 1.5, p.z, dir.x, dir.y, dir.z, 90, 34, 'player');
  police.addHeat(4);
  world.recentShot = 1.5;
  pedestrians.scareAll();
}

function updateCamera(dt) {
  const p = player.state;
  let targetPos;
  let lookAt;
  if (p.inCar) {
    const car = p.inCar;
    const backX = car.x - Math.sin(car.yaw) * 11;
    const backZ = car.z - Math.cos(car.yaw) * 11;
    targetPos = new THREE.Vector3(backX, 4.6, backZ);
    lookAt = new THREE.Vector3(car.x + Math.sin(car.yaw) * 8, 1.6, car.z + Math.cos(car.yaw) * 8);
  } else {
    const dist = 7.5;
    const height = 2.6 + p.camPitch * 4;
    const backX = p.x - Math.sin(p.camYaw) * dist * Math.cos(p.camPitch);
    const backZ = p.z - Math.cos(p.camYaw) * dist * Math.cos(p.camPitch);
    targetPos = new THREE.Vector3(backX, height, backZ);
    lookAt = new THREE.Vector3(
      p.x + Math.sin(p.camYaw) * 4,
      1.6,
      p.z + Math.cos(p.camYaw) * 4,
    );
  }
  camera.position.lerp(targetPos, Math.min(1, dt * 5));
  camera.lookAt(lookAt);
}

function step(dt) {
  world.time += dt;
  world.timeSinceHurt += dt;
  world.recentShot = Math.max(0, world.recentShot - dt);
  world.shootCooldown = Math.max(0, world.shootCooldown - dt);
  world.bestWanted = Math.max(world.bestWanted, police.state.wanted);

  const p = player.state;
  if (world.screen === 'play') {
    const actions = input.takeActions();
    if (actions & ACTION_PAUSE) {
      world.screen = 'paused';
      hud.showScreen('<h1 style="font-size:34px">PAUSED</h1><p>Marlowe Bay waits for no one. Except now.</p><button data-action="resume">RESUME</button>');
      hud.announce('Paused.');
    } else if (actions & ACTION_MISSIONS) {
      world.screen = 'missions';
      hud.showScreen(missionsHtml());
    } else if (actions & ACTION_HELP) {
      world.screen = 'help';
      hud.showScreen(helpHtml());
    } else if (actions & ACTION_ENTER) {
      tryEnterExit();
    } else if (actions & ACTION_CONFIRM) {
      // Enter also starts the game from a dead screen; handled by buttons.
    }
    if (input.takeMouseClick() && !p.inCar) tryShoot();
    if (input.mouseHeld() && !p.inCar && world.shootCooldown <= 0) tryShoot();
  } else if (world.screen === 'paused' || world.screen === 'missions' || world.screen === 'help') {
    const actions = input.takeActions();
    if (actions & ACTION_PAUSE) {
      world.screen = 'play';
      hud.hideScreen();
    }
    input.takeMouseClick();
    return; // Frozen world while a menu is open.
  } else {
    // title / busted / wasted / victory: world idles, buttons drive.
    input.takeActions();
    input.takeMouseClick();
    city.update(dt, world.time);
    effects.update(dt);
    return;
  }

  player.update(dt, input, world);
  if (p.dead && world.screen === 'play') {
    world.onWasted();
    return;
  }
  if (p.inCar) {
    const move = input.move();
    const throttle = move.z;
    const steer = move.x;
    if (input.brake()) {
      p.inCar.speed -= p.inCar.speed * 3 * dt;
    }
    vehicles.driveCar(p.inCar, dt, throttle, steer);
    if (p.inCar.wrecked) {
      player.exitCar();
      hud.toast('Car wrecked!');
    }
  }
  vehicles.update(dt, world);
  pedestrians.update(dt, world);
  police.update(dt, world);
  combat.update(dt, world);
  missions.update(dt, world);
  city.update(dt, world.time);
  effects.update(dt);
  audio.engine(p.inCar ? Math.abs(p.inCar.speed) / 24 : 0, !!p.inCar);
  audio.siren(police.state.wanted > 0);
  updateCamera(dt);
  hud.update(world);
  hud.setCrosshair(!p.inCar && world.screen === 'play');
}

world.update = step;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && world.screen === 'play') {
    world.screen = 'paused';
    hud.showScreen('<h1 style="font-size:34px">PAUSED</h1><p>Marlowe Bay waits for no one. Except now.</p><button data-action="resume">RESUME</button>');
  }
});

if (shot) {
  // Screenshot mode: no title screen, no loop — stage the scene and paint it.
  world.screen = 'play';
  hud.hideScreen();
  stageShot(shot, world);
} else {
  hud.showScreen(titleHtml());
  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    while (accumulator >= STEP) {
      step(STEP);
      accumulator -= STEP;
    }
    if (world.screen !== 'title') renderer.render(scene, camera);
    else renderer.render(scene, camera);
  }
  // A slow cinematic pan behind the title screen.
  camera.position.set(-60, 26, -80);
  camera.lookAt(0, 4, 0);
  requestAnimationFrame(frame);
}
