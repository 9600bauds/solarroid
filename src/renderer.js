const clearCanvas = (canvas) => {
  canvas.width = canvas.width //Stackoverflow tells me not to do this and to do the other thing, but this one actually works and the other one doesn't.
  /*const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(1, 0, 0, 1, 0, 0)*/
}

const renderBranch = (branch) => {
  const pixelsPerUnit = 20;
  const borderSize = 2;

  // Get our dimensions
  let maxX = branch.startingGrid.width;
  let maxY = branch.startingGrid.height;
  const logicalWidth = maxX * pixelsPerUnit;
  const logicalHeight = maxY * pixelsPerUnit;

  //Create the canvas
  const container = document.getElementById('branch-container');
  const canvas = document.getElementById('branch-canvas');
  clearCanvas(canvas);
  const ctx = canvas.getContext('2d');

  //Scale ourselves
  canvas.height = container.clientHeight;
  const scale = canvas.height / logicalHeight;
  canvas.width = logicalWidth * scale;
  ctx.scale(scale, scale);

  //Actually draw the thing
  const piecesArray = Array.from(branch.piecesPlaced);
  const powerPoleSet = new Set(piecesArray.filter(piece => piece.prototype.isPowerPole()));
  branch.piecesPlaced.forEach(piece => {
    const size = piece.prototype.size * pixelsPerUnit;
    const x = piece.x * pixelsPerUnit;
    const y = piece.y * pixelsPerUnit;

    let isSupplied = branch.isPieceSupplied(piece, powerPoleSet);

    ctx.fillStyle = isSupplied ? piece.prototype.fillColor : "rgba(0, 0, 0, 0.5)";
    ctx.clearRect(x + borderSize, y + borderSize, size - borderSize * 2, size - borderSize * 2);
    ctx.fillRect(x + borderSize, y + borderSize, size - borderSize * 2, size - borderSize * 2);

    ctx.strokeStyle = piece.prototype.borderColor;
    ctx.lineWidth = 2; // Border width
    ctx.strokeRect(x + borderSize / 2, y + borderSize / 2, size - borderSize, size - borderSize);
  });
}

module.exports = {
  clearCanvas,
  renderBranch
}