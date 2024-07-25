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
  showStartButton,
  showStopButton,
  setTitle,
  setErrorMessage
}