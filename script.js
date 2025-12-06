/* Fixed script.js — uses evDate (date input) instead of missing evDay.
   Full repeat support and weekly view (Mon→Sun).
   Save as script.js
*/

const STORAGE_KEY = "wb_week_events_v2";

/* --- Utilities --- */
function pad(n){ return n<10? "0"+n : ""+n; }
function fmt12(h,m){
  let am = h>=12?"PM":"AM"; let hh = h%12; if(hh===0) hh=12;
  return `${hh}:${pad(m)} ${am}`;
}
function jsToMonIndex(jsDay){ return (jsDay + 6) % 7; }
function dateOnly(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function addMonths(date, n){
  const y = date.getFullYear(), m = date.getMonth() + n;
  const d = date.getDate();
  const nd = new Date(y, m, 1);
  const last = new Date(nd.getFullYear(), nd.getMonth()+1, 0).getDate();
  nd.setDate(Math.min(d, last));
  return nd;
}
function addYears(date, n){
  const nd = new Date(date);
  nd.setFullYear(nd.getFullYear()+n);
  return nd;
}
function escapeHtml(s){ return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }

/* --- State --- */
let events = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let viewDate = new Date(); viewDate.setHours(0,0,0,0);
const HOURS_START = 1, HOURS_END = 23, ROW_HEIGHT = 48;

/* --- DOM refs --- */
const miniCal = document.getElementById("miniCal");
const miniMonthLabel = document.getElementById("miniMonthLabel");
const miniPrev = document.getElementById("miniPrev");
const miniNext = document.getElementById("miniNext");
const todayBtn = document.getElementById("todayBtn");
const createBtn = document.getElementById("createBtn");
const weekHeader = document.getElementById("weekHeader");
const gridContainer = document.getElementById("gridContainer");
const weekLabel = document.getElementById("weekLabel");
const tzOffset = document.getElementById("tzOffset");

const popup = document.getElementById("popup");
const evTitle = document.getElementById("evTitle");
const evDate = document.getElementById("evDate");        // date input (anchor)
const evStart = document.getElementById("evStart");
const evEnd = document.getElementById("evEnd");
const evRepeat = document.getElementById("evRepeat");
const customRow = document.getElementById("customRow");
const customInterval = document.getElementById("customInterval");
const customUnit = document.getElementById("customUnit");
const evNotify = document.getElementById("evNotify");
const saveEv = document.getElementById("saveEv");
const cancelEv = document.getElementById("cancelEv");
const popupTitle = document.getElementById("popupTitle");

/* --- init --- */
function init(){
  tzOffset.innerText = -new Date().getTimezoneOffset()/60;
  bindUI();
  renderMini();
  renderWeek();
  scheduleAll();
}
function bindUI(){
  if(miniPrev) miniPrev.onclick = ()=>{ changeMiniMonth(-1) };
  if(miniNext) miniNext.onclick = ()=>{ changeMiniMonth(1) };
  if(todayBtn) todayBtn.onclick = ()=>{ viewDate = new Date(); viewDate.setHours(0,0,0,0); renderWeek(); renderMini(); };
  if(createBtn) createBtn.onclick = ()=>openPopupForNew();
  const prevW = document.getElementById("prevWeek");
  const nextW = document.getElementById("nextWeek");
  if(prevW) prevW.onclick = ()=>{ viewDate.setDate(viewDate.getDate()-7); renderWeek(); renderMini(); };
  if(nextW) nextW.onclick = ()=>{ viewDate.setDate(viewDate.getDate()+7); renderWeek(); renderMini(); };
  if(cancelEv) cancelEv.onclick = ()=>closePopup();
  if(saveEv) saveEv.onclick = saveEvent;
  if(evRepeat) evRepeat.onchange = ()=>{ if(customRow) customRow.classList.toggle("hidden", evRepeat.value !== "custom"); };
}

/* --- mini month --- */
let miniAnchor = new Date(); miniAnchor.setHours(0,0,0,0);
function changeMiniMonth(delta){ miniAnchor.setMonth(miniAnchor.getMonth()+delta); renderMini(); }
function renderMini(){
  miniMonthLabel.innerText = miniAnchor.toLocaleString(undefined,{month:'long', year:'numeric'});
  miniCal.innerHTML = "";
  const m = miniAnchor.getMonth(), y = miniAnchor.getFullYear();
  const first = new Date(y,m,1);
  const startDay = jsToMonIndex(first.getDay()); // Monday-first
  const days = new Date(y, m+1, 0).getDate();
  const head = document.createElement("div");
  head.style.display="grid"; head.style.gridTemplateColumns="repeat(7,1fr)";
  const labels = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  labels.forEach(l=>{ let e=document.createElement("div"); e.style.textAlign="center"; e.style.fontSize="11px"; e.innerText=l; head.appendChild(e); });
  miniCal.appendChild(head);
  const grid = document.createElement("div");
  grid.style.display="grid"; grid.style.gridTemplateColumns="repeat(7,1fr)"; grid.style.gap="0px";
  for(let i=0;i<startDay;i++){ let b=document.createElement("div"); b.className="mini-day"; b.innerText=""; grid.appendChild(b); }
  for(let d=1; d<=days; d++){
    const cell = document.createElement("div"); cell.className="mini-day"; cell.innerText = d;
    const cellDate = new Date(y,m,d); const today = new Date(); today.setHours(0,0,0,0);
    if(cellDate.getTime()===today.getTime()) cell.classList.add("today");
    cell.onclick = ()=>{ viewDate = new Date(y,m,d); viewDate.setHours(0,0,0,0); renderWeek(); };
    grid.appendChild(cell);
  }
  miniCal.appendChild(grid);
}

/* --- week grid --- */
function startOfWeek(date){
  const d = new Date(date); d.setHours(0,0,0,0);
  const monIndex = jsToMonIndex(d.getDay());
  d.setDate(d.getDate() - monIndex);
  return d;
}
function renderWeek(){
  const start = startOfWeek(viewDate);
  const end = new Date(start); end.setDate(end.getDate()+6);
  weekLabel.innerText = `${start.toDateString()} — ${end.toDateString()}`;

  weekHeader.innerHTML=""; const firstCell = document.createElement("div"); firstCell.className="col"; weekHeader.appendChild(firstCell);
  const cols = [];
  for(let i=0;i<7;i++){
    const d = new Date(start); d.setDate(start.getDate()+i);
    const col = document.createElement("div"); col.className="col";
    const dayName = d.toLocaleString(undefined,{weekday:'long'}); const dayNum = d.getDate();
    col.innerHTML = `<div class="weekday">${dayName}</div><div class="date">${dayNum}</div>`;
    if(dateOnly(d).getTime() === dateOnly(new Date()).getTime()) col.classList.add("today");
    weekHeader.appendChild(col); cols.push(d);
  }

  // grid creation
  gridContainer.innerHTML="";
  for(let h=HOURS_START; h<=HOURS_END; h++){
    const label = document.createElement("div"); label.className="hour-label"; label.innerText = fmt12(h,0); gridContainer.appendChild(label);
    for(let d=0; d<7; d++){
      const cell = document.createElement("div"); cell.className="day-cell";
      cell.dataset.dayIndex = d; cell.dataset.hour = h;
      cell.onclick = ()=> openPopupForHour(d,h);
      gridContainer.appendChild(cell);
    }
  }

  renderEventsOnGrid(start);
}

/* --- repeat logic helpers --- */
function eventOccursOnDate(ev, date){
  const evOrigin = new Date(ev.eventDateY, ev.eventDateM, ev.eventDateD);
  const d0 = dateOnly(evOrigin);
  const target = dateOnly(date);

  if(ev.repeat === "none"){
    return d0.getTime() === target.getTime();
  }
  if(ev.repeat === "daily"){
    return target.getTime() >= d0.getTime();
  }
  if(ev.repeat === "weekly"){
    const originWeekday = jsToMonIndex(d0.getDay());
    const targetWeekday = jsToMonIndex(target.getDay());
    return target.getTime() >= d0.getTime() && originWeekday === targetWeekday;
  }
  if(ev.repeat === "biweekly"){
    if(target.getTime() < d0.getTime()) return false;
    const diffDays = Math.floor((target - d0)/(1000*60*60*24));
    const weeks = Math.floor(diffDays/7);
    const originWeekday = jsToMonIndex(d0.getDay()), targetWeekday = jsToMonIndex(target.getDay());
    return originWeekday === targetWeekday && (weeks % 2 === 0);
  }
  if(ev.repeat === "monthly"){
    if(target.getTime() < d0.getTime()) return false;
    return target.getDate() === d0.getDate();
  }
  if(ev.repeat === "yearly"){
    if(target.getTime() < d0.getTime()) return false;
    return target.getDate() === d0.getDate() && target.getMonth() === d0.getMonth();
  }
  if(ev.repeat === "custom"){
    if(target.getTime() < d0.getTime()) return false;
    const n = Number(ev.customInterval) || 1;
    const unit = ev.customUnit || "days";
    if(unit === "days"){
      const diffDays = Math.floor((target - d0)/(1000*60*60*24));
      return (diffDays % n) === 0;
    }
    if(unit === "weeks"){
      const diffDays = Math.floor((target - d0)/(1000*60*60*24));
      const weeks = Math.floor(diffDays/7);
      return (weeks % n) === 0 && jsToMonIndex(d0.getDay()) === jsToMonIndex(target.getDay());
    }
    if(unit === "months"){
      const months = (target.getFullYear() - d0.getFullYear())*12 + (target.getMonth() - d0.getMonth());
      return months % n === 0 && target.getDate() === d0.getDate();
    }
    if(unit === "years"){
      const yrs = target.getFullYear() - d0.getFullYear();
      return yrs % n === 0 && target.getMonth() === d0.getMonth() && target.getDate() === d0.getDate();
    }
  }
  return false;
}

/* --- render events into the current week --- */
function renderEventsOnGrid(weekStart){
  document.querySelectorAll(".event").forEach(e=>e.remove());
  for(let idx=0; idx<events.length; idx++){
    const ev = events[idx];
    for(let col=0; col<7; col++){
      const date = new Date(weekStart); date.setDate(weekStart.getDate()+col);
      if(!eventOccursOnDate(ev, date)) continue;
      const startMinutes = ev.startHour*60 + ev.startMin;
      const endMinutes = ev.endHour*60 + ev.endMin;
      const durationMin = Math.max(10, endMinutes - startMinutes);
      const hour = Math.floor(ev.startHour);
      const hourCell = document.querySelector(`.day-cell[data-day-index='${col}'][data-hour='${hour}']`);
      if(!hourCell) continue;
      const topOffset = (ev.startMin/60) * ROW_HEIGHT;
      const heightPx = (durationMin/60) * ROW_HEIGHT;
      const block = document.createElement("div");
      block.className = "event";
      block.style.top = `${topOffset}px`;
      block.style.height = `${Math.max(18,heightPx)}px`;
      block.dataset.idx = idx;
      block.innerHTML = `<strong>${escapeHtml(ev.title)}</strong><span class="meta">${fmt12(ev.startHour,ev.startMin)} - ${fmt12(ev.endHour,ev.endMin)}</span>
                         <button class="del" title="Delete" onclick="deleteEvent(${idx})">✕</button>`;
      hourCell.appendChild(block);
    }
  }
}

/* --- popup --- */
function openPopupForHour(dayIndex, hour){
  popupTitle.innerText = "Create event";
  evTitle.value = "";
  const start = startOfWeek(viewDate);
  const target = new Date(start); target.setDate(start.getDate() + dayIndex);
  evDate.value = target.toISOString().slice(0,10);
  evStart.value = `${pad(hour)}:00`;
  evEnd.value = `${pad(Math.min(hour+1,HOURS_END))}:00`;
  evRepeat.value = "none"; if(customRow) customRow.classList.add("hidden");
  evNotify.value = "5";
  popup.classList.remove("hidden");
}
function openPopupForNew(){
  const today = new Date(); popupTitle.innerText = "Create event"; evTitle.value=""; evDate.value = today.toISOString().slice(0,10);
  evStart.value = "09:00"; evEnd.value = "10:00"; evRepeat.value="none"; if(customRow) customRow.classList.add("hidden"); evNotify.value="5";
  popup.classList.remove("hidden");
}
function closePopup(){ popup.classList.add("hidden"); }
function saveEvent(){
  const title = evTitle.value.trim(); if(!title){ alert("Title required"); return; }
  const dateParts = (evDate.value || "").split("-");
  const y = parseInt(dateParts[0],10), m = parseInt(dateParts[1],10), d = parseInt(dateParts[2],10);
  if(!y || !m || !d){ alert("Valid date required"); return; }
  const [sh,sm] = evStart.value.split(":").map(x=>parseInt(x||"0"));
  const [eh,em] = evEnd.value.split(":").map(x=>parseInt(x||"0"));
  if(eh*60+em <= sh*60+sm){ alert("End must be after start"); return; }
  const repeat = evRepeat.value;
  const notifyBefore = parseInt(evNotify.value || "0");
  const evObj = {
    title,
    startHour: sh, startMin: sm,
    endHour: eh, endMin: em,
    repeat,
    notifyBefore,
    eventDateY: y, eventDateM: m-1, eventDateD: d
  };
  if(repeat==="custom"){
    evObj.customInterval = parseInt(customInterval.value||"1");
    evObj.customUnit = customUnit.value;
  }
  events.push(evObj);
  persist();
  scheduleEvent(evObj);
  renderWeek();
  closePopup();
}

/* --- storage --- */
function persist(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(events)); }

/* --- delete --- */
window.deleteEvent = function(index){
  if(!confirm("Delete this event?")) return;
  events.splice(index,1);
  persist();
  scheduleAll();
  renderWeek();
};

/* --- scheduling notifications --- */
let activeTimers = [];
function clearTimers(){ activeTimers.forEach(t=>clearTimeout(t)); activeTimers = []; }
function scheduleAll(){ clearTimers(); events.forEach(e=> scheduleEvent(e)); }
function scheduleEvent(ev){
  const now = new Date();
  function nextOccurrenceAfter(baseDate){
    let origin = new Date(ev.eventDateY, ev.eventDateM, ev.eventDateD, ev.startHour, ev.startMin, 0,0);
    if(ev.repeat === "none"){
      if(origin <= baseDate) return null;
      return origin;
    }
    let candidate = new Date(origin);
    if(candidate <= baseDate){
      let safety=0;
      while(safety < 1000 && candidate <= baseDate){
        safety++;
        if(ev.repeat==="daily"){ candidate.setDate(candidate.getDate()+1); }
        else if(ev.repeat==="weekly"){ candidate.setDate(candidate.getDate()+7); }
        else if(ev.repeat==="biweekly"){ candidate.setDate(candidate.getDate()+14); }
        else if(ev.repeat==="monthly"){ candidate = addMonths(candidate, 1); }
        else if(ev.repeat==="yearly"){ candidate = addYears(candidate, 1); }
        else if(ev.repeat==="custom"){
          const n = Number(ev.customInterval) || 1;
          const u = ev.customUnit || "days";
          if(u==="days"){ candidate.setDate(candidate.getDate()+n); }
          else if(u==="weeks"){ candidate.setDate(candidate.getDate()+7*n); }
          else if(u==="months"){ candidate = addMonths(candidate, n); }
          else if(u==="years"){ candidate = addYears(candidate, n); }
        } else { candidate.setDate(candidate.getDate()+1); }
      }
    }
    return candidate > baseDate ? candidate : null;
  }

  let next = nextOccurrenceAfter(now);
  if(!next) return;
  const notifyMs = (ev.notifyBefore || 0) * 60 * 1000;
  const notifyAt = new Date(next.getTime() - notifyMs);
  const diff = notifyAt - now;
  if(diff >= 0){
    const t = setTimeout(()=> {
      const timeStr = fmt12(ev.startHour, ev.startMin);
      const beforeText = ev.notifyBefore===0? "at time" : (ev.notifyBefore<60? ev.notifyBefore+" min before" : (ev.notifyBefore/60)+" hr before");
      if("Notification" in window && Notification.permission === "granted"){
        new Notification(`${ev.title}`, { body: `${timeStr} (${beforeText})` });
      } else {
        alert(`Reminder: ${ev.title} at ${timeStr} (${beforeText})`);
      }
      if(ev.repeat !== "none"){
        scheduleEvent(ev);
      }
    }, diff);
    activeTimers.push(t);
  } else {
    if(ev.repeat !== "none"){
      scheduleEvent(ev);
    }
  }
}

/* --- initial render & schedule --- */
init();
events.forEach(e => scheduleEvent(e));
