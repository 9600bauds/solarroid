const Blueprint = require('factorio-blueprint');
const PiecePrototype = require('./classes/PiecePrototype');
const PlacedPiece = require('./classes/PlacedPiece');
const Grid = require('./classes/Grid');
const Branch = require('./classes/Branch');
const { isValidSpaceEntity } = require('./util');

window.Blueprint = Blueprint; // This makes it accessible globally if needed. Not sure if needed

let testSquare = new PlacedPiece(0, 0, new PiecePrototype(4, 4, "test-4x4"))
console.assert(testSquare.intersectsRectangle(2, 2, 5, 5))
let testSubStation = new PlacedPiece(12, 0, new PiecePrototype(2, 10, "substation", "", "", 18, 18))
console.assert(!testSquare.isSuppliedBy(testSubStation))
testSubStation = new PlacedPiece(8, 10, new PiecePrototype(2, 10, "substation", "", "", 18, 18))
console.assert(testSquare.isSuppliedBy(testSubStation))

async function simulatedAnnealing(startingBranch, allPiecePrototypes, initialTemperature, coolingRate, maxIterations) {
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
    newBranch.updateScore()
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
  console.log(startingBranch.toBlueprint().encode());
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
    new PiecePrototype(2, 10, "substation", 'rgba(148, 148, 148, 0.5)', 'rgba(148, 148, 148, 1)', 18, 18),
    new PiecePrototype(1, 1, "medium-electric-pole", 'rgba(139, 69, 19, 0.5)', 'rgba(139, 69, 19, 1)', 9, 7)
  ];
  //Sort by their score per tile (higher is first)
  allPiecePrototypes.sort((a, b) => b.scorePerTile - a.scorePerTile);

  const importedBp = new Blueprint(input);
  let starterGrid = new Grid(importedBp);
  let startingBranch = new Branch(starterGrid, starterGrid, new Set());
  startingBranch.greedyAutoComplete(allPiecePrototypes)
  startingBranch.updateScore()

  simulatedAnnealing(startingBranch, allPiecePrototypes, 100000, 0.9995, 100000)
}

document.getElementById('search-form').addEventListener('submit', function (event) {
  event.preventDefault();
  const input = document.getElementById('search-input').value;

  start(input)
});
