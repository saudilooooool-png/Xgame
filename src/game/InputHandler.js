export class InputHandler {
  constructor() {
    this.keys = new Set();
    this._onKeyDown = e => this.keys.add(e.code);
    this._onKeyUp   = e => this.keys.delete(e.code);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup',   this._onKeyUp);
  }

  get left()  { return this.keys.has('ArrowLeft')  || this.keys.has('KeyA'); }
  get right() { return this.keys.has('ArrowRight') || this.keys.has('KeyD'); }
  get shoot() { return this.keys.has('Space') || this.keys.has('ArrowUp') || this.keys.has('KeyW'); }
  get pause() { return this.keys.has('Escape') || this.keys.has('KeyP'); }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup',   this._onKeyUp);
  }
}
