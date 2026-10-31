// One floating, interactive panel for report confirm steps opened from an
// email (banner buttons and the inline "Report" buttons next to links). It
// stays until Close, Escape, a click elsewhere or a scroll, and returns focus
// to the button that opened it. Events are stopped at the panel so the page
// never sees clicks on Aspida's buttons.

import { FloatingPanel } from '../ui/overlay.js';
import { safe } from './util.js';

let panel = null; // created on first use, reused
let pop = null; // open step: { opener, listeners }

function on(target, type, fn, opts) {
  const h = safe(fn, type);
  target.addEventListener(type, h, opts);
  pop.listeners.push([target, type, h, opts]);
}

export function closeReportPopover({ restoreFocus = true } = {}) {
  if (!pop) return;
  const { opener, listeners } = pop;
  for (const [t, type, h, opts] of listeners) t.removeEventListener(type, h, opts);
  pop = null;
  panel.hide();
  if (restoreFocus && opener?.isConnected) opener.focus({ preventScroll: true });
}

// opener: the button that was clicked (inside one of our shadow roots).
// content: a rendered confirm step (renderReportPanel / renderSenderReportPanel).
export function openReportPopover(opener, content) {
  if (pop) closeReportPopover({ restoreFocus: false });
  panel ||= new FloatingPanel();
  pop = { opener, listeners: [] };
  panel.show(opener.getBoundingClientRect(), content, { interactive: true });
  const box = panel.box;
  if (!box.dataset.aspidaWired) {
    box.dataset.aspidaWired = '1';
    for (const type of ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'keydown', 'keyup']) {
      box.addEventListener(type, (e) => {
        if (type === 'keydown' && e.key === 'Escape') closeReportPopover();
        e.stopPropagation();
      });
    }
  }
  // A click on the opener itself must not close what it just opened.
  const openerHost = opener.getRootNode()?.host;
  on(document, 'mousedown', (e) => !panel.owns(e.target) && e.target !== openerHost && closeReportPopover({ restoreFocus: false }), { capture: true, passive: true });
  on(document, 'keydown', (e) => e.key === 'Escape' && closeReportPopover(), { capture: true });
  on(window, 'scroll', (e) => !(e.target instanceof Node && panel.owns(e.target)) && closeReportPopover({ restoreFocus: false }), { capture: true, passive: true });
  content.querySelector('button, input')?.focus({ preventScroll: true });
}

export function destroyReportPopover() {
  closeReportPopover({ restoreFocus: false });
  panel?.destroy();
  panel = null;
}
