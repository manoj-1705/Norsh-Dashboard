/* ============ SETTINGS: change only this block ============ */
const CONFIG = {
  SHEET_ID: "1q4WHoinJKmdL1AFYV1p3Ns5je1rS94XpPOKiCXJ4AOI",
  REFRESH_SECONDS: 30,
  // Tab names exactly as they appear at the bottom of your Google Sheet
  TABS: {
    plan: "Monthly Plan",
    summary: "Monthly Summary",
    leads: "Lead Generation Tracker",
    visits: "Daily Visit Log",
    followups: "Follow-up Tracker"
  },
  // Optional: if the default method fails, paste a "Publish to web" CSV link
  // for a tab here (File > Share > Publish to web > pick the tab > CSV).
  CSV_OVERRIDE: { plan: "", summary: "", leads: "", visits: "", followups: "" }
};
/* ========================================================== */

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const cell = (r, i) => (r && r[i] != null ? String(r[i]).trim() : "");
const clean = s => (/[A-Za-z0-9]/.test(s) ? s : "");
const isBlank = r => !r || r.every(c => !String(c).trim());

$("open").href = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/edit`;

// ---------- fetching ----------
function sheetUrl(key) {
  if (CONFIG.CSV_OVERRIDE[key]) return CONFIG.CSV_OVERRIDE[key];
  return `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:csv&headers=0&sheet=${encodeURIComponent(CONFIG.TABS[key])}`;
}
function parseCSV(text) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else if (c !== "\r") f += c;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  return rows;
}
async function load(key) {
  const res = await fetch(sheetUrl(key), { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return parseCSV(await res.text());
}

// ---------- status ----------
function setStatus(ok, text) { $("dot").className = "dot " + (ok ? "ok" : "bad"); $("when").textContent = text; }
function showError(msg) { const m = $("msg"); m.textContent = msg; m.style.display = "block"; setStatus(false, "Not connected"); }
function hideError() { $("msg").style.display = "none"; }

// ---------- schedule ----------
const DN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], WD = [];
for (let d = 2; d <= 30; d++) { const w = (d - 1) % 7; if (w > 0 && w < 6) WD.push(d); }   // weekdays of Nov 2026
const zoneClass = z => /^(High|Quotation|Final|Monthly)/.test(z) ? "c" : /^Doddaballapur/.test(z) ? "d" : /^Devanahalli/.test(z) ? "v" : "y";

function renderPlan(rows) {
  const plan = rows.filter(r => /^\d+$/.test(cell(r, 0)));
  if (!plan.length) { $("plan").innerHTML = '<div class="empty">No days found in the Monthly Plan sheet.</div>'; return; }
  let h = "";
  for (let i = 0; i < plan.length; i += 5) {
    const wk = plan.slice(i, i + 5);
    const first = WD[+cell(wk[0], 0) - 1], last = WD[+cell(wk[wk.length - 1], 0) - 1];
    h += `<div class="week"><div class="wk">Week ${i / 5 + 1}<small>${first ? (first === last ? first + " Nov" : first + "–" + last + " Nov") : ""}</small></div><div class="days">`;
    wk.forEach(r => {
      const n = +cell(r, 0), dd = WD[n - 1];
      const label = clean(cell(r, 1)) || (dd ? DN[(dd - 1) % 7] + " " + dd : "Day " + n);
      const st = cell(r, 12) || "Planned", extra = [];
      if (cell(r, 8)) extra.push(esc(cell(r, 8)) + " visits");
      if (cell(r, 9)) extra.push(esc(cell(r, 9)) + " samples/quotes");
      if (cell(r, 10)) extra.push(esc(cell(r, 10)) + " follow-ups due");
      h += `<div class="day z-${zoneClass(cell(r, 3))}${st === "Completed" ? " done" : ""}">
        <em><span>${esc(label)}</span><span class="st ${esc(st.replace(/ /g, "-"))}">${esc(st)}</span></em>
        <strong>${esc(cell(r, 3))}</strong><br>${esc(cell(r, 4))}
        ${extra.length ? "<small>" + extra.join(" · ") + "</small>" : ""}
        ${cell(r, 11) ? "<small>" + esc(cell(r, 11)) + "</small>" : ""}</div>`;
    });
    h += "</div></div>";
  }
  $("plan").innerHTML = h;
}

// ---------- summary ----------
function renderSummary(rows) {
  const mi = rows.findIndex(r => cell(r, 0) === "Metric");
  let h = "";
  if (mi >= 0) for (let i = mi + 1; i < rows.length && !isBlank(rows[i]) && cell(rows[i], 0); i++)
    h += `<div class="stat"><b>${esc(cell(rows[i], 1) || "0")}</b><span>${esc(cell(rows[i], 0))}</span></div>`;
  $("stats").innerHTML = h || '<div class="empty">No summary found.</div>';
  const c = rows.filter(r => cell(r, 0).charAt(0) === "☐").map(r => `<li>${esc(cell(r, 0).replace(/^☐\s*/, ""))}</li>`).join("");
  $("check").innerHTML = c || "<li>No checklist found.</li>";
}

// ---------- prospects ----------
const state = { leads: [], zone: "All", q: "" };
function parseLeads(rows) {
  let zone = "", out = [];
  rows.forEach(r => {
    const filled = r.filter(c => String(c).trim());
    if (filled.length === 1 && cell(r, 0) && !/^\d+$/.test(cell(r, 0))) { zone = cell(r, 0); return; }
    if (/^\d+$/.test(cell(r, 0)) && cell(r, 1)) out.push({ zone: zone || "Other", name: cell(r, 1), type: cell(r, 2), area: cell(r, 3), addr: cell(r, 4) });
  });
  state.leads = out; renderLeads();
}
function renderLeads() {
  const L = state.leads, zones = ["All"];
  L.forEach(l => { if (!zones.includes(l.zone)) zones.push(l.zone); });
  $("zones").innerHTML = zones.map(z => {
    const n = z === "All" ? L.length : L.filter(l => l.zone === z).length;
    return `<button type="button" data-z="${esc(z)}" aria-pressed="${z === state.zone}">${esc(z)} (${n})</button>`;
  }).join("");
  const q = state.q.toLowerCase();
  const v = L.filter(l => (state.zone === "All" || l.zone === state.zone) && (!q || (l.name + " " + l.addr).toLowerCase().includes(q)));
  if (!v.length) { $("leads").innerHTML = '<div class="empty">No prospects match.</div>'; return; }
  $("leads").innerHTML = "<table><thead><tr><th>#</th><th>Business</th><th>Type</th><th>Area</th><th>Address</th><th>Map</th></tr></thead><tbody>" +
    v.map((l, i) => `<tr><td>${i + 1}</td><td><strong>${esc(l.name)}</strong></td><td>${esc(l.type)}</td><td>${esc(l.area)}</td><td>${esc(l.addr)}</td>
      <td><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.name + " " + l.addr)}" target="_blank" rel="noopener">Open</a></td></tr>`).join("") + "</tbody></table>";
}
$("zones").addEventListener("click", e => { const z = e.target.dataset && e.target.dataset.z; if (z) { state.zone = z; renderLeads(); } });
$("q").addEventListener("input", e => { state.q = e.target.value; renderLeads(); });

// ---------- visits and follow-ups ----------
const STAGES = ["Contacted", "Interested", "Sample Shared", "Quotation Sent", "Negotiation", "Follow-up Due", "Lost", "On Hold"];
let fuRows = [];
function renderPipe() {
  $("pipe").innerHTML = STAGES.map(s => `<div class="${s === "Lost" || s === "On Hold" ? "end" : ""}"><b>${fuRows.filter(r => cell(r, 11) === s).length}</b>${esc(s)}</div>`).join("");
}
function renderVisits(rows) {
  const v = rows.filter(r => cell(r, 5) && cell(r, 5) !== "Business Name");
  if (!v.length) { $("visits").innerHTML = '<div class="empty">No visits logged yet. Add a row in the Daily Visit Log sheet and it shows here.</div>'; return; }
  $("visits").innerHTML = "<table style='min-width:420px'><thead><tr><th>Date</th><th>Business</th><th>Outcome</th><th>Status</th></tr></thead><tbody>" +
    v.slice(-10).reverse().map(r => `<tr><td>${esc(cell(r, 1))}</td><td>${esc(cell(r, 5))}</td><td>${esc(cell(r, 17))}</td><td>${esc(cell(r, 21))}</td></tr>`).join("") + "</tbody></table>";
}
function renderFollowups(rows) {
  fuRows = rows.filter(r => cell(r, 1) && cell(r, 1) !== "Business Name");
  renderPipe();
  if (!fuRows.length) { $("fus").innerHTML = '<div class="empty">No follow-ups yet. Add interested prospects in the Follow-up Tracker sheet.</div>'; return; }
  const f = [...fuRows].sort((a, b) => (cell(a, 7) < cell(b, 7) ? -1 : 1));
  $("fus").innerHTML = "<table style='min-width:420px'><thead><tr><th>Business</th><th>Next date</th><th>Next action</th><th>Potential</th><th>Status</th></tr></thead><tbody>" +
    f.map(r => `<tr><td>${esc(cell(r, 1))}</td><td>${esc(cell(r, 7))}</td><td>${esc(cell(r, 8))}</td><td class="pot-${esc(cell(r, 9))}">${esc(cell(r, 9))}</td><td>${esc(cell(r, 11))}</td></tr>`).join("") + "</tbody></table>";
}

// ---------- load everything ----------
const RENDER = { plan: renderPlan, summary: renderSummary, leads: parseLeads, visits: renderVisits, followups: renderFollowups };
async function loadAll() {
  const keys = Object.keys(RENDER);
  const results = await Promise.allSettled(keys.map(load));
  let failed = 0;
  results.forEach((r, i) => { if (r.status === "fulfilled") RENDER[keys[i]](r.value); else failed++; });
  if (failed === keys.length) {
    showError(location.protocol === "file:"
      ? "Can’t read the sheet from a file:// page. In VS Code, right-click index.html and choose “Open with Live Server” (or run a local server), then reload."
      : "Couldn’t read the Google Sheet. Check that sharing is set to “Anyone with the link can view”, that the tab names in app.js match your sheet, and that you’re online. If it still fails, use the CSV_OVERRIDE links described in README.md.");
  } else {
    hideError();
    setStatus(true, "Live from Google Sheets · updated " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + (failed ? ` · ${failed} tab(s) failed` : ""));
  }
}
$("refresh").addEventListener("click", loadAll);
loadAll();
setInterval(loadAll, CONFIG.REFRESH_SECONDS * 1000);
