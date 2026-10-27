<script setup lang="ts">
import iconUrl from '../assets/callouts/exercise.png'
import SlideFrame from '../components/SlideFrame.vue'

// L'icona sta accanto a kicker e titolo, ma il titolo è il `# h1` dello slot:
// la griglia di styles/interactive.css lo porta nella seconda colonna.
</script>

<template>
  <SlideFrame class="exercise">
    <img class="at-task__icon" :src="iconUrl" alt="">
    <p class="at-kicker">
      {{ $frontmatter.kicker ?? 'Prova tu' }}
    </p>
    <div class="at-content">
      <slot />
    </div>
  </SlideFrame>
</template>
