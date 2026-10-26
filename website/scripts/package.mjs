import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");
const version = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
).version;
if (!fs.existsSync(path.join(root, "out/index.html")))
  throw new Error("Run npm run build before packaging.");
fs.mkdirSync(output, { recursive: true });
const table = Array.from({ length: 256 }, (_, i) => {
  let value = i;
  for (let bit = 0; bit < 8; bit++)
    value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  return value >>> 0;
});
function crc32(data) {
  let value = 0xffffffff;
  for (const byte of data) value = (value >>> 8) ^ table[(value ^ byte) & 255];
  return (value ^ 0xffffffff) >>> 0;
}
function collect(directory, prefix = "") {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const source = path.join(directory, entry.name),
      name = prefix + entry.name;
    if (entry.isDirectory()) return collect(source, name + "/");
    return entry.isFile() ? [{ name, source }] : [];
  });
}
function zip(filename, entries) {
  const parts = [],
    directory = [];
  let offset = 0;
  for (const { name: entryName, source } of entries) {
    const name = Buffer.from(entryName),
      data = fs.readFileSync(source),
      compressed = zlib.deflateRawSync(data),
      crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt16LE(0x5c21, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(name.length, 26);
    parts.push(header, name, compressed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0x5c21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    directory.push(central, name);
    offset += header.length + name.length + compressed.length;
  }
  const central = Buffer.concat(directory),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  const archive = Buffer.concat([...parts, central, end]);
  fs.writeFileSync(path.join(output, filename), archive);
  return {
    file: filename,
    bytes: archive.length,
    sha256: crypto.createHash("sha256").update(archive).digest("hex"),
  };
}
const files = [
  "package.json",
  "package-lock.json",
  "next.config.ts",
  "next-env.d.ts",
  "tsconfig.json",
  "vercel.json",
  "README.md",
  "VALIDATION.md",
  ".env.example",
];
const sources = [
  ...files.map((name) => ({ name, source: path.join(root, name) })),
  ...["app", "components", "public", "scripts"].flatMap((name) =>
    collect(path.join(root, name), name + "/"),
  ),
];
const archives = [
  zip("gatekeeper-website-source.zip", sources),
  zip("gatekeeper-website-static.zip", collect(path.join(root, "out"))),
];
fs.writeFileSync(
  path.join(output, "SHA256SUMS.txt"),
  archives.map((a) => `${a.sha256}  ${a.file}`).join("\n") + "\n",
);
fs.writeFileSync(
  path.join(output, "manifest.json"),
  JSON.stringify({ version, archives }, null, 2) + "\n",
);
console.log(JSON.stringify(archives, null, 2));
