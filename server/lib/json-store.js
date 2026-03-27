const fsp = require('fs/promises');
const path = require('path');
const os = require('os');

const ORBIT_DIR = path.join(os.homedir(), '.orbit');
const TICKETS_DIR = path.join(ORBIT_DIR, 'tickets');

async function readJson(file) {
  try {
    const data = await fsp.readFile(file, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeJson(file, data) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = file.replace(/\.json$/, '.tmp.json');
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fsp.rename(tmp, file);
}

module.exports = { ORBIT_DIR, TICKETS_DIR, readJson, writeJson };
