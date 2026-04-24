let state = JSON.parse(localStorage.getItem("lecigon")) || {};

state.startTime = state.startTime || null;
state.doses = state.doses || 0;
state.doseLog = state.doseLog || [];
state.history = state.history || {};
state.warned = state.warned || false;
state.running = state.running || false;
state.remainingTime = state.remainingTime || null;

function mainAction() {
  if (!state.startTime) {
    startTimer();
    state.running = true;
  } else if (state.running) {
    stopTimer();
  } else {
    reset();
  }

  save();
}

function save() {
  localStorage.setItem("lecigon", JSON.stringify(state));
}

function getEndTime() {
  if (!state.startTime) return null;

  const BASE_TIME = 18 * 3600000; // 18 uur
  const DOSE_PENALTY = (60 + 8) * 60000; // 68 minuten

  return state.startTime + BASE_TIME - state.doses * DOSE_PENALTY;
}

function startTimer() {
  if (state.startTime && !confirm("Timer stoppen en resetten?")) return;
  let input = document.getElementById("start");

  let timeValue = input.value || new Date().toTimeString().slice(0, 5);
  input.value = timeValue;
  let [h, m] = timeValue.split(":").map(Number);

  let startDate = new Date();
  startDate.setHours(h, m, 0, 0);

  state.startTime = startDate.getTime();

  state.doses = 0;
  state.doseLog = [];
  state.warned = false;
  state.running = true;

  if (Notification.permission !== "granted") {
    Notification.requestPermission();
  }

  save();
}
function renderTimeAnalysis() {
  let history = state.history || {};
  let buckets = [0, 0, 0, 0];

  Object.values(history).forEach((day) => {
    day.forEach((time) => {
      let [h] = time.split(":").map(Number);

      if (h < 6) buckets[0]++;
      else if (h < 12) buckets[1]++;
      else if (h < 18) buckets[2]++;
      else buckets[3]++;
    });
  });

  let labels = ["00-06", "06-12", "12-18", "18-24"];
  let max = Math.max(...buckets, 1);

  let html = `<div class="card">
        <h3 style="margin-bottom:-10px;">⏱ Tijdstip analyse</h3>
    `;

  buckets.forEach((count, i) => {
    let percentage = count === max ? 100 : (count / max) * 60;

    // 👇 CRUCIAAL voor Safari
    let width = count === 0 ? "0%" : Math.max(5, percentage) + "%";
    let color = count === max ? "#2e7d32" : "#a5d6a7";

    html += `
            <div class="bar-row">
                <div class="bar-label">${labels[i]}</div>
                <div class="bar-container">
                    <div class="bar-fill" data-width="${width}" style="background:${color}"></div>
                </div>
                <div class="bar-count">${count}</div>
            </div>
        `;
  });
  let peakIndex = buckets.indexOf(max);

  html += `<div style="margin-top:-8px;font-size:12px;color:#666;">
        🔥 ${labels[peakIndex]}
    </div></div>`;

  return html;
}

function stopTimer() {
  if (!confirm("Timer stoppen?")) return;

  let endTime = getEndTime();
  let now = Date.now();

  state.remainingTime = endTime - now; // 👉 opslaan wat nog over is
  state.running = false;

  save();
}

function addDose() {
  if (!state.startTime) return;

  let now = new Date();
  let time = now.toLocaleTimeString().slice(0, 5);
  let date = now.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  state.doses++;
  state.doseLog.push(time);

  // 👇 history opslaan
  if (!state.history[date]) {
    state.history[date] = [];
  }
  state.history[date].push(time);

  save();
  if (document.getElementById("historyPage").style.display === "block") {
    renderHistory();
  }
}
function toggleHistory() {
  let view = document.getElementById("historyView");

  if (view.style.display === "none") {
    view.style.display = "block";
    renderHistory();
  } else {
    view.style.display = "none";
  }
}
function renderHistory() {
  const container = document.getElementById("historyContent");

  const history = state.history || {};
  const dates = Object.keys(history).sort().reverse();

  if (dates.length === 0) {
    container.innerHTML = "<p>Nog geen history</p>";
    return;
  }

  let html = renderTimeAnalysis(); // 👈 eerst analyse

  const DOSE_MIN = 68;

  dates.forEach((date) => {
    const doses = history[date];
    const count = doses.length;

    const reduction = count * DOSE_MIN;
    const h = Math.floor(reduction / 60);
    const m = reduction % 60;

    html += `<div class="card">
            <h3>📅 ${date}</h3>
            <div class="meta">
                Doses: ${count}<br>
                Verkorting: ${h}u ${m}m
            </div>
        `;

    doses.forEach((t, i) => {
      html += `<div class="dose-item">${i + 1} - ${t}</div>`;
    });

    html += `<button class="delete-day" onclick="deleteDay('${date}')">🗑 Verwijder dag</button>`;
    html += `</div>`;
  });

  container.innerHTML = html;
  requestAnimationFrame(() => {
    document.querySelectorAll(".bar-fill").forEach((el) => {
      el.style.width = el.dataset.width;
    });
  });
}
function deleteDay(date) {
  if (!confirm("Verwijder alle doses van " + date + "?")) return;

  delete state.history[date];
  save();
  renderHistory();
}
function removeLastDose() {
  if (state.doseLog.length === 0) return;

  let last = state.doseLog[state.doseLog.length - 1];
  if (!confirm("Verwijder dosis van " + last + "?")) return;

  // laatste tijd
  let removedTime = state.doseLog.pop();
  state.doses--;

  // 👉 vandaag bepalen
  let now = new Date();
  let date = now.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  // 👉 uit history halen
  if (state.history[date]) {
    state.history[date].pop();

    // als leeg → hele dag verwijderen
    if (state.history[date].length === 0) {
      delete state.history[date];
    }
  }

  save();
  if (document.getElementById("historyPage").style.display === "block") {
    renderHistory();
  }
}

function reset() {
  if (!confirm("Weet je zeker dat je wilt resetten?")) return;

  state.startTime = null;
  state.doses = 0;
  state.doseLog = [];
  state.warned = false;
  state.running = false;

  save(); // 👈 NIET localStorage.clear!

  let btn = document.getElementById("mainButton");
  btn.innerText = "START";
  btn.className = "start";

  document.getElementById("start").value = "";
  document.getElementById("start").style.background = "";
  document.getElementById("eindtijd").innerText = "";
  document.getElementById("aftellen").innerText = "";
  document.getElementById("doseLog").innerText = "";
}

function update() {
  if (!state.startTime) {
    document.getElementById("aftellen").innerText = "";
    document.getElementById("eindtijd").innerText = "";
    return;
  }

  let diff;

  // 👉 GESTOPT → vaste tijd
  if (!state.running && state.remainingTime !== null) {
    diff = state.remainingTime;
  } else {
    let endTime = getEndTime();
    diff = endTime - Date.now();
  }

  if (diff <= 0) {
    document.getElementById("aftellen").innerText = "⚠️ Medicijn op!";
    document.getElementById("eindtijd").innerText = "";
    return;
  }

  let h = Math.floor(diff / 3600000);
  let m = Math.floor((diff % 3600000) / 60000);
  let s = Math.floor((diff % 60000) / 1000);

  // 👉 eindtijd alleen berekenen als running
  let eindtijdText = "";

  if (state.running) {
    let end = new Date(getEndTime());
    let hh = String(end.getHours()).padStart(2, "0");
    let mm = String(end.getMinutes()).padStart(2, "0");
    let ss = String(end.getSeconds()).padStart(2, "0");

    eindtijdText = "Eindtijd: " + hh + ":" + mm + ":" + ss;
  }

  document.getElementById("eindtijd").innerText = eindtijdText;

  let text = "Nog: " + h + "u " + m + "m " + s + "s";

  if (!state.running) {
    text = "⏹ GESTOPT - " + text;
  }

  document.getElementById("aftellen").innerText = text;

  // 🔔 notificatie alleen als running
  if (state.running && diff <= 3600000 && diff > 0 && !state.warned) {
    state.warned = true;
    save();

    if (Notification.permission === "granted") {
      new Notification("Lecigon Timer", {
        body: "Nog 1 uur medicijn over!",
      });
    }

    alert("⚠️ Nog 1 uur medicijn over!");

    try {
      new Audio(
        "https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg",
      ).play();
    } catch (e) {}
  }

  // 👉 knop status
  let btn = document.getElementById("mainButton");

  if (!state.startTime) {
    btn.innerText = "START";
    btn.className = "start";
  } else if (state.running) {
    btn.innerText = "STOP";
    btn.className = "remove";
  } else {
    btn.innerText = "RESET";
    btn.className = "reset";
  }

  // achtergrond
  document.body.style.background = diff <= 3600000 ? "#ffcccc" : "#f5f5f5";

  // log
  let logText = "Extra doses:\n";
  for (let i = 0; i < state.doseLog.length; i++) {
    logText += i + 1 + " - " + state.doseLog[i] + "\n";
  }

  document.getElementById("doseLog").innerText = logText;

  document.querySelector(".dose").disabled = !state.startTime;
  document.querySelector(".remove").disabled = !state.startTime;

  // 👉 running → remainingTime bijwerken
  if (state.running) {
    state.remainingTime = diff;
  }
}

function exportCSV() {
  const history = state.history || {};

  const rows = [["Datum", "Dosis", "Tijd", "Uurblok"]];

  Object.keys(history)
    .sort(
      (a, b) =>
        new Date(a.split("-").reverse().join("-")) -
        new Date(b.split("-").reverse().join("-")),
    )
    .forEach((date) => {
      history[date].forEach((time, i) => {
        const hour = parseInt(time.split(":")[0]);

        const block =
          hour < 6
            ? "00-06"
            : hour < 12
              ? "06-12"
              : hour < 18
                ? "12-18"
                : "18-24";

        rows.push([date, i + 1, time, block]);
      });
    });

  // Excel-friendly (BOM + ; separator voor NL)
  const csv = "\uFEFF" + rows.map((r) => r.join(";")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "lecigon_export.csv";
  a.click();

  URL.revokeObjectURL(url);
}

function openHistory() {
  document.getElementById("historyPage").style.display = "block";
  renderHistory();
}

function closeHistory() {
  document.getElementById("historyPage").style.display = "none";
}

function clearHistory() {
  if (!confirm("Weet je zeker dat je alle history wilt verwijderen?")) return;

  state.history = {};
  save();

  renderHistory(); // direct updaten
}

setInterval(update, 1000);
update();

window.addEventListener("load", () => {
  if (state.startTime) {
    let start = new Date(state.startTime);

    let hh = String(start.getHours()).padStart(2, "0");
    let mm = String(start.getMinutes()).padStart(2, "0");

    document.getElementById("start").value = hh + ":" + mm;

    document.getElementById("start").style.background = "#d4edda";
  }
});

// PWA
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}
