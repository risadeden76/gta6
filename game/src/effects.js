// Cheap particle bursts (smoke, sparks, dust) with one shared Points cloud
// per burst, plus a muzzle flash light. No textures, no files.

import * as THREE from 'three';

export function createEffects(scene) {
  const bursts = [];
  const flash = new THREE.PointLight(0xffcc66, 0, 30, 1.6);
  scene.add(flash);

  function burst(x, y, z, color, count, speed, life, size, gravity) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 0.9 + 0.1;
      const s = speed * (0.4 + Math.random() * 0.8);
      velocities.push([Math.cos(a) * s, up * s, Math.sin(a) * s]);
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color, size, transparent: true, opacity: 0.95, depthWrite: false,
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);
    bursts.push({ points, velocities, life, age: 0, gravity: gravity ?? 6 });
  }

  return {
    smoke(x, y, z) { burst(x, y, z, 0x9aa0aa, 14, 2.5, 0.9, 0.7, -0.5); },
    sparks(x, y, z) { burst(x, y, z, 0xffc266, 18, 7, 0.5, 0.35, 12); },
    dust(x, y, z) { burst(x, y, z, 0xc9b18a, 10, 1.8, 0.7, 0.9, 0.5); },
    explosion(x, y, z) {
      burst(x, y, z, 0xff7722, 30, 9, 0.8, 0.9, 4);
      burst(x, y, z, 0x333333, 20, 4, 1.4, 1.4, -1);
      flash.position.set(x, y + 2, z);
      flash.intensity = 60;
    },
    muzzle(x, y, z) {
      flash.position.set(x, y, z);
      flash.intensity = 26;
    },
    update(dt) {
      flash.intensity = Math.max(0, flash.intensity - dt * 160);
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i];
        b.age += dt;
        if (b.age >= b.life) {
          scene.remove(b.points);
          b.points.geometry.dispose();
          b.points.material.dispose();
          bursts.splice(i, 1);
          continue;
        }
        const pos = b.points.geometry.attributes.position;
        for (let j = 0; j < b.velocities.length; j++) {
          const v = b.velocities[j];
          v[1] -= b.gravity * dt;
          pos.array[j * 3] += v[0] * dt;
          pos.array[j * 3 + 1] += v[1] * dt;
          pos.array[j * 3 + 2] += v[2] * dt;
        }
        pos.needsUpdate = true;
        b.points.material.opacity = 0.95 * (1 - b.age / b.life);
      }
    },
  };
}
