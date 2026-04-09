var currentTime = new Date();
var timeScale = 5000;

// The function is called in the animate function
var isTimePaused = false;
function updateTime(delta) {
  if (!isTimePaused) {
    currentTime.setTime(currentTime.getTime() + timeScale * delta);
  }
}

// This function returns a float between 0 and 1
// which indicates the proportion of the time passed
// since the first day of the year to the total time
// of a year
function nowInYear() {
  var firstDayOfTheYear = new Date(currentTime.getFullYear(), 0, 1);
  var dif = currentTime.getTime() - firstDayOfTheYear.getTime();
  return dif / 31556926000;
}

function nowInDay() {
  var dif =
    (currentTime.getUTCHours() +
      currentTime.getUTCMinutes() / 60 +
      currentTime.getUTCSeconds() / 3600) /
    24;
  return dif;
}

function getVietnamTime() {
  // Vietnam is UTC+7
  var vnOffset = 7 * 60 * 60 * 1000;
  var vnTime = new Date(currentTime.getTime() + vnOffset);
  return vnTime;
}

function formatVietnamTime() {
  var vnTime = getVietnamTime();
  var hours = vnTime.getUTCHours().toString().padStart(2, "0");
  var minutes = vnTime.getUTCMinutes().toString().padStart(2, "0");
  var seconds = vnTime.getUTCSeconds().toString().padStart(2, "0");
  var date = vnTime.getUTCDate().toString().padStart(2, "0");
  var month = (vnTime.getUTCMonth() + 1).toString().padStart(2, "0");
  var year = vnTime.getUTCFullYear();
  return (
    hours +
    ":" +
    minutes +
    ":" +
    seconds +
    " " +
    date +
    "/" +
    month +
    "/" +
    year
  );
}

var newMoonEpoch = new Date("2018-01-17");
newMoonEpoch.setUTCHours(2);
newMoonEpoch.setUTCMinutes(17);
function nowInLunarMonth() {
  var c = currentTime.getTime();
  var o = newMoonEpoch.getTime();
  var t = 29.530588853 * 24 * 3600 * 1000;
  return (c - o - Math.floor((c - o) / t) * t) / t;
}

function fasterTime() {
  if (timeScale < 1000000) {
    timeScale *= 10;
  }
}

function slowerTime() {
  if (timeScale > 0.1) {
    timeScale /= 10;
  }
}
