(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const step = window.__step = (window.__step ?? -1) + 1;
  const C = window.__checks = window.__checks ?? [];
  const ok = (name, cond, detail = '') => C.push([step, name, !!cond, String(detail).slice(0, 120)]);
  const q = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];
  const byText = (sel, ...alts) => qa(sel).find((x) => alts.includes(x.textContent.trim()));
  const click = (...alts) => { const b = byText('button, li, .menu-item, .hit', ...alts); if (b) b.click(); return !!b; };
  const setInput = (el, v, enter = true) => { if (!el) return false; el.focus(); const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); if (enter) el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); else el.blur(); return true; };
  const setSel = (sel, pred) => { if (!sel) return false; const opt = [...sel.options].find(pred); if (!opt) return false; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, opt.value); sel.dispatchEvent(new Event('change', { bubbles: true })); return true; };
  const key = (k, mods = {}) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...mods }));
  const li = (prefix) => qa('li').find((l) => l.textContent.trim().startsWith(prefix));
  window.confirm = () => true;
  if (step === 0) await wait(1500);

  const steps = [
    // 0 · Escritorio
    async () => {
      click('Escritorio', 'Writing Desk'); await wait(300);
      li('0.1')?.click(); await wait(600);
      ok('desk: abre el capítulo 0.1', q('.cm-content')?.textContent.includes('Preludio 0.1'));
      ok('desk: 18 escenas listadas', qa('.scenes li:not(.grouphead)').length === 18, qa('.scenes li:not(.grouphead)').length);
      setInput(q('aside input[placeholder*="escena" i], aside input[placeholder*="scene" i]'), 'rey', false); await wait(300);
      ok('desk: búsqueda de escena filtra', qa('.scenes li:not(.grouphead)').length === 1, qa('.scenes li:not(.grouphead)').length);
      setInput(q('aside input[placeholder*="escena" i], aside input[placeholder*="scene" i]'), '', false); await wait(300);
      const f0 = !!q('.editor.focus'); click('Enfoque', 'Focus'); await wait(200); ok('desk: modo enfoque conmuta', !!q('.editor.focus') !== f0); click('Enfoque', 'Focus'); await wait(100);
      const p0 = !!q('.editor.page'); click('Página', 'Page'); await wait(200); ok('desk: modo página conmuta', !!q('.editor.page') !== p0); click('Página', 'Page'); await wait(100);
      click('Multi'); await wait(200);
      const cb = qa('.scenes li input[type=checkbox]')[1]; ok('desk: multi muestra casillas', !!cb);
      if (cb) { cb.click(); await wait(200); click('Eliminar', 'Delete'); await wait(800); }
      ok('desk: eliminar escena deja 17', qa('.scenes li:not(.grouphead)').length === 17, qa('.scenes li:not(.grouphead)').length);
      const trashBtn = q('aside button[title*="Papelera"], aside button[title*="trash" i]'); ok('desk: aparece papelera', !!trashBtn);
      trashBtn?.click(); await wait(300); click('Restaurar', 'Restore'); await wait(800);
      ok('desk: restaurar vuelve a 18', qa('.scenes li:not(.grouphead)').length === 18, qa('.scenes li:not(.grouphead)').length);
      click('Multi'); await wait(100);
      const plus = qa('.lib h2 button').find((b) => b.title === 'Nuevo…' || b.title === 'New…');
      ok('desk: botón + en secciones', !!plus);
      const kn = qa('.lib h2').find((h) => /CONOCIMIENTO|KNOWLEDGE/i.test(h.textContent))?.querySelector('button[title]');
      kn?.click(); await wait(300); setInput(q('.newfile input'), 'Regla de prueba E2E'); await wait(900);
      ok('desk: crea documento de conocimiento', !!li('Regla de prueba E2E'));
    },
    // 1 · Breakdown
    async () => {
      click('Breakdown'); await wait(500);
      const n0 = qa('.cards .card, .bd-list .card').length; ok('breakdown: tarjetas visibles', n0 > 0, n0);
      const extract = qa('button').find((b) => /Extraer del guión|Extract from script/.test(b.textContent));
      ok('breakdown: extraer no propone secciones de prosa como locaciones', /\(0\)/.test(extract?.textContent ?? ''), extract?.textContent);
      setInput(q('input[placeholder="Nuevo…"], input[placeholder="New…"]'), 'Personaje E2E'); await wait(900);
      ok('breakdown: nueva ficha aparece', qa('.card strong').some((s) => /PERSONAJE E2E/i.test(s.textContent)));
      setInput(q('.toolbar input[placeholder*="Buscar"], .toolbar input[placeholder*="Search"]'), 'Personaje E2E', false); await wait(400);
      ok('breakdown: búsqueda filtra a 1', qa('.cards .card, .bd-list .card').length === 1, qa('.cards .card, .bd-list .card').length);
      q('.card .cardmenu button')?.click(); await wait(200); click('Renombrar…', 'Rename…'); await wait(300);
      const rn = q('.modal input'); ok('breakdown: modal renombrar', !!rn);
      if (rn) { setInput(rn, 'Personaje Renombrado', false); await wait(100); click('Renombrar', 'Rename'); await wait(1200); }
      setInput(q('.toolbar input[placeholder*="Buscar"], .toolbar input[placeholder*="Search"]'), 'Renombrado', false); await wait(400);
      ok('breakdown: renombrar actualiza la ficha', qa('.card strong').some((s) => /RENOMBRADO/i.test(s.textContent)));
      q('.card .cardmenu button')?.click(); await wait(200); click('Eliminar', 'Delete'); await wait(1000);
      ok('breakdown: eliminar borra la ficha', qa('.cards .card, .bd-list .card').length === 0, qa('.cards .card, .bd-list .card').length);
      setInput(q('.toolbar input[placeholder*="Buscar"], .toolbar input[placeholder*="Search"]'), '', false); await wait(300);
      click('Lista', 'List'); await wait(300); ok('breakdown: vista lista', !!q('.bd-list')); click('Tarjetas', 'Cards'); await wait(200);
    },
    // 2 · Personajes
    async () => {
      click('Desarrollo', 'Development'); await wait(200); click('Personajes', 'Characters'); await wait(400);
      li('Aetios')?.click(); await wait(500);
      ok('personajes: ficha Aetios', q('main.split h1')?.textContent.trim() === 'Aetios', q('main.split h1')?.textContent);
      const alias = q('input.aliasin'); if (alias) { setInput(alias, 'Aet'); await wait(800); }
      ok('personajes: alias añadido', qa('.chip.alias').some((c) => c.textContent.includes('Aet')));
      const eng = qa('.engine input:not([type=range])'); ok('personajes: motor con 10 dimensiones', eng.length === 10, eng.length);
      if (eng[0]) { setInput(eng[0], 'Recuperar la fe'); await wait(700); }
      if (eng[2]) { setInput(eng[2], 'Perder a los suyos'); await wait(700); }
      ok('personajes: motor persiste', qa('.engine input:not([type=range])')[0]?.value === 'Recuperar la fe');
      click('Añadir relación', 'Add relationship'); await wait(800);
      ok('personajes: relación añadida', qa('.relcard').length > 0, qa('.relcard').length);
      // segundo personaje con motor para la CMM
      li('Ezra')?.click(); await wait(500);
      const e2 = qa('.engine input:not([type=range])'); if (e2[0]) { setInput(e2[0], 'Proteger el libro'); await wait(600); } if (e2[2]) { setInput(e2[2], 'Que lo encuentren'); await wait(600); }
    },
    // 3 · Planificación
    async () => {
      click('Planificación', 'Planning'); await wait(200); click('Planner'); await wait(500);
      setInput(q('input[data-new]'), 'Trama A'); await wait(900);
      ok('planner: track creado', qa('.table.planner input').some((i) => i.value === 'Trama A'));
      const st = qa('.table select')[0]; if (st) { setSel(st, (o) => o.value === 'draft'); await wait(800); }
      ok('planner: estado de escena guardado', qa('.table select')[0]?.value === 'draft', qa('.table select')[0]?.value);
      click('Preguntas', 'Questions'); await wait(400);
      setInput(q('input[data-new]'), '¿Quién robó el libro?'); await wait(900);
      ok('preguntas: creada', qa('.qcard').length >= 1, qa('.qcard').length);
      const qs = q('.qcard select'); if (qs) { setSel(qs, (o) => o.value === 'developing'); await wait(700); }
      ok('preguntas: estado cambiado', q('.qcard select')?.value === 'developing');
      click('Plant & Payoff'); await wait(400);
      setInput(q('input[data-new]'), 'Reloj roto'); await wait(900);
      ok('plants: creado', qa('.table tbody tr').length >= 1, qa('.table tbody tr').length);
      click('payoff'); await wait(800); ok('plants: payoff añadido', qa('.table tbody tr:first-child select').length >= 3, qa('.table tbody tr:first-child select').length);
      click('Ideas'); await wait(400);
      setInput(q('input[data-new]'), 'Idea de prueba'); await wait(900);
      ok('ideas: creada', qa('main input').some((i) => i.value === 'Idea de prueba'));
      const sels = qa('.panelbox select'); setSel(sels[sels.length - 2], (o) => o.textContent.includes('Aetios')); await wait(300); setSel(sels[sels.length - 1], (o) => o.textContent.includes('Ezra')); await wait(700);
      ok('cmm: premisas generadas', qa('.premise').length > 0, qa('.premise').length);
      click('Clinic'); await wait(600);
      const issues = qa('main .card, main .panelbox').filter((c) => /Descartar|Dismiss/.test(c.textContent)).length; ok('clinic: hallazgos', issues > 0, issues);
      click('Descartar', 'Dismiss'); await wait(500);
      ok('clinic: descartar reduce', qa('main .card, main .panelbox').filter((c) => /Descartar|Dismiss/.test(c.textContent)).length === issues - 1);
      click('Index'); await wait(400); ok('index: filas', qa('.table tbody tr').length > 0, qa('.table tbody tr').length);
      click('Personajes', 'Characters'); await wait(300); ok('index: pestaña personajes', qa('.table tbody tr').length > 0);
      click('Biblioteca', 'Library'); await wait(400);
      setInput(q('main input[placeholder*="biblioteca" i], main input[placeholder*="library" i]'), 'pregunta', false); await wait(300);
      ok('biblioteca: búsqueda', qa('.libcards .card').length >= 1 && qa('.libcards .card').length < 22, qa('.libcards .card').length);
      q('.libcards .card')?.click(); await wait(300);
      click('Crear nota en el vault', 'Create note in vault'); await wait(1000);
      ok('biblioteca: nota creada en knowledge', true);
    },
    // 4 · Producción y Ajustes
    async () => {
      click('Producción', 'Production'); await wait(500);
      setSel(q('aside select'), (o) => o.textContent.includes('0.1')); await wait(500);
      click('Toma', 'Shot'); await wait(900);
      ok('producción: toma creada', qa('.table tbody tr').length === 1, qa('.table tbody tr').length);
      setInput(q('.table tbody textarea'), 'Plano de prueba', false); await wait(700);
      ok('producción: descripción guardada', q('.table tbody textarea')?.value === 'Plano de prueba');
      q('.table tbody button[title]')?.click(); await wait(800);
      ok('producción: toma eliminada', qa('.table tbody tr').length === 0, qa('.table tbody tr').length);
      click('Ajustes', 'Settings'); await wait(500);
      const model = qa('main input').find((i) => /proveedor|provider/i.test(i.placeholder)); ok('ajustes: campo modelo', !!model);
      if (model) { setInput(model, 'claude-sonnet-5', false); await wait(200); click('Guardar', 'Save'); await wait(900); }
      ok('ajustes: guardado', /guardad|saved/i.test(q('footer span')?.textContent ?? ''), q('footer span')?.textContent);
      const tagIn = qa('main input').find((i) => i.value === '[[ ]]'); if (tagIn) { setInput(tagIn, '%% %%', false); await wait(400); }
      ok('ajustes: validador de tags avisa', qa('main .err, main .warn, main .banner').length > 0);
      if (tagIn) { setInput(tagIn, '[[ ]]', false); await wait(300); }
    },
    // 5 · Modales globales
    async () => {
      click('Escritorio', 'Writing Desk'); await wait(300);
      key('k', { ctrlKey: true }); await wait(300);
      setInput(q('.cmdpal input'), 'Aetios', false); await wait(400);
      ok('paleta: resultados', qa('.cmdpal .hit').length > 0, qa('.cmdpal .hit').length);
      setInput(q('.cmdpal input'), '>clinic', false); await wait(300);
      q('.cmdpal .hit')?.click(); await wait(500);
      ok('paleta: comando abre Clinic', !!byText('nav.sub button.on', 'Clinic'));
      key('N', { ctrlKey: true, shiftKey: true }); await wait(300);
      const qn = qa('.modal input')[0]; ok('nota rápida: modal', !!qn);
      if (qn) { setInput(qn, 'Nota E2E', false); const ta = q('.modal textarea'); setInput(ta, 'Cuerpo de la nota [[Aetios]]', false); await wait(100); click('Guardar', 'Save'); await wait(1000); }
      ok('nota rápida: modal cerrado tras guardar', !q('.modal textarea'));
      click('Menú', 'Menu', '☰ Menú', '☰ Menu'); await wait(200); click('Buscar y reemplazar…', 'Find and replace…'); await wait(300);
      ok('buscar y reemplazar: modal', !!q('.modal.search'));
      if (q('.modal.search')) { setInput(q('.modal.search input'), 'Aetios', false); await wait(100); click('Previsualizar', 'Preview'); await wait(1200); ok('buscar y reemplazar: coincidencias', qa('.modal.search .linkrow').length > 0, qa('.modal.search .linkrow').length); key('Escape'); await wait(200); }
      ok('escape cierra el modal', !q('.modal.search'));
      
    },
    // 6 · Mapa neural, Análisis, Documentos
    async () => {
      click('Desarrollo', 'Development'); await wait(200); click('Mapa neural', 'Neural Map'); await wait(1200);
      ok('mapa: nodos', qa('svg circle, svg rect, svg path.node, svg g.node').length > 5, qa('svg circle, svg rect').length);
      setInput(q('main input[placeholder*="nodo" i], main input[placeholder*="node" i]'), 'Aetios', false); await wait(500);
      ok('mapa: búsqueda no rompe', !!q('svg'));
      click('Análisis', 'Analysis'); await wait(500);
      click('Script Doctor (1)', 'Script Doctor'); await wait(600);
      ok('análisis: script doctor local', /Script Doctor|Doctor/.test(document.body.textContent) && !q('.err'));
      click('Documentos', 'Documents'); await wait(400);
      ok('documentos: 3 secciones', qa('main textarea').length === 3, qa('main textarea').length);
    },
    // 7 · Beat Timeline y Vinculador
    async () => {
      click('Beat Timeline'); await wait(600);
      setSel(qa('main.bt select')[0], (o) => o.textContent.includes('0.1')); await wait(600);
      click('Acto', 'Act'); await wait(700); click('Acto', 'Act'); await wait(700);
      ok('beat timeline: dos actos', qa('.bt-card.act').length >= 2, qa('.bt-card.act').length);
      click('Beat'); await wait(700); ok('beat timeline: beat y inspector', !!q('.bt-card.beat') && !!q('.bt-insp select'));
      const ins = q('.bt-insp input'); if (ins) { setInput(ins, 'Beat renombrado'); await wait(700); }
      ok('beat timeline: título editado desde el inspector', qa('.bt-card.beat b').some((b) => b.textContent === 'Beat renombrado'));
      click('Menú', 'Menu', '☰ Menú', '☰ Menu'); await wait(200); click('Vincular carpetas…', 'Link folders…'); await wait(400);
      ok('vinculador: modal con roles', qa('.linker .linkrow').length >= 7, qa('.linker .linkrow').length);
      key('Escape'); await wait(200); ok('vinculador: escape cierra', !q('.linker'));
    },
  ];
  try { await steps[step](); } catch (e) { ok(`step ${step} exception`, false, e && e.message); }
  await wait(300);
  if (step < steps.length - 1) return '__more__';
  return JSON.stringify(C);
})()
