// Trasformazioni del Markdown di ogni slide. Il glossario (fase 4) ha bisogno del
// frontmatter della slide, che Slidev passa solo qui; le opzioni dei blocchi SQL (fase 14)
// riscrivono la riga d'apertura del blocco prima che Slidev la legga. L'ordine conta: il
// glossario parte dal Markdown originale e lo sovrascrive tutto.
import { defineTransformersSetup } from '@slidev/types'
import { glossaryTransformer } from '../plugins/glossary'
import { sqlOptionsTransformer } from '../plugins/sql-options'

export default defineTransformersSetup(() => ({
  pre: [glossaryTransformer, sqlOptionsTransformer],
}))
