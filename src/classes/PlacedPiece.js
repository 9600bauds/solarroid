class PlacedPiece {
  constructor(x, y, prototype) {
    this.x = x;
    this.y = y;
    this.prototype = prototype;
    this.centerX = this.x + this.prototype.size / 2;
    this.centerY = this.y + this.prototype.size / 2;
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

  distanceTo(piece2) {
    const dx = this.centerX - piece2.centerX;
    const dy = this.centerY - piece2.centerY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  isSuppliedBy(otherPiece) {
    let otherRange = otherPiece.prototype.supplyAreaRange / 2;
    let x1 = otherPiece.centerX - otherRange;
    let y1 = otherPiece.centerY - otherRange;
    let x2 = otherPiece.centerX + otherRange;
    let y2 = otherPiece.centerY + otherRange;
    return this.intersectsRectangle(x1, y1, x2, y2)
  }

  connectsTo(otherPiece) {
    let range = Math.min(this.prototype.connectRange, otherPiece.prototype.connectRange);
    return this.distanceTo(otherPiece) <= range;
  }
}

module.exports = PlacedPiece;
