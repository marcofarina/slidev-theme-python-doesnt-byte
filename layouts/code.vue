<script setup lang="ts">
import SlideFrame from '../components/SlideFrame.vue'
</script>

<template>
  <SlideFrame class="code">
    <p v-if="$frontmatter.kicker" class="at-kicker">
      {{ $frontmatter.kicker }}
    </p>
    <div class="at-content">
      <slot />
    </div>
  </SlideFrame>
</template>
