import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { createApiRouter } from './server/api';
import { openDatabase } from './server/database';
import { configureNetworkPolicy, getServerBinding } from './server/network';

async function startServer() {
  const app = express();
  const binding = getServerBinding();
  configureNetworkPolicy(app);

  app.use(express.json({ limit: "2mb", type: 'application/json' }));
  const db = openDatabase();
  app.use('/api', createApiRouter(db));

  // Initialize Gemini AI (server-side only)
  const apiKey = process.env.GEMINI_API_KEY;
  let ai: GoogleGenAI | null = null;
  if (apiKey) {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }

  // API Health Endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", aiConfigured: !!apiKey });
  });

  // API Endpoint: AI 3D Scene / Asset Generator
  app.post("/api/generate-3d", async (req, res) => {
    try {
      const { prompt, style = "modern" } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      if (!ai) {
        return res.status(503).json({
          error: "Gemini API Key is not configured in server environment.",
        });
      }

      const systemInstruction = `You are a professional 3D Architectural & Scene Designer Assistant.
Given a user prompt describing a 3D scene, object, or space, generate a structured layout of 3D objects with parametric positioning, scaling, rotations, colors, and PBR materials.
Return JSON matching the requested schema. Use reasonable offsets so items form a coherent layout (e.g., table at center, chairs around table, lamps beside sofa, building blocks connected).

Allowed asset types: "cube", "sphere", "cylinder", "cone", "torus", "wall", "pillar", "arch", "stair", "window", "door", "sofa", "chair", "table", "lamp", "plant", "tree", "rock", "spotlight", "pointlight".

Available material presets: "gold", "smoked_glass", "walnut", "concrete", "brushed_steel", "carbon", "neon", "marble", "terracotta", "matte_white".`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `Create a 3D scene based on this description: "${prompt}" (Style: ${style}).`,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              sceneTitle: { type: Type.STRING },
              description: { type: Type.STRING },
              environmentTheme: {
                type: Type.STRING,
                description: "studio, sunset, midnight, daylight, warm",
              },
              objects: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    type: { type: Type.STRING },
                    position: {
                      type: Type.ARRAY,
                      items: { type: Type.NUMBER },
                      description: "[x, y, z]",
                    },
                    rotation: {
                      type: Type.ARRAY,
                      items: { type: Type.NUMBER },
                      description: "[rx, ry, rz] in degrees",
                    },
                    scale: {
                      type: Type.ARRAY,
                      items: { type: Type.NUMBER },
                      description: "[sx, sy, sz]",
                    },
                    color: { type: Type.STRING, description: "Hex color code e.g. #3b82f6" },
                    materialPreset: { type: Type.STRING },
                    roughness: { type: Type.NUMBER },
                    metalness: { type: Type.NUMBER },
                    transmission: { type: Type.NUMBER },
                  },
                  required: ["name", "type", "position", "scale"],
                },
              },
            },
            required: ["sceneTitle", "description", "objects"],
          },
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("No response generated from Gemini AI");
      }

      const parsedData = JSON.parse(text);
      res.json({ success: true, data: parsedData });
    } catch (error: any) {
      console.error("3D Generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate 3D scene" });
    }
  });

  // Vite middleware for development vs static serve for production
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

  app.listen(binding.port, binding.host, () => {
    console.log(`3D Design Studio server running at ${binding.host}:${binding.port}`);
  });
}

startServer();
