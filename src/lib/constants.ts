export const APP_NAME = "MOIJEY AI Co-Pilot";

export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  SALES_REP: "sales_rep",
} as const;

export const CHUNK_CONFIG = {
  SIZE: 500,
  OVERLAP: 50,
};

export const AI_CONFIG = {
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL_ID || "gemini-embedding-001",
  COMPLETION_MODEL: process.env.COMPLETION_MODEL_ID || "gemini-2.5-flash",
};

export const UI_COLORS = {
  BACKGROUND: "#020617",
  FOREGROUND: "#F8FAFC",
  ACCENT: "#D4AF37",
  SURFACE: "#1E293B",
  BORDER: "#334155",
};
