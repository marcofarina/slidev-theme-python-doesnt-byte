<script setup lang="ts">
import SlideFrame from '../components/SlideFrame.vue'
</script>

<template>
  <SlideFrame class="question">
    <p class="at-kicker">
      {{ $frontmatter.kicker ?? 'Domanda' }}
    </p>
    <div class="at-content">
      <slot />
    </div>
  </SlideFrame>
</template>
