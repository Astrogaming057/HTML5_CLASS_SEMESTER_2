const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const storeFile = path.join(dataDir, 'store.json');

function ensureDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function load() {
  ensureDir();
  try {
    const raw = fs.readFileSync(storeFile, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.users)) data.users = [];
    if (!Array.isArray(data.devices)) data.devices = [];
    const defaultBase =
      process.env.DEFAULT_DEVICE_BASE || 'http://127.0.0.1:3000';
    let fixedBaseUrl = false;
    for (const d of data.devices) {
      if (
        d.baseUrl == null ||
        typeof d.baseUrl !== 'string' ||
        !String(d.baseUrl).trim()
      ) {
        d.baseUrl = defaultBase;
        fixedBaseUrl = true;
      }
    }
    if (fixedBaseUrl) {
      save(data);
    }
    return data;
  } catch (e) {
    return { users: [], devices: [] };
  }
}

function save(data) {
  ensureDir();
  fs.writeFileSync(storeFile, JSON.stringify(data, null, 2), 'utf8');
}

let cache = load();

function getState() {
  return cache;
}

function persist() {
  save(cache);
}

function findUserByName(username) {
  const u = String(username || '').trim().toLowerCase();
  return cache.users.find((x) => x.usernameLower === u);
}

function findUserById(id) {
  return cache.users.find((x) => x.id === id);
}

function addUser(user) {
  cache.users.push(user);
  persist();
}

function findDeviceById(id) {
  return cache.devices.find((d) => d.id === id);
}

function findDeviceByUserAndKey(userId, deviceKey) {
  return cache.devices.find((d) => d.userId === userId && d.deviceKey === deviceKey);
}

function addDevice(device) {
  cache.devices.push(device);
  persist();
}

function updateDevice(device) {
  const i = cache.devices.findIndex((d) => d.id === device.id);
  if (i === -1) return false;
  cache.devices[i] = device;
  persist();
  return true;
}

function listDevicesForUser(userId) {
  return cache.devices.filter((d) => d.userId === userId);
}

module.exports = {
  getState,
  persist,
  findUserByName,
  findUserById,
  findDeviceById,
  findDeviceByUserAndKey,
  addUser,
  addDevice,
  updateDevice,
  listDevicesForUser
};
