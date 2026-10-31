import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.env.NODE_ENV === "production") {
  console.error("A demonstração só funciona em desenvolvimento local.");
  process.exit(1);
}
console.log(
  "Demonstração local: dados sintéticos em memória, apagados ao encerrar. http://127.0.0.1:3000",
);
const next = fileURLToPath(
  new URL("../node_modules/next/dist/bin/next", import.meta.url),
);
const child = spawn(
  process.execPath,
  [next, "dev", "--webpack", "--hostname", "127.0.0.1"],
  {
    stdio: "inherit",
    env: { ...process.env, ERP_LOCAL_DEMO: "1" },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));
