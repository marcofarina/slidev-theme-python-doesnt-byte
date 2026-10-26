<script setup lang="ts">
import { computed, ref } from 'vue'

// Termine del glossario con la sua definizione. Lo inserisce `plugins/glossary.ts`
// per ogni voce di `glossary:` nel frontmatter della slide; usabile anche a mano.
const props = defineProps<{ text: string }>()

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Apostrofi e virgolette curve come nel resto del testo (vedi plugins/smartquotes.ts),
// poi un Markdown minimo: **grassetto**, `codice`, *corsivo*.
const rendered = computed(() =>
  escapeHtml(props.text)
    .replace(/(\p{L})'(\p{L})/gu, '$1’$2')
    .replace(/&quot;(.+?)&quot;/g, '“$1”')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>'),
)

const box = ref<HTMLElement>()

// Tiene il riquadro dentro la slide: lo sposta di lato se esce, sotto il termine se manca
// lo spazio sopra. La slide è scalata, quindi si misura in pixel dello schermo e si
// riporta lo spostamento in pixel della tela.
function place() {
  const el = box.value
  if (!el)
    return
  el.classList.remove('is-below')
  el.style.setProperty('--shift', '0px')
  const slide = el.closest('.slidev-layout')?.getBoundingClientRect()
  if (!slide)
    return
  const rect = el.getBoundingClientRect()
  const scale = el.offsetWidth ? rect.width / el.offsetWidth : 1
  const margin = 8 * scale
  let shift = 0
  if (rect.right > slide.right - margin)
    shift = slide.right - margin - rect.right
  if (rect.left + shift < slide.left + margin)
    shift = slide.left + margin - rect.left
  el.style.setProperty('--shift', `${shift / scale}px`)
  if (rect.top < slide.top + margin)
    el.classList.add('is-below')
}
</script>

<template>
  <span class="at-tooltip" tabindex="0" @mouseenter="place" @focus="place">
    <slot />
    <span ref="box" class="at-tooltip__box" role="tooltip" v-html="rendered" />
  </span>
</template>
