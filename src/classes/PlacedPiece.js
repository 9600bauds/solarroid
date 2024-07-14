class PlacedPiece {
  constructor(x, y, prototype) {
    this.x = x;
    this.y = y;
    this.prototype = prototype;
  }

  toString() {
    return `@${this.x}-${this.y} ${this.prototype.name}`;
  }

  intersectsPoint(x, y) {
    const size = this.prototype.size;
    return (x >= this.x && x < this.x + size &&
      y >= this.y && y < this.y + size);
  }

  intersectsRectangle(x1, y1, x2, y2) {
    const size = this.prototype.size;
    return !(this.x + size <= x1 || this.x >= x2 ||
      this.y + size <= y1 || this.y >= y2);
  }

  getCorners() {
    const size = this.prototype.size;
    return [
      { x: this.x, y: this.y },
      { x: this.x + size, y: this.y },
      { x: this.x, y: this.y + size },
      { x: this.x + size, y: this.y + size }
    ];
  }
}

module.exports = PlacedPiece;
