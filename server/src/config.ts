import dotenv from "dotenv";
dotenv.config();

function num(v: string | undefined, d: number): number {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : d;
}

export const config = {
  port: num(process.env.PORT, 8080),
  corsOrigins: (process.env.CORS_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  agencyName: process.env.AGENCY_NAME || "DALI Agency",
  agencyDescription:
    process.env.AGENCY_DESCRIPTION ||
    "a creative and brand agency that does brand identity, campaigns and design for D2C and growth-stage companies",

  qualifyThreshold: num(process.env.QUALIFY_THRESHOLD, 75),
  disqualifyThreshold: num(process.env.DISQUALIFY_THRESHOLD, 40),

  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  llmModel: process.env.LLM_MODEL || "claude-haiku-4-5-20251001",

  whatsapp: {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "",
    token: process.env.WHATSAPP_TOKEN || "",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    appSecret: process.env.WHATSAPP_APP_SECRET || "",
    graphVersion: process.env.GRAPH_API_VERSION || "v21.0",
  },

  serveWeb: process.env.SERVE_WEB === "1",
};

export const whatsappEnabled = () =>
  !!(config.whatsapp.token && config.whatsapp.phoneNumberId);

export const llmEnabled = () => !!config.anthropicApiKey;
