// The Marlowe Bay PD: a wanted level from 0 to 5 stars, police cars that
// chase and ram, foot officers who shoot at 3+ stars, and a heat that cools
// off when you break line of sight.

import * as THREE from 'three';
import { clamp, distance2D } from './rng.js';

export function createPolice(scene, city, vehicles, rng) {
  const cops = [];
  const state = {
    wanted: 0,
    heat: 0,
    unseenTime: 0,
    bustTimer: 0,
    maxSpawned: 0,
  };
  let flashPhase = 0;

  function addHeat(amount) {
    state.heat = clamp(state.heat + amount, 0, 100);
    const level = state.heat <= 0 ? 0 : state.heat < 18 ? 1 : state.heat < 38 ? 2
      : state.heat < 58 ? 3 : state.heat < 80 ? 4 : 5;
    if (level > state.wanted) state.wanted = level;
    state.unseenTime = 0;
  }

  function spawnCopCar(x, z) {
    const car = vehicles.spawnPoliceCar(x, z);
    car.police = true;
    cops.push({ car, foot: false, shootTimer: 0 });
    state.maxSpawned = Math.max(state.maxSpawned, cops.length);
    return car;
  }

  function spawnFootCop(x, z) {
    const mesh = new THREE.Group();
    const navy = new THREE.MeshLambertMaterial({ color: 0x1a2a5a });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.34), navy);
    torso.position.y = 1.15;
    mesh.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.38, 0.36), skin);
    head.position.y = 1.7;
    mesh.add(head);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), navy);
    legs.position.y = 0.4;
    mesh.add(legs);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    cops.push({ mesh, x, z, foot: true, health: 50, shootTimer: rng.range(0.5, 1.5) });
  }

  function clearCops() {
    for (const cop of cops) {
      if (cop.car) vehicles.removeCar(cop.car);
      if (cop.mesh) scene.remove(cop.mesh);
    }
    cops.length = 0;
  }

  function update(dt, world) {
    const player = world.player.state;
    const px = player.inCar ? player.inCar.x : player.x;
    const pz = player.inCar ? player.inCar.z : player.z;
    flashPhase += dt;

    // Wanted decays only while no cop can see you.
    let seen = false;
    for (const cop of cops) {
      const cx = cop.car ? cop.car.x : cop.x;
      const cz = cop.car ? cop.car.z : cop.z;
      if (distance2D(px, pz, cx, cz) < 55) seen = true;
    }
    if (!seen && state.wanted > 0) {
      state.unseenTime += dt;
      if (state.unseenTime > 9) {
        state.heat = Math.max(0, state.heat - dt * 4);
        const level = state.heat <= 0 ? 0 : state.heat < 18 ? 1 : state.heat < 38 ? 2
          : state.heat < 58 ? 3 : state.heat < 80 ? 4 : 5;
        state.wanted = level;
        if (state.wanted === 0) clearCops();
      }
    } else {
      state.unseenTime = 0;
    }

    // Keep the right number of units on the street.
    const wantCars = state.wanted === 0 ? 0 : Math.min(2 + state.wanted, 6);
    const carCops = cops.filter((c) => !c.foot);
    if (carCops.length < wantCars) {
      const angle = rng.range(0, Math.PI * 2);
      const sx = clamp(px + Math.cos(angle) * rng.range(55, 80), -200, 200);
      const sz = clamp(pz + Math.sin(angle) * rng.range(55, 80), -200, 180);
      const fixed = city.resolveCircle(sx, sz, 2);
      spawnCopCar(fixed.x, fixed.z);
    }
    // Foot officers join the hunt at 3+ stars.
    if (state.wanted >= 3 && cops.filter((c) => c.foot).length < 2) {
      const angle = rng.range(0, Math.PI * 2);
      spawnFootCop(
        clamp(px + Math.cos(angle) * 26, -200, 200),
        clamp(pz + Math.sin(angle) * 26, -200, 180),
      );
    }

    // Chase brains.
    for (const cop of cops) {
      if (cop.car) {
        const car = cop.car;
        if (car.wrecked) continue;
        if (car.player) continue; // The player stole this unit: they drive it now.
        const dx = px - car.x;
        const dz = pz - car.z;
        const dist = Math.hypot(dx, dz) || 1;
        const targetYaw = Math.atan2(dx, dz);
        let dyaw = ((targetYaw - car.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        car.yaw += clamp(dyaw, -2.4 * dt, 2.4 * dt);
        const throttle = dist > 6 ? 1 : 0.3;
        vehicles.driveCar(car, dt, throttle, clamp(dyaw * 1.2, -1, 1));
        // Ram the player's car.
        if (player.inCar && dist < 3.6) {
          player.inCar.health -= 14 * dt;
          world.effects.sparks(player.inCar.x, 1, player.inCar.z);
          if (player.inCar.health <= 0 && !player.inCar.wrecked) {
            player.inCar.wrecked = true;
            world.effects.explosion(player.inCar.x, 1, player.inCar.z);
            world.audio.crash();
          }
        }
        // Light bar flash.
        const bar = car.mesh.getObjectByName('lightbar');
        if (bar) bar.material.color.setHex(Math.sin(flashPhase * 9) > 0 ? 0xff2222 : 0x2255ff);
      } else {
        // Foot cop: walk at the player, shoot at 3+ stars.
        const dx = px - cop.x;
        const dz = pz - cop.z;
        const dist = Math.hypot(dx, dz) || 1;
        if (dist > 4) {
          cop.x += (dx / dist) * 4.4 * dt;
          cop.z += (dz / dist) * 4.4 * dt;
        }
        const fixed = city.resolveCircle(cop.x, cop.z, 0.6);
        cop.x = fixed.x;
        cop.z = fixed.z;
        cop.mesh.position.set(cop.x, 0, cop.z);
        cop.mesh.rotation.y = Math.atan2(dx, dz);
        cop.shootTimer -= dt;
        if (state.wanted >= 3 && dist < 34 && cop.shootTimer <= 0) {
          cop.shootTimer = rng.range(0.9, 1.6);
          if (world.combat) world.combat.copShot(cop.x, 1.5, cop.z, px, 1.4, pz);
        }
      }
    }

    // Busted: a cop stands next to you on foot while you are slow and wanted.
    if (!player.inCar && !player.dead && state.wanted > 0) {
      let near = false;
      for (const cop of cops) {
        const cx = cop.car ? cop.car.x : cop.x;
        const cz = cop.car ? cop.car.z : cop.z;
        if (distance2D(px, pz, cx, cz) < 2.6) near = true;
      }
      if (near) {
        state.bustTimer += dt;
        if (state.bustTimer > 2.2) world.onBusted();
      } else {
        state.bustTimer = 0;
      }
    } else {
      state.bustTimer = 0;
    }
  }

  return {
    state,
    cops,
    addHeat,
    clearCops,
    update,
    setWanted(level) {
      state.wanted = clamp(level, 0, 5);
      state.heat = [0, 10, 28, 48, 68, 90][state.wanted];
    },
  };
}
