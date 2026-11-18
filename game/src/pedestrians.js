// Pedestrians: Marlowe Bay locals strolling the sidewalks. They walk between
// street corners, and run away screaming (in the form of fast walking) when a
// car bears down on them or a gun goes off nearby.

import * as THREE from 'three';
import { distance2D } from './rng.js';

const SHIRTS = [0x3b7dd2, 0xe8c33c, 0x3bd27a, 0xd2d2d2, 0x8a4fd2, 0xe07b2a, 0x7a6a8a, 0x4a8a7a];
const PANTS = [0x2a2d33, 0x2a3a5a, 0x5a3a2a, 0x3a3a3a];

function buildPedestrianMesh(shirtColor, pantsColor) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pants = new THREE.MeshLambertMaterial({ color: pantsColor });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), pants);
  legs.position.y = 0.4;
  group.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.34), shirt);
  torso.position.y = 1.15;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.38, 0.36), skin);
  head.position.y = 1.7;
  group.add(head);
  return group;
}

export function createPedestrians(scene, city, rng) {
  const peds = [];

  function randomSidewalkPoint() {
    const road = rng.pick(city.roads);
    const along = rng.range(-190, 190);
    const side = rng.chance(0.5) ? 8.5 : -8.5;
    return road.axis === 'x'
      ? { x: along, z: road.at + side }
      : { x: road.at + side, z: along };
  }

  for (let i = 0; i < 18; i++) {
    const spot = randomSidewalkPoint();
    const mesh = buildPedestrianMesh(rng.pick(SHIRTS), rng.pick(PANTS));
    mesh.position.set(spot.x, 0, spot.z);
    scene.add(mesh);
    const target = randomSidewalkPoint();
    peds.push({
      mesh,
      x: spot.x, z: spot.z,
      targetX: target.x, targetZ: target.z,
      yaw: 0,
      speed: rng.range(1.0, 1.7),
      flee: 0,
      down: false,
    });
  }

  return {
    peds,
    update(dt, world) {
      const player = world.player.state;
      const px = player.inCar ? player.inCar.x : player.x;
      const pz = player.inCar ? player.inCar.z : player.z;
      const playerSpeed = player.inCar ? Math.abs(player.inCar.speed) : player.speed;
      for (const ped of peds) {
        if (ped.down) continue;
        const dist = distance2D(px, pz, ped.x, ped.z);
        // Flee from a fast car or a recent gunshot.
        if ((player.inCar && dist < 10 && playerSpeed > 6) || world.recentShot > 0 && dist < 22) {
          ped.flee = 2.5;
        }
        if (ped.flee > 0) {
          ped.flee -= dt;
          const dx = ped.x - px, dz = ped.z - pz;
          const len = Math.hypot(dx, dz) || 1;
          ped.x += (dx / len) * 5.2 * dt;
          ped.z += (dz / len) * 5.2 * dt;
          ped.yaw = Math.atan2(dx, dz);
        } else {
          const dx = ped.targetX - ped.x;
          const dz = ped.targetZ - ped.z;
          const len = Math.hypot(dx, dz);
          if (len < 2) {
            const next = randomSidewalkPoint();
            ped.targetX = next.x;
            ped.targetZ = next.z;
          } else {
            ped.x += (dx / len) * ped.speed * dt;
            ped.z += (dz / len) * ped.speed * dt;
            ped.yaw = Math.atan2(dx, dz);
          }
        }
        const fixed = city.resolveCircle(ped.x, ped.z, 0.5);
        ped.x = fixed.x;
        ped.z = fixed.z;
        ped.mesh.position.set(ped.x, 0, ped.z);
        ped.mesh.rotation.y = ped.yaw;
        // Run over by the player's car: down, dust, heat.
        if (player.inCar && dist < 1.9 && playerSpeed > 3) {
          ped.down = true;
          ped.mesh.rotation.x = Math.PI / 2;
          ped.mesh.position.y = 0.3;
          world.effects.dust(ped.x, 0.6, ped.z);
          world.police.addHeat(15);
          world.hud.toast('Pedestrian down! The cops saw that!');
          world.audio.crash();
        }
      }
    },
    scareAll() {
      for (const ped of peds) ped.flee = 2.5;
    },
  };
}
