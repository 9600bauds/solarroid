const clearCanvas = elemId => {
  const canvas = document.getElementById(elemId);
  canvas.width = canvas.width //Stackoverflow tells me not to do this and to do the other thing, but this one actually works and the other one doesn't.
  /*const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(1, 0, 0, 1, 0, 0)*/
}

function showStartButton() {
  document.getElementById('start-btn').style.display = 'inline-block';
  document.getElementById('stop-btn').style.display = 'none';
}

function showStopButton() {
  document.getElementById('start-btn').style.display = 'none';
  document.getElementById('stop-btn').style.display = 'inline-block';
}

function setTitle(elemId, value) {
  document.getElementById(elemId).innerHTML = value;
}

function setErrorMessage(value) {
  document.getElementById('errormessage').innerHTML = value;
}

module.exports = {
  clearCanvas,
  showStartButton,
  showStopButton,
  setTitle,
  setErrorMessage
}