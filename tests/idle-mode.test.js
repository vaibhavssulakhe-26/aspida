import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIdleMode, IDLE_AFTER_MS, SLIDES } from '../src/core/idle-mode.js';

// Minimal fake clock: tick(ms) runs due timeouts/intervals in time order.
function fakeClock() {
  let now = 0;
  let next = 1;
  const jobs = new Map(); // id -> { at, fn, every }
  const add = (fn, ms, every) => {
    const id = next++;
    jobs.set(id, { at: now + ms, fn, every });
    return id;
  };
  return {
    timers: {
      setTimeout: (fn, ms) => add(fn, ms, 0),
      setInterval: (fn, ms) => add(fn, ms, ms),
      clearTimeout: (id) => jobs.delete(id),
      clearInterval: (id) => jobs.delete(id),
    },
    tick(ms) {
      const end = now + ms;
      for (;;) {
        const due = [...jobs].filter(([, j]) => j.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        const [id, job] = due;
        now = job.at;
        if (job.every) job.at += job.every;
        else jobs.delete(id);
        job.fn();
      }
      now = end;
    },
    pending: () => jobs.size,
  };
}

function setup(opts = {}) {
  const clock = fakeClock();
  const log = [];
  const m = createIdleMode({
    timers: clock.timers,
    onIdle: () => log.push('idle'),
    onActive: () => log.push('active'),
    onSlide: () => log.push('slide'),
    ...opts,
  });
  return { clock, log, m, count: (k) => log.filter((x) => x === k).length };
}

test('starts idle: a new slide every 3 s, faded over 0.5 s (one config constant)', () => {
  assert.deepEqual({ ...SLIDES }, { intervalMs: 3000, fadeMs: 500 });
  assert.ok(Object.isFrozen(SLIDES));
  const { clock, m, count } = setup();
  m.start();
  assert.equal(m.mode, 'idle');
  clock.tick(2999);
  assert.equal(count('slide'), 0);
  clock.tick(1);
  assert.equal(count('slide'), 1);
  clock.tick(9000);
  assert.equal(count('slide'), 4);
});

test('click on a navbar item -> active; slides stop at once', () => {
  const { clock, m, count, log } = setup();
  m.start();
  clock.tick(4500);
  m.activate();
  assert.equal(m.mode, 'active');
  assert.equal(log.at(-1), 'active');
  const s = count('slide');
  clock.tick(9000);
  assert.equal(count('slide'), s);
});

test('10 s without a click in active mode -> idle (slides resume)', () => {
  const { clock, m, count } = setup();
  m.start();
  m.activate();
  clock.tick(IDLE_AFTER_MS - 1);
  assert.equal(m.mode, 'active');
  clock.tick(1);
  assert.equal(m.mode, 'idle');
  assert.equal(count('idle'), 2);
  clock.tick(SLIDES.intervalMs);
  assert.equal(count('slide'), 1);
});

test('every click restarts the countdown; idle clicks do nothing', () => {
  const { clock, m, log } = setup();
  m.start();
  m.click();
  clock.tick(500);
  assert.equal(m.mode, 'idle', 'a click outside the navbar does not leave idle');
  m.activate();
  for (let i = 0; i < 5; i++) {
    clock.tick(8000);
    m.click();
  }
  assert.equal(m.mode, 'active');
  clock.tick(IDLE_AFTER_MS);
  assert.equal(m.mode, 'idle');
  assert.equal(log.filter((x) => x === 'active').length, 1);
});

test('activating again while active keeps it active without re-entering', () => {
  const { clock, m, count } = setup();
  m.start();
  m.activate();
  clock.tick(9000);
  m.activate();
  clock.tick(9000);
  assert.equal(m.mode, 'active');
  assert.equal(count('active'), 1);
});

test('focus exception: no return to idle while editing; 10 s again after blur', () => {
  let editing = false;
  const { clock, m } = setup({ isEditing: () => editing });
  m.start();
  m.activate();
  editing = true;
  clock.tick(IDLE_AFTER_MS * 3);
  assert.equal(m.mode, 'active');
  editing = false;
  m.focusLeft();
  clock.tick(IDLE_AFTER_MS - 1);
  assert.equal(m.mode, 'active');
  clock.tick(1);
  assert.equal(m.mode, 'idle');
});

test('hidden tab: all timers stop; on return the countdown starts over', () => {
  const { clock, m, count } = setup();
  m.start();
  m.setHidden(true);
  assert.equal(clock.pending(), 0);
  clock.tick(10_000);
  assert.equal(count('slide'), 0);
  m.setHidden(false);
  clock.tick(SLIDES.intervalMs);
  assert.equal(count('slide'), 1);

  m.activate();
  clock.tick(9000);
  m.setHidden(true);
  clock.tick(60_000);
  assert.equal(m.mode, 'active', 'no switch while hidden');
  m.setHidden(false);
  clock.tick(IDLE_AFTER_MS - 1);
  assert.equal(m.mode, 'active');
  clock.tick(1);
  assert.equal(m.mode, 'idle');
  // Repeated hide/show never stacks intervals.
  for (let i = 0; i < 5; i++) {
    m.setHidden(true);
    m.setHidden(false);
  }
  assert.equal(clock.pending(), 1);
});
