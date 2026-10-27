#!/bin/sh
# Start Ollama, load Gemma into memory once, then serve the game.
set -e
ollama serve &
until curl -sf "$OLLAMA_URL/api/version" >/dev/null; do sleep 1; done
curl -sf "$OLLAMA_URL/api/generate" -d '{"model":"gemma4:e4b","prompt":"","keep_alive":-1}' >/dev/null || true
exec python3 server.py
