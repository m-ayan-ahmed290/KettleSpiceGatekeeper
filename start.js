const { spawn } = require("node:child_process");
const path = require("node:path");
const child = spawn(process.execPath, ["--max-old-space-size=256", path.join(__dirname, "index.js")], { stdio: "inherit", cwd: __dirname });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", error => { console.error("[Startup]", error.message); process.exitCode = 1; });
child.on("exit", (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
