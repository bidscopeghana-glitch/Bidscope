import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ApiError } from "@/lib/server/api-error";

function key() {
  const raw = process.env.MEETING_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new ApiError(503, "Calendar credential encryption is not configured.", "calendar_encryption_unavailable");
  const value = Buffer.from(raw, "base64");
  if (value.length !== 32) throw new ApiError(503, "Calendar credential encryption is misconfigured.", "calendar_encryption_unavailable");
  return value;
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSecret(value: string) {
  const [version, iv, tag, encrypted] = value.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new ApiError(500, "Stored calendar credentials are invalid.", "calendar_credential_invalid");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}
