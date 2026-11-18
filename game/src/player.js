// Dana Reyes on foot: third-person walking and running, a simple low-poly
// character mesh, and getting in and out of cars.

import * as THREE from 'three';
import { clamp, angleDiff } from './rng.js';

function buildPersonMesh(shirtColor, pantsColor) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pants = new THREE.MeshLambertMaterial({ color: pantsColor });
  const hair = new THREE.MeshLambertMaterial({ color: 0x2a1c10 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), pants);
  legs.position.y = 0.4;
  group.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.34), shirt);
  torso.position.y = 1.15;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.38, 0.36), skin);
  head.position.y = 1.7;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.12, 0.4), hair);
  cap.position.y = 1.92;
  group.add(cap);
  const armGeo = new THREE.BoxGeometry(0.16, 0.62, 0.16);
  const armL = new THREE.Mesh(armGeo, shirt);
  armL.position.set(-0.4, 1.15, 0);
  armL.name = 'armL';
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, shirt);
  armR.position.set(0.4, 1.15, 0);
  armR.name = 'armR';
  group.add(armR);
  return group;
}

export function createPlayer(scene, city) {
  const mesh = buildPersonMesh(0xd23b3b, 0x2a3a5a);
  scene.add(mesh);
  const player = {
    mesh,
    x: 0, z: 30,
    yaw: Math.PI,
    camYaw: Math.PI,
    camPitch: 0.32,
    health: 100,
    speed: 0,
    inCar: null,
    walkPhase: 0,
    dead: false,
  };
  mesh.position.set(player.x, 0, player.z);
  mesh.rotation.y = player.yaw;

  return {
    state: player,
    reset(x, z) {
      player.x = x;
      player.z = z;
      player.yaw = Math.PI;
      player.camYaw = Math.PI;
      player.health = 100;
      player.inCar = null;
      player.dead = false;
      player.speed = 0;
      mesh.visible = true;
      mesh.position.set(x, 0, z);
    },
    update(dt, input, world) {
      if (player.dead || player.inCar) return;
      const look = input.takeLook();
      player.camYaw -= look.dx * 0.004;
      player.camPitch = clamp(player.camPitch + look.dy * 0.003, -0.1, 0.9);
      const move = input.move();
      const running = input.run();
      const targetSpeed = (move.x !== 0 || move.z !== 0) ? (running ? 8.5 : 4.6) : 0;
      player.speed += (targetSpeed - player.speed) * Math.min(1, dt * 8);
      if (player.speed > 0.2) {
        // Move relative to the camera yaw.
        const forwardX = Math.sin(player.camYaw);
        const forwardZ = Math.cos(player.camYaw);
        const rightX = Math.cos(player.camYaw);
        const rightZ = -Math.sin(player.camYaw);
        const mx = forwardX * move.z + rightX * move.x;
        const mz = forwardZ * move.z + rightZ * move.x;
        const len = Math.hypot(mx, mz) || 1;
        const nx = player.x + (mx / len) * player.speed * dt;
        const nz = player.z + (mz / len) * player.speed * dt;
        const fixed = city.resolveCircle(nx, nz, 0.6);
        player.x = fixed.x;
        player.z = fixed.z;
        player.yaw += angleDiff(player.yaw, Math.atan2(mx, mz)) * Math.min(1, dt * 12);
        player.walkPhase += dt * player.speed * 1.6;
      }
      mesh.position.set(player.x, 0, player.z);
      mesh.rotation.y = player.yaw;
      // Walk swing on the arms.
      const swing = Math.sin(player.walkPhase) * 0.5 * clamp(player.speed / 5, 0, 1);
      const armL = mesh.getObjectByName('armL');
      const armR = mesh.getObjectByName('armR');
      if (armL) armL.rotation.x = swing;
      if (armR) armR.rotation.x = -swing;
      // Slow health regen out of combat.
      if (world.timeSinceHurt > 6 && player.health < 100) {
        player.health = Math.min(100, player.health + dt * 2);
      }
    },
    enterCar(car) {
      player.inCar = car;
      car.player = true;
      mesh.visible = false;
    },
    exitCar() {
      const car = player.inCar;
      if (!car) return;
      car.player = false;
      player.inCar = null;
      // Step out to the driver's side.
      const sideX = car.x + Math.cos(car.yaw) * 2.2;
      const sideZ = car.z - Math.sin(car.yaw) * 2.2;
      const fixed = city.resolveCircle(sideX, sideZ, 0.6);
      player.x = fixed.x;
      player.z = fixed.z;
      player.yaw = car.yaw;
      player.camYaw = car.yaw;
      mesh.visible = true;
      mesh.position.set(player.x, 0, player.z);
    },
    hurt(amount, world) {
      if (player.dead) return;
      player.health -= amount;
      world.timeSinceHurt = 0;
      if (player.health <= 0) {
        player.health = 0;
        player.dead = true;
      }
    },
    heal(amount) {
      player.health = Math.min(100, player.health + amount);
    },
    buildPersonMesh,
  };
}
