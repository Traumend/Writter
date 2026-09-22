(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__ev = []; window.api.onVaultChange((e) => window.__ev.push(e.path));
  const click = (...alts) => { const b = [...document.querySelectorAll('button, li')].find((x) => alts.includes(x.textContent.trim())); if (b) b.click(); return !!b; };
  const snap = () => ({ main: document.querySelector('main')?.className, h1: document.querySelector('main h1')?.textContent, hero: !!document.querySelector('.hero'), chips: document.querySelector('.hero .chips')?.innerText, listN: document.querySelectorAll('main aside li').length, sectionHead: document.querySelector('main section')?.innerText.slice(0, 80) });
  const ready = async () => { const t = Date.now(); while (Date.now() - t < 30000) { const b = [...document.querySelectorAll('header > nav > button')].find((x) => x.textContent.trim() === 'Breakdown'); if (b && !b.disabled) return; await wait(200); } };
  await ready(); await wait(300);
  click('Desarrollo', 'Development'); await wait(300); click('Personajes', 'Characters'); await wait(400);
  const item = [...document.querySelectorAll('main aside li')].find((l) => l.textContent.trim().startsWith('Aetios')); item?.click(); await wait(400);
  const before = snap();
  const t0 = Date.now(); while (Date.now() - t0 < 40000 && !window.__ev.length) await wait(300);
  await wait(3000);
  const after = snap();
  return JSON.stringify({ events: window.__ev.length, before, after });
})()
