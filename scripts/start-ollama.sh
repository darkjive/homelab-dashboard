#!/bin/bash

OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"

if curl -s "${OLLAMA_URL}/api/tags" > /dev/null 2>&1; then
  echo "[Ollama] Already running at ${OLLAMA_URL}"
  while true; do sleep 3600; done
else
  echo "[Ollama] Starting Ollama server..."
  ollama serve
fi
