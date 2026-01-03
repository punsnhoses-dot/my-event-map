(function(){
  const map = L.map('map').setView([20,0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
  const markerCluster = L.markerClusterGroup(); map.addLayer(markerCluster);

  function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // parse day label with address fallback
  function parseDayLabel(row){
    const repeat = (row.repeat_day||'').trim(); if(repeat) return repeat;
    const dateStr = (row.date||'').trim();
    if(dateStr){
      const parts = dateStr.split('-'); let dt=null;
      if(parts.length===3){ let [dd,mon,yy]=parts.map(p=>p.trim()); let year = yy.length===2 ? '20'+yy : yy; dt = new Date(`${dd} ${mon} ${year}`); if(!isNaN(dt)) return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dt.getDay()]; }
      const dt2 = new Date(dateStr); if(!isNaN(dt2)) return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dt2.getDay()];
    }
    const textCandidates = [row.address, row.venue_name, row.notes, row.source_preview, row.event_title].map(s=>String(s||'')).join(' ');
    function tryParseFromText(txt){ if(!txt) return null; const now=new Date(); const currYear=now.getFullYear();
      const m1 = txt.match(/\b(\d{1,2})[- ]([A-Za-z]{3,9})[- ](\d{2,4})\b/); if(m1){ let dd=m1[1], mon=m1[2], yy=m1[3]; yy = yy.length===2 ? '20'+yy : yy; let d = new Date(`${dd} ${mon} ${yy}`); if(!isNaN(d)) return d; }
      const m2 = txt.match(/\b([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{2,4}))?/i); if(m2){ let mon=m2[1], dd=m2[2], yy=m2[3]||currYear; yy = String(yy).length===2 ? '20'+yy : yy; let d = new Date(`${dd} ${mon} ${yy}`); if(!isNaN(d)) return d; }
      const m3 = txt.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/); if(m3){ let iso = `${m3[1]}-${m3[2].padStart(2,'0')}-${m3[3].padStart(2,'0')}`; let d = new Date(iso); if(!isNaN(d)) return d; }
      const m4 = txt.match(/\b(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})\b/); if(m4){ let dd=parseInt(m4[1],10), mm=parseInt(m4[2],10), yy=String(m4[3]); if(yy.length===2) yy='20'+yy; let iso=`${yy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`; let d = new Date(iso); if(!isNaN(d)) return d; }
      return null; }
    const inf = tryParseFromText(textCandidates); if(inf && !isNaN(inf)){ return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][inf.getDay()]; }
    return 'Unknown';
  }

  const markersByDay = {};
  const daysSet = new Set();
  function clearData(){ markerCluster.clearLayers(); Object.keys(markersByDay).forEach(k=>markersByDay[k]=[]); daysSet.clear(); }

  function processRows(rows){
    clearData();
    const dayColors = { 'Monday':'#1f77b4','Tuesday':'#ff7f0e','Wednesday':'#2ca02c','Thursday':'#d62728','Friday':'#9467bd','Saturday':'#8c564b','Sunday':'#e377c2','Unknown':'#777' };
    rows.forEach(r=>{
      const lat = parseFloat(r.latitude); const lng = parseFloat(r.longitude); if(!Number.isFinite(lat)||!Number.isFinite(lng)) return;
      const day = parseDayLabel(r); daysSet.add(day); markersByDay[day] = markersByDay[day] || [];
      const title = r.venue_name || r.event_title || r.event_id || 'Event';
      const date = (r.date||'').trim(); const time=(r.time||'').trim(); const address=(r.address||'').trim();
      const host=(r.host_name||'').trim(); const price=(r.price||'').trim(); const age=(r.age_limit||'').trim(); const teams=(r.teams_max||r.teams||'').toString().trim(); const url=(r.event_url||r.source_page||'').trim();
      const color = dayColors[day] || '#888';
      const m = L.circleMarker([lat,lng], { radius:7, fillColor: color, color:'#222', weight:1, opacity:1, fillOpacity:0.9, title });
      let html = `<div style="font-weight:700;margin-bottom:4px">${escapeHtml(title)}</div>`;
      if(date||time) html += `<div style="margin-bottom:6px;color:#333">${escapeHtml([date,time].filter(Boolean).join(' '))}</div>`;
      if(address) html += `<div style="margin-bottom:6px">${escapeHtml(address)}</div>`;
      if(host) html += `<div><strong>Host:</strong> ${escapeHtml(host)}</div>`;
      if(price) html += `<div><strong>Price:</strong> ${escapeHtml(price)}</div>`;
      if(age) html += `<div><strong>Age limit:</strong> ${escapeHtml(age)}</div>`;
      if(teams) html += `<div><strong>Teams max:</strong> ${escapeHtml(teams)}</div>`;
      if(url) html += `<div style="margin-top:6px"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Event page</a></div>`;
      m.bindPopup(html); m.bindTooltip(escapeHtml(title)); m.__day = day; markersByDay[day].push(m);
    });

    // build days and controls
    const weekdayOrder = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday','Unknown'];
    const days = Array.from(daysSet).sort((a,b)=>{ const ia=weekdayOrder.indexOf(a)>=0?weekdayOrder.indexOf(a):999; const ib=weekdayOrder.indexOf(b)>=0?weekdayOrder.indexOf(b):999; if(ia!==ib) return ia-ib; return String(a).localeCompare(String(b)); });

    const dayState = {};
    days.forEach(d=> dayState[d]=true);

    function refreshCluster(){ markerCluster.clearLayers(); Object.keys(dayState).forEach(d=>{ if(dayState[d]) markersByDay[d].forEach(m=> markerCluster.addLayer(m)); }); }
    refreshCluster();

    // day toggle control
    const existing = document.querySelector('.leaflet-control.day-toggle'); if(existing && existing._leaflet_pos){ existing.parentNode && existing.parentNode.removeChild(existing); }
    const DayToggleControl = L.Control.extend({ options:{position:'topright'}, onAdd:function(){ const container=L.DomUtil.create('div','day-toggle'); container.innerHTML=`<div style="font-weight:600;margin-bottom:6px">Show events by day</div>`; days.forEach(d=>{ const btn=L.DomUtil.create('button','day-btn',container); const count=(markersByDay[d]||[]).length; btn.innerHTML=`${d} <span class="day-count">(${count})</span>`; if(dayState[d]) btn.classList.add('active'); btn.onclick=function(e){ L.DomEvent.stopPropagation(e); dayState[d]=!dayState[d]; btn.classList.toggle('active', dayState[d]); refreshCluster(); }; }); const controls=L.DomUtil.create('div','controls',container); const selectAll=L.DomUtil.create('button','','controls'); selectAll.textContent='Select All'; selectAll.onclick=function(e){ L.DomEvent.stopPropagation(e); days.forEach(d=>dayState[d]=true); updateButtons(container); refreshCluster(); }; const clearAll=L.DomUtil.create('button','','controls'); clearAll.textContent='Clear All'; clearAll.onclick=function(e){ L.DomEvent.stopPropagation(e); days.forEach(d=>dayState[d]=false); updateButtons(container); refreshCluster(); }; function updateButtons(container){ const btns = container.querySelectorAll('.day-btn'); btns.forEach(btn=>{ const day = btn.innerText.split(' ')[0]; const active = !!dayState[day]; btn.classList.toggle('active', active); }); } return container; } });
    map.addControl(new DayToggleControl());

    // legend
    const existingLegend = document.querySelector('.leaflet-control.legend-daycolors'); if(existingLegend && existingLegend._leaflet_pos){ existingLegend.parentNode && existingLegend.parentNode.removeChild(existingLegend); }
    const LegendControl = L.Control.extend({ options:{position:'bottomright'}, onAdd:function(){ const container=L.DomUtil.create('div','day-toggle legend-daycolors'); container.innerHTML=`<div style="font-weight:600;margin-bottom:6px">Day colours</div>`; const dayColorsLocal=dayColors; if(!days||days.length===0){ const none=document.createElement('div'); none.textContent='No events'; none.style.opacity='0.8'; container.appendChild(none); return container; } days.forEach(d=>{ const color = dayColorsLocal[d]||'#888'; const entry=document.createElement('div'); entry.style.display='flex'; entry.style.alignItems='center'; entry.style.marginBottom='4px'; const swatch=document.createElement('span'); swatch.style.width='12px'; swatch.style.height='12px'; swatch.style.display='inline-block'; swatch.style.background=color; swatch.style.marginRight='8px'; swatch.style.border='1px solid #333'; entry.appendChild(swatch); const label=document.createElement('span'); label.textContent = `${d}: ${(markersByDay[d]||[]).length}`; entry.appendChild(label); container.appendChild(entry); }); return container; } });
    map.addControl(new LegendControl());

    window._eventMap = { map, markerCluster, markersByDay, dayState, refreshCluster };
  }

  // auto-load CSV
  (function(){ const tryUrl = window.EVENTS_CSV_URL || (location.protocol.startsWith('http') ? 'Speedquizzingexport20260102.csv' : null); if(tryUrl){ Papa.parse(tryUrl, { download:true, header:true, skipEmptyLines:true, complete: (res)=>{ processRows(res.data||[]); } }); } })();
})();