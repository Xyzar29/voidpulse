// Keyboard and mouse state for the game. Other modules poll this object each
// frame; `pressed` holds the keys that went down since the last frame ended,
// which is how one-shot actions (dash, pause, confirm) read their edges.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false, rightDown: false, clicked: false, rightClicked: false };

    window.addEventListener('keydown', (event) => {
      if (!event.repeat) this.pressed.add(event.code);
      this.keys.add(event.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
      this.mouse.rightDown = false;
    });

    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = event.clientX - rect.left;
      this.mouse.y = event.clientY - rect.top;
    });
    canvas.addEventListener('mousedown', (event) => {
      if (event.button === 0) {
        this.mouse.down = true;
        this.mouse.clicked = true;
      }
      if (event.button === 2) {
        this.mouse.rightDown = true;
        this.mouse.rightClicked = true;
      }
    });
    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouse.down = false;
      if (event.button === 2) this.mouse.rightDown = false;
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  /** Movement vector from WASD or the arrow keys, normalised to length 0 or 1. */
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    if (x === 0 && y === 0) return { x: 0, y: 0 };
    const length = Math.hypot(x, y);
    return { x: x / length, y: y / length };
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  /** Called once at the end of each frame so edges fire exactly once. */
  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
    this.mouse.rightClicked = false;
  }
}
