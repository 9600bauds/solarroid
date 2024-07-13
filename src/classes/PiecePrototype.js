class PiecePrototype {
  constructor(size, scorePerTile, name, fillColor, borderColor) {
    this.size = size;
    this.name = name;
    this.scorePerTile = scorePerTile;
    this.score = scorePerTile * size * size;
    this.area = size * size;
    this.fillColor = fillColor;
    this.borderColor = borderColor;
  }

  toString() {
    return `${this.name}, pertile ${this.scorePerTile.toFixed(2)}`;
  }
}

module.exports = PiecePrototype;
