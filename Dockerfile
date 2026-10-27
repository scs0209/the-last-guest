# The Last Guest, hosted: the game server and Gemma 4 E4B (Ollama, CPU) in one container.
#   docker build -t the-last-guest .
#   docker run -p 10000:10000 the-last-guest        # http://localhost:10000
FROM ollama/ollama:0.35.1

RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-httpx curl \
    && rm -rf /var/lib/apt/lists/*

# Bake the model into the image so a cold start does not download 6.6 GB.
RUN ollama serve & pid=$!; sleep 5; ollama pull gemma4:e4b && kill $pid

ENV OLLAMA_HOST=127.0.0.1:11434 \
    OLLAMA_URL=http://127.0.0.1:11434 \
    OLLAMA_KEEP_ALIVE=-1 \
    OLLAMA_NUM_PARALLEL=1 \
    OLLAMA_CONTEXT_LENGTH=4096 \
    HOST=0.0.0.0 \
    PORT=10000

WORKDIR /app
COPY server.py cards.py check.py facts.json start.sh ./
COPY data/answer_cache.json data/
COPY web/ web/

EXPOSE 10000
ENTRYPOINT ["/bin/sh", "/app/start.sh"]
