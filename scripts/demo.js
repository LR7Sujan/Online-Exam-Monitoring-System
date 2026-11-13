#!/usr/bin/env node

import { spawn, execSync } from 'node:child_process';
import net from 'node:net';

console.log('\x1b[36m%s\x1b[0m', '==========================================================');
console.log('\x1b[1m\x1b[36m%s\x1b[0m', '      PROCTORIQ MISSION CONTROL: DEMO LAUNCHPAD           ');
console.log('\x1b[36m%s\x1b[0m', '==========================================================');

// Helper to probe TCP connection on port
function checkPort(port, host = '127.0.0.1', timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let connected = false;

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      connected = true;
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

async function waitForPort(port, host = '127.0.0.1', retries = 25, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    const ok = await checkPort(port, host);
    if (ok) return true;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

async function main() {
  console.log('\x1b[34m[1/4]\x1b[0m Checking MySQL 8.0+ Availability...');
  let dbUp = await checkPort(3306);

  if (!dbUp) {
    console.log(' -> MySQL not detected on 127.0.0.1:3306.');
    console.log(' -> Attempting Docker container start (proctoriq-mysql)...');
    try {
      execSync('docker compose -f db/docker-compose.yml up -d', { stdio: 'inherit' });
    } catch {
      try {
        execSync('docker start proctoriq-mysql', { stdio: 'inherit' });
      } catch (e) {
        console.warn(' -> Docker command failed. Please ensure MySQL is listening on 3306.', e.message);
      }
    }

    console.log(' -> Waiting for MySQL port 3306 to accept connections...');
    dbUp = await waitForPort(3306, '127.0.0.1', 20, 1000);
  }

  if (dbUp) {
    console.log('\x1b[32m  ✓ MySQL 8.0+ is ONLINE on 127.0.0.1:3306\x1b[0m');
  } else {
    console.warn('\x1b[33m  ⚠ MySQL port 3306 not responding. Will proceed with seed attempt...\x1b[0m');
  }

  console.log('\x1b[34m[2/4]\x1b[0m Initializing DBMS Schema, Triggers, Views & Seed Data...');
  try {
    execSync('npm --prefix server run db:init', { stdio: 'inherit' });
    console.log('\x1b[32m  ✓ MySQL database initialized with clean seed state!\x1b[0m');
  } catch (err) {
    console.error('\x1b[31m  ✗ Database initialization encountered an issue:\x1b[0m', err.message);
  }

  console.log('\x1b[34m[3/4]\x1b[0m Launching ProctorIQ Backend API + Vite Frontend SPA...');
  console.log('\x1b[36m%s\x1b[0m', '----------------------------------------------------------');
  console.log('  🌐 Client Web Console:     \x1b[1m\x1b[32mhttp://localhost:5173\x1b[0m');
  console.log('  🔌 Backend REST & Sockets: \x1b[1m\x1b[36mhttp://localhost:4000\x1b[0m');
  console.log('  📚 Swagger API Docs:       \x1b[1m\x1b[35mhttp://localhost:4000/api/docs\x1b[0m');
  console.log('  🤖 Swarm Demo Simulator:   \x1b[1m\x1b[33mhttp://localhost:5173/admin/simulator\x1b[0m');
  console.log('\x1b[36m%s\x1b[0m', '----------------------------------------------------------');
  console.log('  🔑 DEMO OPERATOR CREDENTIALS (All accounts use password: \x1b[1mProctorIQ#2026\x1b[0m)');
  console.log('     • Admin:   \x1b[35madmin@proctoriq.io\x1b[0m');
  console.log('     • Proctor: \x1b[36mproctor@proctoriq.io\x1b[0m');
  console.log('     • Student: \x1b[32mstudent@proctoriq.io\x1b[0m (or student2..student60)');
  console.log('\x1b[36m%s\x1b[0m', '==========================================================\n');

  // Launch both services using concurrently or standard node child_process
  const child = spawn(
    'npx',
    [
      'concurrently',
      '-k',
      '-p',
      '[{name}]',
      '-n',
      'SERVER,CLIENT',
      '-c',
      'cyan.bold,magenta.bold',
      '"npm --prefix server run dev"',
      '"npm --prefix client run dev"',
    ],
    {
      shell: true,
      stdio: 'inherit',
    }
  );

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error('Fatal error launching demo:', err);
  process.exit(1);
});

