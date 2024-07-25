const { clearCanvas } = require('../utils');
const Grid = require('./Grid');
const PlacedPiece = require('./PlacedPiece');

class Branch {
  constructor(grid, startingGrid, piecesPlaced) {
    this.grid = new Grid(grid);
    this.startingGrid = startingGrid;
    this.piecesPlaced = new Set(piecesPlaced);
  }

  placePiece(x, y, prototype) {
    const size = prototype.size;
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        this.grid.openSpaces[x + i][y + j] = false; // Mark the grid as filled
      }
    }
    let newPlacedPiece = new PlacedPiece(x, y, prototype);
    this.piecesPlaced.add(newPlacedPiece);
  }

  removePiece(placedPiece) {
    const x = placedPiece.x;
    const y = placedPiece.y;
    const size = placedPiece.prototype.size;
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        this.grid.openSpaces[x + i][y + j] = true; // Mark the grid as open
      }
    }
    this.piecesPlaced.delete(placedPiece);
  }

  removePiecesInRect(x1, y1, x2, y2) {
    for (const piece of this.piecesPlaced) {
      if (piece.intersectsRectangle(x1, y1, x2, y2)) {
        this.removePiece(piece);
      }
    }
  }

  removePiecesSmallerThan(size) {
    for (const piece of this.piecesPlaced) {
      if (piece.prototype.size < size) {
        this.removePiece(piece);
      }
    }
  }

  getIntersectingPiece(x, y) {
    if (!this.grid.isInBounds(x, y)) {
      return null
    }
    for (const piece of this.piecesPlaced) {
      if (piece.intersectsPoint(x, y)) {
        return piece;
      }
    }
    return null;
  }

  toString() {
    let out = "";
    const lastYIndex = this.grid.height - 1;
    const lastXIndex = this.grid.width - 1;
    for (let curY = 0; curY <= lastYIndex; curY++) {
      for (let curX = 0; curX <= lastXIndex; curX++) {
        let intersectingPiece = this.getIntersectingPiece(curX, curY)
        if (intersectingPiece) {
          out += intersectingPiece.prototype.size.toString()
        }
        else if (this.grid.isSpaceOpen(curX, curY)) {
          out += "#";
        } else {
          out += "_";
        }
      }
      out += "\n";
    }
    return out;
  }

  toBlueprint() {
    let newBp = new Blueprint();
    for (const piecePlaced of this.piecesPlaced) {
      let prototype = piecePlaced.prototype;
      newBp.createEntity(prototype.name, { x: piecePlaced.x, y: piecePlaced.y });
    }
    return newBp;
  }

  updateScore() {
    const piecesArray = Array.from(this.piecesPlaced);

    let baseScore = piecesArray.reduce((sum, piece) => sum + piece.prototype.score, 0);

    const powerPoleSet = new Set(piecesArray.filter(piece => piece.prototype.isPowerPole()));
    for (const piece of this.piecesPlaced) {
      if (!this.isPieceSupplied(piece, powerPoleSet)) {
        baseScore -= piece.prototype.score;
      }
    }

    /*let starterPole = null;
    for (const piece of powerPoleSet) {
      starterPole = piece;
      break;
    }
    if (starterPole) {
      let electricNetwork = new Set();
      const recursiveElectricNetworkFind = (piece, electricNetwork, powerPoleSet) => {
        for (const thisPole of powerPoleSet) {
          if (!electricNetwork.has(thisPole) && piece.connectsTo(thisPole)) {
            electricNetwork.add(thisPole);
            recursiveElectricNetworkFind(thisPole, electricNetwork, powerPoleSet);
          }
        }
      };

      electricNetwork.add(starterPole);
      recursiveElectricNetworkFind(starterPole, electricNetwork, powerPoleSet);

      for (const piece of this.piecesPlaced) {
        if (piece.prototype.isPowerPole() && !electricNetwork.has(piece)) {
          baseScore /= 2;
          console.log(this.toBlueprint().encode())
          debugger
        }
      }

    }*/

    this.score = baseScore;
    return this.score;
  }

  isPieceSupplied(piece, powerPoleSet) {
    if (piece.prototype.isPowerPole()) {
      return true
    }
    let isSupplied = false;
    for (const otherPiece of powerPoleSet) {
      if (piece.isSuppliedBy(otherPiece)) {
        isSupplied = true;
        break;
      }
    }
    return isSupplied;
  }

  greedyAutoComplete(piecePrototypes) {
    for (let prototype of piecePrototypes) {
      this.grid.forEachOpenTile((x, y) => {
        if (this.grid.canPlacePiece(x, y, prototype)) {
          this.placePiece(x, y, prototype);
        }
      });
    }
  }

  makeSmallChange(allPiecePrototypes) {
    // Remove all pieces smaller than size 3
    this.removePiecesSmallerThan(3);

    // Pick a random piece to move
    const pieceToMove = Array.from(this.piecesPlaced)[Math.floor(Math.random() * this.piecesPlaced.size)];

    // Randomly choose a new position
    const maxDeviation = 2;
    const newX = pieceToMove.x + Math.floor(Math.random() * (2 * maxDeviation + 1)) - maxDeviation;
    const newY = pieceToMove.y + Math.floor(Math.random() * (2 * maxDeviation + 1)) - maxDeviation;
    // Remove all pieces that would intersect the new position
    const size = pieceToMove.prototype.size;
    this.removePiecesInRect(newX, newY, newX + size, newY + size);

    // Place the piece in the new location if possible
    if (this.grid.canPlacePiece(newX, newY, pieceToMove.prototype)) {
      this.placePiece(newX, newY, pieceToMove.prototype);
    }

    this.greedyAutoComplete(allPiecePrototypes);
  }

  clone() {
    let clone = new Branch(this.grid, this.startingGrid, this.piecesPlaced);
    clone.score = this.score;
    return clone;
  }
}

module.exports = Branch;
