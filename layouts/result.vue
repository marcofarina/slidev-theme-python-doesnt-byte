<script setup lang="ts">
import SlideFrame from '../components/SlideFrame.vue'

// La slide del risultato: non si scrive a mano, la genera setup/preparser.ts dopo una slide
// con `output: next`. Ha il titolo e il kicker di `code`; l'editor è nascosto e l'output, che
// parte da solo, prende tutta l'altezza (styles/interactive.css).
</script>

<template>
  <SlideFrame class="code result">
    <p v-if="$frontmatter.kicker" class="at-kicker">
      {{ $frontmatter.kicker }}
    </p>
    <div class="at-content">
      <slot />
    </div>
  </SlideFrame>
</template>
