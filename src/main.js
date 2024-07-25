const { selectPreset } = require('./presets');

const PiecePrototype = require('./classes/PiecePrototype');
const PlacedPiece = require('./classes/PlacedPiece');
const Grid = require('./classes/Grid');
const Branch = require('./classes/Branch');

const Blueprint = require('./blueprintData');
const { showStartButton, showStopButton, setTitle, setErrorMessage } = require('./utils');
const { clearCanvas, renderBranch } = require('./renderer');

window.Blueprint = Blueprint; // This makes it accessible globally

let isRunning;

// Extremely lazy testing
let testSquare = new PlacedPiece(0, 0, new PiecePrototype(4, 4, "test_4x4"))
console.assert(testSquare.intersectsRectangle(2, 2, 5, 5))
let testSubStation = new PlacedPiece(12, 0, new PiecePrototype(2, 10, "substation", "", "", 18, 18))
console.assert(!testSquare.isSuppliedBy(testSubStation))
testSubStation = new PlacedPiece(8, 10, new PiecePrototype(2, 10, "substation", "", "", 18, 18))
console.assert(testSquare.isSuppliedBy(testSubStation))

async function simulatedAnnealing(startingBranch, allPiecePrototypes, initialTemperature, coolingRate) {
  let bestBranch = startingBranch.clone();

  let temperature = initialTemperature;
  let iteration = 0;
  let startTime = Date.now();
  let lastUpdateTime = startTime;

  while (temperature > 1 && isRunning) {
    let currentBranch = bestBranch.clone();
    currentBranch.makeSmallChange(allPiecePrototypes);
    currentBranch.updateScore()

    let isNewScoreBetter = currentBranch.score > bestBranch.score;
    let randomChance = Math.random() < Math.exp((currentBranch.score - bestBranch.score) / temperature)
    if (isNewScoreBetter || randomChance) {
      bestBranch = currentBranch;
    }

    temperature *= coolingRate;
    iteration++;

    // Check if a second has passed since the last update
    let currentTime = Date.now();
    if (currentTime - lastUpdateTime >= 100) {
      await new Promise(resolve => setTimeout(resolve, 0));
      updateProgress(currentBranch, bestBranch, temperature, iteration);
      lastUpdateTime = currentTime;
    }
  }

  const endTime = Date.now();
  console.log(`Finished annealing in in ${(endTime - startTime) / 1000} seconds:`);
  console.log(bestBranch.score)
  console.log(bestBranch.toString());
  console.log(bestBranch.toBlueprint().encode());
  console.log("Score:", bestBranch.score, '(', (bestBranch.score - startingBranch.score), ') from starter branch');
  console.log("Pieces placed:", bestBranch.piecesPlaced.length);
  console.log("Branches Evaluated:", iteration);

  stopTheSearch()
  renderBranch(bestBranch)

  return bestBranch;
}

function updateProgress(currentBranch, bestBranch, temperature, iteration) {
  renderBranch(bestBranch)
  console.log(`Iteration: ${iteration}, Temperature: ${temperature.toFixed(2)}`);
}

function makePiecePrototypes() {
  //todo populate the piece prototypes procedurally
  let allPiecePrototypes = [
    new PiecePrototype(4, 1050, "se_space_solar_panel", 'rgba(255, 99, 71, 0.5)', 'rgba(255, 99, 71, 1)'),
    new PiecePrototype(3, 100, "solar_panel", 'rgba(70, 130, 180, 0.5)', 'rgba(70, 130, 180, 1)'),
    new PiecePrototype(2, 10, "substation", 'rgba(148, 148, 148, 0.5)', 'rgba(148, 148, 148, 1)', 18, 18),
    new PiecePrototype(1, 1, "medium_electric_pole", 'rgba(139, 69, 19, 0.5)', 'rgba(139, 69, 19, 1)', 9, 7)
  ];
  //Sort by their score per tile (higher is first)
  allPiecePrototypes.sort((a, b) => b.scorePerTile - a.scorePerTile);
  return allPiecePrototypes;
}

function makeStarterBranch(blueprintInputText, allPiecePrototypes) {
  try {
    const importedBp = new Blueprint(blueprintInputText, { checkWithEntityData: false });
    const baseTile = document.getElementById('base-tile').value;
    let starterGrid = new Grid(importedBp, baseTile);
    startingBranch = new Branch(starterGrid, starterGrid, new Set());
    startingBranch.greedyAutoComplete(allPiecePrototypes)
    startingBranch.updateScore()
  }
  catch (error) {
    setErrorMessage("Blueprint " + error)
    return
  }

  return startingBranch
}

function startTheSearch() {
  let blueprintInputText = document.getElementById('blueprint-input').value;
  if (!blueprintInputText) {
    return setErrorMessage("Please input a blueprint first, or select a preset")
  }

  let allPiecePrototypes = makePiecePrototypes();
  let starterBranch = makeStarterBranch(blueprintInputText, allPiecePrototypes);

  isRunning = true;
  showStopButton();
  let initialTemperature = document.getElementById('initialTemperature').value;
  let coolingRate = document.getElementById('coolingRate').value;
  simulatedAnnealing(starterBranch, allPiecePrototypes, initialTemperature, coolingRate)
}

function stopTheSearch() {
  isRunning = false;
  showStartButton();
}

document.addEventListener('DOMContentLoaded', function () {
  showStartButton();
  document.getElementById('start-btn').addEventListener('click', startTheSearch);
  document.getElementById('stop-btn').addEventListener('click', stopTheSearch);

  document.getElementById('preset1').addEventListener('click', function () {
    selectPreset(0);
  });
  document.getElementById('preset2').addEventListener('click', function () {
    selectPreset(1);
  });
  document.getElementById('preset3').addEventListener('click', function () {
    selectPreset(2);
  });
  document.getElementById('preset4').addEventListener('click', function () {
    selectPreset(3);
  });
});

