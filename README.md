# TeamSignups (SignUpGenius-style demo)

A lightweight web app for creating signup events and claiming volunteer slots.

## Two-page workflow
- `create.html` = **Organizer/creator page** (create events and view full volunteer details).
- `index.html` = **Public signup page** (volunteers sign up).
- Public page only shows volunteer display names as **first initial + last name**.
- Organizer page shows full details: first name, last name, email, phone, and notes.

## Shared data storage (multi-user)
- Events and signups are saved to `data/events.json` via `GET/PUT /api/events`.
- A CSV mirror is also written to `data/events.csv` on each save so you can open data in spreadsheets.
- If the storage files do not exist, the server auto-creates them on startup/request.
- This means all users see the same events/signups when using the Node server.
- Browser-only static hosting will not provide shared storage.

## Features
- Create events with title, date, description, and multiple slots.
- Collect volunteer first name, last name, email, phone, and optional notes.
- Keep public identity limited to `F. Lastname` while preserving full organizer visibility.
- Organizer can remove an event.

## Run with shared storage (recommended)
```bash
npm start
```
Then open:
- Public signup page: <http://localhost:8000/index.html>
- Organizer page: <http://localhost:8000/create.html>

## Run static only (single-browser demo)
```bash
python3 -m http.server 8000
```
This mode does **not** share data across devices.

## Publish to GitHub
If you don't see this project in GitHub yet, the local repository likely has no remote configured.

1. Create an empty GitHub repository (for example: `CVsoccer`).
2. Add it as `origin`:
   ```bash
   git remote add origin git@github.com:<your-username>/CVsoccer.git
   ```
3. Push the current branch:
   ```bash
   git push -u origin $(git branch --show-current)
   ```

You can verify with:
```bash
git remote -v
git log --oneline -n 5
```


## Deployment note
- If your site is deployed as static files only (for example, simple file hosting), `/api/events` does not exist, so global saving cannot work.
- To make `coach.cvsoccer.club` shared, deploy `server.js` on your host and keep `data/events.json` writable by the server process.
- After deployment, open `/api/events` in a browser and confirm it returns JSON.


## PR + GitHub sync troubleshooting
- The **"View PR"** badge from this agent run is PR metadata, not a guarantee that your GitHub Pages deployment has switched to the newest commit yet.
- Confirm the latest commit is on `main` in GitHub before checking the website.
- If your repo shows both `README.md` and `readme.md`, that is a duplicate caused by mixed upload methods; remove the wrong duplicate and keep one canonical file name.

Use this exact sequence locally to force your folder to match GitHub and push one clean update:
```bash
git fetch origin
git checkout main
git pull --rebase origin main
git status
git add -A
git commit -m "Sync TeamSignups files"
git push origin main
```

After pushing, wait for GitHub Pages deploy to finish and then hard-refresh your browser (`Ctrl+F5`).

## ZIP packaging
- The distributable archive is generated locally and intentionally not committed because binary files can break PR creation in some tools.
- Generate it anytime with:
```bash
./scripts_make_zip.sh
```


CSV export endpoint (read-only): `GET /api/events.csv`
