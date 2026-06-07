import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON parsing middleware for POST requests
  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // TTS Download Route: Converts full book/document paragraphs to high-fidelity MP3
  app.post("/api/download-tts", async (req, res) => {
    try {
      const { text, lang } = req.body;
      if (!text) {
        return res.status(400).json({ error: "Text content is required" });
      }

      const language = lang || "ko";
      
      // Split text into chunks of max 200 characters (Google Translate TTS threshold limit per request)
      const chunks: string[] = [];
      const words = text.split(/\s+/);
      let currentChunk = "";

      for (const word of words) {
        if ((currentChunk + " " + word).length > 200) {
          if (currentChunk) chunks.push(currentChunk.trim());
          currentChunk = word;
        } else {
          currentChunk = currentChunk ? currentChunk + " " + word : word;
        }
      }
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }

      // Fetch each chunk in serial sequence to stay respectful of origin rate limiting limits
      const buffers: Buffer[] = [];
      for (const chunk of chunks) {
        if (!chunk.trim()) continue;
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${language}&client=tw-ob`;
        
        const response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });

        if (!response.ok) {
          console.error(`Failed to fetch TTS for chunk: ${chunk.substring(0, 20)}... Status: ${response.status}`);
          continue;
        }

        const arrayBuffer = await response.arrayBuffer();
        buffers.push(Buffer.from(arrayBuffer));
      }

      if (buffers.length === 0) {
        return res.status(500).json({ error: "Failed to assemble voice synthesis components" });
      }

      // Direct binary concatenation is fully valid and supported by standard MP3 players
      const mergedBuffer = Buffer.concat(buffers);
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Disposition", `attachment; filename="document_tts.mp3"`);
      res.send(mergedBuffer);
    } catch (error: any) {
      console.error("Error generating compiled TTS audio stream:", error);
      res.status(500).json({ error: error.message || "Failed to compile TTS stream assets" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server launched successfully and listening on http://localhost:${PORT}`);
  });
}

startServer();
