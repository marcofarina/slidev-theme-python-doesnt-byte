<script setup lang="ts">
import { computed } from 'vue'
import { useSlideContext } from '@slidev/client'
import SlideFrame from '../components/SlideFrame.vue'

// Le proporzioni arrivano dal frontmatter come stringa (`cols: 2-3`): un valore
// sconosciuto ricade sul predefinito invece di rompere la griglia.
const COLS = ['1-3', '2-2', '3-1', '2-3']

const { $frontmatter } = useSlideContext()
const cols = computed(() => {
  const value = String($frontmatter?.cols ?? '').trim()
  return COLS.includes(value) ? value : '2-3'
})
</script>

<template>
  <SlideFrame class="two-columns">
    <div class="at-content">
      <slot />
      <div class="at-cols" :class="`at-cols--${cols}`">
        <div class="at-cols__left">
          <slot name="left" />
        </div>
        <div class="at-cols__right">
          <slot name="right" />
        </div>
      </div>
    </div>
  </SlideFrame>
</template>
