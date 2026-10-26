import { defineConfig } from 'vite'
import { callout } from './plugins/callout.ts'
import { smartquotes } from './plugins/smartquotes.ts'

// Slidev unisce questo file a quello del deck. Il Markdown del tema (fase 4) si configura in
// `slidev.markdown`: container dei callout e virgolette curve. Il glossario, che legge il
// frontmatter della slide, sta in `setup/transformers.ts`.
export default defineConfig({
  slidev: {
    markdown: {
      markdownSetup(md) {
        smartquotes(md)
        callout(md)
      },
    },
  },
} as Record<string, unknown>)
