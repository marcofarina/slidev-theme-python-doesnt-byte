<script setup lang="ts">
import { computed } from 'vue'
import { asVolume, useFrameData, VOLUMES } from '../composables/frame'
import VolumeIcon from './VolumeIcon.vue'

const props = defineProps<{ volume?: string }>()

const { volume: deckVolume } = useFrameData()
const key = computed(() => asVolume(props.volume) ?? deckVolume.value)
</script>

<template>
  <span v-if="key" class="at-chip" :data-volume="key">
    <VolumeIcon :volume="key" />
    Vol. {{ VOLUMES[key].number }} · {{ VOLUMES[key].short }}
  </span>
</template>
