#!/usr/bin/env bash
set -euo pipefail

backend_pid=""
frontend_pid=""

cleanup() {
  if [[ -n "$backend_pid" ]] && kill -0 "$backend_pid" 2>/dev/null; then
    kill "$backend_pid" 2>/dev/null || true
  fi
  if [[ -n "$frontend_pid" ]] && kill -0 "$frontend_pid" 2>/dev/null; then
    kill "$frontend_pid" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

python3 -m uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000 &
backend_pid=$!

HOST=0.0.0.0 npm --prefix frontend run start &
frontend_pid=$!

wait "$backend_pid" "$frontend_pid"
