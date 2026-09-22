const BLOCKED_DEVTOOLS_KEYS = [
  { test: (e: KeyboardEvent) => e.key === 'F12' },
  { test: (e: KeyboardEvent) => e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i') },
  { test: (e: KeyboardEvent) => e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j') },
  { test: (e: KeyboardEvent) => e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c') },
  { test: (e: KeyboardEvent) => e.ctrlKey && (e.key === 'U' || e.key === 'u') },
];

export function installDevtoolsBlocker() {
  document.addEventListener('keydown', (e) => {
    if (BLOCKED_DEVTOOLS_KEYS.some(rule => rule.test(e))) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  });

  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  });

  document.addEventListener('dragstart', (e) => {
    const t = e.target as HTMLElement;
    if (t.tagName === 'INPUT' || t.tagName === 'LABEL' || t.tagName === 'SELECT' ||
        t.tagName === 'BUTTON' || t.tagName === 'TEXTAREA' ||
        t.closest('input, label, select, button, [role="slider"]')) {
      e.preventDefault();
    }
  });
}
