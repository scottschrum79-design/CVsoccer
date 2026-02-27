# TeamSignups (SignUpGenius-style demo)

A lightweight web app for creating signup events and claiming volunteer slots.

## Two-page workflow
- `create.html` = **Organizer/creator page** (create events and view full volunteer details).
- `index.html` = **Public signup page** (volunteers sign up).
- Public page only shows volunteer display names as **first initial + last name**.
- Organizer page shows full details: first name, last name, email, phone, and notes.

## Features
- Create events with title, date, description, and multiple slots.
- Collect volunteer first name, last name, email, phone, and optional notes.
- Keep public identity limited to `F. Lastname` while preserving full organizer visibility.
- Data persists in browser `localStorage`.

## Run locally
```bash
python3 -m http.server 8000
```
Then open:
- Public signup page: <http://localhost:8000/index.html>
- Organizer page: <http://localhost:8000/create.html>

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
