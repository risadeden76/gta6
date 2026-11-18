// Marlowe Bay: a sun-soaked coastal city built procedurally from a seed.
// Roads on a grid, buildings with lit windows, palms, lamps, a beach and a
// sea to the south. Also owns the collision boxes and the road network the
// traffic drives on.

import * as THREE from 'three';
import { clamp } from './rng.js';

export const CITY_HALF = 210;
export const BEACH_Z = 186;

const ROAD_COORDS = [-182, -130, -78, -26, 26, 78, 130, 182];
const ROAD_WIDTH = 12;

function makeWindowTexture(rng, base, lit) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 6; col++) {
      const x = 10 + col * 19;
      const y = 10 + row * 20;
      g.fillStyle = rng.chance(0.42) ? lit : '#20242e';
      g.fillRect(x, y, 12, 12);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeRoadTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const g = canvas.getContext('2d');
  g.fillStyle = '#26292f';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#e8d44f';
  g.fillRect(30, 4, 4, 24);
  g.fillStyle = '#3a3d44';
  g.fillRect(0, 0, 64, 3);
  g.fillRect(0, 61, 64, 3);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createCity(scene, rng) {
  const colliders = [];
  const roads = [];
  const group = new THREE.Group();
  scene.add(group);

  // Sun, sky and fog: late afternoon over the bay.
  const sun = new THREE.DirectionalLight(0xffdfb0, 2.4);
  sun.position.set(120, 180, 60);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xffe0b3, 0x5a4632, 1.1));
  scene.background = new THREE.Color(0xf2b879);
  scene.fog = new THREE.Fog(0xf2b879, 180, 520);

  // Ground: grass-green city floor, sand beach, and the sea beyond.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2, CITY_HALF * 2 + 90),
    new THREE.MeshLambertMaterial({ color: 0x4a6b46 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 40);
  ground.receiveShadow = true;
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2, 30),
    new THREE.MeshLambertMaterial({ color: 0xe8d29a }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0, BEACH_Z + 12);
  group.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2, 130),
    new THREE.MeshLambertMaterial({ color: 0x2e7f9e, transparent: true, opacity: 0.96 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.4, 285);
  group.add(sea);
  const seaShine = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2, 130),
    new THREE.MeshBasicMaterial({ color: 0x9fd8ef, transparent: true, opacity: 0.18 }),
  );
  seaShine.rotation.x = -Math.PI / 2;
  seaShine.position.set(0, -0.2, 285);
  group.add(seaShine);

  // Roads: long strips with a dashed centre line, plus the road list traffic uses.
  const roadTexture = makeRoadTexture();
  for (const at of ROAD_COORDS) {
    const hTex = roadTexture.clone();
    hTex.needsUpdate = true;
    hTex.repeat.set(28, 1);
    const hRoad = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY_HALF * 2, ROAD_WIDTH),
      new THREE.MeshLambertMaterial({ map: hTex }),
    );
    hRoad.rotation.x = -Math.PI / 2;
    hRoad.position.set(0, 0.02, at);
    group.add(hRoad);
    const vTex = roadTexture.clone();
    vTex.needsUpdate = true;
    vTex.repeat.set(28, 1);
    const vRoad = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY_HALF * 2, ROAD_WIDTH),
      new THREE.MeshLambertMaterial({ map: vTex }),
    );
    vRoad.rotation.x = -Math.PI / 2;
    vRoad.rotation.z = Math.PI / 2;
    vRoad.position.set(at, 0.02, 0);
    group.add(vRoad);
    roads.push({ axis: 'x', at, min: -CITY_HALF, max: CITY_HALF });
    roads.push({ axis: 'z', at, min: -CITY_HALF, max: CITY_HALF });
  }

  // Named places for the missions.
  const places = {
    garage: { x: -26, z: 26, name: "Sal's Garage" },
    marina: { x: 78, z: 178, name: 'Marina' },
    bank: { x: 26, z: -26, name: 'Marlowe Trust Bank' },
    docks: { x: 182, z: 78, name: 'East Docks' },
    hideout: { x: -156, z: -156, name: 'Hideout' },
    park: { x: -78, z: -78, name: 'Palm Park' },
  };

  // Buildings: one or two per block, taller near the centre.
  const facadeTextures = [
    makeWindowTexture(rng, '#7a6a8a', '#ffd98a'),
    makeWindowTexture(rng, '#8a6a5a', '#ffe9a8'),
    makeWindowTexture(rng, '#5a6a7a', '#ffd98a'),
    makeWindowTexture(rng, '#a08a5a', '#fff0b8'),
  ];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofGeo = new THREE.BoxGeometry(1, 0.6, 1);
  const blockCenters = [];
  for (let i = 0; i < ROAD_COORDS.length - 1; i++) {
    for (let j = 0; j < ROAD_COORDS.length - 1; j++) {
      blockCenters.push({
        x: (ROAD_COORDS[i] + ROAD_COORDS[i + 1]) / 2,
        z: (ROAD_COORDS[j] + ROAD_COORDS[j + 1]) / 2,
      });
    }
  }
  const special = [places.garage, places.marina, places.bank, places.docks, places.hideout, places.park];
  function isSpecial(cx, cz) {
    return special.some((p) => Math.abs(p.x - cx) < 30 && Math.abs(p.z - cz) < 30);
  }
  for (const block of blockCenters) {
    if (isSpecial(block.x, block.z)) continue;
    // Sidewalk slab under the block.
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(38, 0.3, 38),
      new THREE.MeshLambertMaterial({ color: 0x8a8d90 }),
    );
    slab.position.set(block.x, 0.1, block.z);
    group.add(slab);
    const count = rng.chance(0.55) ? 1 : 2;
    for (let k = 0; k < count; k++) {
      const w = rng.range(12, 18);
      const d = rng.range(12, 18);
      const dist = Math.sqrt(block.x * block.x + block.z * block.z);
      const h = rng.range(9, 14) + Math.max(0, 30 - dist * 0.09) * rng.range(0.4, 1);
      const ox = count === 1 ? 0 : (k === 0 ? -9 : 9);
      const oz = count === 1 ? 0 : (k === 0 ? -9 : 9);
      const tex = rng.pick(facadeTextures);
      const mat = new THREE.MeshLambertMaterial({ map: tex });
      const building = new THREE.Mesh(boxGeo, mat);
      building.scale.set(w, h, d);
      building.position.set(block.x + ox, h / 2, block.z + oz);
      group.add(building);
      const roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: 0x3a3d44 }));
      roof.scale.set(w + 1, 1, d + 1);
      roof.position.set(block.x + ox, h + 0.3, block.z + oz);
      group.add(roof);
      colliders.push({
        minX: block.x + ox - w / 2 - 0.5,
        maxX: block.x + ox + w / 2 + 0.5,
        minZ: block.z + oz - d / 2 - 0.5,
        maxZ: block.z + oz + d / 2 + 0.5,
      });
    }
  }

  // Landmark buildings at the named places.
  function landmark(place, w, h, d, color, label) {
    const mat = new THREE.MeshLambertMaterial({ map: rng.pick(facadeTextures), color });
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.scale.set(w, h, d);
    mesh.position.set(place.x, h / 2, place.z);
    group.add(mesh);
    colliders.push({
      minX: place.x - w / 2 - 0.5, maxX: place.x + w / 2 + 0.5,
      minZ: place.z - d / 2 - 0.5, maxZ: place.z + d / 2 + 0.5,
    });
    // A glowing sign board with the place name, readable in screenshots.
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const g = canvas.getContext('2d');
    g.fillStyle = '#101828';
    g.fillRect(0, 0, 512, 96);
    g.fillStyle = '#ffd23e';
    g.font = 'bold 52px Verdana';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(label.toUpperCase(), 256, 50);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(30, w), 5.5),
      new THREE.MeshBasicMaterial({ map: tex }),
    );
    sign.position.set(place.x, h + 3.2, place.z + d / 2 + 0.4);
    group.add(sign);
    return mesh;
  }
  landmark(places.garage, 26, 10, 20, 0xdddddd, "SAL'S GARAGE");
  landmark(places.bank, 24, 26, 20, 0xffffff, 'MARLOWE TRUST BANK');
  landmark(places.docks, 30, 12, 18, 0xbbbbbb, 'EAST DOCKS');
  landmark(places.hideout, 20, 9, 16, 0xcccccc, 'HIDEOUT');

  // Palm trees along the beach and in the park.
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 7, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const leafGeo = new THREE.ConeGeometry(2.6, 1.2, 5);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  function palm(x, z) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 3.5, z);
    group.add(trunk);
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      const a = (i / 5) * Math.PI * 2;
      leaf.position.set(x + Math.cos(a) * 1.6, 7.2, z + Math.sin(a) * 1.6);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      group.add(leaf);
    }
  }
  for (let x = -190; x <= 190; x += 26) palm(x + rng.range(-4, 4), BEACH_Z - 4);
  for (let i = 0; i < 10; i++) palm(places.park.x + rng.range(-16, 16), places.park.z + rng.range(-16, 16));
  for (let i = 0; i < 14; i++) {
    const road = rng.pick(roads);
    const along = rng.range(-180, 180);
    palm(road.axis === 'x' ? along : road.at + (rng.chance(0.5) ? 8 : -8),
      road.axis === 'x' ? road.at + (rng.chance(0.5) ? 8 : -8) : along);
  }

  // Street lamps along the roads (emissive heads only, no extra lights).
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 6, 5);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
  const headGeo = new THREE.SphereGeometry(0.5, 8, 6);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const road of roads) {
    for (let along = -170; along <= 170; along += 52) {
      const x = road.axis === 'x' ? along : road.at + 7;
      const z = road.axis === 'x' ? road.at + 7 : along;
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x, 3, z);
      group.add(pole);
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(x, 6.2, z);
      group.add(head);
    }
  }

  function resolveCircle(x, z, radius) {
    // Push a circle out of every building box, then clamp to the city.
    for (const c of colliders) {
      const cx = clamp(x, c.minX, c.maxX);
      const cz = clamp(z, c.minZ, c.maxZ);
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          x = cx + (dx / d) * radius;
          z = cz + (dz / d) * radius;
        } else {
          // Dead centre: push out along the smallest penetration.
          const pl = x - c.minX, pr = c.maxX - x, pt = z - c.minZ, pb = c.maxZ - z;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = c.minX - radius;
          else if (m === pr) x = c.maxX + radius;
          else if (m === pt) z = c.minZ - radius;
          else z = c.maxZ + radius;
        }
      }
    }
    x = clamp(x, -CITY_HALF + 2, CITY_HALF - 2);
    z = clamp(z, -CITY_HALF + 2, BEACH_Z + 16);
    return { x, z };
  }

  function randomStreetPoint() {
    const road = rng.pick(roads);
    const along = rng.range(-185, 185);
    const lane = rng.chance(0.5) ? 2.6 : -2.6;
    return road.axis === 'x'
      ? { x: along, z: road.at + lane, yaw: lane > 0 ? 0 : Math.PI }
      : { x: road.at + lane, z: along, yaw: lane > 0 ? -Math.PI / 2 : Math.PI / 2 };
  }

  return {
    group,
    colliders,
    roads,
    places,
    resolveCircle,
    randomStreetPoint,
    update(_dt, t) {
      sea.position.y = -0.4 + Math.sin(t * 0.5) * 0.15;
    },
  };
}
