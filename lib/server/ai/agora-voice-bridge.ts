import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { ApiError } from "@/lib/server/api-error";

export type VoiceBridge = { accessToken: string; userId: string; expiresAt: number; channel: string; currentPath: string; threadId: string };

function encryptionKey() {
  const secret = process.env.AGORA_APP_CERTIFICATE;
  if (!secret || secret.length < 24) throw new ApiError(503, "Agora voice is not configured.", "agora_voice_unavailable");
  return createHash("sha256").update("bidscope-taleh-bridge-v1:").update(secret).digest();
}

export function sealVoiceBridge(payload: VoiceBridge) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString("base64url")).join(".");
}

export function openVoiceBridge(token: string): VoiceBridge {
  try {
    if (token.length > 8192) throw new Error("oversized");
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("malformed");
    const [iv, tag, encrypted] = parts.map(part => Buffer.from(part, "base64url"));
    if (iv.length !== 12 || tag.length !== 16) throw new Error("malformed");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    const data = JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")) as VoiceBridge;
    if (!data.userId || !data.accessToken || !data.channel || !data.threadId || Date.now() >= data.expiresAt) throw new Error("expired");
    return data;
  } catch { throw new ApiError(401, "This voice session has expired. Start a new call.", "agora_voice_session_invalid"); }
}

export function voiceStopProof(userId: string, agentId: string) {
  return createHmac("sha256", encryptionKey()).update(`stop:${userId}:${agentId}`).digest("hex");
}

export function verifyVoiceStopProof(userId: string, agentId: string, proof: string) {
  const expected = Buffer.from(voiceStopProof(userId, agentId), "hex");
  const supplied = Buffer.from(proof, "hex");
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export function agoraVoiceEnabled() {
  return process.env.BIDSCOPE_AGORA_RECEPTIONIST_ENABLED === "true" && Boolean(process.env.AGORA_APP_ID && process.env.AGORA_APP_CERTIFICATE);
}
