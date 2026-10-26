const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
for (const name of fs.readdirSync(path.join(__dirname, "../test")).filter(name => name.endsWith(".test.js"))) {
  const result = spawnSync(process.execPath, [path.join(__dirname, "../test", name)], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
