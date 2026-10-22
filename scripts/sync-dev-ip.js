import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function getLocalIp() {
  const ifaces = os.networkInterfaces();
  const nonVirtual = [];
  const allIpv4 = [];

  for (const [name, addrs] of Object.entries(ifaces)) {
    const isVirtual = /vethernet|virtual|vmware|hyper-v|wsl|loopback|docker/i.test(name);
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        if (!isVirtual) {
          nonVirtual.push({ name, address: addr.address });
        }
        allIpv4.push({ name, address: addr.address });
      }
    }
  }
  const preferred = nonVirtual.find((i) => /wi-fi|wifi|ethernet|wlan/i.test(i.name));
  if (preferred) return preferred.address;
  if (nonVirtual.length > 0) return nonVirtual[0].address;
  if (allIpv4.length > 0) return allIpv4[0].address;
  return '127.0.0.1';
}

function updateEnvFile(filePath, key, value) {
  let content = '';
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, 'utf8');
  }

  const regex = new RegExp(`^${key}=.*$`, 'm');
  let updated;
  if (regex.test(content)) {
    updated = content.replace(regex, `${key}=${value}`);
  } else {
    updated = content.trim() ? `${content.trim()}\n${key}=${value}\n` : `${key}=${value}\n`;
  }

  fs.writeFileSync(filePath, updated, 'utf8');
}

const localIp = getLocalIp();
const rootDir = process.cwd();
const expoEnv = path.join(rootDir, 'expo-mobile', '.env');

try {
  updateEnvFile(expoEnv, 'EXPO_PUBLIC_DEV_MACHINE_IP', localIp);
  console.log(`[sync-dev-ip] Updated expo-mobile/.env with EXPO_PUBLIC_DEV_MACHINE_IP=${localIp}`);
} catch (err) {
  console.warn(`[sync-dev-ip] Notice: Could not update expo-mobile/.env: ${err.message}`);
}
