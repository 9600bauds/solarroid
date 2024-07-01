console.log('solarroid loaded')

const Blueprint = require('factorio-blueprint');

const isValidSpaceEntity = (entity) => {
  //Contains "wall" anywhere
  return entity.name.search("wall") >= 0
}
const printGrid = (grid) => {
  let out = ""
  const lastYIndex = grid[0].length - 1;
  const lastXIndex = grid.length - 1;
  for (let curY = lastYIndex; curY >= 0; curY--) {
    for (let curX = 0; curX <= lastXIndex; curX++) {
      if (grid[curX][curY]) {
        out += "#"
      }
      else {
        out += "_"
      }
    }
    out += "\n"
  }
  console.log(out)
}

//const importString = '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'
const importString = '0eNqd199KwzAYBfB3+a6jNP+atK8iIpsGKXTpWDt1jL67Xb1QcIeGc9eO5bfzQc5IrrLvz+l46vIk7VW61yGP0j5dZeze866/fTZdjkla6aZ0ECV5d7i9jdOQ08Pnru9lVtLlt/QlrZ6flaQ8dVOXfpT15fKSz4d9Oi1fuLdeyXEYlyVDvv3awjwEXT96JZflUdfL4zyrf5QppdwmZUspv0m5UspsUr6UsptUTaQK96lApAJULKXiL+XuUw2xrwClq1IrbFvMfvfAMkQuZFmiPGhGR7QHWZ7IhWasiVzIYnY9mjESZUS5GiIXsExF1NEASxOWBVbxvm+2LUtYaEZHdBvl8kS3kVUTudCMgciFrEh0G83YEBbIZSvifwLkspqwUC5DdBvlsoSFcjmi2xpYnugjsmoiVwWsQHQI5YpEh5DFnHPAjI455yBLE30EMzpDdAjlYk72a67lHrPed9o/1yMlH+k0rstM1C40JsRotA31PH8Dey8mJQ=='
const importedBp = new Blueprint(importString);
//First pass: Get the grid's dimensions
let minX = Number.MAX_SAFE_INTEGER;
let minY = Number.MAX_SAFE_INTEGER;
let maxX = Number.MIN_SAFE_INTEGER;
let maxY = Number.MIN_SAFE_INTEGER;
for (const pos in importedBp.entityPositionGrid) {
  const entity = importedBp.entityPositionGrid[pos]
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
const gridHeight = Math.abs(maxY - minY) + 1
const gridWidth = Math.abs(maxX - minX) + 1
let grid = Array(gridWidth).fill().map(() => Array(gridHeight).fill(false));
//Second pass: Populate the grid
for (const pos in importedBp.entityPositionGrid) {
  const entity = importedBp.entityPositionGrid[pos]
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
  grid[adjustedX][adjustedY] = true;
  printGrid(grid)
}

debugger
//importedBp.createEntity('transport-belt', { x: 0, y: 0 }, Blueprint.UP);

// Export the string to use in-game
//console.log(importedBp.encode());

window.Blueprint = Blueprint; // This makes it accessible globally if needed