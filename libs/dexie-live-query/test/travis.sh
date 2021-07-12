#!/bin/bash -e
echo "Installing dependencies for live-query"
npm install >/dev/null
npm run build
npm test
