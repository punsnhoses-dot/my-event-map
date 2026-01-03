Event Map sample

Files:
- index.html — main page. Open in your browser locally.
- events.js — creates sample events, clustering, and the in-map day toggle control.

How to run (locally):
1. Open `index.html` directly in your browser (double-click the file).
2. Use the "Load events CSV" control (top-left) to select `Speedquizzingexport20260102.csv` from your machine, or drag & drop the CSV onto the map.

Optional (if you do have a static server):

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

Notes:
- Replace the sample `events` generation in `events.js` with a fetch call to your API returning event objects {lat, lng, day, title}.
- For large datasets, server-side filtering or clamping markers per viewport can improve performance.
- The day toggle control lives in-map (top-right) and adds/removes markers from the cluster for each day.