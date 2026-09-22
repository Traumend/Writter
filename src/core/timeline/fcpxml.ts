// Paquete de edición (equivalente al "DaVinci Pack" de ScriptWriterX): la estructura del Beat Timeline
// como FCPXML de marcadores, que DaVinci Resolve y Final Cut importan sobre una pista vacía.
export type Marker = { name: string; start: number; duration?: number } // minutos

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function toFcpxml(title: string, markers: Marker[], totalMinutes: number, fps = 24): string {
  // FCPXML usa tiempos racionales; se cuantizan a fotograma para que Resolve no los rechace.
  const tc = (min: number) => `${Math.max(0, Math.round(min * 60 * fps))}/${fps}s`
  const total = Math.max(1, Math.round(Math.max(totalMinutes, 0.1) * 60 * fps))
  const body = [...markers]
    .sort((a, b) => a.start - b.start)
    .map((m) => `          <marker start="${tc(m.start)}" duration="${tc(Math.max(m.duration ?? 0, 1 / (60 * fps)))}" value="${esc(m.name)}"/>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.9">
  <resources>
    <format id="r1" name="FFVideoFormat1080p${fps}" frameDuration="1/${fps}s" width="1920" height="1080"/>
  </resources>
  <library name="Writter">
    <event name="${esc(title)}">
      <project name="${esc(title)}">
        <sequence format="r1" duration="${total}/${fps}s" tcStart="0s" tcFormat="NDF">
          <spine>
            <gap name="${esc(title)}" offset="0s" duration="${total}/${fps}s" start="0s">
${body}
            </gap>
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>
`
}
