<script setup lang="ts">
import { computed } from 'vue'
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
const classes = computed(() => ({ 'at-glow': props.glow, 'at-frame--bare': !props.footer }))
</script>

<template>
  <div class="slidev-layout at-frame" :class="classes" :data-volume="volume">
    <div class="at-frame__body">
      <slot />
    </div>
    <SlideFooter v-if="footer" :volume="volume" />
  </div>
</template>
