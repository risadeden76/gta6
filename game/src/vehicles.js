// Cars: the player's ride, parked cars to steal, and traffic that follows the
// road grid. Arcade physics: accelerate, steer, brake, collide with buildings
// and each other. Police cars are cars with a light bar and a chase brain.

import * as THREE from 'three';
import { clamp, distance2D } from './rng.js';

const CAR_COLORS = [0xd23b3b, 0x3b7dd2, 0xe8c33c, 0x3bd27a, 0xd2d2d2, 0x2a2d33, 0x8a4fd2, 0xe07b2a];
const CAR_NAMES = ['Comet GT', 'Sunset Coupe', 'Bay Runner', 'Harbor Van', 'Palm Sedan', 'Turbo Hatch'];

function buildCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1d22 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd8ef });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 4.4), paint);
  body.position.y = 0.62;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 2.2), glass);
  cabin.position.set(0, 1.15, -0.2);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [x, z] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(x, 0.42, z);
    group.add(wheel);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const x of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), lightMat);
    head.position.set(x, 0.65, 2.22);
    group.add(head);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x2255ff }));
    bar.position.set(0, 1.55, -0.2);
    bar.name = 'lightbar';
    group.add(bar);
    const decal = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.3, 1.2),
      new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    decal.position.set(0, 0.62, 0.4);
    group.add(decal);
  }
  return group;
}

export function createVehicles(scene, city, rng) {
  const cars = [];
  let idCounter = 1;

  function addCar(x, z, yaw, options = {}) {
    const color = options.color ?? rng.pick(CAR_COLORS);
    const mesh = buildCarMesh(color, !!options.police);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = yaw;
    scene.add(mesh);
    const car = {
      id: idCounter++,
      mesh,
      name: options.name ?? rng.pick(CAR_NAMES),
      x, z, yaw,
      speed: 0,
      steer: 0,
      color,
      police: !!options.police,
      player: false,
      wrecked: false,
      health: 100,
      crashCooldown: 0, // seconds until the next wall impact can damage the car
      road: null,
      roadDir: 1,
      waitAtJunction: 0,
    };
    cars.push(car);
    return car;
  }

  function pickRoadFor(car) {
    const road = rng.pick(city.roads);
    const dir = rng.chance(0.5) ? 1 : -1;
    car.road = road;
    car.roadDir = dir;
    return road;
  }

  // Parked cars the player can steal, scattered along the streets.
  for (let i = 0; i < 9; i++) {
    const spot = city.randomStreetPoint();
    const off = rng.chance(0.5) ? 5.2 : -5.2;
    const px = spot.yaw === 0 || spot.yaw === Math.PI ? spot.x : spot.x + off;
    const pz = spot.yaw === 0 || spot.yaw === Math.PI ? spot.z + off : spot.z;
    addCar(px, pz, spot.yaw);
  }
  // The mission-1 prize: a bright Comet GT at the marina.
  const marinaCar = addCar(city.places.marina.x + 14, city.places.marina.z - 6, Math.PI / 2,
    { color: 0xd23b3b, name: 'Comet GT' });
  marinaCar.missionCar = true;
  // Traffic cars already driving.
  for (let i = 0; i < 12; i++) {
    const spot = city.randomStreetPoint();
    const car = addCar(spot.x, spot.z, spot.yaw);
    car.road = { axis: spot.yaw === 0 || spot.yaw === Math.PI ? 'x' : 'z', at: spot.yaw === 0 || spot.yaw === Math.PI ? spot.z : spot.x, min: -210, max: 210 };
    car.roadDir = spot.yaw === 0 || spot.yaw === -Math.PI / 2 ? 1 : -1;
    car.speed = rng.range(6, 11);
    car.traffic = true;
  }

  function driveCar(car, dt, throttle, steerInput) {
    if (car.wrecked) return;
    const maxSpeed = car.police ? 24 : 19;
    const accel = throttle > 0 ? 12 : throttle < 0 ? -9 : 0;
    car.speed += accel * dt;
    if (throttle === 0) car.speed -= car.speed * 1.2 * dt;
    if (car.speed > maxSpeed) car.speed = maxSpeed;
    if (car.speed < -8) car.speed = -8;
    car.steer = clamp(steerInput, -1, 1);
    const turnRate = car.steer * 1.9 * clamp(Math.abs(car.speed) / 8, 0, 1) * (car.speed >= 0 ? 1 : -1);
    car.yaw += turnRate * dt;
    const nx = car.x + Math.sin(car.yaw) * car.speed * dt;
    const nz = car.z + Math.cos(car.yaw) * car.speed * dt;
    const fixed = city.resolveCircle(nx, nz, 1.6);
    car.crashCooldown = Math.max(0, (car.crashCooldown ?? 0) - dt);
    if ((fixed.x !== nx || fixed.z !== nz) && Math.abs(car.speed) > 3) {
      // A wall stops the car every step, but it only damages it once per
      // crash event: without the cooldown, grinding along a wall for a
      // couple of seconds shredded a full-health car.
      car.speed *= 0.45;
      if (car.crashCooldown <= 0) {
        car.health -= 6;
        car.crashCooldown = 0.7;
      }
      if (car.health <= 0 && !car.wrecked) {
        car.wrecked = true;
        car.speed = 0;
      }
    }
    car.x = fixed.x;
    car.z = fixed.z;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.yaw;
    car.mesh.rotation.z = -car.steer * 0.06 * clamp(Math.abs(car.speed) / 10, 0, 1);
  }

  function updateTraffic(car, dt) {
    if (car.wrecked) return;
    if (!car.road) pickRoadFor(car);
    const road = car.road;
    // Follow the road's centre lane; at the end or a junction, maybe turn.
    const along = road.axis === 'x' ? car.x : car.z;
    const end = car.roadDir > 0 ? road.max - 8 : road.min + 8;
    const reachedEnd = car.roadDir > 0 ? along >= end : along <= end;
    const atJunction = ROAD_IS_JUNCTION(road, along);
    if (reachedEnd || (atJunction && car.waitAtJunction <= 0 && rng.chance(0.25))) {
      // Turn onto a crossing road.
      const cross = city.roads.filter((r) => r.axis !== road.axis
        && Math.abs((road.axis === 'x' ? r.at - along : r.at - along)) < 6);
      const next = cross.length > 0 ? rng.pick(cross) : null;
      if (next) {
        car.road = next;
        car.roadDir = rng.chance(0.5) ? 1 : -1;
        car.waitAtJunction = 1.5;
      } else if (reachedEnd) {
        car.roadDir *= -1;
      }
    }
    car.waitAtJunction = Math.max(0, car.waitAtJunction - dt);
    // Steer toward the lane centre.
    const lane = road.axis === 'x' ? road.at + 2.6 * (car.roadDir > 0 ? 1 : -1) : road.at + 2.6 * (car.roadDir > 0 ? 1 : -1);
    const targetYaw = road.axis === 'x' ? (car.roadDir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.roadDir > 0 ? 0 : Math.PI);
    // Note: forward is +z in our car model (sin/cos of yaw); adjust target.
    const desired = road.axis === 'x'
      ? (car.roadDir > 0 ? Math.PI / 2 : -Math.PI / 2)
      : (car.roadDir > 0 ? 0 : Math.PI);
    let dyaw = ((desired - car.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    const lateral = road.axis === 'x' ? lane - car.z : lane - car.x;
    // Steer back toward the lane centre: the sign flips between the road
    // axes, because turning toward +z on an x-road is the opposite yaw
    // direction from turning toward +x on a z-road.
    const laneSign = road.axis === 'x' ? -car.roadDir : car.roadDir;
    dyaw += clamp(lateral * 0.06, -0.4, 0.4) * laneSign;
    car.yaw += clamp(dyaw, -1.4 * dt, 1.4 * dt);
    car.speed += (9 - car.speed) * dt * 0.8;
    const nx = car.x + Math.sin(car.yaw) * car.speed * dt;
    const nz = car.z + Math.cos(car.yaw) * car.speed * dt;
    const fixed = city.resolveCircle(nx, nz, 1.6);
    if (fixed.x !== nx || fixed.z !== nz) {
      car.roadDir *= -1;
      car.yaw += Math.PI;
    }
    car.x = fixed.x;
    car.z = fixed.z;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.yaw;
    void targetYaw;
  }

  function ROAD_IS_JUNCTION(road, along) {
    for (const coord of [-182, -130, -78, -26, 26, 78, 130, 182]) {
      if (Math.abs(along - coord) < 4) return true;
    }
    return false;
  }

  function nearestCar(x, z, maxDist, filter) {
    let best = null;
    let bestD = maxDist;
    for (const car of cars) {
      if (filter && !filter(car)) continue;
      const d = distance2D(x, z, car.x, car.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  return {
    cars,
    addCar,
    marinaCar,
    driveCar,
    nearestCar,
    spawnPoliceCar(x, z) {
      const car = addCar(x, z, 0, { police: true, color: 0x1a2a44, name: 'Interceptor' });
      car.police = true;
      return car;
    },
    removeCar(car) {
      scene.remove(car.mesh);
      const i = cars.indexOf(car);
      if (i >= 0) cars.splice(i, 1);
    },
    update(dt, world) {
      for (const car of cars) {
        if (car.player) continue; // driven by the player module
        if (car.traffic) updateTraffic(car, dt);
        // Police cars are steered by the police module.
      }
      // Gentle car-car separation so traffic does not stack.
      for (let i = 0; i < cars.length; i++) {
        for (let j = i + 1; j < cars.length; j++) {
          const a = cars[i], b = cars[j];
          const d = distance2D(a.x, a.z, b.x, b.z);
          if (d > 0.01 && d < 3.4) {
            const push = (3.4 - d) / 2;
            const dx = (a.x - b.x) / d, dz = (a.z - b.z) / d;
            a.x += dx * push; a.z += dz * push;
            b.x -= dx * push; b.z -= dz * push;
            a.mesh.position.set(a.x, 0, a.z);
            b.mesh.position.set(b.x, 0, b.z);
            if (a.player || b.player) {
              if (world && world.onCarBump) world.onCarBump();
            }
          }
        }
      }
    },
  };
}
