// Small blocking bootstrap: reuse the existing settings before first paint.
try {
  const saved = JSON.parse(localStorage.getItem('game-desk-settings-v1')) || {};
  const mode = ['light','dark','system'].includes(saved.appearance) ? saved.appearance : 'dark';
  document.documentElement.dataset.appearance = mode === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode;
  document.documentElement.dataset.reduceMotion = String(saved.reduceMotion === true);
  document.documentElement.style.colorScheme = document.documentElement.dataset.appearance;
} catch { document.documentElement.dataset.appearance = 'dark'; }

if (document.documentElement.dataset.homeDesign === 'booth') {
  const view = location.hash.slice(2);
  document.documentElement.dataset.currentView = ['my-team','standings','stats','highlights','betting','watch','settings'].includes(view) ? view : 'games';
}
