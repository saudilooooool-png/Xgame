export class Canvas {
  constructor(containerId) {
    this.el = document.createElement('canvas');
    this.ctx = this.el.getContext('2d');
    document.getElementById(containerId).appendChild(this.el);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.el.width = window.innerWidth;
    this.el.height = window.innerHeight;
    this.width = this.el.width;
    this.height = this.el.height;
  }

  clear() {
    this.ctx.fillStyle = '#010d06';
    this.ctx.fillRect(0, 0, this.width, this.height);
  }
}
