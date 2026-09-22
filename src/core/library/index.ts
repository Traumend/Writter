// Biblioteca editorial de Writter: contenido ORIGINAL escrito para este producto (no copiado de ningún catálogo).
// Separado de los datos del usuario: vive en código, no en el vault. Conjunto semilla pensado para crecer.
export type LibKind = 'technique' | 'psychology' | 'trope'
export type LibEntry = {
  id: string
  kind: LibKind
  title: string
  category: string
  summary: string
  when: string // cuándo usarla / manifestación / uso habitual
  pitfalls: string // riesgos o cautelas
  related: string[]
  tags: string[]
}

const T = (id: string, category: string, title: string, summary: string, when: string, pitfalls: string, related: string[] = [], tags: string[] = []): LibEntry => ({ id, kind: 'technique', title, category, summary, when, pitfalls, related, tags })
const P = (id: string, category: string, title: string, summary: string, when: string, pitfalls: string, related: string[] = [], tags: string[] = []): LibEntry => ({ id, kind: 'psychology', title, category, summary, when, pitfalls, related, tags })
const R = (id: string, category: string, title: string, summary: string, when: string, pitfalls: string, related: string[] = [], tags: string[] = []): LibEntry => ({ id, kind: 'trope', title, category, summary, when, pitfalls, related, tags })

export const LIBRARY: LibEntry[] = [
  // --- Técnicas: trama ---
  T('t-pregunta-motor', 'Trama', 'Pregunta motor', 'Formula la historia como una pregunta que el público quiere ver respondida y hazla explícita antes del final del primer acto.', 'Cuando el lector no sabe "de qué va" o el ritmo se siente sin dirección.', 'Responderla demasiado pronto desactiva la tensión; no responderla frustra.', ['t-siembra-pago', 't-reloj'], ['estructura', 'preguntas']),
  T('t-siembra-pago', 'Trama', 'Siembra y pago', 'Introduce un detalle aparentemente menor (siembra) que más tarde cobra sentido o decide la acción (pago).', 'Para que los giros se sientan justos y no arbitrarios.', 'Sembrar sin pagar deja cabos sueltos; pagar sin sembrar parece trampa. Vigila la distancia entre ambos.', ['t-pregunta-motor', 't-chejov'], ['plant', 'payoff']),
  T('t-chejov', 'Trama', 'Economía del detalle', 'Todo elemento que recibe atención debe tener consecuencia; lo que no la tendrá, quítalo o rebaja su énfasis.', 'En revisión, cuando hay descripciones o props que nunca vuelven.', 'No confundir con "explicar todo": el misterio deliberado es distinto del olvido.', ['t-siembra-pago'], ['revision']),
  T('t-reloj', 'Trama', 'Reloj visible', 'Impón un plazo concreto y conocido por el público para la acción central.', 'Cuando el segundo acto se estanca o las decisiones carecen de urgencia.', 'Un reloj que nunca suena pierde credibilidad; hazlo avanzar en escena.', ['t-pregunta-motor', 't-escalada'], ['ritmo', 'tension']),
  T('t-escalada', 'Trama', 'Escalada de apuestas', 'Cada obstáculo superado debe elevar lo que está en juego, no solo cambiarlo de sitio.', 'Cuando varias escenas seguidas se sienten "iguales" en intensidad.', 'Escalar solo el peligro físico cansa; alterna apuestas emocionales, sociales y morales.', ['t-reloj', 't-punto-medio'], ['tension']),
  T('t-punto-medio', 'Trama', 'Giro de punto medio', 'A mitad de la historia, cambia la naturaleza del problema: lo que se creía objetivo resulta ser otra cosa.', 'Cuando el segundo acto es una línea recta.', 'Que el giro nazca de lo sembrado; si sale de la nada, se percibe como truco.', ['t-escalada', 't-siembra-pago'], ['estructura']),
  // --- Técnicas: personaje ---
  T('t-querer-necesitar', 'Personaje', 'Querer vs. necesitar', 'Separa lo que el personaje persigue (quiere) de lo que le falta de verdad (necesita); la historia es el viaje del uno al otro.', 'Cuando el arco se siente plano o el final no emociona.', 'Si querer y necesitar coinciden desde el inicio, no hay transformación posible.', ['t-herida', 't-decision-imposible'], ['arco', 'motivacion']),
  T('t-herida', 'Personaje', 'Herida fundacional', 'Define una experiencia pasada que explica la creencia errónea con la que el personaje empieza la historia.', 'Al construir la motivación o cuando sus decisiones parecen caprichosas.', 'No la expliques toda de golpe; deja que las escenas la revelen.', ['t-querer-necesitar', 'p-defensa'], ['motivacion']),
  T('t-decision-imposible', 'Personaje', 'Decisión imposible', 'Coloca al personaje ante dos opciones que cuestan algo real; lo que elige revela quién es.', 'En el clímax o en cualquier punto donde necesitas caracterización sin exposición.', 'Si una opción es claramente mejor, no hay decisión, hay trámite.', ['t-querer-necesitar', 't-espejo'], ['clímax']),
  T('t-espejo', 'Personaje', 'Personaje espejo', 'Un secundario encarna la versión del protagonista que podría ser si tomara el otro camino.', 'Para hacer visible el tema sin discursos.', 'El espejo no debe ser un clon; comparten dilema, no personalidad.', ['t-decision-imposible'], ['tema']),
  T('t-voz-propia', 'Personaje', 'Voz propia', 'Da a cada personaje un patrón verbal distinguible (ritmo, léxico, evasivas) de modo que se le reconozca sin la etiqueta de nombre.', 'Cuando todos los diálogos suenan al mismo autor.', 'Las muletillas exageradas se vuelven caricatura; busca la diferencia en lo que evitan decir.', ['t-subtexto'], ['dialogo']),
  // --- Técnicas: conflicto y diálogo ---
  T('t-subtexto', 'Diálogo', 'Subtexto', 'Haz que los personajes hablen de otra cosa mientras el conflicto real ocurre debajo.', 'Cuando el diálogo explica lo que la escena ya muestra.', 'Demasiado subtexto vuelve la escena opaca; ancla al menos un gesto que traduzca.', ['t-voz-propia', 't-objetivo-escena'], ['dialogo']),
  T('t-objetivo-escena', 'Escena', 'Objetivo de escena', 'Cada personaje entra a la escena queriendo algo concreto; la escena termina cuando lo consigue, fracasa o cambia de objetivo.', 'Cuando una escena "no va a ningún sitio".', 'Objetivos idénticos en todos no generan fricción; que al menos dos choquen.', ['t-subtexto', 't-entrar-tarde'], ['escena']),
  T('t-entrar-tarde', 'Escena', 'Entrar tarde, salir pronto', 'Empieza la escena lo más cerca posible del conflicto y córtala antes de la conclusión evidente.', 'Cuando las escenas se alargan con llegadas, saludos y despedidas.', 'Cortar demasiado puede dejar fuera el giro emocional; revisa qué pierdes.', ['t-objetivo-escena', 't-cambio-valor'], ['ritmo']),
  T('t-cambio-valor', 'Escena', 'Cambio de valor', 'Al terminar la escena, algún valor (esperanza/desesperanza, poder/impotencia) debe haber cambiado de signo.', 'En revisión, para detectar escenas prescindibles.', 'Cambiar de valor en cada escena no obliga a un giro dramático; un matiz basta.', ['t-entrar-tarde'], ['revision', 'escena']),
  // --- Técnicas: ritmo, suspense, descripción ---
  T('t-respiracion', 'Ritmo', 'Respiración', 'Alterna escenas de alta intensidad con escenas de asentamiento donde el personaje procesa lo ocurrido.', 'Cuando la tensión se mantiene tan alta que deja de sentirse.', 'El descanso no es relleno: debe preparar el siguiente golpe.', ['t-escalada'], ['ritmo']),
  T('t-ironia-dramatica', 'Suspense', 'Ironía dramática', 'El público sabe algo que un personaje ignora; la tensión nace de esperar el momento en que lo descubra.', 'Para generar suspense sin ocultar información al lector.', 'Si el personaje tarda demasiado en enterarse, parece torpe.', ['t-reloj'], ['suspense']),
  T('t-detalle-elegido', 'Descripción', 'Detalle elegido', 'Describe con uno o dos detalles concretos que sugieran el resto, en lugar de inventariar el espacio.', 'Cuando la descripción frena el ritmo.', 'El detalle debe ser significativo para el personaje que mira, no para el autor.', ['t-chejov'], ['descripcion']),
  T('t-lugar-personaje', 'Mundo', 'El lugar como personaje', 'Da a cada localización reglas, atmósfera y una relación emocional con quien la habita; que condicione la escena.', 'Cuando los escenarios son intercambiables.', 'Evita que la atmósfera sustituya al conflicto: acompaña, no reemplaza.', ['t-detalle-elegido'], ['mundo', 'lugares']),
  T('t-inactividad-subtrama', 'Estructura', 'Latido de subtrama', 'Ninguna línea narrativa debería desaparecer más de unas pocas escenas seguidas; dale un latido breve aunque no avance.', 'Cuando la Clinic marca inactividad de un track.', 'Latidos vacíos ("recordatorios") cansan; que cada aparición mueva algo.', ['t-respiracion'], ['tracks', 'estructura']),
  T('t-primera-ultima', 'Revisión', 'Primera y última imagen', 'Haz que la imagen final dialogue con la inicial para que el cambio sea visible sin explicarlo.', 'En revisión final.', 'Rimar imágenes no sustituye al arco: la rima es el remate, no el contenido.', ['t-querer-necesitar'], ['revision']),
  T('t-lectura-fria', 'Revisión', 'Lectura fría por escena', 'Resume cada escena en una línea con objetivo, conflicto y resultado; si no puedes, la escena no está definida.', 'Antes de reescribir.', 'No confundir resumen con sinopsis: es diagnóstico, no marketing.', ['t-cambio-valor', 't-objetivo-escena'], ['revision']),
  // --- Psicología (referencia conceptual para caracterización; no diagnóstico clínico) ---
  P('p-defensa', 'Mecanismos', 'Mecanismos de defensa', 'Estrategias con las que un personaje evita el malestar: negación, racionalización, proyección, humor, desplazamiento.', 'Se manifiestan como explicaciones demasiado rápidas, culpar a otros o bromas en momentos serios.', 'Úsalos como conducta observable, no como etiqueta; evita la caricatura.', ['t-herida', 'p-apego'], ['motivacion']),
  P('p-apego', 'Vínculos', 'Estilos de vínculo', 'Patrones con los que un personaje se acerca o se protege en las relaciones: buscar cercanía, evitarla o alternar.', 'Se ven en cómo reacciona a la distancia, a la pérdida y a la intimidad.', 'No son destinos fijos; los personajes pueden cambiar de patrón en la historia.', ['p-defensa'], ['relaciones']),
  P('p-disonancia', 'Decisión', 'Disonancia', 'Incomodidad al sostener dos ideas o conductas incompatibles; el personaje la reduce cambiando lo que cree o lo que hace.', 'Excusas elaboradas, cambios súbitos de opinión, minimizar lo que hizo.', 'Motor excelente para el conflicto interno; no lo resuelvas en una sola escena.', ['t-decision-imposible'], ['conflicto']),
  P('p-sesgo-confirmacion', 'Cognición', 'Ver lo que se espera', 'Tendencia a notar solo lo que confirma lo que ya se cree.', 'Ignora pistas evidentes, malinterpreta gestos, se sorprende ante lo obvio.', 'Ideal para tramas de misterio; cuida que el lector no lo sienta como estupidez.', ['t-ironia-dramatica'], ['misterio']),
  P('p-perdida', 'Emoción', 'Respuesta a la pérdida', 'La pérdida activa fases no lineales: negación, rabia, negociación, tristeza, aceptación, que pueden alternarse.', 'Cambios de humor bruscos, culpa, búsqueda de responsables.', 'No usar como guion rígido; cada personaje mezcla las fases a su manera.', ['p-defensa'], ['emocion']),
  P('p-miedo-social', 'Social', 'Miedo al juicio', 'Necesidad de pertenecer y temor a ser expulsado del grupo condicionan decisiones aparentemente irracionales.', 'Callar lo que piensa, seguir al grupo, mentir para encajar.', 'Buena fuente de presión externa; que el grupo tenga reglas concretas.', ['p-apego'], ['presion']),
  P('p-poder', 'Social', 'Dinámicas de poder', 'Quien tiene poder habla menos, interrumpe más y no necesita justificarse; quien no lo tiene anticipa y se explica.', 'Se ve en turnos de palabra, silencios y quién decide cuándo termina una conversación.', 'Traducirlo a conducta de diálogo evita explicar la jerarquía.', ['t-subtexto', 't-voz-propia'], ['dialogo']),
  P('p-ambivalencia', 'Emoción', 'Ambivalencia', 'Sentir dos cosas opuestas hacia la misma persona o meta: amar y resentir, desear y temer.', 'Actos contradictorios, sabotajes, ternura seguida de crueldad.', 'La ambivalencia es riqueza; la incoherencia es falta de diseño. Que el lector vea las dos fuerzas.', ['p-disonancia', 't-querer-necesitar'], ['motivacion']),
  // --- Tropos (convenciones narrativas; definiciones propias) ---
  R('r-mentor', 'Personajes', 'El mentor', 'Figura que guía al protagonista y suele desaparecer para obligarlo a actuar solo.', 'Casi universal en historias de aprendizaje.', 'Si resuelve los problemas por el héroe, lo anula.', ['t-espejo'], ['personaje']),
  R('r-falso-final', 'Estructura', 'Falsa victoria', 'El protagonista parece ganar antes del último acto; la celebración precede la caída.', 'Antes del clímax para maximizar el contraste.', 'Si el lector la ve venir desde lejos, se convierte en rutina.', ['t-punto-medio'], ['estructura']),
  R('r-traidor', 'Personajes', 'El traidor cercano', 'Alguien de confianza resulta estar en el otro bando.', 'Misterio, thriller, drama político.', 'Necesita siembra honesta; sin pistas previas es una trampa al lector.', ['t-siembra-pago'], ['giro']),
  R('r-cuenta-atras', 'Estructura', 'Cuenta atrás', 'Un plazo explícito ordena el clímax.', 'Acción y thriller.', 'Relojes que se detienen sin motivo rompen el pacto.', ['t-reloj'], ['tension']),
  R('r-mundo-cerrado', 'Ambiente', 'Espacio cerrado', 'Todos los personajes confinados en un lugar del que no pueden salir.', 'Misterio clásico, terror, teatro.', 'Justifica el encierro o el lector buscará la salida antes que los personajes.', ['t-lugar-personaje'], ['lugares']),
  R('r-enemigos-aliados', 'Relaciones', 'Enemigos obligados a colaborar', 'Dos antagonistas deben cooperar contra una amenaza mayor.', 'Comedia, aventura, drama.', 'Que la colaboración les cueste algo; si es gratuita, no hay escena.', ['t-decision-imposible'], ['relaciones']),
  R('r-secreto-familiar', 'Trama', 'El secreto familiar', 'Una verdad oculta en el pasado familiar explica el presente.', 'Drama, saga, misterio.', 'Revelarlo debe cambiar decisiones, no solo informar.', ['t-herida'], ['giro']),
  R('r-objeto-clave', 'Trama', 'Objeto clave', 'Un objeto concentra el deseo de varios personajes y organiza la acción.', 'Aventura, thriller.', 'Que el objeto importe por lo que significa para cada uno, no por sí mismo.', ['t-siembra-pago', 't-chejov'], ['props']),
  R('r-dobles', 'Personajes', 'Los dobles', 'Dos personajes con el mismo dilema y decisiones opuestas.', 'Drama de tesis, tragedia.', 'Si uno es claramente "el bueno", se pierde la pregunta.', ['t-espejo'], ['tema']),
  R('r-regreso', 'Estructura', 'El regreso', 'El protagonista vuelve al lugar de partida transformado.', 'Historias de viaje y madurez.', 'La transformación debe verse en la conducta, no en un discurso.', ['t-primera-ultima'], ['arco']),
  R('r-tiempo-limite-emocional', 'Relaciones', 'La última oportunidad', 'Una relación tiene una única ocasión de arreglarse antes de una separación definitiva.', 'Romance, drama familiar.', 'No resolver con un gran gesto; con una decisión pequeña y costosa.', ['t-decision-imposible'], ['relaciones']),
  R('r-testigo', 'Personajes', 'El testigo', 'Un personaje observa y cuenta la historia de otro más grande que él.', 'Novela clásica, crónica.', 'Que el testigo tenga su propio cambio, o será solo cámara.', ['t-voz-propia'], ['pov'])
]

export const CATEGORIES = (kind: LibKind) => [...new Set(LIBRARY.filter((e) => e.kind === kind).map((e) => e.category))]
export const byId = (id: string) => LIBRARY.find((e) => e.id === id)

// Sugerencias de la Clinic: área de hallazgo -> técnicas de la biblioteca.
export const SUGGEST: Record<string, string[]> = {
  structure: ['t-punto-medio', 't-escalada', 't-lectura-fria'],
  characters: ['t-querer-necesitar', 't-herida', 't-voz-propia'],
  questions: ['t-pregunta-motor', 't-ironia-dramatica'],
  plants: ['t-siembra-pago', 't-chejov'],
  tracks: ['t-inactividad-subtrama', 't-respiracion'],
  pacing: ['t-entrar-tarde', 't-cambio-valor', 't-respiracion'],
  ideas: ['t-objetivo-escena']
}
