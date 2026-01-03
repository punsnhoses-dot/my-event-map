Event Map sample

Files:
- index.html — main page. Open in your browser locally.
- events.js — creates sample events, clustering, and the in-map day toggle control.

How to run (locally):
1. Host `index.html` and `Speedquizzingexport20260102.csv` together on your site (Netlify, GitHub Pages, or your server). The map will auto-load the CSV from the same folder.

Optional: if you prefer a different CSV path, set `window.EVENTS_CSV_URL` before loading `events.js`, for example:

```html
<script>window.EVENTS_CSV_URL = '/data/events.csv';</script>
<script src="/path/to/papaparse.min.js"></script>
<script src="/path/to/events.js"></script>
```

Note: the in-page file uploader was removed to prevent site visitors from replacing the data; update the CSV through your hosting provider's file upload or repo commit.

Notes:
- Replace the sample `events` generation in `events.js` with a fetch call to your API returning event objects {lat, lng, day, title}.
- For large datasets, server-side filtering or clamping markers per viewport can improve performance.
- The day toggle control lives in-map (top-right) and adds/removes markers from the cluster for each day.