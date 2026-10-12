import "dotenv/config";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import routes from "./routes";
import { connectDB } from "./lib/db";

const app = express();
const PORT = Number(process.env.PORT || 4000);

// Allow the frontend origin(s) to call the API. Comma-separated list in env.
const origins = (process.env.CORS_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim());

app.use(cors({ origin: origins }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api", routes);

// 404 for unknown API routes.
app.use((_req, res) => res.status(404).json({ error: "not_found" }));

// Central error handler.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "internal_error" });
});

async function start() {
  try {
    await connectDB();
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection failed:", err);
  }
  app.listen(PORT, () => console.log(`API ready on http://localhost:${PORT}`));
}

start();
