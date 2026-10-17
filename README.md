# Norsh Juicery – live field plan (Google Sheets dashboard)

A plain HTML/CSS/JS page that reads your Google Sheet and refreshes every 30 seconds.
No installs, no build step.

## Run it in VS Code
1. Open this folder in VS Code (File > Open Folder).
2. Install the extension **Live Server** (Ritwick Dey).
3. Right-click `index.html` > **Open with Live Server**.
   (Double-clicking the file will NOT work: browsers block sheet requests from file:// pages.)

## Make the sheet readable
In Google Sheets: **Share > General access > Anyone with the link > Viewer.**
Anyone who has the sheet's link can then see its data, so don't put private information in it.

## Settings
Everything you may need to change is in the `CONFIG` block at the top of `app.js`:
- `SHEET_ID` – the long ID in the sheet's address.
- `TABS` – tab names; they must match the sheet exactly.
- `REFRESH_SECONDS` – how often the page re-reads the sheet.

## If it says it can't read the sheet
Use "Publish to web" links instead:
1. In the sheet: **File > Share > Publish to web.**
2. Choose one tab (e.g. Monthly Plan) and the format **Comma-separated values (.csv)**, then Publish.
3. Copy the link and paste it into `CSV_OVERRIDE` in `app.js` (e.g. `plan: "https://docs.google.com/.../pub?output=csv"`).
4. Repeat for the other four tabs.

## Put it online later
Upload the three files (`index.html`, `style.css`, `app.js`) to any static host
(GitHub Pages, Netlify, Vercel). Nothing else is needed.
