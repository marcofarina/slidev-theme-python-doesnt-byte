<script setup lang="ts">
import SlideFrame from '../components/SlideFrame.vue'
</script>

<template>
  <SlideFrame class="section" glow>
    <div class="at-content at-content--center at-section__inner">
      <p class="at-kicker">
        {{ $frontmatter.section ?? 'Sezione' }}
      </p>
      <slot />
    </div>
  </SlideFrame>
</template>
