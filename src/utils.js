function showStartButton() {
  document.getElementById('start-btn').style.display = 'inline-block';
  document.getElementById('stop-btn').style.display = 'none';
}

function showStopButton() {
  document.getElementById('start-btn').style.display = 'none';
  document.getElementById('stop-btn').style.display = 'inline-block';
}

function setSubtitle(iteration, temperature, score, bpString) {
  const subtitleElement = document.getElementById('subtitles');
  subtitleElement.classList.remove('d-none');
  subtitleElement.classList.add('d-flex');
  document.getElementById('stat-iteration').innerHTML = iteration;
  document.getElementById('stat-temperature').innerHTML = temperature;
  document.getElementById('stat-score').innerHTML = score;

  const button = document.getElementById('copyButton');
  let isButtonClickable = true;
  let timeoutId = null;

  function onClick() {
    if (!isButtonClickable) return;
    const originalText = button.innerHTML;
    navigator.clipboard.writeText(bpString);
    button.innerHTML = 'Copied!';
    isButtonClickable = false;
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      button.innerHTML = originalText;
      isButtonClickable = true;
    }, 2000);
  }

  button.onclick = onClick;
}

function setErrorMessage(value) {
  document.getElementById('errormessage').innerHTML = value;
}

module.exports = {
  showStartButton,
  showStopButton,
  setSubtitle,
  setErrorMessage
}