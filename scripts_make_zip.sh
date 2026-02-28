#!/usr/bin/env bash
set -euo pipefail

zip -r TeamSignups-package.zip \
  README.md \
  app.js \
  create.html \
  data/events.json \
  data/events.csv \
  index.html \
  package.json \
  server.js \
  styles.css

echo "Created TeamSignups-package.zip"
unzip -l TeamSignups-package.zip
