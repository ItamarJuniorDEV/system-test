import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { isLocalDemo } from "../src/lib/server/config";

afterEach(() => vi.unstubAllEnvs());
describe("limite da demonstração local", () => {
  it("fica desativada por padrão", () => {
    vi.stubEnv("ERP_LOCAL_DEMO", "");
    expect(isLocalDemo()).toBe(false);
  });
  it("aceita ativação explícita em desenvolvimento", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ERP_LOCAL_DEMO", "1");
    expect(isLocalDemo()).toBe(true);
  });
  it("recusa ativação em produção", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ERP_LOCAL_DEMO", "1");
    expect(() => isLocalDemo()).toThrow("bloqueada em produção");
  });
});
