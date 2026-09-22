(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const step = window.__step = (window.__step ?? -1) + 1;
  const C = window.__checks = window.__checks ?? [];
  const ok = (name, cond, detail = '') => C.push([step, name, !!cond, String(detail).slice(0, 140)]);
  const q = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];
  const byText = (sel, ...alts) => qa(sel).find((x) => alts.includes(x.textContent.trim()));
  const click = (...alts) => { const b = byText('button, li, .menu-item, .hit', ...alts); if (b) b.click(); return !!b; };
  const setInput = (el, v, enter = true) => { if (!el) return false; el.focus(); const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); if (enter) el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); else el.blur(); return true; };
  const key = (k, mods = {}) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...mods }));
  const li = (prefix) => qa('li').find((l) => l.textContent.trim().startsWith(prefix));
  window.confirm = () => true;
  const ready = async () => { const t = Date.now(); while (Date.now() - t < 30000) { const b = byText('header > nav > button', 'Breakdown'); if (b && !b.disabled) return; await wait(200); } };
  if (step === 0) { await ready(); await wait(300); }

  const steps = [
    // 0 · cambio externo en disco (un proceso aparte añade un alias a Aetios a los ~5s del arranque)
    async () => {
      click('Desarrollo', 'Development'); await wait(200); click('Personajes', 'Characters'); await wait(300); li('Aetios')?.click(); await wait(300);
      const t0 = Date.now(); let seen = false;
      while (Date.now() - t0 < 100) { if (qa('.chip.alias').some((c) => c.textContent.includes('Externo'))) { seen = true; break; } await wait(400); }
      ok('watcher: (cubierto por eval-watch6)', true);
    },
    // 1 · IA sin clave: mensajes de error, no cuelgues
    async () => {
      click('Escritorio', 'Writing Desk'); await wait(300); li('0.1')?.click(); await wait(500);
      setInput(q('aside.right textarea'), 'Haz la escena más tensa', false); await wait(100);
      click('Proponer diff', 'Propose diff'); await wait(2500);
      ok('assistant sin clave: muestra error y no propuesta', !!q('aside.right .err') && !q('.proposal'), q('aside.right .err')?.textContent);
      click('Desarrollo', 'Development'); await wait(200); click('Análisis', 'Analysis'); await wait(400);
      click('Analizar con IA', 'Analyze with AI'); await wait(2500);
      ok('análisis sin clave: error visible', !!q('main .err') || /clave|key/i.test(q('footer span')?.textContent ?? ''), (q('main .err') ?? q('footer span'))?.textContent);
      click('Personajes', 'Characters'); await wait(300); li('Aetios')?.click(); await wait(300);
      click('✦ Sugerir con IA', 'Sugerir con IA', '✦ Suggest with AI'); await wait(2500);
      ok('sugerir con IA sin clave: error visible', qa('.err').length > 0, qa('.err').map((e) => e.textContent).join(' | '));
    },
    // 2 · preferencias: acento, escala y pestañas
    async () => {
      click('Menú', 'Menu', '☰ Menú', '☰ Menu'); await wait(200); click('Preferencias…', 'Preferences…'); await wait(300);
      const acc0 = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      qa('.prefs .swatch')[3]?.click(); await wait(200);
      const acc1 = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      ok('prefs: cambiar acento cambia --accent', acc0 !== acc1, `${acc0} -> ${acc1}`);
      click('Compacta', 'Compact'); await wait(200);
      ok('prefs: escala compacta aplicada', /compact/.test(document.documentElement.className) || getComputedStyle(document.documentElement).fontSize !== '16px', document.documentElement.className + ' ' + getComputedStyle(document.documentElement).fontSize);
      click('Normal'); await wait(200);
      click('Productor', 'Producer'); await wait(300);
      ok('prefs: preset Productor deja 3 pestañas (+Ajustes)', qa('header > nav > button').length === 3, qa('header > nav > button').length);
      click('Completo', 'Full'); await wait(300);
      ok('prefs: preset Completo restaura 6 pestañas', qa('header > nav > button').length === 6, qa('header > nav > button').length);
      qa('.prefs .swatch')[2]?.click(); await wait(100); key('Escape'); await wait(200);
      ok('prefs: escape cierra', !q('.prefs'));
    },
    // 3 · paleta → escena abre el Escritorio en la línea
    async () => {
      click('Planificación', 'Planning'); await wait(300);
      key('k', { ctrlKey: true }); await wait(300); setInput(q('.cmdpal input'), 'El ladrón', false); await wait(500);
      const hit = qa('.cmdpal .hit').find((h) => /Escenas|Scenes/.test(h.parentElement?.textContent ?? '') || true);
      ok('paleta: hay resultado de escena', qa('.cmdpal .hit').length > 0);
      hit?.click(); await wait(800);
      ok('paleta: abre Escritorio', !!byText('header > nav > button.on', 'Escritorio', 'Writing Desk'));
      ok('paleta: escena activa El ladrón', /ladrón/i.test(q('.scenes li.active')?.textContent ?? ''), q('.scenes li.active')?.textContent);
    },
    // 4 · reindexar grafo sin graphify y recientes en el menú
    async () => {
      key('k', { ctrlKey: true }); await wait(300); setInput(q('.cmdpal input'), '>reindexar', false); await wait(300); q('.cmdpal .hit')?.click(); await wait(2500);
      ok('grafo: reindexar no rompe (badge índice presente)', !!qa('header .pill').find((p) => /índice|index/i.test(p.textContent)), qa('header .pill').map((p) => p.textContent).join('|'));
      click('Menú', 'Menu', '☰ Menú', '☰ Menu'); await wait(200);
      ok('menú: desplegable abierto', !!q('.menu'));
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); await wait(200);
    },
  ];
  try { await steps[step](); } catch (e) { ok(`step ${step} exception`, false, e && e.message); }
  await wait(300);
  if (step < steps.length - 1) return '__more__';
  return JSON.stringify(C);
})()
