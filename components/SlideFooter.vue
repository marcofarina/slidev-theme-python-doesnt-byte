<script setup lang="ts">
import { computed } from 'vue'
import { asVolume, useFrameData, VOLUMES } from '../composables/frame'
import logoUrl from '../assets/pdb-logo.svg'
import VolumeIcon from './VolumeIcon.vue'

const props = defineProps<{ volume?: string }>()

const { volume: deckVolume, chapter, lesson, page } = useFrameData()
const key = computed(() => asVolume(props.volume) ?? deckVolume.value)

// «Vol. 2 · Cap. 03 ·» non si tronca mai; solo il titolo della lezione ha l'ellissi.
const where = computed(() => {
  const parts: string[] = []
  if (key.value) parts.push(`Vol. ${VOLUMES[key.value].number}`)
  if (chapter.value) parts.push(`Cap. ${chapter.value}`)
  return parts.join(' · ')
})
</script>

<template>
  <footer class="at-footer">
    <span class="at-footer__where">
      <img class="at-logo" :src="logoUrl" alt="Python Doesn’t Byte">
      <VolumeIcon v-if="key" :volume="key" />
      <span v-if="where" class="at-footer__fixed">{{ where }}{{ lesson ? ' ·' : '' }}</span>
      <span v-if="lesson" class="at-footer__lesson">{{ lesson }}</span>
    </span>
    <span class="at-footer__num">{{ page }}</span>
  </footer>
</template>
