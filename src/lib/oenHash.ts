// OEN (Ontario Education Number) is used only for CSV matching purposes.
// Only hashed values are persisted for privacy — raw OEN is never stored,
// displayed, logged, or exported. This aligns with MFIPPA obligations.

/**
 * Normalizes and hashes an OEN using SHA-256.
 * The raw OEN never leaves this function — only the hex digest is returned.
 */
export async function hashOEN(oen: string): Promise<string> {
  const normalized = oen.replace(/[\s\-]/g, "").trim();

  if (!normalized) return "";

  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);

  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
