<script setup lang="ts">
import { computed } from 'vue'
import { useFrameData } from '../composables/frame'
import logoUrl from '../assets/pdb-logo.svg'
import LessonQR from '../components/LessonQR.vue'
import SlideFrame from '../components/SlideFrame.vue'

const { lessonUrl } = useFrameData()
// Mostro l'URL senza schema, come nella card dell'artifact.
const shownUrl = computed(() => lessonUrl.value.replace(/^https?:\/\//, ''))
</script>

<template>
  <SlideFrame class="end" :footer="false" glow>
    <div class="at-brand">
      <img class="at-logo" :src="logoUrl" alt="">Python Doesn’t Byte
    </div>
    <div class="at-cover__main">
      <div class="at-end__text">
        <p class="at-kicker">
          Fine della lezione
        </p>
        <slot />
        <div v-if="$slots.footer" class="at-end__url">
          <slot name="footer" />
        </div>
        <p v-else-if="shownUrl" class="at-end__url">
          {{ shownUrl }}
        </p>
      </div>
      <div v-if="lessonUrl" class="at-tile at-tile--qr">
        <LessonQR :url="lessonUrl" />
      </div>
    </div>
    <div class="at-meta">
      <span>Marco Farina · Rainbow Bits</span>
      <span>CC BY-NC-SA 4.0</span>
    </div>
  </SlideFrame>
</template>
