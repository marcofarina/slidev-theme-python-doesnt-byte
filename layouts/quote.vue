<script setup lang="ts">
import SlideFrame from '../components/SlideFrame.vue'
</script>

<template>
  <SlideFrame class="quote">
    <div class="at-content at-content--center">
      <blockquote class="at-quote">
        <span class="at-quote__mark" aria-hidden="true">“</span>
        <slot />
      </blockquote>
      <div v-if="$slots.author" class="at-caption">
        <slot name="author" />
      </div>
    </div>
  </SlideFrame>
</template>
