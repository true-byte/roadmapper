// npm run test:push, once the pages are built: runs every test in three rounds, one after the other.
// Rounds 1 and 3 run the tests on 4 CPUs of this computer; round 2 runs each page 4 times slower. It stops at the first round that fails, and gives the command that runs that round again.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { cpus } from 'node:os';

/** Each round: its name, how many tests run at once, how many times slower each page runs (SLOW_CPU, in tests/support/helpers.ts), and whether they share 4 CPUs. */
const ROUNDS = [
  { name: '4 tests at once on 4 CPUs', workers: 4, slow: 1, pin: true },
  { name: '4 tests at once, each page 4 times slower', workers: 4, slow: 4, pin: false },
  { name: '8 tests at once on 4 CPUs', workers: 8, slow: 1, pin: true },
];

/** 4 CPUs of this computer: 2 cores with both threads of each, where a core has 2. Null where `taskset` cannot pin the tests to them. */
function fourCpus() {
  if (process.platform !== 'linux' || spawnSync('taskset', ['-V']).status !== 0) return null;
  const picked = [];
  for (let i = 0; i < cpus().length && picked.length < 4; i++) {
    let siblings;
    try {
      siblings = readFileSync(`/sys/devices/system/cpu/cpu${i}/topology/thread_siblings_list`, 'utf8').trim();
    } catch {
      return null;
    }
    // such as '0,4' or '0-1'
    const core = siblings.split(',').flatMap(r => {
      const [a, b = a] = r.split('-').map(Number);
      return Array.from({ length: b - a + 1 }, (_, k) => a + k);
    });
    for (const c of core) if (!picked.includes(c) && picked.length < 4) picked.push(c);
  }
  return picked.length === 4 ? picked.join(',') : null;
}

const pin = fourCpus();
for (const [i, round] of ROUNDS.entries()) {
  const tests = ['--no-install', 'playwright', 'test', `--workers=${round.workers}`];
  const [command, args] = round.pin && pin ? ['taskset', ['-c', pin, 'npx', ...tests]] : ['npx', tests];
  console.log(`\nRound ${i + 1} of ${ROUNDS.length}: ${round.name}${round.pin ? (pin ? `, the CPUs ${pin}` : ', on all CPUs, as taskset cannot pin them here') : ''}.`);
  const { status } = spawnSync(command, args, { stdio: 'inherit', env: { ...process.env, SLOW_CPU: String(round.slow) } });
  if (status !== 0) {
    console.error(`\nRound ${i + 1} of ${ROUNDS.length} failed: ${round.name}.`);
    console.error(`To run this round again, run this command. To run one test file, put its path at the end.\n\n  ${round.slow > 1 ? `SLOW_CPU=${round.slow} ` : ''}${[command, ...args].join(' ')}\n`);
    process.exit(1);
  }
}
