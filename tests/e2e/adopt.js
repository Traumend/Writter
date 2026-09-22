(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (...alts) => { const b = [...document.querySelectorAll('button, li')].find((x) => alts.includes(x.textContent.trim())); if (b) b.click(); return !!b; };
  const t = Date.now(); while (Date.now() - t < 20000 && !document.querySelector('.linker')) await wait(200);
  const rows = [...document.querySelectorAll('.linker .linkrow')].map((r) => (r.querySelector('strong')?.textContent ?? '') + '=' + (r.querySelector('input')?.value ?? ''));
  click('Vincular y abrir', 'Link and open'); await wait(2500);
  const episodes = [...document.querySelectorAll('.lib li')].map((l) => l.textContent.trim()).filter((x) => /^0\.|Reto/.test(x));
  return JSON.stringify({ hadLinker: rows.length > 0, rows, linkerClosed: !document.querySelector('.linker'), crumb: document.querySelector('header .crumb')?.textContent, episodes: episodes.slice(0, 4), tabsEnabled: [...document.querySelectorAll('header > nav > button')].filter((b) => !b.disabled).length });
})()
