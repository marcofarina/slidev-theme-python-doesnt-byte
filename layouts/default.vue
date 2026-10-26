<script setup lang="ts">
import SlideFrame from '../components/SlideFrame.vue'
</script>

<template>
  <SlideFrame class="default">
    <p v-if="$frontmatter.kicker" class="at-kicker">
      {{ $frontmatter.kicker }}
    </p>
    <div class="at-content">
      <slot />
    </div>
  </SlideFrame>
</template>
