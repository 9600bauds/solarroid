const Blueprint = require('factorio-blueprint');
const PriorityQueue = require('priorityqueuejs');
const PiecePrototype = require('./classes/PiecePrototype');
const PlacedPiece = require('./classes/PlacedPiece');
const Grid = require('./classes/Grid');
const Branch = require('./classes/Branch');
const { isValidSpaceEntity } = require('./util');

window.Blueprint = Blueprint; // This makes it accessible globally if needed. Not sure if needed

const testSquare = new PlacedPiece(1, 1, new PiecePrototype(4, 4, "test-4x4"))
console.assert(testSquare.isFullyContainedByRectangle(1, 1, 5, 5))
console.assert(!testSquare.isFullyContainedByRectangle(1, 1, 4, 4))
console.assert(testSquare.intersectsRectangle(2, 2, 5, 5))
console.assert(testSquare.isBisectedByRectangle(3, 3, 6, 6))

const someKindOfBacktrackingSearch = (startingBranch, piecePrototypes) => {
  //Create a greedy branch as a reference point
  let greedyBranch = startingBranch.clone()
  greedyBranch.greedyAutoComplete(piecePrototypes)

  console.log("Greedy branch:");
  console.log(greedyBranch.toString());
  console.log(greedyBranch.toBlueprint().encode());
  console.log("Score:", greedyBranch.getScore());
  console.log("Pieces placed:", greedyBranch.piecesPlaced.length);
  startingBranch.display("canvas-left")
  greedyBranch.display("canvas-right")

  const startTime = Date.now();
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
    for (const prototype of piecePrototypes) {
      if (branch.grid.canPlacePiece(x, y, prototype)) {
        let newBranch = branch.clone();
        newBranch.placePiece(x, y, prototype);

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
          for (const otherPrototype of allPiecePrototypes) {
            if (otherPrototype.size === 1) {
              continue
            }
            if (branch.wouldThisPieceBeMoreOptimal(loopx, loopy, otherPrototype)) {
              shouldSkip = true;
              return false;
            }
          }
        });
  
        if (shouldSkip) {
          heuristicsSkipCount++;
          continue;
        }*/

        newBranch.calculateOptimisticRemainingScore(piecePrototypes);
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
  console.log("Pieces placed:", bestBranch.piecesPlaced.length);
  console.log("Branches Evaluated:", evaluatedCount);
  console.log("Branches Skipped:", skippedCount);
  console.log("Skipped by heuristics:", heuristicsSkipCount);
  console.log("Skipped by hashing:", hashingSkipCount);

  startingBranch.display("canvas-left")
  bestBranch.display("canvas-right")
}

async function simulatedAnnealing(startingBranch, initialTemperature, coolingRate, maxIterations) {
  let currentBranch = startingBranch;
  let currentScore = currentBranch.score;
  let temperature = initialTemperature;
  let iteration = 0;
  let lastUpdateTime = Date.now();

  while (temperature > 1 && iteration < maxIterations) {
    let newBranch = currentBranch.clone();
    newBranch.makeSmallChange();
    let newScore = newBranch.score;

    if (newScore > currentScore || Math.random() < Math.exp((newScore - currentScore) / temperature)) {
      currentBranch = newBranch;
      currentScore = newScore;
    }

    temperature *= coolingRate;
    iteration++;

    // Check if a second has passed since the last update
    let currentTime = Date.now();
    if (currentTime - lastUpdateTime >= 1000) {
      await new Promise(resolve => setTimeout(resolve, 0));
      updateProgress(currentBranch, temperature, iteration);
      lastUpdateTime = currentTime;
    }
  }

  return currentBranch;
}

function updateProgress(currentBranch, temperature, iteration) {
  console.log(`Iteration: ${iteration}, Temperature: ${temperature.toFixed(2)}`);
}

function start(input) {
  let allPiecePrototypes = [
    new PiecePrototype(4, 1050, "roboport", 'rgba(255, 99, 71, 0.5)', 'rgba(255, 99, 71, 1)'),
    new PiecePrototype(3, 100, "solar-panel", 'rgba(70, 130, 180, 0.5)', 'rgba(70, 130, 180, 1)'),
    new PiecePrototype(2, 10, "substation", 'rgba(148, 148, 148, 0.5)', 'rgba(148, 148, 148, 1)'),
    new PiecePrototype(1, 1, "medium-electric-pole", 'rgba(139, 69, 19, 0.5)', 'rgba(139, 69, 19, 1)')
  ];
  //Sort by their score per tile (higher is first)
  allPiecePrototypes.sort((a, b) => b.scorePerTile - a.scorePerTile);

  const importedBp = new Blueprint(input);
  let starterGrid = new Grid(importedBp);
  let startingBranch = new Branch(starterGrid, starterGrid, []);
  //startingBranch.greedyAutoComplete(allPiecePrototypes)

  someKindOfBacktrackingSearch(startingBranch, allPiecePrototypes);
  //simulatedAnnealing(startingBranch, 100, 0.95, 10000)
}

document.getElementById('search-form').addEventListener('submit', function (event) {
  event.preventDefault();
  const input = document.getElementById('search-input').value;

  start(input)

  //someKindOfBacktrackingSearch(input);
});
