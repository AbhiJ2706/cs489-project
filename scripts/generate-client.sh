#!/usr/bin/env bash

set -e
set -x

# Generate OpenAPI spec from backend
cd backend
python -c "import app.main; import json; print(json.dumps(app.main.app.openapi()))" > ../openapi.json
cd ..

# Modify OpenAPI spec
node frontend/modify-openapi-operationids.js

# Generate client for frontend
cp openapi.json frontend/
cd frontend
npm run generate-client
npx biome format --write ./src/client
cd ..

rm openapi.json
