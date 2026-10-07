import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import handler from "../api/portal.mjs";
http
  .createServer(async (req, res) => {
    try {
      if (req.url.split("?")[0] === "/api/portal") {
        let body = "";
        for await (const c of req) {
          body += c;
          if (body.length > 65536) {
            res.writeHead(413);
            return res.end();
          }
        }
        req.body = body;
        return await handler(req, res);
      }
      const file = path.join(
        process.cwd(),
        "dist",
        req.url === "/" ? "index.html" : req.url.split("?")[0],
      );
      if (!file.startsWith(path.join(process.cwd(), "dist") + path.sep)) {
        res.writeHead(403);
        return res.end();
      }
      const types = {
        ".html": "text/html",
        ".mjs": "text/javascript",
        ".css": "text/css",
      };
      res.setHeader(
        "Content-Type",
        types[path.extname(file)] || "application/octet-stream",
      );
      res.end(await readFile(file));
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(3000, "0.0.0.0", () => console.log("Preview: http://localhost:3000"));
