import { useEffect, useRef, useState } from 'react'
import { t } from '../i18n'
import { useStore } from '../store'

// Nota rápida (Ctrl+Shift+N): captura sin salir del contexto -> knowledge/Inbox/<fecha> <título>.md
// Carpetas de notas (PRD §79): bandeja + temáticas. Se crean al vuelo dentro de la carpeta de conocimiento.
const FOLDERS = ['Inbox', 'Historia', 'Personajes', 'Mundo', 'Investigación']

export function QuickNote() {
  const { quickNoteOpen, setQuickNoteOpen, createFile, roleDir, vault } = useStore()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [folder, setFolder] = useState(() => localStorage.getItem('writter.note.folder') || 'Inbox')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (quickNoteOpen) { setTitle(''); setBody(''); setTimeout(() => ref.current?.focus(), 0) } }, [quickNoteOpen])
  if (!quickNoteOpen || !vault) return null
  const save = async () => {
    const ti = title.trim() || body.trim().split('\n')[0]?.slice(0, 40) || 'Nota'
    const stamp = new Date().toISOString().slice(0, 10)
    localStorage.setItem('writter.note.folder', folder)
    await createFile(`${roleDir('knowledge')}/${folder}/${stamp} ${ti.replace(/[\\/:*?"<>|]/g, '')}.md`, `---\ntype: knowledge\ntitle: "${ti.replace(/"/g, '\\"')}"\ncreated: ${new Date().toISOString()}\n---\n\n${body.trim()}\n`, false)
    setQuickNoteOpen(false)
    useStore.setState({ status: `Nota guardada en ${folder}` })
  }
  return (
    <div className="modal-backdrop" onClick={() => setQuickNoteOpen(false)}>
      <div className="modal" style={{ width: 'min(560px,92vw)' }} onClick={(e) => e.stopPropagation()}>
        <div className="row"><h1>{t('Nota rápida')}</h1><span className="grow" /><select value={folder} onChange={(e) => setFolder(e.target.value)} title={t('Carpeta')}>{FOLDERS.map((f) => <option key={f} value={f}>{f}</option>)}</select></div>
        <input ref={ref} placeholder={t('Título (opcional)')} value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setQuickNoteOpen(false) }} />
        <textarea rows={6} placeholder={t('Idea, regla del mundo, pendiente… Usa [[Nombre]] para enlazar entidades. Ctrl+Enter guarda.')} value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void save(); if (e.key === 'Escape') setQuickNoteOpen(false) }} />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="ghost" onClick={() => setQuickNoteOpen(false)}>{t('Cancelar')}</button>
          <button disabled={!title.trim() && !body.trim()} onClick={() => void save()}>{t('Guardar')}</button>
        </div>
      </div>
    </div>
  )
}
