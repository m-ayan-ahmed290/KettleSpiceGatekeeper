/** Build flat, secret-free ZIPs using Node's standard library; no server-side install required. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const output = path.join(root, 'dist');
const table = Array.from({ length: 256 }, (_, i) => {
  let crc = i;
  for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  return crc >>> 0;
});
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = (crc >>> 8) ^ table[(crc ^ byte) & 255];
  return (crc ^ 0xffffffff) >>> 0;
}
function collect(directory, prefix = '') {
  const entries = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.bin' || entry.name === '.package-lock.json') continue;
    const name = prefix + entry.name, source = path.join(directory, entry.name);
    if (entry.isDirectory()) entries.push(...collect(source, name + '/'));
    else if (entry.isFile()) entries.push({ name, source });
  }
  return entries;
}
function buildZip(destination, entries) {
  const fd = fs.openSync(destination, 'w'), directory = [];
  let offset = 0, unpacked = 0;
  try {
    for (const entry of entries) {
      const data = fs.readFileSync(entry.source), compressed = zlib.deflateRawSync(data), name = Buffer.from(entry.name);
      const crc = crc32(data), header = Buffer.alloc(30);
      header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6);
      header.writeUInt16LE(8, 8); header.writeUInt16LE(0x5c21, 12); header.writeUInt32LE(crc, 14);
      header.writeUInt32LE(compressed.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(name.length, 26);
      for (const chunk of [header, name, compressed]) fs.writeSync(fd, chunk);
      const central = Buffer.alloc(46);
      central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
      central.writeUInt16LE(0x800, 8); central.writeUInt16LE(8, 10); central.writeUInt16LE(0x5c21, 14);
      central.writeUInt32LE(crc, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(data.length, 24);
      central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
      directory.push(central, name);
      offset += header.length + name.length + compressed.length; unpacked += data.length;
    }
    const centralStart = offset;
    for (const chunk of directory) { fs.writeSync(fd, chunk); offset += chunk.length; }
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(offset - centralStart, 12); end.writeUInt32LE(centralStart, 16); fs.writeSync(fd, end);
  } finally { fs.closeSync(fd); }
  return { name: path.basename(destination), files: entries.length, compressedBytes: fs.statSync(destination).size, unpackedBytes: unpacked };
}
function main() {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
  if (Object.entries(config).some(([key, value]) => /token|mongourl|password|secret/i.test(key) && value))
    throw new Error('Move secrets out of config.json before packaging. No archive was built.');
  fs.mkdirSync(output, { recursive: true });
  const source = [];
  for (const name of ['index.js', 'start.js', 'config.json', 'package.json', 'package-lock.json', '.env.example', 'README.md', 'WISPBYTE.md', 'CHANGELOG.md'])
    source.push({ name, source: path.join(root, name) });
  for (const name of ['commands', 'events', 'schemas', 'utilities', 'api', 'data', 'scripts', 'test', 'deploy'])
    source.push(...collect(path.join(root, name), name + '/'));
  const manifests = [buildZip(path.join(output, 'ktg-bot-source.zip'), source)];
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'ktg-package-'));
  try {
    for (const name of ['package.json', 'package-lock.json']) fs.copyFileSync(path.join(root, name), path.join(temporary, name));
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    execFileSync(npm, ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', path.join(temporary, 'npm-cache')], { cwd: temporary, stdio: 'inherit' });
    manifests.push(buildZip(path.join(output, 'ktg-bot-wispbyte.zip'), source.concat(collect(path.join(temporary, 'node_modules'), 'node_modules/'))));
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
  const checksums = manifests.map(item => crypto.createHash('sha256').update(fs.readFileSync(path.join(output, item.name))).digest('hex') + '  ' + item.name).join('\n') + '\n';
  fs.writeFileSync(path.join(output, 'SHA256SUMS.txt'), checksums);
  fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify({ version: require('../package.json').version, archives: manifests }, null, 2) + '\n');
  console.log(JSON.stringify(manifests, null, 2));
}
if (require.main === module) main();
module.exports = { buildZip, crc32 };
