<script setup lang="ts">
import { computed } from 'vue'
import { useNav, useSlideContext } from '@slidev/client'
import { useFrameData } from '../composables/frame'
import SlideFooter from './SlideFooter.vue'

// Cornice di ogni slide: imposta data-volume (da cui derivano --vol e --beam-*),
// ospita lo slot e il footer. Cover ed end passano `:footer="false"`; cover, section
// ed end passano `glow` (bagliore atmosferico: solo lì).
const props = withDefaults(defineProps<{
  footer?: boolean
  glow?: boolean
}>(), {
  footer: true,
  glow: false,
})

const { volume } = useFrameData()

// `verify: error | skip` nel frontmatter della slide dice a pdb-verify che il blocco
// eseguibile deve andare in errore (error) o non si esegue (skip). Lo script lo legge dal DOM.
const { $frontmatter, $page } = useSlideContext()
const verify = computed(() => String($frontmatter?.verify ?? '').trim() || undefined)

// `output: next`: il risultato del blocco eseguibile sta nella slide successiva, generata da
// setup/preparser.ts. «Esegui» porta lì invece di aprire l'output sotto il codice: il clic si
// ferma qui, prima di arrivare al pulsante di Slidev.
const output = computed(() => String($frontmatter?.output ?? '').trim() || undefined)
const { go } = useNav()
function runElsewhere(event: MouseEvent) {
  if (output.value !== 'next' || !(event.target as Element | null)?.closest?.('.slidev-monaco-container .slidev-icon-btn'))
    return
  event.stopPropagation()
  event.preventDefault()
  go($page.value + 1)
}
const classes = computed(() => ({ 'at-glow': props.glow, 'at-frame--bare': !props.footer }))
</script>

<template>
  <div class="slidev-layout at-frame" :class="classes" :data-volume="volume" :data-verify="verify" :data-output="output" @click.capture="runElsewhere">
    <div class="at-frame__body">
      <slot />
    </div>
    <SlideFooter v-if="footer" :volume="volume" />
  </div>
</template>
