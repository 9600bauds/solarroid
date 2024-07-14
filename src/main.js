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

const someKindOfBacktrackingSearch = (startingBranch, allPiecePrototypes, higherPieces, lesserPieces) => {
  //Create a greedy branch as a reference point
  let greedyBranch = startingBranch.clone()
  greedyBranch.greedyAutoComplete(allPiecePrototypes)

  console.log("Greedy branch:");
  console.log(greedyBranch.toString());
  console.log(greedyBranch.toBlueprint().encode());
  console.log("Score:", greedyBranch.score);
  console.log("Pieces placed:", greedyBranch.piecesPlaced.length);
  startingBranch.display("canvas-left")
  greedyBranch.display("canvas-right")

  const startTime = Date.now();
  let maxScore = greedyBranch.score;
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
    for (const prototype of allPiecePrototypes) {
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

        newBranch.calculateOptimisticRemainingScore(allPiecePrototypes);
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

async function simulatedAnnealing(startingBranch, allPiecePrototypes, higherPieces, lesserPieces, initialTemperature, coolingRate, maxIterations) {
  let currentBranch = startingBranch;
  currentBranch.greedyAutoComplete(allPiecePrototypes)
  let currentScore = currentBranch.score;
  let temperature = initialTemperature;
  let iteration = 0;
  let startTime = Date.now();
  let lastUpdateTime = startTime;

  while (temperature > 1 && iteration < maxIterations) {
    let newBranch = currentBranch.clone();
    newBranch.makeSmallChange(allPiecePrototypes);
    let newScore = newBranch.score;

    let isNewScoreBetter = newScore > currentScore;
    let randomChance = Math.random() < Math.exp((newScore - currentScore) / temperature)
    if (isNewScoreBetter || randomChance) {
      currentBranch = newBranch;
      currentScore = newScore;
    }

    temperature *= coolingRate;
    iteration++;

    // Check if a second has passed since the last update
    let currentTime = Date.now();
    if (currentTime - lastUpdateTime >= 100) {
      await new Promise(resolve => setTimeout(resolve, 0));
      updateProgress(startingBranch, currentBranch, temperature, iteration);
      lastUpdateTime = currentTime;
    }
  }

  const endTime = Date.now();
  console.log(`Finished annealing in in ${(endTime - startTime) / 1000} seconds:`);
  console.log(currentBranch.toString());
  console.log(currentBranch.toBlueprint().encode());
  console.log("Score:", currentBranch.score, '(', (currentBranch.score - startingBranch.score), ') from starter branch');
  console.log("Pieces placed:", currentBranch.piecesPlaced.length);
  console.log("Branches Evaluated:", iteration);

  startingBranch.display("canvas-left")
  currentBranch.display("canvas-right")

  return currentBranch;
}

function updateProgress(startingBranch, currentBranch, temperature, iteration) {
  startingBranch.display("canvas-left")
  currentBranch.display("canvas-right")
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
  // Calculate the cutoff index for the top 50%
  const cutoffIndex = Math.floor(allPiecePrototypes.length / 2);

  // Split into higherPieces and lesserPieces
  const higherPieces = allPiecePrototypes.slice(0, cutoffIndex);;
  const lesserPieces = allPiecePrototypes.slice(cutoffIndex);

  const importedBp = new Blueprint(input);
  let starterGrid = new Grid(importedBp);
  let startingBranch = new Branch(starterGrid, starterGrid, []);

  //someKindOfBacktrackingSearch(startingBranch, allPiecePrototypes, higherPieces, lesserPieces);
  simulatedAnnealing(startingBranch, allPiecePrototypes, higherPieces, lesserPieces, 100000, 0.9995, 100000)
}

document.getElementById('search-form').addEventListener('submit', function (event) {
  event.preventDefault();
  const input = document.getElementById('search-input').value;

  start(input)
});
