// The HUD: cash, health, wanted stars, mission text, speed, weapon and a
// live top-down minimap drawn on a 2D canvas. Also toasts and the screens
// (title, pause, busted, wasted, mission list, victory).

export function createHud() {
  const cashEl = document.getElementById('cash');
  const healthFill = document.getElementById('healthfill');
  const healthText = document.getElementById('healthtext');
  const starsEl = document.getElementById('stars');
  const missionTitle = document.getElementById('mission-title');
  const missionText = document.getElementById('mission-text');
  const speedEl = document.getElementById('speed');
  const weaponEl = document.getElementById('weapon');
  const toastEl = document.getElementById('toast');
  const crosshair = document.getElementById('crosshair');
  const screenEl = document.getElementById('screen');
  const screenCard = document.getElementById('screen-card');
  const statusEl = document.getElementById('status');
  const mapCanvas = document.getElementById('minimap');
  const mapCtx = mapCanvas.getContext('2d');
  let toastTimer = null;

  function starString(wanted) {
    let out = '';
    for (let i = 0; i < 5; i++) {
      out += i < wanted
        ? '<span>★</span>'
        : '<span class="off">★</span>';
    }
    return out;
  }

  return {
    setMission(title, text) {
      missionTitle.textContent = title;
      missionText.textContent = text;
    },
    toast(message, ms) {
      toastEl.textContent = message;
      toastEl.style.display = 'block';
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toastEl.style.display = 'none'; }, ms || 2600);
    },
    announce(message) {
      statusEl.textContent = message;
    },
    showScreen(html) {
      screenCard.innerHTML = html;
      screenEl.style.display = 'flex';
    },
    hideScreen() {
      screenEl.style.display = 'none';
    },
    setCrosshair(show) {
      crosshair.style.display = show ? 'block' : 'none';
    },
    update(world) {
      const player = world.player.state;
      cashEl.textContent = `$${world.cash.toLocaleString('en-US')}`;
      const hp = Math.max(0, Math.round(player.health));
      healthFill.style.width = `${hp}%`;
      healthText.textContent = `HEALTH ${hp}`;
      starsEl.innerHTML = starString(world.police.state.wanted);
      const inCar = player.inCar;
      if (inCar) {
        speedEl.innerHTML = `${Math.round(Math.abs(inCar.speed) * 2.2)} <small>mph</small>`;
      } else {
        speedEl.innerHTML = `${Math.round(player.speed * 2.2)} <small>mph</small>`;
      }
      weaponEl.textContent = inCar ? `${inCar.name.toUpperCase()} — ${inCar.wrecked ? 'WRECKED' : 'DRIVING'}` : 'PISTOL — ∞';
      this.drawMinimap(world);
    },
    drawMinimap(world) {
      const S = 180;
      const half = 210;
      const toMap = (x, z) => [(x + half) / (half * 2) * S, (z + half) / (half * 2) * S];
      mapCtx.fillStyle = '#101828';
      mapCtx.fillRect(0, 0, S, S);
      // Sea and beach.
      mapCtx.fillStyle = '#2e7f9e';
      mapCtx.fillRect(0, toMap(0, 186)[1], S, S - toMap(0, 186)[1]);
      mapCtx.fillStyle = '#e8d29a';
      mapCtx.fillRect(0, toMap(0, 176)[1], S, 8);
      // Roads.
      mapCtx.strokeStyle = '#555a63';
      mapCtx.lineWidth = 4;
      for (const coord of [-182, -130, -78, -26, 26, 78, 130, 182]) {
        const [x1, y1] = toMap(coord, -210);
        const [x2, y2] = toMap(coord, 210);
        mapCtx.beginPath(); mapCtx.moveTo(x1, y1); mapCtx.lineTo(x2, y2); mapCtx.stroke();
        const [x3, y3] = toMap(-210, coord);
        const [x4, y4] = toMap(210, coord);
        mapCtx.beginPath(); mapCtx.moveTo(x3, y3); mapCtx.lineTo(x4, y4); mapCtx.stroke();
      }
      // Mission marker.
      const marker = world.missions.markerPos();
      if (world.missions.state.active && marker) {
        const [mx, my] = toMap(marker.x, marker.z);
        mapCtx.fillStyle = '#ffd23e';
        mapCtx.beginPath();
        mapCtx.arc(mx, my, 6, 0, Math.PI * 2);
        mapCtx.fill();
        mapCtx.strokeStyle = '#fff';
        mapCtx.lineWidth = 2;
        mapCtx.stroke();
      }
      // Police dots.
      mapCtx.fillStyle = '#5a8dff';
      for (const cop of world.police.cops) {
        const cx = cop.car ? cop.car.x : cop.x;
        const cz = cop.car ? cop.car.z : cop.z;
        const [x, y] = toMap(cx, cz);
        mapCtx.beginPath(); mapCtx.arc(x, y, 3, 0, Math.PI * 2); mapCtx.fill();
      }
      // Player arrow.
      const player = world.player.state;
      const px = player.inCar ? player.inCar.x : player.x;
      const pz = player.inCar ? player.inCar.z : player.z;
      const pyaw = player.inCar ? player.inCar.yaw : player.yaw;
      const [ax, ay] = toMap(px, pz);
      mapCtx.save();
      mapCtx.translate(ax, ay);
      mapCtx.rotate(Math.PI - pyaw);
      mapCtx.fillStyle = '#ff5a5a';
      mapCtx.beginPath();
      mapCtx.moveTo(0, -7);
      mapCtx.lineTo(5, 6);
      mapCtx.lineTo(-5, 6);
      mapCtx.closePath();
      mapCtx.fill();
      mapCtx.restore();
    },
  };
}
