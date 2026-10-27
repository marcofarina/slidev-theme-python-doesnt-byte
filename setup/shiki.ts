// Evidenziazione del codice: una coppia di temi Shiki (light, dark) costruita da
// tokens/tokens.json ogni volta che Slidev carica il setup, senza file generati.
//
// Perché colori esadecimali e non un tema a variabili CSS (createCssVariablesTheme):
// Slidev passa gli stessi temi a Monaco (`shikiToMonaco`, runner della fase 5), che
// accetta solo esadecimali. Light e dark restano senza ri-renderizzare perché Slidev,
// con `themes`, scrive i due colori in `--shiki-light` / `--shiki-dark` su ogni span.
//
// Questo modulo gira sia in Node (jiti, rendering del markdown) sia nel browser (Vite).

import type { ShikiSetupReturn } from '@slidev/types'
import type { ShikiTransformer, ThemedToken, ThemeRegistration } from 'shiki'
import { defineShikiSetup } from '@slidev/types'
import tokens from '../tokens/tokens.json'

type Mode = 'light' | 'dark'

interface ColorToken {
  name: string
  value: string | Record<Mode, string>
}

const colorTokens = new Map<string, ColorToken['value']>(
  (tokens.color.tokens as ColorToken[]).map(t => [t.name, t.value]),
)

// Valore esadecimale di un token colore nel tema dato; segue gli alias `{nome}`.
function color(name: string, mode: Mode): string {
  const raw = colorTokens.get(name)
  if (raw === undefined)
    throw new Error(`[python-doesnt-byte] token colore sconosciuto: ${name}`)
  const value = typeof raw === 'string' ? raw : raw[mode]
  const alias = /^\{(.+)\}$/.exec(value)
  if (alias)
    return color(alias[1], mode)
  if (!/^#[0-9a-f]{6}$/i.test(value))
    throw new Error(`[python-doesnt-byte] ${name} (${mode}) deve essere esadecimale per Shiki e Monaco: ${value}`)
  return value
}

// Sei colori `code-*`, come il Prism del sito: le parole chiave e le funzioni e i tipi
// predefiniti in `code-keyword`; True, False e None col colore dei numeri (il `boolean`
// di Prism); operatori, nomi e punteggiatura in `code-fg`. Nessuno stile corsivo.
function codeTheme(mode: Mode): ThemeRegistration {
  const c = (name: string) => color(`code-${name}`, mode)
  return {
    name: `python-doesnt-byte-${mode}`,
    type: mode,
    fg: c('fg'),
    bg: c('bg'),
    colors: {
      'editor.background': c('bg'),
      'editor.foreground': c('fg'),
    },
    settings: [
      { settings: { foreground: c('fg'), background: c('bg') } },
      {
        scope: ['comment', 'punctuation.definition.comment'],
        settings: { foreground: c('comment') },
      },
      {
        scope: ['string', 'storage.type.string', 'constant.character.escape'],
        settings: { foreground: c('string') },
      },
      {
        scope: ['constant.numeric', 'constant.language'],
        settings: { foreground: c('number') },
      },
      {
        scope: [
          'keyword',
          'keyword.operator.logical',
          'keyword.operator.word',
          'storage.type',
          'storage.modifier',
          'support.function.builtin',
          'support.type.python',
          'support.type.exception',
        ],
        settings: { foreground: c('keyword') },
      },
      {
        scope: ['keyword.operator'],
        settings: { foreground: c('fg') },
      },
    ],
  }
}

// Un token è un commento se ogni sua parte non vuota sta sotto uno scope `comment`.
// Si decide sullo scope TextMate, non sul colore: vale per ogni linguaggio e tema.
export function isCommentToken(token: ThemedToken): boolean {
  const parts = (token.explanation ?? []).filter(p => p.content.trim() !== '')
  return parts.length > 0
    && parts.every(p => p.scopes.some(s => s.scopeName.startsWith('comment')))
}

// Aggiunge `token-comment` agli span dei commenti: styles/code.css li compone in Radon.
// Gli scope arrivano solo con `includeExplanation`; 'scopeName' è la forma leggera.
export const commentTransformer: ShikiTransformer = {
  name: 'python-doesnt-byte:comment',
  preprocess(_code, options) {
    if (!options.includeExplanation)
      options.includeExplanation = 'scopeName'
  },
  span(hast, _line, _col, _lineElement, token) {
    if (isCommentToken(token))
      this.addClassToHast(hast, 'token-comment')
  },
}

export const themes = {
  light: codeTheme('light'),
  dark: codeTheme('dark'),
}

// `langs`: lo Shiki del client (quello che Slidev passa a Monaco) carica solo markdown,
// vue, JS, TS, HTML e CSS. Senza Python l'editor dei runner (fase 5) usa il tokenizer
// Monarch di Monaco, che non conosce gli scope del tema: i numeri restano senza colore.
export default defineShikiSetup((): ShikiSetupReturn => ({
  themes,
  langs: ['python'],
  transformers: [commentTransformer],
}))
