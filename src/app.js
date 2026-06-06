import "dotenv/config";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger.config.js";
import artistsRouter from "./routes/artists.routes.js";
import releasesRouter from "./routes/releases.routes.js";
import genresRouter from "./routes/genres.routes.js";
import submissionsRouter from "./routes/submissions.routes.js";
import authRouter from "./routes/auth.routes.js";
import heroSpotlightsRouter from "./routes/hero-spotlights.routes.js";
import dashboardRouter from "./routes/dashboard.routes.js";
import uploadRouter from "./routes/upload.routes.js";
import newsletterRouter from "./routes/newsletter.routes.js";
import analyticsRouter from "./routes/analytics.routes.js";
import postsRouter from "./routes/posts.routes.js";
import emailTemplatesRouter from "./routes/emailTemplates.routes.js";
const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Recursive Web Backend");
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/api/artists", artistsRouter);
app.use("/api/releases", releasesRouter);
app.use("/api/genres", genresRouter);
app.use("/api/demo-submission", submissionsRouter);
app.use("/api/auth", authRouter);
app.use("/api/hero-spotlights", heroSpotlightsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/newsletter", newsletterRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/posts", postsRouter);
app.use("/api/email-templates", emailTemplatesRouter);

export default app;
