#!/bin/bash
cd "$(dirname "$0")"
export PATH="$PWD/.tools/node/bin:$PATH"
echo "----------------------------------------"
echo "  Démarrage de l'application Prix Nouméa"
echo "  Accès : http://localhost:3000"
echo "----------------------------------------"
npm run dev
