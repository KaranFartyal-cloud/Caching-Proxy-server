# caching-proxy

A CLI tool that starts a caching proxy server. It forwards requests to a
real origin server and caches the responses. Repeat requests are served
straight from the cache instead of hitting the origin again.

this project serves as a solution for https://roadmap.sh/projects/caching-server

## Table Of Content

1. Install
2. Usage
3. How it works 
4. Project layouts
5. Manual testing 
6. Problems that you might encounter

## Install

```bash
cd caching-proxy
npm install
npm link        # makes the `caching-proxy` command available globally
```

(`npm link` requires npm/Node to be installed and on your PATH. If you'd
rather not link it globally, you can always run it as `node bin/caching-proxy.js ...`.)

## Usage

Start the proxy:

```bash
caching-proxy --port 3000 --origin http://dummyjson.com
```

This starts a server on `http://localhost:3000` that forwards every request
to `http://dummyjson.com` and caches the response.

```bash
curl -i http://localhost:3000/products/1
# X-Cache: MISS   (first request — forwarded to the origin)

curl -i http://localhost:3000/products/1
# X-Cache: HIT    (second request — served from cache)
```

Response status code, body, and headers (query strings included) are all
preserved from the origin, with an added `X-Cache` header:

- `X-Cache: MISS` — the request was forwarded to the origin server and freshly cached.
- `X-Cache: HIT` — the response was served from the local cache.

Clear the cache at any time:

```bash
caching-proxy --clear-cache
```

## How it works

- Only `GET`/`HEAD` requests are cached (they're idempotent and safe to
  reuse); everything else (`POST`, `PUT`, `DELETE`, ...) is always forwarded
  live to the origin.
- The cache key is the method, full path + query string, and (for methods
  that can carry a body) a hash of the request body — so
  `/products?limit=5` and `/products?limit=10` are cached separately.
- Cached entries (status, headers, and a base64-encoded body, so binary
  responses like images work fine) are persisted to
  `~/.caching-proxy/cache.json`. That's what lets a *separate*
  `caching-proxy --clear-cache` invocation wipe the cache even though it
  isn't the same process as the running server.
- Only successful responses (`2xx`) are cached.
- Hop-by-hop headers (`Connection`, `Transfer-Encoding`, `Content-Encoding`,
  `Content-Length`, etc.) are stripped before re-sending, since the proxy
  computes its own framing for the response it sends back.

## Project layout

```
caching-proxy/
├── bin/
│   └── caching-proxy.js   # CLI entrypoint (argument parsing)
├── lib/
│   ├── server.js          # Express app: proxying + caching logic
│   └── cache.js           # Persistent (file-backed) cache store
└── package.json
```

## Manual testing

With the server running against `http://dummyjson.com`:

```bash
# First call — MISS, gets cached
curl -i http://localhost:3000/products

# Second call — HIT, served from cache, identical body
curl -i http://localhost:3000/products

# Clear the cache (run in a separate terminal; server can keep running)
caching-proxy --clear-cache

# Next call is a MISS again
curl -i http://localhost:3000/products
```

## Problems that i encountered

If you are getting errors like 
```bash
permission denied
```

you might want to change the permissions , try 
```bash
sudo chown -R $(whoami)
```
to whichever you encountered this error.