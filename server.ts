import express from "express";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import AdmZip from "adm-zip";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Set up storage for uploaded audio files
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), "tmp_uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, `${uniqueSuffix}-${file.originalname}`);
    },
  }),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit (Groq's limit is 25MB, but our script handles auto-compression)
  },
});

app.use(express.json());

// API Endpoints

// 1. Transcribe audio file using local transcriber.py
app.post("/api/transcribe", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file provided." });
  }

  const audioFilePath = req.file.path;
  const model = req.body.model || "whisper-large-v3";
  const keepDevanagari = req.body.keepDevanagari === "true";
  
  // Accept custom Groq key from client if configured, otherwise fallback to server environment
  const groqKey = req.body.groqApiKey || process.env.GROQ_API_KEY;

  if (!groqKey) {
    // Cleanup file
    if (fs.existsSync(audioFilePath)) fs.unlinkSync(audioFilePath);
    return res.status(400).json({
      error: "GROQ_API_KEY is not set. Please provide an API key in the settings panel or configure it on the server.",
    });
  }

  // Construct command
  let cmd = `python3 transcriber.py "${audioFilePath}" --model "${model}"`;
  if (keepDevanagari) {
    cmd += " --keep-devanagari";
  }

  console.log(`[Server] Executing: ${cmd}`);

  // Inject GROQ_API_KEY into python environment execution
  const env = {
    ...process.env,
    GROQ_API_KEY: groqKey,
  };

  exec(cmd, { env }, (error, stdout, stderr) => {
    // Clean up uploaded audio file
    if (fs.existsSync(audioFilePath)) {
      try {
        fs.unlinkSync(audioFilePath);
      } catch (err) {
        console.error("Error deleting temp upload file:", err);
      }
    }

    // Clean up potential transcriber output .txt file
    const txtFilePath = audioFilePath.substring(0, audioFilePath.lastIndexOf(".")) + ".txt";
    if (fs.existsSync(txtFilePath)) {
      try {
        fs.unlinkSync(txtFilePath);
      } catch (err) {
        console.error("Error deleting temp txt transcript:", err);
      }
    }

    if (error) {
      console.error("[Server] Execution error:", stderr);
      return res.status(500).json({
        error: "Transcription failed.",
        details: stderr || stdout || error.message,
      });
    }

    // Parse output from stdout
    // We expect stdout to contain:
    // --- RAW TRANSCRIPTION (Devanagari) ---
    // <raw_hindi>
    // --- ROMANIZED HINGLISH TRANSCRIPT ---
    // <final_output>
    const devanagariHeader = "--- RAW TRANSCRIPTION (Devanagari) ---";
    const hinglishHeader = "--- ROMANIZED HINGLISH TRANSCRIPT ---";

    let devanagari = "";
    let hinglish = "";

    if (stdout.includes(devanagariHeader)) {
      const parts = stdout.split(devanagariHeader);
      const remaining = parts[1] || "";
      
      if (remaining.includes(hinglishHeader)) {
        const subParts = remaining.split(hinglishHeader);
        devanagari = subParts[0].trim();
        hinglish = subParts[1].trim();
      } else {
        devanagari = remaining.trim();
        hinglish = "";
      }
    } else {
      // Fallback
      hinglish = stdout.trim();
    }

    // Filter out potential log prefixes/status lines from the parsed segments
    devanagari = devanagari.replace(/\[\*\]\s*Local Romanization[\s\S]*$/, "").trim();

    res.json({
      success: true,
      rawHindi: devanagari || stdout.trim(),
      hinglish: hinglish || (keepDevanagari ? devanagari : stdout.trim()),
    });
  });
});

// 2. Download the local Python CLI tool bundle
app.get("/api/download-cli", (req, res) => {
  try {
    const zip = new AdmZip();
    
    const transcriberPath = path.join(process.cwd(), "transcriber.py");
    const requirementsPath = path.join(process.cwd(), "requirements.txt");
    const readmePath = path.join(process.cwd(), "README.md");
    const envExamplePath = path.join(process.cwd(), ".env.example");

    if (fs.existsSync(transcriberPath)) zip.addLocalFile(transcriberPath);
    if (fs.existsSync(requirementsPath)) zip.addLocalFile(requirementsPath);
    if (fs.existsSync(readmePath)) zip.addLocalFile(readmePath);
    if (fs.existsSync(envExamplePath)) zip.addLocalFile(envExamplePath);

    const buffer = zip.toBuffer();

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=hinglish-transcriber.zip");
    res.send(buffer);
  } catch (error: any) {
    console.error("[Server] Zip generation error:", error);
    res.status(500).json({ error: "Failed to generate download bundle.", details: error.message });
  }
});

// Vite & Static Asset Handling
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] running on http://localhost:${PORT}`);
  });
}

startServer();
