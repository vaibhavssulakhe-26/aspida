// Settings-page idle mode. Pure: timers are injected, no DOM, no chrome.*.
//
//   idle    slideshow visible, section content hidden, navbar auto-rotating
//   active  a section is shown, rotation stopped, slideshow hidden
//
// activate()   a navbar item was chosen (click or keyboard) -> active
// click()      any mouse click on the page; in active mode it restarts the
//              inactivity countdown, in idle mode it does nothing
// focusLeft()  a text field inside the content lost focus; restarts the
//              countdown (see isEditing)
// setHidden(h) the tab was hidden / shown: all timers stop while hidden; on
//              return the countdown starts over (timers never pile up)
//
// isEditing(): while true, the countdown expiring does not return to idle;
// the countdown restarts from the next focusLeft().

export const IDLE_AFTER_MS = 10_000;
export const ROTATE_MS = 2_000;
export const SLIDE_MS = 1_000;

const realTimers = () => ({
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (id) => clearInterval(id),
});

export function createIdleMode({
  timers = realTimers(),
  isEditing = () => false,
  onIdle = () => {},
  onActive = () => {},
  onRotate = () => {},
  onSlide = () => {},
  idleAfterMs = IDLE_AFTER_MS,
  rotateMs = ROTATE_MS,
  slideMs = SLIDE_MS,
} = {}) {
  let mode = 'idle';
  let hidden = false;
  let countdown = null;
  let rotate = null;
  let slide = null;

  function stopAll() {
    timers.clearTimeout(countdown);
    timers.clearInterval(rotate);
    timers.clearInterval(slide);
    countdown = rotate = slide = null;
  }

  function arm() {
    stopAll();
    if (hidden) return;
    if (mode === 'idle') {
      rotate = timers.setInterval(() => onRotate(), rotateMs);
      slide = timers.setInterval(() => onSlide(), slideMs);
    } else {
      countdown = timers.setTimeout(expire, idleAfterMs);
    }
  }

  function expire() {
    countdown = null;
    if (mode !== 'active') return;
    if (isEditing()) return; // wait for focusLeft()
    mode = 'idle';
    onIdle();
    arm();
  }

  return {
    get mode() {
      return mode;
    },
    start() {
      mode = 'idle';
      onIdle();
      arm();
    },
    activate() {
      const was = mode;
      mode = 'active';
      if (was !== 'active') onActive();
      arm();
    },
    click() {
      if (mode === 'active') arm();
    },
    focusLeft() {
      if (mode === 'active') arm();
    },
    setHidden(h) {
      hidden = !!h;
      arm();
    },
    destroy() {
      stopAll();
    },
  };
}
