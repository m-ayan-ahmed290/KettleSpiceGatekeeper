const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
function check(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", ".next", "out", "dist"].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) check(file);
    else if (file.endsWith(".js")) execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
  }
}
check(path.join(__dirname, ".."));
console.log("JavaScript syntax checks passed.");
