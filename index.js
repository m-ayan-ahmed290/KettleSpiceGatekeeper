// Wispbyte may force index.js as the entry file. Relaunch once with a bounded heap.
const configuredHeap = [...process.execArgv.join(" ").matchAll(/--max[-_]old[-_]space[-_]size(?:=| )(\d+)/g)].at(-1)?.[1];
if (!configuredHeap || Number(configuredHeap) > 256) {
  require("./start");
} else {
  require("./bot");
}
