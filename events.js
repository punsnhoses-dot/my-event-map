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
      let dt = null;
      if(parts.length===3){
        let [dd, mon, yy] = parts.map(p=>p.trim());
        let year = yy.length===2 ? '20'+yy : yy;
        const iso = `${dd} ${mon} ${year}`;
        dt = new Date(iso);
        if(!isNaN(dt)) return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dt.getDay()];
      }
      const dt2 = new Date(dateStr);
      if(!isNaN(dt2)) return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dt2.getDay()];
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

  async function processRows(rows){
    clearData();

    // colours for days of week
    const dayColors = {
      'Monday': '#1f77b4',
      'Tuesday': '#ff7f0e',
      'Wednesday': '#2ca02c',
      'Thursday': '#d62728',
      'Friday': '#9467bd',
      'Saturday': '#8c564b',
      'Sunday': '#e377c2',
      'Unknown': '#777'
    };

    // counters per day and type (phone/pen)
    const countsByDay = {};
    const iconCache = { phone: {}, pen: {} };
    const iconPromises = { phone: {}, pen: {} };
    const missingIconFiles = new Set();
    const validDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

    function detectType(r){
      const titleTest = (r.event_title||'').toLowerCase();
      const preview = (r.source_preview||'').toLowerCase();
      if(/speedquizzing event/i.test(r.event_title||'')) return 'phone';
      if(titleTest.includes('pen and paper') || preview.includes('pen and paper') || titleTest.includes('pen quiz') ) return 'pen';
      // default to phone for SpeedQuizzing-style data
      return 'phone';
    }

    function sanitizeDayForFile(day){
      if(!day) return '';
      const s = String(day||'').trim();
      return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    }

    function getIconFilename(type, day){
      const filePrefix = type==='phone' ? 'PhoneQuiz' : 'PenQuiz';
      const dayKey = sanitizeDayForFile(day);
      return `${filePrefix}${dayKey}.png`;
    }

    function loadImagePromise(url, timeout = 2500){
      return new Promise(resolve=>{
        const img = new Image();
        let done = false;
        const onDone = (ok)=>{ if(done) return; done = true; img.onload = img.onerror = null; resolve(ok); };
        img.onload = ()=> onDone(true);
        img.onerror = ()=> onDone(false);
        img.src = url;
        setTimeout(()=> onDone(false), timeout);
      });
    }

    async function ensureIcon(type, day){
      // return cached result if available (may be icon or null)
      if(iconCache[type] && Object.prototype.hasOwnProperty.call(iconCache[type], day)) return iconCache[type][day];
      if(iconPromises[type] && iconPromises[type][day]) return await iconPromises[type][day];
      const filename = getIconFilename(type, day);
      const dayKey = sanitizeDayForFile(day);
      const promise = (async ()=>{
        // only attempt to load icons for known weekdays
        if(!dayKey || validDays.indexOf(dayKey)===-1) return null;
        const ok = await loadImagePromise(filename);
        if(!ok){ missingIconFiles.add(filename); iconCache[type][day] = null; return null; }
        const icon = L.icon({ iconUrl: filename, iconSize: [28,28], iconAnchor: [14,28], popupAnchor: [0,-24] });
        iconCache[type][day] = icon;
        return icon;
      })();
      iconPromises[type][day] = promise;
      const icon = await promise;
      iconCache[type][day] = icon;
      return icon;
    }

    for(const r of rows){
      const lat = parseFloat(r.latitude);
      const lng = parseFloat(r.longitude);
      if(!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const day = parseDayLabel(r);
      daysSet.add(day);
      markersByDay[day] = markersByDay[day] || [];
      countsByDay[day] = countsByDay[day] || { phone:0, pen:0, other:0 };
      const title = r.venue_name || r.event_title || r.event_id || 'Event';
      const date = (r.date||'').trim();
      const time = (r.time||'').trim();
      const address = (r.address||'').trim();
      const host = (r.host_name||'').trim();
      const price = (r.price||'').trim();
      const age = (r.age_limit||'').trim();
      const teams = (r.teams_max||r.teams||'').toString().trim();
      const url = (r.event_url || r.source_page || '').trim();

      const type = detectType(r);
      if(type === 'phone') countsByDay[day].phone++;
      else if(type === 'pen') countsByDay[day].pen++;
      else countsByDay[day].other++;

      // choose an icon based on type/day; fall back to colored circle if icon missing
      let marker;
      const icon = await ensureIcon(type, day);
      if(icon){
        marker = L.marker([lat,lng], { icon, title });
      }else{
        const color = dayColors[day] || '#888';
        marker = L.circleMarker([lat,lng], { radius: 7, fillColor: color, color: '#222', weight: 1, opacity: 1, fillOpacity: 0.9, title });
      }

      let html = `<div style="font-weight:700;margin-bottom:4px">${escapeHtml(title)}</div>`;
      if(date || time) html += `<div style="margin-bottom:6px;color:#333">${escapeHtml([date, time].filter(Boolean).join(' '))}</div>`;
      if(address) html += `<div style="margin-bottom:6px">${escapeHtml(address)}</div>`;
      if(host) html += `<div><strong>Host:</strong> ${escapeHtml(host)}</div>`;
      if(price) html += `<div><strong>Price:</strong> ${escapeHtml(price)}</div>`;
      if(age) html += `<div><strong>Age limit:</strong> ${escapeHtml(age)}</div>`;
      if(teams) html += `<div><strong>Teams max:</strong> ${escapeHtml(teams)}</div>`;
      if(url) html += `<div style="margin-top:6px"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Event page</a></div>`;

      marker.bindPopup(html);
      marker.bindTooltip(escapeHtml(title));
      marker.__day = day;
      marker.__type = type;
      markersByDay[day].push(marker);
    }

    // expose counts for legend
    processRows._countsByDay = countsByDay;

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

    // remove any existing legend and add a colour legend for the days
    const existingLegend = document.querySelector('.leaflet-control.legend-daycolors');
    if(existingLegend && existingLegend._leaflet_pos){ existingLegend.parentNode && existingLegend.parentNode.removeChild(existingLegend); }

    const LegendControl = L.Control.extend({
      options: { position: 'bottomright' },
      onAdd: function(){
        const container = L.DomUtil.create('div','day-toggle legend-daycolors');
        container.innerHTML = `<div style="font-weight:600;margin-bottom:6px">Day colours</div>`;
        const dayColorsLocal = {
          'Monday': '#1f77b4', 'Tuesday': '#ff7f0e', 'Wednesday': '#2ca02c', 'Thursday': '#d62728', 'Friday': '#9467bd', 'Saturday': '#8c564b', 'Sunday': '#e377c2', 'Unknown': '#777'
        };
        days.forEach(d=>{
          const color = dayColorsLocal[d] || '#888';
          const entry = document.createElement('div');
          entry.style.display = 'flex'; entry.style.alignItems = 'center'; entry.style.marginBottom = '4px';
          const swatch = document.createElement('span');
          swatch.style.width = '12px'; swatch.style.height = '12px'; swatch.style.display = 'inline-block'; swatch.style.background = color; swatch.style.marginRight = '8px'; swatch.style.border = '1px solid #333';
          entry.appendChild(swatch);
          const label = document.createElement('span');
          const info = (processRows._countsByDay && processRows._countsByDay[d]) || {phone:0,pen:0};
          label.textContent = `${d}: ${(markersByDay[d]||[]).length} (${info.phone} phone, ${info.pen} pen)`;
          entry.appendChild(label);
          container.appendChild(entry);
        });
        return container;
      }
    });

    map.addControl(new LegendControl());

    // expose missing icon files for debugging
    processRows._missingIconFiles = Array.from(missingIconFiles);
    window._eventMap = { map, markerCluster, markersByDay, dayState, refreshCluster, missingIconFiles: processRows._missingIconFiles };
  }

  // Uploader removed: public visitors cannot upload files. To update CSV, replace `Speedquizzingexport20260102.csv` in the same folder where this page is hosted or set `window.EVENTS_CSV_URL` before loading the script.


  // Auto-load CSV from host: prefer EVENTS_CSV_URL, otherwise attempt to fetch `Speedquizzingexport20260102.csv` from the same folder when served over http(s).
  (function(){
    const tryUrl = window.EVENTS_CSV_URL || (location.protocol.startsWith('http') ? 'Speedquizzingexport20260102.csv' : null);
    if(tryUrl){
      Papa.parse(tryUrl, { download: true, header: true, skipEmptyLines: true, complete: async (res)=>{ await processRows(res.data||[]); } });
    }
  })();

  // default: do nothing until data is provided (via hosted CSV). If you open the page via file:// you must use a local edit of the CSV or host it to test.
})();