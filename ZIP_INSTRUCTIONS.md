# TeamSignups ZIP package

To avoid PR failures with binary artifacts, the ZIP file is **generated locally** and not tracked in git.

## Create the package
```bash
./scripts_make_zip.sh
```

This creates `TeamSignups-package.zip` containing:
- `README.md`
- `app.js`
- `create.html`
- `data/events.json`
- `index.html`
- `package.json`
- `server.js`
- `styles.css`
