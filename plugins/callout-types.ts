// I quattordici callout del libro: tipo, titolo di default e icona.
// Tabella pura, senza dipendenze: la leggono sia il plugin di Markdown (Node) sia
// `components/Callout.vue` (browser). Titoli e icone sono quelli di `src/theme/Admonition`
// del libro e della card Callout di Atmospheric.

export interface CalloutType {
  /** Titolo mostrato quando la slide non ne scrive uno. */
  title: string
  /** File in `assets/callouts/`; `null` quando il tipo non ha icona. */
  icon: string | null
}

export const calloutTypes = {
  prereq: { title: 'Prerequisiti', icon: 'prereq.png' },
  learn: { title: 'Cosa imparerai in questa lezione', icon: 'learn.png' },
  exercise: { title: 'Cosa imparerai con questo esercizio', icon: 'exercise.png' },
  definition: { title: 'Definizioni', icon: 'definition.png' },
  history: { title: 'Cenni storici', icon: 'history.png' },
  code: { title: 'Programmazione', icon: 'code.png' },
  cleancode: { title: 'Clean code', icon: 'cleancode.png' },
  nutshell: { title: 'In a nutshell', icon: 'nutshell.png' },
  mindmap: { title: 'Mindmap', icon: 'mindmap.png' },
  info: { title: 'Informazioni utili', icon: 'info.png' },
  tip: { title: 'Suggerimento', icon: 'tip.png' },
  warning: { title: 'Attenzione', icon: 'warning.png' },
  danger: { title: 'Pericolo', icon: 'danger.png' },
  note: { title: 'Nota', icon: null },
} as const satisfies Record<string, CalloutType>

export type CalloutName = keyof typeof calloutTypes

export function isCalloutName(name: string): name is CalloutName {
  return Object.hasOwn(calloutTypes, name)
}
