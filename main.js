const Blueprint = require('factorio-blueprint');
const PriorityQueue = require('priorityqueuejs');

const isValidSpaceEntity = (entity) => {
  //Contains "wall" anywhere
  return entity.name.search("wall") >= 0
}

class BuildingPrototype {
  constructor(size, score, name) {
    this.size = size;
    this.score = score;
    this.name = name;
    this.scorePerTile = score / size / size;
    this.area = size * size;
  }

  toString() {
    return `${this.name}, pertile ${this.scorePerTile.toFixed(2)}`;
  }
}

const allBuildingPrototypes = [
  new BuildingPrototype(4, 1000, "roboport"),
  new BuildingPrototype(3, 250, "solar-panel"),
  new BuildingPrototype(2, 30, "substation"),
  new BuildingPrototype(1, 1, "medium-electric-pole")
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

const testSquare = new PlacedBuilding(1, 1, new BuildingPrototype(4, 4, "test-4x4"))
console.assert(testSquare.isFullyContainedByRectangle(1, 1, 5, 5))
console.assert(!testSquare.isFullyContainedByRectangle(1, 1, 4, 4))
console.assert(testSquare.intersectsRectangle(2, 2, 5, 5))
console.assert(testSquare.isBisectedByRectangle(3, 3, 6, 6))

//const importString = '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'
//const importString = '0eNqdm9tOU1EURf9lP1ey75f+iiEG9MQ0KaeEFpWQ/rsFXhpl5Kwz38TY4Rx6uvdkrfLq7vfP0+PTbj657avbfT/MR7f9+uqOu5/z3f7t904vj5Pbut1penAbN989vH11PB3m6cvvu/3enTduN/+Y/rhtON9u3DSfdqfd9EF5/+Ll2/z8cD89Xf7AZ6/fuMfD8fKSw/z2t10wX1qIN2XjXi6/DL3flPN58x8qWlFhEZWsKL+IykaUH4uoYkX1RVS1otoiqln/ra5Q9XNUt6LqImpYUWURFbyVlZdZQcjVgBWFXMQyP/Fp2TEL72liFSEXOVYhF7GacNiQYxdOG2INIRc4Ri/kIlYQjkFwjFE4B4mVhFzkmIVcxCrCAU2O5sN++ViNTchFjl3IRSzrc++Xz+hkfe798t2RgsACx2Q+76+erwysJLAKsLJwbVOuIrQJYlWBRY5NcCRWF+5tclR6DrCyF1jgmIPgSKwo3NvkqPQcYmWBRY5FcCRWFe5tclR6DrG6wCLHITgCq3jh3gbHovQcYkWBRY5JcCRWFu5tclR6DrGUb2rJsQmOxOpCNyHHIfQJYFWl54BjDYIjsczP/fJ5X83P/fJ5X7PAIkfzeX/13o7AqkKXI1YTciVgdSEXsYbQ5cCxeaHLESsIucCxRSEXsZLQ5cgxC12OWEXIRY5VyEWsJnQ5cuxClyPWEHKBY/dCLmIFocuBY49ClyNWEnKRYxZyEasIXY4cq9DliNWEXOTYhVzEGkKXA8fhhS5HrCDkAscRhVzESkKXI8csdDliFSEXOVYhF7Ga0OXIsQt9lVhDyJVob+WFYAgzP/nLJ37wUaiZgWDKLNMTLAswTFaERofJlHEmwpStLWoqe1uEDaHVkWZQRpoIU2aapGlf3hYDLAnNDjWVsSbClLkmalYhGcKa0O5QUxltIkyZbZKmfYkbDLAgNDzSjMp4E2HKfBM1lc/sIKwILQ81lREnwpQZJ2p2IRnClG0uaUrrXIQpc07SNC90veEOMG90veEOSMqoE2FFSIaaVUiGsCZ0WtTsAgyTjfWVqnX6PJZfX/YYFoRkg2BRSIawtL6fsWZe388YVoRkqFmFZAhr6/sZa/b1/YxhQ0hGmuYV73UyhIX1/Qw1i/CpZYYJn1tmzSwkQ5jw2WXWrOv7GcOakAw1u5AMYWN9P0NN+7LXcAfYt72GO8C+7jXcAfZ9r+EOsC98DXeAeePrDXeAeeXrDXdAFWahDBOGoQwTpqH4H9CEaSjDzO8Aw0lrXvx6w0lr3vx6w4ViXv36f6+6283Hjwdtr36aaON+TU/H95fFfqkeI7be46WF1/P5L25sU9A='
//const importString = '0eNqdmN1ugkAUhN9lr2mze9g/eJWmabTdNCS6GqE/xvDuRb1p0k52mTsw8jlDhjMeLmq7+0jH05An1V/U8HrIo+qfLmoc3vNmd/1sOh+T6tUwpb1qVN7sr2fjdMjp4Wuz26m5UUN+S9+qN/Nzo1KehmlId8rt5PySP/bbdFq+8N/1jToexuWSQ77+2oJ5CMY+ukadl0MTlsN5bv6ghEC5/1FtLUqKqmwtqi2iHKEKGPSEKoAKtShdNBhrUaaI6ghVwKDRhCzEqs27jkWLRggW0lWbeN2VdVmChXTVZl6HMssTLOSxNvXal3VFgoV01eZel4eg1OZeuzLLECw054XwiFjVuS/PVKnOfXmoiiNYyKMnPCJWde7Lc1Wqc1+eq9IRLOCx1UTPCmAZomgRSwhdLWC1hC7EskTXIo+O6FrE8oQu5DEQuhArEr2NPHZE1wKW1YQu4NEaQhdiCdHbiNUSXYtYltCF7r0jdCGWJ/oReQxEbyNWJFjII/M/B7CcJvoReHSG6G3EEkIX8tgSuhDLEl2LPDI7rQYsT7AMYAWiHxErEj2EPHZEDwGW14Qu4NEbQhdiMXst8sjstYhlCV3IoyN0IRaz1yIWs9ciFrPXonvfER4BK2iiO4DHwOy1iCUEC3lk5j3SZdfPVd8Blls/cyDLr585kBXWP9uQFdc/25BF5P7Oem7u7+f7X6/zG/WZTuPtMonGhk5CjGLa4Of5B/DaeoA='
const importString = '0eNqd199KwzAYBfB3+a6jNP+atK8iIpsGKXTpWDt1jL67Xb1QcIeGc9eO5bfzQc5IrrLvz+l46vIk7VW61yGP0j5dZeze866/fTZdjkla6aZ0ECV5d7i9jdOQ08Pnru9lVtLlt/QlrZ6flaQ8dVOXfpT15fKSz4d9Oi1fuLdeyXEYlyVDvv3awjwEXT96JZflUdfL4zyrf5QppdwmZUspv0m5UspsUr6UsptUTaQK96lApAJULKXiL+XuUw2xrwClq1IrbFvMfvfAMkQuZFmiPGhGR7QHWZ7IhWasiVzIYnY9mjESZUS5GiIXsExF1NEASxOWBVbxvm+2LUtYaEZHdBvl8kS3kVUTudCMgciFrEh0G83YEBbIZSvifwLkspqwUC5DdBvlsoSFcjmi2xpYnugjsmoiVwWsQHQI5YpEh5DFnHPAjI455yBLE30EMzpDdAjlYk72a67lHrPed9o/1yMlH+k0rstM1C40JsRotA31PH8Dey8mJQ=='
//const importString = '0eNqd1cFuhCAQBuB3mTO7EQRBX2XTbNyWNCSKRti2xvDui/bSpE40cxPjfP4MBBZ4dE87Ts5HaBZw74MP0NwWCO7Tt936Ls6jhQZctD0w8G2/jkIcvL18t10HiYHzH/YHGp7eGFgfXXT2V9kG890/+4ed8gd79QzGIeSSwa9/y8xF8+KqGMz5kev6qlJi/yhBoMw+VZ6kivowlTxLmcNUipAKoSpCr/Q+pQlUtU8ZQq+QVDWhVwjFC0IsZIacE3Jh1tkNX+hjqySsokQsSbAUYilC77FcFcHCcmnCOmK5DMHCctWEPYFYoiBYyBwF5ZwvEUsQ1hGzKCc9ZklCvzYr35HbXdr8uXoZfNkpbGXCcKlroY0RvNRVSi+hDmSc'
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


let heuristicMult = 0.5;
let startingBranch = new Branch(starterGrid, []);
let maxScore = greedyBranch.getScore();
let bestBranch = greedyBranch;
const branches = new PriorityQueue((a, b) => a.priority - b.priority)
branches.enq(startingBranch, startingBranch.getPriority(heuristicMult))
let evaluatedCount = 0;
let skippedCount = 0;
let heuristicsSkipCount = 0;
let lastPrintTime = 0;

let branchesEvaluated = [];
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
      newBranch.calculateOptimisticRemainingScore();

      let shouldSkip = false;

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
      }

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
    console.log("Branches in Queue:", branches.size());
    setTimeout(() => {
      // Continue the loop in the next event loop iteration
      window.requestAnimationFrame(mainLoop);
    }, 0);
  }
}

// Export the string to use in-game
console.log("Found the optimal solution:");
console.log(bestBranch.toString());
console.log(bestBranch.toBlueprint().encode());
console.log("Score:", bestBranch.score);
console.log("Branches Evaluated:", evaluatedCount);
console.log("Branches Skipped:", skippedCount);
console.log("Skipped by heuristics:", heuristicsSkipCount);
console.log("Branches in Queue:", branches.size());

//debugger

window.Blueprint = Blueprint; // This makes it accessible globally if needed. Not sure if needed