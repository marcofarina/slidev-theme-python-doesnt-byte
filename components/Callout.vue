<script setup lang="ts">
import { computed } from 'vue'
import { calloutTypes, isCalloutName } from '../plugins/callout-types'

// Callout del libro: `:::tipo Titolo` nel Markdown oppure `<Callout type="warning" title="…">`.
// Senza `title` vale il titolo di default del tipo; `note` non ha icona.
const props = withDefaults(defineProps<{
  type?: string
  title?: string
}>(), {
  type: 'note',
})

const icons = import.meta.glob<string>('../assets/callouts/*.png', {
  eager: true,
  import: 'default',
  query: '?url',
})

const name = computed(() => {
  if (isCalloutName(props.type))
    return props.type
  console.warn(`[python-doesnt-byte] callout sconosciuto «${props.type}», uso «note».`)
  return 'note'
})
const heading = computed(() => props.title || calloutTypes[name.value].title)
const icon = computed(() => {
  const file = calloutTypes[name.value].icon
  return file ? icons[`../assets/callouts/${file}`] : undefined
})
</script>

<template>
  <aside class="at-callout" :class="`at-callout--${name}`">
    <div class="at-callout__header">
      <img v-if="icon" class="at-callout__icon" :src="icon" alt="">
      <h4 class="at-callout__title">
        {{ heading }}
      </h4>
    </div>
    <div class="at-callout__body">
      <slot />
    </div>
  </aside>
</template>
