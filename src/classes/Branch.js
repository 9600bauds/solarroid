const Grid = require('./Grid');
const PlacedPiece = require('./PlacedPiece');

class Branch {
  constructor(grid, startingGrid, piecesPlaced) {
    this.grid = new Grid(grid);
    this.startingGrid = startingGrid;
    this.piecesPlaced = piecesPlaced.slice(); // Shallow copy
    this.score = this.getScore()
  }

  wouldThisPieceBeMoreOptimal(x, y, prototype) {
    const size = prototype.size;

    let x2 = x + size;
    let y2 = y + size;
    let thisArea = 0;
    let thisScore = 0;
    let thesePieces = [];
    for (const piece of this.piecesPlaced) {
      if (!piece.intersectsRectangle(x, y, x2, y2)) {
        continue
      }
      if (!piece.isFullyContainedByRectangle(x, y, x2, y2)) {
        return false; //We are bisecting a piece!
      }
      else {
        thesePieces.push(piece)
        thisScore += piece.prototype.score;
        thisArea += piece.prototype.area;
      }
    }
    if (thisArea < prototype.area) {
      return false; //This area was not 100% full of pieces
    }
    if (prototype.score > thisScore) {
      //this.placePiece(x, y, prototype)
      //console.log(this.toString(), this, x, y, prototype.name, "would be better")
      //debugger
      return true;
    }
    return false;
  }

  placePiece(x, y, prototype) {
    const size = prototype.size;
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        this.grid.openSpaces[x + i][y + j] = false; // Mark the grid as filled
      }
    }
    let newPlacedPiece = new PlacedPiece(x, y, prototype);
    this.piecesPlaced.push(newPlacedPiece);
    this.score += prototype.score;
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
    // Remove the piece from piecesPlaced
    // Yes this is how you have to do it in javascript because javascript is just like that
    this.piecesPlaced = this.piecesPlaced.filter(
      piece => piece !== placedPiece
    );
    this.score -= placedPiece.prototype.score;
  }

  removePiecesInRect(x1, y1, x2, y2) {
    const piecesToRemove = []; //intermediary because we can't iterate through the array while modifying it

    for (const piece of this.piecesPlaced) {
      if (piece.intersectsRectangle(x1, y1, x2, y2)) {
        piecesToRemove.push(piece);
      }
    }

    for (const piece of piecesToRemove) {
      this.removePiece(piece);
    }
  }

  removePiecesSmallerThan(size) {
    const piecesToRemove = []; //intermediary because we can't iterate through the array while modifying it

    for (const piece of this.piecesPlaced) {
      if (piece.prototype.size < size) {
        piecesToRemove.push(piece);
      }
    }

    for (const piece of piecesToRemove) {
      this.removePiece(piece);
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
        else if (this.grid.openSpaces[curX][curY]) {
          out += "#";
        } else {
          out += "_";
        }
      }
      out += "\n";
    }
    return out;
  }

  display(elemId) {
    const pixelsPerUnit = 20;
    const borderSize = 2;

    const canvas = document.getElementById(elemId);
    const ctx = canvas.getContext('2d');

    //Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0)

    // Scale the canvas
    let maxX = this.startingGrid.width;
    let maxY = this.startingGrid.height;
    const logicalWidth = maxX * pixelsPerUnit;
    const logicalHeight = maxY * pixelsPerUnit;
    const scaleX = canvas.width / logicalWidth;
    const scaleY = canvas.height / logicalHeight;
    const scale = Math.min(scaleX, scaleY);
    ctx.scale(scale, scale);

    // Draw the 2D grid
    ctx.lineWidth = 1 / scale; // Grid line width
    ctx.strokeStyle = 'black'; // Grid line color

    for (let i = 0; i < this.startingGrid.width; i++) {
      for (let j = 0; j < this.startingGrid.height; j++) {
        const x = i * pixelsPerUnit;
        const y = j * pixelsPerUnit;

        if (this.startingGrid.openSpaces[i][j]) {
          ctx.strokeRect(x, y, pixelsPerUnit, pixelsPerUnit); // Draw the grid cell
        }
      }
    }

    //Actually draw the thing
    this.piecesPlaced.forEach(piece => {
      const size = piece.prototype.size * pixelsPerUnit;
      const x = piece.x * pixelsPerUnit;
      const y = piece.y * pixelsPerUnit;

      ctx.fillStyle = piece.prototype.fillColor;
      ctx.clearRect(x + borderSize, y + borderSize, size - borderSize * 2, size - borderSize * 2);
      ctx.fillRect(x + borderSize, y + borderSize, size - borderSize * 2, size - borderSize * 2);

      ctx.strokeStyle = piece.prototype.borderColor;
      ctx.lineWidth = 2; // Border width
      ctx.strokeRect(x + borderSize / 2, y + borderSize / 2, size - borderSize, size - borderSize);
    });
  }

  toBlueprint() {
    let newBp = new Blueprint();
    for (const piecePlaced of this.piecesPlaced) {
      let prototype = piecePlaced.prototype;
      newBp.createEntity(prototype.name, { x: piecePlaced.x, y: piecePlaced.y });
    }
    return newBp;
  }

  getScore() {
    return this.piecesPlaced.reduce((sum, piece) => sum + piece.prototype.score, 0);
  }

  calculateOptimisticRemainingScore(piecePrototypes) {
    let sum = 0;
    if (!this.grid.optimisticScorePerTile) {
      this.grid.calculateOptimisticScorePerTile(piecePrototypes)
    }
    this.grid.forEachOpenTile((x, y) => {
      sum += this.grid.optimisticScorePerTile[x, y];
    });
    this.optimisticRemainingScore = sum;
    return sum;
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

  getPriority(weight = 0.5) {
    return this.score + this.optimisticRemainingScore * weight;
  }

  makeSmallChange(piecePrototypes) {

  }

  clone() {
    return new Branch(this.grid, this.startingGrid, this.piecesPlaced);
  }
}

module.exports = Branch;
