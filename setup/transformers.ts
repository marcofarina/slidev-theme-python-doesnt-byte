// Trasformazioni del Markdown di ogni slide (fase 4): il glossario ha bisogno del
// frontmatter della slide, che Slidev passa solo qui.
import { defineTransformersSetup } from '@slidev/types'
import { glossaryTransformer } from '../plugins/glossary'

export default defineTransformersSetup(() => ({
  pre: [glossaryTransformer],
}))
