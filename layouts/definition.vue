<script setup lang="ts">
import SlideFrame from '../components/SlideFrame.vue'
</script>

<template>
  <SlideFrame class="definition">
    <div class="at-content at-content--center at-definition__inner">
      <p class="at-kicker">
        {{ $frontmatter.kicker ?? 'Definizione' }}
      </p>
      <slot />
    </div>
  </SlideFrame>
</template>
