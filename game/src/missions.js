// The story: five jobs for Sal Kestrel, the fixer at Sal's Garage. Each
// mission has stages with a map marker, a HUD objective and a cash reward.
// Finishing all five makes Dana the King of Marlowe Bay.

import * as THREE from 'three';
import { distance2D } from './rng.js';

const MISSION_DEFS = [
  {
    id: 'wheels',
    title: 'JOB 1 — FIRST WHEELS',
    intro: 'Sal needs wheels. Steal the red Comet GT at the marina and bring it to the garage.',
    reward: 400,
    stages: [
      { text: 'Steal the red Comet GT at the Marina (press E near it)', at: 'marina', radius: 5, needCar: 'marina' },
      { text: 'Deliver the Comet GT to Sal\'s Garage', at: 'garage', radius: 7, needCar: 'marina' },
    ],
  },
  {
    id: 'payday',
    title: 'JOB 2 — PAYDAY PICKUP',
    intro: 'A bag of cash waits at Marlowe Trust Bank. Grab it on foot, then lose the heat at the Hideout.',
    reward: 800,
    stages: [
      { text: 'Get to Marlowe Trust Bank', at: 'bank', radius: 6, needCar: null },
      { text: 'Grab the cash — walk into the bank marker', at: 'bank', radius: 4, needCar: null, grab: true },
      { text: 'Lose the cops: reach the Hideout with no wanted level', at: 'hideout', radius: 7, needCar: null, needClean: true },
    ],
  },
  {
    id: 'rat',
    title: 'JOB 3 — SILENCE THE RAT',
    intro: 'Three of Marv\'s shooters are waiting at the East Docks. Deal with all three, then report back to Sal.',
    reward: 1200,
    stages: [
      { text: 'Go to the East Docks', at: 'docks', radius: 10, needCar: null, spawn: 'enemies' },
      { text: 'Take out all 3 shooters', at: 'docks', radius: 40, needCar: null, killAll: true },
      { text: 'Report back to Sal\'s Garage', at: 'garage', radius: 7, needCar: null },
    ],
  },
  {
    id: 'heat',
    title: 'JOB 4 — HEAT WAVE',
    intro: 'The PD is on a war footing. Survive 60 seconds at 3 stars, then break away and reach Palm Park.',
    reward: 1600,
    stages: [
      { text: 'Make some noise — get to 3 wanted stars', at: 'garage', radius: 30, needCar: null, needWanted: 3, timer: 60 },
      { text: 'Survive the heat — 60 seconds with the cops on you', at: 'garage', radius: 200, needCar: null, survive: true },
      { text: 'Break away — reach Palm Park', at: 'park', radius: 8, needCar: null },
    ],
  },
  {
    id: 'bigone',
    title: 'JOB 5 — THE BIG ONE',
    intro: 'An armored van is parked at the Docks. Take it, survive the 4-star response, and deliver it to the Hideout.',
    reward: 3000,
    stages: [
      { text: 'Steal the armored van at the East Docks (press E near it)', at: 'docks', radius: 6, needCar: 'van' },
      { text: 'Deliver the van to the Hideout — the whole PD is coming', at: 'hideout', radius: 8, needCar: 'van' },
    ],
  },
];

export function createMissions(scene, city, rng) {
  // A tall beacon column marks the active objective on the map.
  const beaconGeo = new THREE.CylinderGeometry(1.2, 1.2, 60, 12, 1, true);
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffd23e, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
  });
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.visible = false;
  scene.add(beacon);
  const ringGeo = new THREE.RingGeometry(2.4, 3.2, 32);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);

  const state = {
    index: 0,
    stage: 0,
    active: false,
    done: [],
    timer: 0,
    marker: null,
    van: null,
  };

  function currentDef() {
    return MISSION_DEFS[state.index] || null;
  }

  function stageDef() {
    const def = currentDef();
    return def ? def.stages[state.stage] : null;
  }

  function markerPos() {
    const stage = stageDef();
    if (!stage || !stage.at) return null;
    const place = city.places[stage.at];
    return place ? { x: place.x, z: place.z } : null;
  }

  function placeBeacon() {
    const pos = markerPos();
    if (pos) {
      beacon.visible = true;
      ring.visible = true;
      beacon.position.set(pos.x, 30, pos.z);
      ring.position.set(pos.x, 0.3, pos.z);
      state.marker = pos;
    } else {
      beacon.visible = false;
      ring.visible = false;
      state.marker = null;
    }
  }

  function startMission(world, index) {
    state.index = index;
    state.stage = 0;
    state.active = true;
    state.timer = 0;
    const def = currentDef();
    world.hud.toast(def.title);
    world.hud.setMission(def.title, def.stages[0].text);
    world.audio.jingle();
    placeBeacon();
    const stage = stageDef();
    if (stage && stage.spawn === 'enemies') {
      // Spawned when the player arrives instead; see update().
    }
  }

  function completeMission(world) {
    const def = currentDef();
    world.cash += def.reward;
    state.done.push(def.id);
    state.active = false;
    state.stage = 0;
    beacon.visible = false;
    ring.visible = false;
    world.hud.toast(`${def.title} COMPLETE — +$${def.reward}`);
    world.hud.setMission('FREE ROAM', 'Job done. Press M for the next job.');
    world.audio.jingle();
    world.saveProgress();
    if (state.done.length >= MISSION_DEFS.length) {
      world.onAllMissionsDone();
    }
  }

  function advanceStage(world) {
    const def = currentDef();
    state.stage += 1;
    state.timer = 0;
    if (state.stage >= def.stages.length) {
      completeMission(world);
      return;
    }
    const stage = stageDef();
    world.hud.setMission(def.title, stage.text);
    world.audio.pickup();
    placeBeacon();
  }

  function update(dt, world) {
    beacon.rotation.y += dt * 0.8;
    ring.scale.setScalar(1 + Math.sin(world.time * 3) * 0.08);
    if (!state.active) return;
    const def = currentDef();
    const stage = stageDef();
    if (!stage) return;
    const player = world.player.state;
    const px = player.inCar ? player.inCar.x : player.x;
    const pz = player.inCar ? player.inCar.z : player.z;
    const pos = markerPos();

    // Stage-specific setup that happens once.
    if (stage.spawn === 'enemies' && !state.enemiesSpawned) {
      if (pos && distance2D(px, pz, pos.x, pos.z) < 45) {
        state.enemiesSpawned = true;
        for (let i = 0; i < 3; i++) {
          world.combat.spawnEnemy(pos.x + rng.range(-14, 14), pos.z + rng.range(-14, 14), 60);
        }
        world.hud.toast('Three shooters — take them all out!');
      }
    }
    if (stage.needWanted && world.police.state.wanted < stage.needWanted) {
      // Nudge the player: committing crimes raises heat; shooting the air helps.
      if (player.inCar && Math.abs(player.inCar.speed) > 12) world.police.addHeat(dt * 1.2);
    }
    if (stage.survive) {
      state.timer += dt;
      world.hud.setMission(def.title, `Survive the heat — ${Math.ceil(60 - state.timer)}s left`);
      if (state.timer >= 60) {
        advanceStage(world);
        return;
      }
    }
    if (stage.needCar) {
      const wantVan = stage.needCar === 'van';
      const inRightCar = player.inCar && (wantVan ? player.inCar.isVan : player.inCar.missionCar);
      if (stage.needCar === 'van' && !state.van) {
        // The armored van appears at the docks when this mission starts.
        const van = world.vehicles.addCar(city.places.docks.x - 12, city.places.docks.z + 8, Math.PI / 2,
          { color: 0x3a3d44, name: 'Armored Van' });
        van.isVan = true;
        state.van = van;
      }
      if (pos && inRightCar && distance2D(px, pz, pos.x, pos.z) < stage.radius) {
        advanceStage(world);
        return;
      }
      if (stage.needCar === 'marina' && !player.inCar && state.stage === 0) {
        // Hint while on foot near the marina car.
        const car = world.vehicles.marinaCar;
        if (car && distance2D(px, pz, car.x, car.z) < 6) {
          world.hud.setMission(def.title, 'Press E to steal the Comet GT');
        }
      }
      return;
    }
    if (stage.killAll) {
      const alive = world.combat.enemies.filter((e) => e.alive).length;
      world.hud.setMission(def.title, `Take out all 3 shooters — ${alive} left`);
      if (alive === 0 && state.enemiesSpawned) {
        advanceStage(world);
        return;
      }
      return;
    }
    if (stage.needClean) {
      if (pos && distance2D(px, pz, pos.x, pos.z) < stage.radius && world.police.state.wanted === 0) {
        advanceStage(world);
        return;
      }
      return;
    }
    if (stage.grab) {
      if (pos && distance2D(px, pz, pos.x, pos.z) < stage.radius && !player.inCar) {
        world.police.setWanted(2);
        world.hud.toast('Cash grabbed! The cops are coming!');
        advanceStage(world);
        return;
      }
      return;
    }
    if (pos && distance2D(px, pz, pos.x, pos.z) < stage.radius) {
      advanceStage(world);
    }
  }

  return {
    state,
    defs: MISSION_DEFS,
    currentDef,
    stageDef,
    markerPos,
    startMission,
    completeMission,
    update,
  };
}
