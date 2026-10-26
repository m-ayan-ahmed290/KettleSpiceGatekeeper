require('dotenv').config();
const config = require('../config.json');
const checks = [
  ['Node.js 22 or newer', Number(process.versions.node.split('.')[0]) >= 22],
  ['Discord token configured', Boolean(process.env.DISCORD_TOKEN || config.token)],
  ['Remote MongoDB configured', /^mongodb(?:\+srv)?:\/\//.test(process.env.MONGODB_URI || config.mongoURL || '')],
];
for (const [label, okay] of checks) console.log(`${okay ? 'OK' : 'MISSING'}: ${label}`);
console.log(process.env.BOT_API_SECRET ? 'OK: Dashboard secret configured' : 'INFO: Dashboard endpoints disabled until BOT_API_SECRET is configured');
console.log('INFO: This is an offline check. Discord permissions, MongoDB access and hosting limits still require live verification.');
if (checks.some(([, okay]) => !okay)) process.exitCode = 1;
