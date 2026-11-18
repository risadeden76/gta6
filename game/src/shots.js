// Staged scenes for the screenshots: deterministic setups that show several
// systems at once (a chase with the wanted level, the minimap and a mission
// objective on the HUD). ?shot=cover|drive|mission|street, with &seed=N.

export function stageShot(name, world) {
  const { player, vehicles, police, missions, combat, city, camera, renderer } = world;
  const p = player.state;
  let camPos = null;
  let camLook = null;

  function putPlayerInCar(car, x, z, yaw, speed) {
    car.x = x; car.z = z; car.yaw = yaw; car.speed = speed;
    car.mesh.position.set(x, 0, z);
    car.mesh.rotation.y = yaw;
    player.enterCar(car);
    p.camYaw = yaw;
  }

  function chaseCameras(count) {
    const car = p.inCar;
    for (let i = 0; i < count; i++) {
      const angle = Math.PI + (i - (count - 1) / 2) * 0.5;
      const cx = car.x + Math.sin(car.yaw + angle) * 16;
      const cz = car.z + Math.cos(car.yaw + angle) * 16;
      const copCar = vehicles.spawnPoliceCar(cx, cz);
      copCar.yaw = car.yaw;
      copCar.speed = 14;
      police.cops.push({ car: copCar, foot: false, shootTimer: 0 });
    }
  }

  if (name === 'cover') {
    // The money shot: Dana fleeing in the red Comet GT at 3 stars, two
    // interceptors behind, mission 2 in progress, sea and skyline ahead.
    const car = vehicles.marinaCar;
    putPlayerInCar(car, -40, 130, Math.PI, 16);
    police.setWanted(3);
    chaseCameras(2);
    missions.startMission(world, 1);
    world.cash = 2450;
    p.health = 82;
    camPos = [-40, 4.5, 116];
    camLook = [-40, 2, 150];
  } else if (name === 'drive') {
    // Cruising downtown at sunset with traffic all around.
    const car = vehicles.nearestCar(0, 0, 500) || vehicles.cars[0];
    putPlayerInCar(car, -52, -26, Math.PI / 2, 11);
    police.setWanted(0);
    world.cash = 1200;
    camPos = [-64, 3.5, -34];
    camLook = [-44, 1.8, -26];
  } else if (name === 'mission') {
    // On foot on the road west of the East Docks, pistol out, two shooters
    // ahead in front of the docks warehouse (the landmark face is at x 166.5,
    // so the shooters stand west of it, in the open).
    player.reset(150, 78);
    p.camYaw = Math.PI / 2;
    police.setWanted(1);
    missions.startMission(world, 2);
    combat.spawnEnemy(160, 72, 60);
    combat.spawnEnemy(162, 84, 60);
    world.cash = 3100;
    camPos = [140, 2.6, 80];
    camLook = [168, 1.5, 78];
  } else {
    // street: Dana walking a busy sidewalk at golden hour.
    player.reset(-26, 52);
    p.camYaw = Math.PI * 0.9;
    police.setWanted(0);
    world.cash = 850;
    camPos = [-31, 3, 45];
    camLook = [-20, 1.5, 60];
  }

  // Let the world settle (traffic moves, the HUD and the minimap draw), then
  // place the staged camera last so the follow camera cannot override it.
  for (let i = 0; i < 3; i++) {
    world.update(1 / 60);
  }
  camera.position.set(camPos[0], camPos[1], camPos[2]);
  camera.lookAt(camLook[0], camLook[1], camLook[2]);
  renderer.render(world.scene, camera);
  world.hud.update(world);
  window.__shotReady = true;
}
