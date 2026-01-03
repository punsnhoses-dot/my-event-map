// events.js — loads your CSV, builds a Leaflet map with clustering, and an in-map day toggle control
(async function(){

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
      const title = r.venue_name || r.event_title || r.event_id || 'Event';
      const date = (r.date||'').trim();
      const time = (r.time||'').trim();
      const address = (r.address||'').trim();
      const host = (r.host_name||'').trim();
      const price = (r.price||'').trim();
      const age = (r.age_limit||'').trim();
      const teams = (r.teams_max||r.teams||'').toString().trim();
      const url = (r.event_url || r.source_page || '').trim();

      const m = L.marker([lat,lng], { title });
      let html = `<div style="font-weight:700;margin-bottom:4px">${escapeHtml(title)}</div>`;
      if(date || time) html += `<div style="margin-bottom:6px;color:#333">${escapeHtml([date, time].filter(Boolean).join(' '))}</div>`;
      if(address) html += `<div style="margin-bottom:6px">${escapeHtml(address)}</div>`;
      if(host) html += `<div><strong>Host:</strong> ${escapeHtml(host)}</div>`;
      if(price) html += `<div><strong>Price:</strong> ${escapeHtml(price)}</div>`;
      if(age) html += `<div><strong>Age limit:</strong> ${escapeHtml(age)}</div>`;
      if(teams) html += `<div><strong>Teams max:</strong> ${escapeHtml(teams)}</div>`;
      if(url) html += `<div style="margin-top:6px"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Event page</a></div>`;

      m.bindPopup(html);
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

  // Uploader removed: public visitors cannot upload files. To update CSV, replace `Speedquizzingexport20260102.csv` in the same folder where this page is hosted or set `window.EVENTS_CSV_URL` before loading the script.


  // Auto-load CSV from host: prefer EVENTS_CSV_URL, otherwise attempt to fetch `Speedquizzingexport20260102.csv` from the same folder when served over http(s).
  (function(){
    const tryUrl = window.EVENTS_CSV_URL || (location.protocol.startsWith('http') ? 'Speedquizzingexport20260102.csv' : null);
    if(tryUrl){
      Papa.parse(tryUrl, { download: true, header: true, skipEmptyLines: true, complete: (res)=>{ processRows(res.data||[]); } });
    }
  })();

  // default: do nothing until data is provided (via hosted CSV). If you open the page via file:// you must use a local edit of the CSV or host it to test.
})();