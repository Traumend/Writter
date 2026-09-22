(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const step = window.__step = (window.__step ?? -1) + 1;
  const C = window.__checks = window.__checks ?? [];
  const ok = (name, cond, detail = '') => C.push([step, name, !!cond, String(detail).slice(0, 160)]);
  const q = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];
  const byText = (sel, ...alts) => qa(sel).find((x) => alts.includes(x.textContent.trim()));
  const click = (...alts) => { const b = byText('button, li, .menu-item, .hit', ...alts); if (b) b.click(); return !!b; };
  const setInput = (el, v, enter = true) => { if (!el) return false; el.focus(); const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); if (enter) el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); else el.blur(); return true; };
  const setSel = (sel, pred) => { if (!sel) return false; const opt = [...sel.options].find(pred); if (!opt) return false; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, opt.value); sel.dispatchEvent(new Event('change', { bubbles: true })); return true; };
  const key = (k, mods = {}) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...mods }));
  const li = (prefix) => qa('main aside li').find((l) => l.textContent.trim().startsWith(prefix));
  const ready = async () => { const t = Date.now(); while (Date.now() - t < 30000) { const b = byText('header > nav > button', 'Breakdown'); if (b && !b.disabled) return; await wait(200); } };
  window.confirm = () => true;
  if (step === 0) { await ready(); await wait(300); }

  const steps = [
    // 0 · renombrar entidad enlazada actualiza el guion; reordenar escenas
    async () => {
      click('Desarrollo', 'Development'); await wait(200); click('Personajes', 'Characters'); await wait(400);
      li('Aetios')?.click(); await wait(400);
      click('Renombrar…', 'Rename…'); await wait(300);
      const inp = q('.modal input'); ok('rename: modal', !!inp);
      if (inp) { setInput(inp, 'Aetios Renombrado', false); await wait(100); click('Renombrar', 'Rename'); await wait(2500); }
      ok('rename: ficha renombrada', q('main h1')?.textContent.trim() === 'Aetios Renombrado', q('main h1')?.textContent);
      const docs = await window.api.vaultReadAll();
      const ch = docs.find((d) => d.path.endsWith('0.1 - Los 10 Cruzados Santos.md'));
      ok('rename: enlaces [[…]] del capítulo actualizados', ch && ch.content.includes('[[Aetios Renombrado]]') && !ch.content.includes('[[Aetios]]'));
      ok('rename: archivo movido', docs.some((d) => d.path.endsWith('/Aetios Renombrado.md')) && !docs.some((d) => d.path.endsWith('/Aetios.md')));
      click('Escritorio', 'Writing Desk'); await wait(300); li('0.1')?.click(); await wait(600);
      const first = qa('.scenes li:not(.grouphead) .ell')[0]?.textContent; const second = qa('.scenes li:not(.grouphead) .ell')[1]?.textContent;
      qa('.scenes li:not(.grouphead) .mv')[2]?.click(); await wait(900); // ▲ de la escena 2
      ok('desk: reordenar intercambia 1 y 2', qa('.scenes li:not(.grouphead) .ell')[0]?.textContent === second && qa('.scenes li:not(.grouphead) .ell')[1]?.textContent === first, `${first} / ${second} -> ${qa('.scenes li:not(.grouphead) .ell')[0]?.textContent}`);
      qa('.scenes li:not(.grouphead) .mv')[1]?.click(); await wait(900); // ▼ de la escena 1 (deshacer)
      ok('desk: reordenar de vuelta', qa('.scenes li:not(.grouphead) .ell')[0]?.textContent === first);
    },
    // 1 · versiones: snapshot y restaurar; panel Exportar a petición; grupo (sección)
    async () => {
      click('Versiones', 'Versions'); await wait(300);
      setInput(q('aside.right input[placeholder*="snapshot" i]'), 'Antes de tocar', false); await wait(100);
      const snapBtn = qa('aside.right button').find((b) => /Snapshot|Instantánea/i.test(b.textContent) && !b.disabled); ok('versiones: botón snapshot', !!snapBtn, qa('aside.right button').map((b) => b.textContent).join('|'));
      snapBtn?.click(); await wait(1200);
      ok('versiones: snapshot listado', /Antes de tocar/.test(q('aside.right')?.textContent ?? ''));
      click('Exportar', 'Export'); await wait(300);
      ok('exportar: panel con PDF/DOCX/FDX', /PDF/.test(q('aside.right')?.textContent ?? '') && /FDX/.test(q('aside.right')?.textContent ?? ''));
      const btns = qa('aside.right button').filter((b) => /DOCX|FDX|Fountain|TXT/.test(b.textContent)); ok('exportar: botones habilitados con guion abierto', btns.length === 4 && btns.every((b) => !b.disabled), btns.map((b) => b.disabled).join(','));
      click('Script Assistant'); await wait(200);
      const n0 = qa('.scenes li.grouphead').length;
      click('+ grupo (sección) en la escena actual', '+ group (section) in the current scene'); await wait(300);
      setInput(q('aside input[placeholder*="grupo" i], aside input[placeholder*="group" i]'), 'Parte Nueva'); await wait(900);
      ok('desk: nuevo grupo (sección) encabeza la lista', /Parte Nueva/i.test(q('.scenes li.grouphead')?.textContent ?? ''), q('.scenes li.grouphead')?.textContent);
    },
    // 2 · mapa neural: doble clic en un nodo abre la entidad; ajustes proveedor ollama
    async () => {
      click('Desarrollo', 'Development'); await wait(200); click('Mapa neural', 'Neural Map'); await wait(1200);
      const node = qa('svg g').filter((g) => /Ezra/.test(g.textContent)).pop();
      ok('mapa: nodo Ezra presente', !!node);
      node?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); await wait(800);
      ok('mapa: doble clic abre la entidad en el Escritorio', !!byText('header > nav > button.on', 'Escritorio', 'Writing Desk') && /Ezra/.test(q('.cm-content')?.textContent ?? ''), q('header > nav > button.on')?.textContent);
      click('Ajustes', 'Settings'); await wait(400);
      const prov = qa('main select')[0]; setSel(prov, (o) => o.value === 'ollama'); await wait(200); click('Guardar', 'Save'); await wait(900);
      ok('ajustes: proveedor ollama guardado y BYOK ●', /ollama/.test(q('footer')?.textContent ?? '') && /●/.test(q('footer')?.textContent ?? ''), q('footer')?.textContent.slice(-40));
      setSel(qa('main select')[0], (o) => o.value === 'anthropic'); await wait(200); click('Guardar', 'Save'); await wait(600);
    },
    // 3 · Planificación: pregunta con referencia a escena y clinic la reconoce; index búsqueda
    async () => {
      click('Planificación', 'Planning'); await wait(200); click('Preguntas', 'Questions'); await wait(400);
      setInput(q('input[data-new]'), '¿Sobrevivirá el anciano?'); await wait(900);
      const card = qa('.qcard').find((c) => [...c.querySelectorAll('input')].some((i) => /anciano/.test(i.value))); ok('preguntas: tarjeta creada', !!card, qa('.qcard').length);
      const sels = card ? [...card.querySelectorAll('select')] : []; ok('preguntas: selects de referencia', sels.length >= 4, sels.length);
      setSel(sels[2], (o) => /0\.1/.test(o.textContent)); await wait(500); setSel(sels[3], (o) => /#3/.test(o.textContent)); await wait(700);
      ok('preguntas: escena de planteo guardada', /#3/.test(card?.querySelectorAll('select')[3]?.selectedOptions[0]?.textContent ?? ''), card?.querySelectorAll('select')[3]?.selectedOptions[0]?.textContent);
      click('Clinic'); await wait(600);
      ok('clinic: pregunta abierta detectada', /anciano/.test(q('main')?.textContent ?? ''));
      click('Index'); await wait(300); const tabBtn = qa('main .toolbar button').find((b) => /^(Preguntas|Questions)$/.test(b.textContent.trim())); tabBtn?.click(); await wait(300);
      setInput(q('main .toolbar input'), 'anciano', false); await wait(300);
      ok('index: búsqueda filtra preguntas', qa('.table tbody tr').length === 1, qa('.table tbody tr').length);
    },
  ];
  try { await steps[step](); } catch (e) { ok(`step ${step} exception`, false, e && e.message); }
  await wait(300);
  if (step < steps.length - 1) return '__more__';
  return JSON.stringify(C);
})()
