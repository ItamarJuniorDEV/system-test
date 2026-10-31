import { createHash } from "node:crypto";

/** Node/server only. Never trust a file hash supplied by the browser. */
export function computeXmlSha256(xml: string): string {
  return createHash("sha256").update(xml, "utf8").digest("hex");
}
