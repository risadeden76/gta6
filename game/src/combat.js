// Combat: Dana's pistol, rival shooters, health and cash pickups. Shooting
// is a hitscan ray against simple sphere targets; tracers are thin lines
// that fade in a frame.

import * as THREE from 'three';
import { distance2D } from './rng.js';

export function createCombat(scene, city, effects, audio, rng) {
  const enemies = [];
  const pickups = [];
  const tracers = [];
  const playerBody = { radius: 0.6 };
  let worldRef = null;

  function spawnEnemy(x, z, health) {
    const mesh = new THREE.Group();
    const gang = new THREE.MeshLambertMaterial({ color: 0x3a5a2a });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.34), gang);
    torso.position.y = 1.15;
    mesh.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.38, 0.36), skin);
    head.position.y = 1.7;
    mesh.add(head);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), gang);
    legs.position.y = 0.4;
    mesh.add(legs);
    // A red health bar floating over the head.
    const barBack = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.12),
      new THREE.MeshBasicMaterial({ color: 0x222222, side: THREE.DoubleSide }));
    barBack.position.y = 2.15;
    mesh.add(barBack);
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xff4444, side: THREE.DoubleSide }));
    bar.position.set(0, 2.15, 0.01);
    bar.name = 'healthbar';
    mesh.add(bar);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const enemy = { mesh, bar, x, z, health: health || 60, maxHealth: health || 60, shootTimer: rng.range(0.8, 1.8), alive: true };
    enemies.push(enemy);
    return enemy;
  }

  function spawnPickup(x, z, kind) {
    const color = kind === 'health' ? 0x44ff88 : 0xffd23e;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7),
      new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.5 }));
    mesh.position.set(x, 0.8, z);
    mesh.rotation.y = Math.PI / 4;
    scene.add(mesh);
    pickups.push({ mesh, x, z, kind, bob: rng.range(0, Math.PI * 2) });
  }

  function shoot(fromX, fromY, fromZ, dirX, dirY, dirZ, range, damage, shooter) {
    // Ray against enemies, the player, and police cars (rough sphere test).
    const origin = new THREE.Vector3(fromX, fromY, fromZ);
    const dir = new THREE.Vector3(dirX, dirY, dirZ).normalize();
    let bestT = range;
    let hit = null;
    function testSphere(cx, cy, cz, radius, target) {
      const ox = cx - origin.x, oy = cy - origin.y, oz = cz - origin.z;
      const t = ox * dir.x + oy * dir.y + oz * dir.z;
      if (t < 0 || t > bestT) return;
      const dx = ox - dir.x * t, dy = oy - dir.y * t, dz = oz - dir.z * t;
      if (dx * dx + dy * dy + dz * dz < radius * radius) {
        bestT = t;
        hit = target;
      }
    }
    for (const e of enemies) {
      if (!e.alive) continue;
      testSphere(e.x, 1.2, e.z, 0.9, { type: 'enemy', ref: e });
    }
    if (shooter !== 'player' && worldRef) {
      const p = worldRef.player.state;
      if (!p.dead && !p.inCar) testSphere(p.x, 1.2, p.z, playerBody.radius, { type: 'player' });
    }
    const end = origin.clone().addScaledVector(dir, bestT);
    const tracerGeo = new THREE.BufferGeometry().setFromPoints([origin, end]);
    const tracer = new THREE.Line(tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    scene.add(tracer);
    tracers.push({ line: tracer, age: 0 });
    effects.muzzle(fromX, fromY, fromZ);
    audio.shot();
    if (hit) {
      if (hit.type === 'enemy') {
        hit.ref.health -= damage;
        effects.sparks(end.x, end.y, end.z);
        hit.ref.bar.scale.x = Math.max(0.01, hit.ref.health / hit.ref.maxHealth);
        if (hit.ref.health <= 0) {
          hit.ref.alive = false;
          scene.remove(hit.ref.mesh);
          effects.explosion(hit.ref.x, 1, hit.ref.z);
        }
      } else if (hit.type === 'player') {
        if (worldRef) worldRef.player.hurt(damage, worldRef);
      }
    }
    return hit;
  }

  function copShot(fromX, fromY, fromZ, toX, toY, toZ) {
    const dx = toX - fromX, dy = toY - fromY, dz = toZ - fromZ;
    const len = Math.hypot(dx, dy, dz) || 1;
    // Cops are bad shots: 45% of their rounds miss wide.
    const spread = rng.chance(0.45) ? 0.35 : 0.03;
    shoot(fromX, fromY, fromZ,
      dx / len + (Math.random() - 0.5) * spread,
      dy / len + (Math.random() - 0.5) * spread,
      dz / len + (Math.random() - 0.5) * spread,
      60, 8, 'cop');
  }

  return {
    enemies,
    pickups,
    setWorld(world) { worldRef = world; },
    spawnEnemy,
    spawnPickup,
    shoot,
    copShot,
    clearEnemies() {
      for (const e of enemies) scene.remove(e.mesh);
      enemies.length = 0;
    },
    update(dt, world) {
      // Tracers fade fast.
      for (let i = tracers.length - 1; i >= 0; i--) {
        const t = tracers[i];
        t.age += dt;
        if (t.age > 0.09) {
          scene.remove(t.line);
          t.line.geometry.dispose();
          t.line.material.dispose();
          tracers.splice(i, 1);
        }
      }
      // Pickups bob and spin; walking over one collects it.
      const p = world.player.state;
      const px = p.inCar ? p.inCar.x : p.x;
      const pz = p.inCar ? p.inCar.z : p.z;
      for (let i = pickups.length - 1; i >= 0; i--) {
        const pk = pickups[i];
        pk.bob += dt * 2;
        pk.mesh.position.y = 0.8 + Math.sin(pk.bob) * 0.15;
        pk.mesh.rotation.y += dt * 1.5;
        if (distance2D(px, pz, pk.x, pk.z) < 1.6) {
          if (pk.kind === 'health') {
            world.player.heal(40);
            world.hud.toast('HEALTH +40');
          } else {
            world.cash += 150;
            world.hud.toast('CASH +$150');
            audio.cash();
          }
          audio.pickup();
          scene.remove(pk.mesh);
          pickups.splice(i, 1);
        }
      }
      // Enemies shoot back at the player when close.
      for (const e of enemies) {
        if (!e.alive || p.dead) continue;
        const dist = distance2D(p.x, p.z, e.x, e.z);
        if (dist < 30) {
          e.shootTimer -= dt;
          if (e.shootTimer <= 0) {
            e.shootTimer = rng.range(1.0, 1.9);
            const dx = p.x - e.x, dz = p.z - e.z;
            const len = Math.hypot(dx, dz) || 1;
            shoot(e.x, 1.5, e.z, dx / len, 0, dz / len, 40, 6, 'enemy');
          }
          e.mesh.lookAt(p.x, 0, p.z);
        }
      }
    },
  };
}
