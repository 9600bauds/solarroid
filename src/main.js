const { selectPreset } = require('./presets');

const PiecePrototype = require('./classes/PiecePrototype');
const PlacedPiece = require('./classes/PlacedPiece');
const Grid = require('./classes/Grid');
const Branch = require('./classes/Branch');

const Blueprint = require('./blueprintData');
const { clearCanvas, showStartButton, showStopButton, setTitle, setErrorMessage } = require('./utils');
window.Blueprint = Blueprint; // This makes it accessible globally

let startingBranch;
let bestBranch;
let allPiecePrototypes;
let isRunning;

// Extremely lazy testing
let testSquare = new PlacedPiece(0, 0, new PiecePrototype(4, 4, "test_4x4"))
console.assert(testSquare.intersectsRectangle(2, 2, 5, 5))
let testSubStation = new PlacedPiece(12, 0, new PiecePrototype(2, 10, "substation", "", "", 18, 18))
console.assert(!testSquare.isSuppliedBy(testSubStation))
testSubStation = new PlacedPiece(8, 10, new PiecePrototype(2, 10, "substation", "", "", 18, 18))
console.assert(testSquare.isSuppliedBy(testSubStation))

async function simulatedAnnealing(initialTemperature, coolingRate) {
  let currentBranch = startingBranch;
  currentBranch.greedyAutoComplete(allPiecePrototypes)
  let currentScore = currentBranch.score;
  let temperature = initialTemperature;
  let iteration = 0;
  let startTime = Date.now();
  let lastUpdateTime = startTime;

  while (temperature > 1 && isRunning) {
    let newBranch = currentBranch.clone();
    newBranch.updateScore()
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
      updateProgress(currentBranch, temperature, iteration);
      lastUpdateTime = currentTime;
    }
  }

  const endTime = Date.now();
  console.log(`Finished annealing in in ${(endTime - startTime) / 1000} seconds:`);
  console.log(currentBranch.score)
  console.log(currentBranch.toString());
  console.log(currentBranch.toBlueprint().encode());
  console.log("Score:", currentBranch.score, '(', (currentBranch.score - startingBranch.score), ') from starter branch');
  console.log("Pieces placed:", currentBranch.piecesPlaced.length);
  console.log("Branches Evaluated:", iteration);

  stopTheSearch()
  startingBranch.display("canvas-left")
  currentBranch.display("canvas-right")

  return currentBranch;
}

function updateProgress(currentBranch, temperature, iteration) {
  startingBranch.display("canvas-left")
  currentBranch.display("canvas-right")
  console.log(`Iteration: ${iteration}, Temperature: ${temperature.toFixed(2)}`);
}

function calculateStarterBranch(blueprintInputText) {
  if (!blueprintInputText) {
    blueprintInputText = document.getElementById('blueprint-input').value;
  }
  if (!blueprintInputText) {
    return
  }

  //todo populate the piece prototypes procedurally
  allPiecePrototypes = [
    new PiecePrototype(4, 1050, "se_space_solar_panel", 'rgba(255, 99, 71, 0.5)', 'rgba(255, 99, 71, 1)'),
    new PiecePrototype(3, 100, "solar_panel", 'rgba(70, 130, 180, 0.5)', 'rgba(70, 130, 180, 1)'),
    new PiecePrototype(2, 10, "substation", 'rgba(148, 148, 148, 0.5)', 'rgba(148, 148, 148, 1)', 18, 18),
    new PiecePrototype(1, 1, "medium_electric_pole", 'rgba(139, 69, 19, 0.5)', 'rgba(139, 69, 19, 1)', 9, 7)
  ];
  //Sort by their score per tile (higher is first)
  allPiecePrototypes.sort((a, b) => b.scorePerTile - a.scorePerTile);

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

  setTitle('left-title', "Starting branch:")
  startingBranch.display("canvas-left")
  clearCanvas("canvas-right");
  setErrorMessage("")
}

function startTheSearch() {
  if (!startingBranch) {
    return setErrorMessage("Please input a blueprint first, or select a preset")
  }
  isRunning = true;
  showStopButton();
  let initialTemperature = document.getElementById('initialTemperature').value;
  let coolingRate = document.getElementById('coolingRate').value;
  simulatedAnnealing(initialTemperature, coolingRate)
}

function stopTheSearch() {
  isRunning = false;
  showStartButton();
}

document.addEventListener('DOMContentLoaded', function () {
  showStartButton();
  document.getElementById('start-btn').addEventListener('click', startTheSearch);
  document.getElementById('stop-btn').addEventListener('click', stopTheSearch);

  document.getElementById('blueprint-input').addEventListener('input', function (event) {
    calculateStarterBranch(event.target.value);
  });
  //Explicitly check upon pageload whether there's stuff saved in the input, because it doesn't trigger the event
  const savedBlueprintValue = document.getElementById('blueprint-input').value;
  if (savedBlueprintValue) {
    calculateStarterBranch(savedBlueprintValue);
  }

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

