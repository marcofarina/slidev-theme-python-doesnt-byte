<script setup lang="ts">
import { computed } from 'vue'
import { useNav, useSlideContext } from '@slidev/client'
import SlideFrame from '../components/SlideFrame.vue'

// «Figura N»: N è la posizione di questa slide fra le slide `figure` del deck.
// `figure: 7` nel frontmatter forza il numero (per esempio dopo una slide nascosta).
const { $frontmatter, $page } = useSlideContext()
const { slides } = useNav()

const number = computed(() => {
  const forced = Number($frontmatter?.figure)
  if (Number.isInteger(forced) && forced > 0)
    return forced
  return slides.value.filter(slide =>
    slide.no <= $page.value && slide.meta?.layout === 'figure',
  ).length || 1
})
</script>

<template>
  <SlideFrame class="figure">
    <div class="at-content">
      <slot name="title" />
      <figure class="at-figure">
        <div class="at-figure__frame">
          <slot />
        </div>
        <figcaption v-if="$slots.caption" class="at-caption">
          <span class="at-figure__label">Figura {{ number }} — </span><slot name="caption" />
        </figcaption>
      </figure>
    </div>
  </SlideFrame>
</template>
