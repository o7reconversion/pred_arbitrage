# Prediction Market Hedging Monitor

This is a lightweight platform for monitoring prediction market hedging and arbitrage opportunities. The goal is to allow configuring market pairs, observing real-time price differences, and surfacing actionable arbitrage windows.
![alt text](./imgs/preview.png)

## Scope
- Configure and maintain market pairs
- Monitor prices and spreads
- Identify arbitrage opportunities and alert
- V1 executes arbitrage trades manually

## Planned Capabilities
- Automated trade execution (later version)
- Risk control and execution strategy configuration

## Technical Constraints
- Frontend: Node
- Backend: Python3

## Project Structure
- `backend/`: Python service responsible for fetching market data and providing APIs
- `backend/providers/`: Data provider adapters
  - `polymarket`: Fetches market info via Gamma API and optionally pulls order book data from CLOB (requires `py_clob_client`)
  - `limitless`: Queries by market slug via public endpoints
- `frontend/`: Node.js static service providing the monitoring UI

## Backend Notes
The core service is built on FastAPI. Main routes are in `backend/app.py`, and the data source switches via the `provider` parameter:
- Polymarket: `/api/markets?ids=123,456&provider=polymarket`
- Limitless: `/api/markets?ids=will-be-listed-on-binance-spot-in-2025-1760872411523&provider=limitless`

When `py_clob_client` is available, Polymarket will attempt to pull best bid/ask from the order book and populate the `outcomeBids/outcomeAsks` fields.

## Run

Backend (hot reload):
```bash
python3 -m pip install -r backend/requirements.txt
python3 -m uvicorn backend.app:app --reload --port 8000
```

Frontend:
```bash
cd frontend
npm install
npm run start
```

Open in browser: `http://localhost:3000`

One-command start with `start.sh`:
```bash
python3 -m pip install -r backend/requirements.txt
npm --prefix frontend install
chmod +x start.sh
./start.sh
```
`start.sh` launches both backend (8000) and frontend (3000) together, binding to `0.0.0.0` for LAN access; exiting the script stops both processes.

## Dependencies
Backend deps are listed in `backend/requirements.txt`:
- fastapi
- uvicorn
- py_clob_client

## Notes
The current version targets a minimal viable set, prioritizing monitoring and alerts.
