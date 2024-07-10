const Blueprint = require('factorio-blueprint');
const PriorityQueue = require('priorityqueuejs');
window.Blueprint = Blueprint; // This makes it accessible globally if needed. Not sure if needed

const isValidSpaceEntity = (entity) => {
  //Contains "wall" anywhere
  return entity.name.search("wall") >= 0
}

class BuildingPrototype {
  constructor(size, score, name, fillColor, borderColor) {
    this.size = size;
    this.score = score;
    this.name = name;
    this.scorePerTile = score / size / size;
    this.area = size * size;
    this.fillColor = fillColor;
    this.borderColor = borderColor;
  }

  toString() {
    return `${this.name}, pertile ${this.scorePerTile.toFixed(2)}`;
  }
}

const allBuildingPrototypes = [
  new BuildingPrototype(4, 1000, "roboport", 'rgba(255, 99, 71, 0.5)', 'rgba(255, 99, 71, 1)'),
  new BuildingPrototype(3, 250, "solar-panel", 'rgba(70, 130, 180, 0.5)', 'rgba(70, 130, 180, 1)'),
  new BuildingPrototype(2, 30, "substation", 'rgba(148, 148, 148, 0.5)', 'rgba(148, 148, 148, 1)'),
  new BuildingPrototype(1, 1, "medium-electric-pole", 'rgba(139, 69, 19, 0.5)', 'rgba(139, 69, 19, 1)')
];
//Sort by their score per tile (higher is first)
allBuildingPrototypes.sort((a, b) => b.scorePerTile - a.scorePerTile);

class PlacedBuilding {
  constructor(x, y, prototype) {
    this.x = x;
    this.y = y;
    this.prototype = prototype;
  }

  toString() {
    return `@${x}-${y} ${this.prototype.name}`;
  }

  intersectsPoint(x, y) {
    const size = this.prototype.size;
    return (x >= this.x && x < this.x + size &&
      y >= this.y && y < this.y + size);
  }

  isFullyContainedByRectangle(x1, y1, x2, y2) {
    const size = this.prototype.size;
    return (this.x >= x1 && this.x + size <= x2 &&
      this.y >= y1 && this.y + size <= y2);
  }

  intersectsRectangle(x1, y1, x2, y2) {
    const size = this.prototype.size;
    return !(this.x + size <= x1 || this.x >= x2 ||
      this.y + size <= y1 || this.y >= y2);
  }

  isBisectedByRectangle(x1, y1, x2, y2) {
    return this.intersectsRectangle(x1, y1, x2, y2) && !this.isFullyContainedByRectangle(x1, y1, x2, y2)
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

class Grid {
  constructor(arg) {
    if (arg instanceof Grid) {
      let otherGrid = arg;
      this.twodee = otherGrid.twodee.map(row => [...row]); // Deep copy
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
      this.twodee = Array(this.width).fill().map(() => Array(this.height).fill(false));
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
        const adjustedY = maxY - thisY;

        // Populate the grid
        this.twodee[adjustedX][adjustedY] = true;
      }
    }
  }

  getKey() {
    return this.twodee.map(row => row.map(cell => cell ? '1' : '0').join('')).join('');
  }

  forEachCoord(callback) {
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        if (callback(x, y, this.twodee[x][y]) === false) { // Stop iterating if callback returns false
          return;
        }
      }
    }
  }

  forEachOpenTile(callback) {
    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        if (this.twodee[x][y]) {
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

  canPlaceBuilding(x, y, prototype) {
    const size = prototype.size;
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        if (x + i >= this.width || y + j >= this.height || !this.twodee[x + i][y + j]) {
          return false;
        }
      }
    }
    return true;
  }

  calculateOptimisticScorePerTile() {
    this.optimisticScorePerTile = Array(this.width).fill().map(() => Array(this.height).fill(0));
    this.forEachOpenTile((x, y) => {
      for (const prototype of allBuildingPrototypes) {
        if (this.canPlaceBuilding(x, y, prototype)) {
          //Mark every tile that that building could theoretically optimistically occupy with its score per tile
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

class Branch {
  constructor(grid, buildingsPlaced) {
    this.grid = new Grid(grid);
    this.buildingsPlaced = buildingsPlaced.slice(); // Shallow copy
    this.score = this.getScore()
    this.calculateOptimisticRemainingScore()
  }

  wouldThisBuildingBeMoreOptimal(x, y, prototype) {
    const size = prototype.size;

    let x2 = x + size;
    let y2 = y + size;
    let thisArea = 0;
    let thisScore = 0;
    let theseBuildings = [];
    for (const building of this.buildingsPlaced) {
      if (!building.intersectsRectangle(x, y, x2, y2)) {
        continue
      }
      if (!building.isFullyContainedByRectangle(x, y, x2, y2)) {
        return false; //We are bisecting a building!
      }
      else {
        theseBuildings.push(building)
        thisScore += building.prototype.score;
        thisArea += building.prototype.area;
      }
    }
    if (thisArea < prototype.area) {
      return false; //This area was not 100% full of buildings
    }
    if (prototype.score > thisScore) {
      //this.placeBuilding(x, y, prototype)
      //console.log(this.toString(), this, x, y, prototype.name, "would be better")
      //debugger
      return true;
    }
    return false;
  }

  placeBuilding(x, y, prototype) {
    const size = prototype.size;
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        this.grid.twodee[x + i][y + j] = false; // Mark the grid as filled
      }
    }
    let newPlacedBuilding = new PlacedBuilding(x, y, prototype);
    this.buildingsPlaced.push(newPlacedBuilding);
    this.score += prototype.score;
  }

  getIntersectingBuilding(x, y) {
    if (!this.grid.isInBounds(x, y)) {
      return null
    }
    for (const building of this.buildingsPlaced) {
      if (building.intersectsPoint(x, y)) {
        return building;
      }
    }
    return null;
  }

  toString() {
    let out = "";
    const lastYIndex = this.grid.height - 1;
    const lastXIndex = this.grid.width - 1;
    for (let curY = lastYIndex; curY >= 0; curY--) {
      for (let curX = 0; curX <= lastXIndex; curX++) {
        let intersectingBuilding = this.getIntersectingBuilding(curX, curY)
        if (intersectingBuilding) {
          out += intersectingBuilding.prototype.size.toString()
        }
        else if (this.grid.twodee[curX][curY]) {
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
    for (const buildingPlaced of this.buildingsPlaced) {
      let prototype = buildingPlaced.prototype;
      newBp.createEntity(prototype.name, { x: buildingPlaced.x, y: buildingPlaced.y });
    }
    return newBp;
  }

  getScore() {
    return this.buildingsPlaced.reduce((sum, building) => sum + building.prototype.score, 0);
  }

  calculateOptimisticRemainingScore() {
    let sum = 0;
    if (!this.grid.optimisticScorePerTile) {
      this.grid.calculateOptimisticScorePerTile()
    }
    this.grid.forEachOpenTile((x, y) => {
      sum += this.grid.optimisticScorePerTile[x][y];
    });
    this.optimisticRemainingScore = sum;
    return sum;
  }

  greedyAutoComplete() {
    for (let prototype of allBuildingPrototypes) {
      this.grid.forEachOpenTile((x, y) => {
        if (this.grid.canPlaceBuilding(x, y, prototype)) {
          this.placeBuilding(x, y, prototype);
        }
      });
    }
  }

  getPriority(weight = 0.5) {
    return this.score + this.optimisticRemainingScore * weight;
  }

  clone() {
    return new Branch(this.grid, this.buildingsPlaced, this.optimisticScorePerTile);
  }
}

// crude testing
const testSquare = new PlacedBuilding(1, 1, new BuildingPrototype(4, 4, "test-4x4"))
console.assert(testSquare.isFullyContainedByRectangle(1, 1, 5, 5))
console.assert(!testSquare.isFullyContainedByRectangle(1, 1, 4, 4))
console.assert(testSquare.intersectsRectangle(2, 2, 5, 5))
console.assert(testSquare.isBisectedByRectangle(3, 3, 6, 6))

//0eNqd1+1qgzAYBeB7eX/bYmK+9FbGGO0WhmBjqXabFO996mAM1oP2/Iw0T88bPGBucmyu8XypUy/VTerXNnVSPd2kq9/ToZmf9cM5SiV1H0+SSTqc5lXXtynuPg9NI2MmdXqLX1Kp8TmTmPq6r+OPsiyGl3Q9HeNl+sG9/Zmc227a0qb53yZmp3Kb53ubyTAvwt6OY/bP0lstU5a/VnnfKrZbYc0yTC4wo2VyActtt9ya5bdbfu28ApMLWCWTC8yo8u2YXQumFIOhZA+8+mYVK5hOeoAZBnMAs0yTUDLHVAlhnkmGxgxMMoRRDQCYzhkMnJlWTM8RphkMjVkw3UTJDNNNhFkmGRrTMckQ9kADitUxA4OhZCXTTQu+C3KmmwZgisFQMs10E2EFUyeEGSYZOjPLJEOYY+qExvRMnRAWmGRozJJJBjCTM91cxpzuAsudofpzxcjkI166ZZ8OyvhS+xC0Krwbx29KW+cQ
//0eNqVmtFO3DAQRf/FzymKnTix91cqVEEbVZGWLGKXtgjtv3cBgSqVo+S8sYgc7jXjO2ac53C7f5zuH+blFHbPYf5+WI5h9/U5HOefy83+5Xunp/sp7MJ8mu5CE5abu5dPx9Nhmb78vtnvw7kJ8/Jj+hN28XzdhGk5zad5eqO8fnj6tjze3U4Plx/47Pkm3B+Ol0cOy8tvu2C+1JSGq9yEp8vX/VU+n5v/SGkzKa+Qus2kfoXUbyaVd1L6nJQ3k8YV0uBXHEijJ3Wfk4p3B6TqqwDcxdajQFSMvqIIlTyKDG6v824Ntb3Q0xoqe1W0VttLPa6p2l7r9R3VAqr4UCBU9agI6dn6LQiqUvQoUpV8xBCq8ygy2PtkIFT225lQg0fRWo3eIKGKTwYyWH0yAKprPQoMdtEbJNT2am/XDHY++gjVexQZzN4goTZXe1wL5G7UKUqiiu4SpKlqEmjqW+0ONPU+10mTj3Ui+VQnd712RySf6eRu0DlMJJ/o5K5od0SqOjnBXfZxTqSoSeAuJ+2OSJ1OTSL1mkTrlHVTIJI/pJO7zTUeV3I8F91ciFS1JnA3tFoTkaLuCPAP1pA0iYYSnU5f0tTrjkCkrEnkbtDuiDTq9CWSz3FaJz9zAdLoRy40mvKnctLkc5w0+XkLkXpNInf+RE4kn+NEGrUmWqeiNRHJ5ziNOn2OEylqErgrSbsj0uYajytJV3pNonXyOQ7j/OJn5xlIo+4IRPKzc3JXdUcATdXnOJH85BzcVX8/RKROdwRy53OcSFlrIneD1kQkn+PkrmgSaaq6I2S6Hmo1qidU1PmLKB/laLDT/QVRvUahwc2VHoc1VYNuMahq1ChUVXSTGQjlE51Q4jb0HTUSKuokRpQPdTToUx1V+dtQVOVvQxHlgx0N+mRHlD+iI6pqVbRWyWc7ovwpnQwmn+2I6jQKDfpsR1TWKYoGB90mEOWzHQ0WrQpR/ja00Hsgrc4rREW9cSqh/G0oovxtKBr0I3REZb1x0OCgtzOiRq0KDRatClFV70EyuP1C9ANFqrbfiH5s51fUdfP27uTun1ctm/Breji+PpRK7MeaxlLS5c8xnM9/AUMCEGw=
const simulate = (importString) => {
  const importedBp = new Blueprint(importString);
  let starterGrid = new Grid(importedBp);
  starterGrid.calculateOptimisticScorePerTile();
  //Create a greedy branch as a reference point
  let greedyBranch = new Branch(starterGrid, []);
  greedyBranch.greedyAutoComplete()

  console.log("Greedy branch:");
  console.log(greedyBranch.toString());
  console.log(greedyBranch.toBlueprint().encode());
  console.log("Score:", greedyBranch.getScore());
  displayBranch("canvas-left", greedyBranch, starterGrid)


  const startTime = Date.now();
  let startingBranch = new Branch(starterGrid, []);
  let maxScore = greedyBranch.getScore();
  let bestBranch = greedyBranch;

  let heuristicMult = 0.5;
  const branches = new PriorityQueue((a, b) => a.priority - b.priority)
  branches.enq(startingBranch, startingBranch.getPriority(heuristicMult))

  let evaluatedGrids = new Map();

  let evaluatedCount = 0;
  let skippedCount = 0;
  let heuristicsSkipCount = 0;
  let hashingSkipCount = 0;
  let lastPrintTime = 0;

  while (!branches.isEmpty()) {
    let branch = branches.deq();
    evaluatedCount++;

    const nextSpace = branch.grid.findNextOpenSpace();
    if (!nextSpace) {
      if (branch.score > maxScore) {
        maxScore = branch.score;
        bestBranch = branch;
      }
      continue;
    }

    const { x, y } = nextSpace;
    for (const prototype of allBuildingPrototypes) {
      if (branch.grid.canPlaceBuilding(x, y, prototype)) {
        let newBranch = branch.clone();
        newBranch.placeBuilding(x, y, prototype);

        const key = newBranch.grid.getKey()
        const existingScore = evaluatedGrids.get(key);
        if (existingScore !== undefined && existingScore >= newBranch.score) {
          hashingSkipCount++;
          continue;
        }
        else {
          evaluatedGrids.set(key, newBranch.score)
        }

        /*let shouldSkip = false;
  
        branch.grid.forEachCoord((loopx, loopy, tile) => {
          for (const otherPrototype of allBuildingPrototypes) {
            if (otherPrototype.size === 1) {
              continue
            }
            if (branch.wouldThisBuildingBeMoreOptimal(loopx, loopy, otherPrototype)) {
              shouldSkip = true;
              return false;
            }
          }
        });
  
        if (shouldSkip) {
          heuristicsSkipCount++;
          continue;
        }*/

        newBranch.calculateOptimisticRemainingScore();
        const heuristicMaxScore = newBranch.score + newBranch.optimisticRemainingScore * 1;
        if (heuristicMaxScore >= maxScore) {
          branches.enq(newBranch, newBranch.getPriority(heuristicMult))
        }
        else {
          skippedCount++;
        }
      }
    }

    const currentTime = Date.now();
    if (currentTime - lastPrintTime >= 5000) {
      lastPrintTime = currentTime;
      if (bestBranch === greedyBranch) {
        console.log("Best Branch is still the greedy branch!");
      }
      else {
        console.log("Best Branch So Far:");
        console.log(bestBranch.toString());
        console.log(bestBranch.toBlueprint().encode());
        console.log("Score:", bestBranch.score);
      }
      console.log("Being evaluated now:");
      console.log(branch.toString());
      console.log(branch.toBlueprint().encode());
      console.log("Score:", branch.score, "Potential:", branch.optimisticRemainingScore);
      console.log("Branches Evaluated:", evaluatedCount);
      console.log("Branches Skipped:", skippedCount);
      console.log("Skipped by heuristics:", heuristicsSkipCount);
      console.log("Skipped by hashing:", hashingSkipCount);
      console.log("Branches in Queue:", branches.size());
      setTimeout(() => {
        // Continue the loop in the next event loop iteration
        window.requestAnimationFrame(mainLoop);
      }, 0);
    }
  }


  const endTime = Date.now();
  console.log(`Found an optimal solution in ${(endTime - startTime) / 1000} seconds:`);
  console.log(bestBranch.toString());
  console.log(bestBranch.toBlueprint().encode());
  console.log("Score:", bestBranch.score);
  console.log("Branches Evaluated:", evaluatedCount);
  console.log("Branches Skipped:", skippedCount);
  console.log("Skipped by heuristics:", heuristicsSkipCount);
  console.log("Skipped by hashing:", hashingSkipCount);

  displayBranch("canvas-left", greedyBranch, starterGrid)
  displayBranch("canvas-right", bestBranch, starterGrid)
}

function displayBranch(elemId, branch, baseGrid) {
  const pixelsPerUnit = 20;
  const borderSize = 2;

  const canvas = document.getElementById(elemId);
  const ctx = canvas.getContext('2d');

  //Clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(1, 0, 0, 1, 0, 0)

  // Scale the canvas
  let maxX = baseGrid.width;
  let maxY = baseGrid.height;
  const logicalWidth = maxX * pixelsPerUnit;
  const logicalHeight = maxY * pixelsPerUnit;
  const scaleX = canvas.width / logicalWidth;
  const scaleY = canvas.height / logicalHeight;
  const scale = Math.min(scaleX, scaleY);
  ctx.scale(scale, scale);

  // Draw the 2D grid
  ctx.lineWidth = 1 / scale; // Grid line width
  ctx.strokeStyle = 'black'; // Grid line color

  for (let i = 0; i < baseGrid.twodee.length; i++) {
    for (let j = 0; j < baseGrid.twodee[i].length; j++) {
      const x = i * pixelsPerUnit;
      const y = j * pixelsPerUnit;

      if (baseGrid.twodee[i][j]) {

        ctx.strokeRect(x, y, pixelsPerUnit, pixelsPerUnit); // Draw the grid cell
      }
    }
  }

  //Actually draw the thing
  branch.buildingsPlaced.forEach(building => {
    const size = building.prototype.size * pixelsPerUnit;
    const x = building.x * pixelsPerUnit;
    const y = building.y * pixelsPerUnit;

    ctx.fillStyle = building.prototype.fillColor;
    ctx.clearRect(x + borderSize, y + borderSize, size - borderSize * 2, size - borderSize * 2);
    ctx.fillRect(x + borderSize, y + borderSize, size - borderSize * 2, size - borderSize * 2);

    ctx.strokeStyle = building.prototype.borderColor;
    ctx.lineWidth = 2; // Border width
    ctx.strokeRect(x + borderSize / 2, y + borderSize / 2, size - borderSize, size - borderSize);
  });
}

document.getElementById('search-form').addEventListener('submit', function (event) {
  event.preventDefault();
  const input = document.getElementById('search-input').value;
  simulate(input);
});