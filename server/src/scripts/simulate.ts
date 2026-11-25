/**
 * ProctorIQ Candidate Swarm Simulator CLI Script
 * Run with: npm run simulate -- [--students 12] [--speed 2] [--chaos high] [--duration 60]
 */
import { simulatorEngine, type ChaosLevel } from '../services/simulator.js';
import { testDbConnection } from '../config/db.js';

function parseArgs() {
  const args = process.argv.slice(2);
  let students = 12;
  let speed = 2.0;
  let chaos: ChaosLevel = 'medium';
  let examId = 1;
  let duration = 0; // 0 = run until Ctrl+C

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--students' || arg === '-s') {
      students = parseInt(args[++i], 10) || 12;
    } else if (arg === '--speed') {
      speed = parseFloat(args[++i]) || 2.0;
    } else if (arg === '--chaos' || arg === '-c') {
      const c = (args[++i] || '').toLowerCase();
      if (c === 'low' || c === 'medium' || c === 'high') {
        chaos = c;
      }
    } else if (arg === '--exam' || arg === '-e') {
      examId = parseInt(args[++i], 10) || 1;
    } else if (arg === '--duration' || arg === '-d') {
      duration = parseInt(args[++i], 10) || 0;
    }
  }

  return { students, speed, chaos, examId, duration };
}

async function main() {
  const { students, speed, chaos, examId, duration } = parseArgs();

  console.log('\n================================================================');
  console.log('   PROCTORIQ CANDIDATE SWARM SIMULATOR // MISSION CONTROL');
  console.log('================================================================');
  console.log(` Target Exam ID  : ${examId}`);
  console.log(` Virtual Students: ${students}`);
  console.log(` Speed Multiplier: ${speed}x`);
  console.log(` Chaos Level     : ${chaos.toUpperCase()}`);
  console.log(` Duration Limit  : ${duration > 0 ? `${duration}s` : 'Unlimited (Press Ctrl+C to stop)'}`);
  console.log('----------------------------------------------------------------\n');

  const dbOk = await testDbConnection();
  if (!dbOk) {
    console.error(' [ERROR] Could not connect to MySQL database.');
    process.exit(1);
  }

  console.log(' Initializing simulation swarm...');
  await simulatorEngine.start({
    examId,
    studentCount: students,
    speed,
    chaos,
  });

  console.log(' Simulation running! Real-time events broadcasting over Socket.IO.\n');

  let secondsElapsed = 0;
  const renderInterval = setInterval(async () => {
    secondsElapsed++;
    await simulatorEngine.tick();
    const state = simulatorEngine.getState();

    // Print status line
    const stats = state.stats;
    console.log(
      `[T+${String(secondsElapsed).padStart(3, '0')}s] ` +
      `Active: \x1b[32m${stats.activeCount}\x1b[0m | ` +
      `Answers: \x1b[36m${stats.answersCount}\x1b[0m | ` +
      `Infractions: \x1b[33m${stats.infractionsCount}\x1b[0m | ` +
      `Disqualified: \x1b[31m${stats.terminatedCount}\x1b[0m`
    );

    // Print latest activity log entry if available
    const latest = state.activityLogs[0];
    if (latest) {
      const color =
        latest.type === 'violation' ? '\x1b[33m' : latest.type === 'answer' ? '\x1b[36m' : '\x1b[35m';
      console.log(`   -> ${latest.candidateName}: ${color}${latest.detail}\x1b[0m`);
    }

    if (duration > 0 && secondsElapsed >= duration) {
      console.log(`\n Simulation duration reached (${duration}s). Stopping...`);
      cleanup();
    }
  }, 1000);

  async function cleanup() {
    clearInterval(renderInterval);
    await simulatorEngine.stop();
    console.log('\n Swarm simulator stopped. Clean shutdown.');
    process.exit(0);
  }

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

main().catch((err) => {
  console.error('[Simulator CLI Error]:', err);
  process.exit(1);
});

