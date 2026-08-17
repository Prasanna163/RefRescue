import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const profileDir = process.env.REFRESCUE_CHROME_PROFILE || path.join(os.homedir(), '.refrescue', 'chrome-profile');
mkdirSync(profileDir, { recursive: true });

function candidates() {
  if (process.platform === 'win32') {
    const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
    return roots.flatMap((root) => [
      path.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ]);
  }
  if (process.platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ];
  }
  return ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
}

const executable = process.env.CHROME_PATH || candidates().find(existsSync);
if (!executable) {
  console.error('Chrome/Edge not found. Set CHROME_PATH to your browser executable.');
  process.exit(1);
}

const args = [
  '--remote-debugging-port=9222',
  '--remote-debugging-address=127.0.0.1',
  `--user-data-dir=${profileDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  'https://app.myloft.xyz/',
];

console.log(`Starting ${executable}`);
console.log(`Dedicated profile: ${profileDir}`);
console.log('Install/log into the MyLOFT extension in THIS profile once. Keep this browser open while using RefRescue.');

const child = spawn(executable, args, { stdio: 'inherit', detached: false });
child.on('exit', (code) => process.exit(code ?? 0));
