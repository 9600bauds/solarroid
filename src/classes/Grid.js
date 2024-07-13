const isValidSpaceEntity = require('../util').isValidSpaceEntity;

class Grid {
  constructor(arg) {
    if (arg instanceof Grid) {
      let otherGrid = arg;
      this.openSpaces = otherGrid.openSpaces.map(row => [...row]); // Deep copy
      this.height = otherGrid.height;
      this.width = otherGrid.width;
    }
    else if (arg instanceof Blueprint) {
      let bp = arg;
      //First pass: Get the grid's dimensions
      let minX = Number.MAX_SAFE_INTEGER;
      let minY = Number.MAX_SAFE_INTEGER;
      let maxX = Number.MIN_SAFE_INTEGER;
      let maxY = Number.MIN_SAFE_INTEGER;
      for (const pos in bp.entityPositionGrid) {
        const entity = bp.entityPositionGrid[pos]
        if (!isValidSpaceEntity(entity)) {
          continue
        }
        //console.log("Entity", entity.name, "is valid at", pos)
        const split = pos.split(',')
        const thisX = parseInt(split[0])
        const thisY = parseInt(split[1])
        minX = Math.min(minX, thisX)
        minY = Math.min(minY, thisY)
        maxX = Math.max(maxX, thisX)
        maxY = Math.max(maxY, thisY)
      }
      this.height = Math.abs(maxY - minY) + 1
      this.width = Math.abs(maxX - minX) + 1
      this.openSpaces = Array(this.width).fill().map(() => Array(this.height).fill(false));
      //Second pass: Populate the grid
      for (const pos in bp.entityPositionGrid) {
        const entity = bp.entityPositionGrid[pos]
        if (!isValidSpaceEntity(entity)) {
          continue
        }
        //console.log("Entity", entity.name, "is valid at", pos)
        const split = pos.split(',')
        const thisX = parseInt(split[0])
        const thisY = parseInt(split[1])
        // Adjust coordinates to make bottom-left (0,0)
        const adjustedX = thisX - minX;
        const adjustedY = thisY - minY;

        // Populate the grid
        this.openSpaces[adjustedX][adjustedY] = true;
      }
    }
  }

  getKey() {
    return this.openSpaces.map(row => row.map(cell => cell ? '1' : '0').join('')).join('');
  }

  forEachCoord(callback) {
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        if (callback(x, y, this.openSpaces[x][y]) === false) { // Stop iterating if callback returns false
          return;
        }
      }
    }
  }

  forEachOpenTile(callback) {
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        if (this.isSpaceOpen(x, y)) {
          if (callback(x, y) === false) { // Stop iterating if callback returns false
            return;
          }
        }
      }
    }
  }

  findNextOpenSpace() {
    let result = null;
    this.forEachOpenTile((x, y) => {
      result = { x, y };
      return false; // Stop iterating immediately
    });
    return result;
  }

  isInBounds(x, y) {
    return (x >= 0 && y >= 0 && x < this.width && y < this.height)
  }

  isRectInBounds(x1, y1, x2, y2) {
    return this.isInBounds(x1, y1) && this.isInBounds(x2, y2);
  }

  isSpaceOpen(x, y) {
    return this.openSpaces[x][y]
  }

  isRectOpen(x1, y1, x2, y2) {
    for (let x = x1; x <= x2; x++) {
      for (let y = y1; y <= y2; y++) {
        if (!this.isInBounds(x, y) || !this.isSpaceOpen(x, y)) {
          return false;
        }
      }
    }
    return true
  }

  canPlacePiece(x, y, prototype) {
    const size = prototype.size;
    return this.isRectOpen(x, y, x + size - 1, y + size - 1);
  }

  findFirstOpenSpaceForPiece(prototype) {
    let result = null;
    this.forEachOpenTile((x, y) => {
      if (this.canPlacePiece(x, y, prototype)) {
        result = { x, y };
        return false; // Stop iterating immediately
      }
    });
    return result;
  }

  calculateOptimisticScorePerTile(piecePrototypes) {
    this.optimisticScorePerTile = Array(this.width).fill().map(() => Array(this.height).fill(0));
    this.forEachOpenTile((x, y) => {
      for (const prototype of piecePrototypes) {
        if (this.canPlacePiece(x, y, prototype)) {
          //Mark every tile that that piece could theoretically optimistically occupy with its score per tile
          for (let i = 0; i < prototype.size; i++) {
            for (let j = 0; j < prototype.size; j++) {
              const oldVal = this.optimisticScorePerTile[x + i][y + j];
              const newVal = prototype.scorePerTile;
              this.optimisticScorePerTile[x + i][y + j] = Math.max(oldVal, newVal)
            }
          }
        }
      }
    });
  }
}

module.exports = Grid;
