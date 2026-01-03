// events.js — loads your CSV, builds a Leaflet map with clustering, and an in-map day toggle control
(async function(){
  const csvPath = 'Speedquizzingexport20260102.csv';

  const map = L.map('map').setView([20,0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const markerCluster = L.markerClusterGroup();
  map.addLayer(markerCluster);

  function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function parseDayLabel(row){
    const repeat = (row.repeat_day||'').trim();
    if(repeat) return repeat;
    const dateStr = (row.date||'').trim();
    if(dateStr){
      // try dd-MMM-yy or dd-MMM-YYYY
      const parts = dateStr.split('-');
      if(parts.length===3){
        let [dd, mon, yy] = parts.map(p=>p.trim());
        let year = yy.length===2 ? '20'+yy : yy;
        const iso = `${dd} ${mon} ${year}`;
        const dt = new Date(iso);
        if(!isNaN(dt)) return dt.toLocaleDateString(undefined,{weekday:'long'});
      }
      const dt2 = new Date(dateStr);
      if(!isNaN(dt2)) return dt2.toLocaleDateString(undefined,{weekday:'long'});
    }
    return 'Unknown';
  }

  // CSV will be provided via file input (works when opening the HTML directly)
  const markersByDay = {};
  const daysSet = new Set();

  function clearData(){
    markerCluster.clearLayers();
    Object.keys(markersByDay).forEach(k=>markersByDay[k]=[]);
    daysSet.clear();
  }

  function processRows(rows){
    clearData();
    rows.forEach(r=>{
      const lat = parseFloat(r.latitude);
      const lng = parseFloat(r.longitude);
      if(!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const day = parseDayLabel(r);
      daysSet.add(day);
      markersByDay[day] = markersByDay[day] || [];
      const title = r.event_title || r.venue_name || r.event_id || 'Event';
      const m = L.marker([lat,lng]);
      m.bindPopup(`<strong>${escapeHtml(title)}</strong><br/>${escapeHtml(r.date||'')}`);
      markersByDay[day].push(m);
    });

    // build days array and UI control (recreate control by removing old then adding)
    const weekdayOrder = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday','Unknown'];
    const days = Array.from(daysSet).sort((a,b)=>{
      const ia = weekdayOrder.indexOf(a)>=0 ? weekdayOrder.indexOf(a) : 999;
      const ib = weekdayOrder.indexOf(b)>=0 ? weekdayOrder.indexOf(b) : 999;
      if(ia!==ib) return ia-ib;
      return String(a).localeCompare(String(b));
    });

    // show all markers by default
    const dayState = {};
    days.forEach(d=> dayState[d]=true);

    function refreshCluster(){
      markerCluster.clearLayers();
      Object.keys(dayState).forEach(d=>{
        if(dayState[d]) markersByDay[d].forEach(m=> markerCluster.addLayer(m));
      });
    }

    refreshCluster();

    // remove any existing control and add a new one
    const existing = document.querySelector('.leaflet-control.day-toggle');
    if(existing && existing._leaflet_pos){
      existing.parentNode && existing.parentNode.removeChild(existing);
    }

    const DayToggleControl = L.Control.extend({
      options: { position: 'topright' },
      onAdd: function(){
        const container = L.DomUtil.create('div','day-toggle');
        container.innerHTML = `<div style="font-weight:600;margin-bottom:6px">Show events by day</div>`;

        days.forEach(d=>{
          const btn = L.DomUtil.create('button','day-btn', container);
          const count = (markersByDay[d]||[]).length;
          btn.innerHTML = `${d} <span class="day-count">(${count})</span>`;
          if(dayState[d]) btn.classList.add('active');
          btn.onclick = function(e){
            L.DomEvent.stopPropagation(e);
            dayState[d] = !dayState[d];
            btn.classList.toggle('active', dayState[d]);
            refreshCluster();
          };
        });

        const controls = L.DomUtil.create('div','controls', container);
        const selectAll = L.DomUtil.create('button','','controls');
        selectAll.textContent = 'Select All';
        selectAll.onclick = function(e){ L.DomEvent.stopPropagation(e); days.forEach(d=>dayState[d]=true); updateButtons(container); refreshCluster(); };
        const clearAll = L.DomUtil.create('button','','controls');
        clearAll.textContent = 'Clear All';
        clearAll.onclick = function(e){ L.DomEvent.stopPropagation(e); days.forEach(d=>dayState[d]=false); updateButtons(container); refreshCluster(); };

        return container;
      }
    });

    function updateButtons(container){
      const btns = container.querySelectorAll('.day-btn');
      btns.forEach(btn=>{
        const day = btn.innerText.split(' ')[0];
        const active = !!dayState[day];
        btn.classList.toggle('active', active);
      });
    }

    map.addControl(new DayToggleControl());
    window._eventMap = { map, markerCluster, markersByDay, dayState, refreshCluster };
  }

  // wire file input and drag/drop
  const fileInput = document.getElementById('csvFile');
  if(fileInput){
    fileInput.addEventListener('change', (ev)=>{
      const f = ev.target.files && ev.target.files[0];
      if(!f) return;
      Papa.parse(f, { header: true, skipEmptyLines: true, complete: (res)=>{ processRows(res.data||[]); } });
    });
  }

  // drag and drop onto map
  const mapContainer = map.getContainer();
  mapContainer.addEventListener('dragover', e=>{ e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  mapContainer.addEventListener('drop', e=>{
    e.preventDefault();
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if(!f) return;
    Papa.parse(f, { header: true, skipEmptyLines: true, complete: (res)=>{ processRows(res.data||[]); } });
  });

  // If the page is hosted and a CSV URL is provided via `window.EVENTS_CSV_URL`, fetch it automatically.
  if(window.EVENTS_CSV_URL){
    Papa.parse(window.EVENTS_CSV_URL, { download: true, header: true, skipEmptyLines: true, complete: (res)=>{ processRows(res.data||[]); } });
  }

  // default: do nothing until user loads a CSV (works with file://). If page is served, you can still drop or select the CSV.
})();