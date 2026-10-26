<script setup lang="ts">
import SlideFrame from '../components/SlideFrame.vue'
</script>

<template>
  <SlideFrame class="fact">
    <div class="at-content at-content--center at-fact__inner">
      <p v-if="$frontmatter.fact" class="at-kicker">
        {{ $frontmatter.fact }}
      </p>
      <slot />
      <div v-if="$slots.source" class="at-fact__source">
        <slot name="source" />
      </div>
    </div>
  </SlideFrame>
</template>
