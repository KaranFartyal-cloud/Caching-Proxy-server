const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const cache = require("./cache");

// Headers that must not be blindly copied from one hop to the next.
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  // axios already decompresses the body for us, and content-length is
  // recalculated by Express when we send() the body, so drop both here to
  // avoid mismatches between the header and the actual payload.
  "content-encoding",
  "content-length",
]);

/**
 * Build a stable cache key for a request. Only method + URL (+ a hash of
 * the body, for methods that can carry one) are used, since headers like
 * User-Agent or cookies shouldn't fragment the cache.
 */
function buildKey(req) {
  const bodyHash =
    req.body && req.body.length
      ? crypto.createHash("md5").update(req.body).digest("hex")
      : "";
  return `${req.method}:${req.originalUrl}:${bodyHash}`;
}

function copyHeaders(from, res) {
  for (const [name, value] of Object.entries(from)) {
    if (!HOP_BY_HOP.has(name.toLowerCase())) {
      try {
        res.setHeader(name, value);
      } catch (err) {
        // Some headers (e.g. malformed ones from upstream) can't be set;
        // skip rather than crash the response.
      }
    }
  }
}

function startServer(port, origin) {
  const app = express();

  // Capture the raw request body for any content type, unparsed, so it can
  // be hashed for the cache key and forwarded to the origin unchanged.
  app.use(express.raw({ type: "*/*", limit: "50mb" }));

  app.use(async (req, res) => {
    // Only GET/HEAD requests are idempotent and safe to cache by default.
    const cacheable = req.method === "GET" || req.method === "HEAD";
    const key = buildKey(req);

   

    if (cacheable) {
      const cached = cache.get(key);


      if (cached) {
        res.status(cached.status);
        copyHeaders(cached.headers, res);
        res.setHeader("X-Cache", "HIT");
        return res.send(Buffer.from(cached.body, "base64"));
      }
    }

    const targetUrl = origin.replace(/\/+$/, "") + req.originalUrl;



    try {
      const forwardHeaders = { ...req.headers };
      delete forwardHeaders.host; // let axios set the correct Host header

      const originResponse = await axios({
        method: req.method,
        url: targetUrl,
        headers: forwardHeaders,
        data: req.body && req.body.length ? req.body : undefined,
        responseType: "arraybuffer",
        maxRedirects: 5,
        validateStatus: () => true, // forward whatever status the origin returns
      });

      const responseHeaders = {};
      for (const [name, value] of Object.entries(originResponse.headers)) {
        if (!HOP_BY_HOP.has(name.toLowerCase())) {
          responseHeaders[name] = value;
        }
      }

      if (
        cacheable &&
        originResponse.status >= 200 &&
        originResponse.status < 300
      ) {
        cache.set(key, {
          status: originResponse.status,
          headers: responseHeaders,
          body: Buffer.from(originResponse.data).toString("base64"),
        });
      }

      res.status(originResponse.status);
      copyHeaders(responseHeaders, res);
      res.setHeader("X-Cache", "MISS");
      res.send(Buffer.from(originResponse.data));
    } catch (err) {
      console.error(`Proxy error for ${req.method} ${targetUrl}:`, err.message);
      res.status(502).json({ error: "Bad Gateway", message: err.message });
    }
  });

  app.listen(port, () => {
    console.log(`Caching proxy server listening on port ${port}`);
    console.log(`Forwarding requests to ${origin}`);
    console.log(`Cache file: ${cache.location()}`);
  });

  return app;
}

module.exports = startServer;
