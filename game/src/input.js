// Keyboard and mouse input: held keys, edge-triggered actions, and the mouse
// look delta the camera consumes each frame.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_MISSIONS = 8;
export const ACTION_HELP = 16;

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  let lookDX = 0;
  let lookDY = 0;
  let mouseDown = false;
  let mouseClicked = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function keyCode(event) {
    return event.code;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(keyCode(event));
    pressed.add(keyCode(event));
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(keyCode(event));
  });
  window.addEventListener('blur', () => {
    held.clear();
  });

  canvas.addEventListener('mousedown', (event) => {
    mouseDown = true;
    mouseClicked = true;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  window.addEventListener('mouseup', () => {
    mouseDown = false;
    dragging = false;
  });
  window.addEventListener('mousemove', (event) => {
    if (!dragging) return;
    lookDX += event.clientX - lastX;
    lookDY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    down(code) { return held.has(code); },
    // Movement axes from WASD / arrows: x is strafe, z is forward.
    move() {
      let x = 0, z = 0;
      if (held.has('KeyA') || held.has('ArrowLeft')) x -= 1;
      if (held.has('KeyD') || held.has('ArrowRight')) x += 1;
      if (held.has('KeyW') || held.has('ArrowUp')) z += 1;
      if (held.has('KeyS') || held.has('ArrowDown')) z -= 1;
      return { x, z };
    },
    run() { return held.has('ShiftLeft') || held.has('ShiftRight'); },
    brake() { return held.has('Space'); },
    mouseHeld() { return mouseDown; },
    takeMouseClick() {
      const was = mouseClicked;
      mouseClicked = false;
      return was;
    },
    takeLook() {
      const dx = lookDX, dy = lookDY;
      lookDX = 0; lookDY = 0;
      return { dx, dy };
    },
    takeActions() {
      let actions = 0;
      if (pressed.has('Enter') || pressed.has('Space')) actions |= ACTION_CONFIRM;
      if (pressed.has('KeyP') || pressed.has('Escape')) actions |= ACTION_PAUSE;
      if (pressed.has('KeyE')) actions |= ACTION_ENTER;
      if (pressed.has('KeyM')) actions |= ACTION_MISSIONS;
      if (pressed.has('KeyH')) actions |= ACTION_HELP;
      pressed.clear();
      return actions;
    },
  };
}
