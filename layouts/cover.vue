<script setup lang="ts">
import { computed } from 'vue'
import { useFrameData, VOLUMES } from '../composables/frame'
import logoUrl from '../assets/pdb-logo.svg'
import SlideFrame from '../components/SlideFrame.vue'
import VolumeIcon from '../components/VolumeIcon.vue'

const { volume } = useFrameData()
const kicker = computed(() =>
  volume.value ? `Volume ${VOLUMES[volume.value].number} · ${VOLUMES[volume.value].title}` : '',
)
</script>

<template>
  <SlideFrame class="cover" :footer="false" glow>
    <div class="at-brand">
      <img class="at-logo" :src="logoUrl" alt="">Python Doesn’t Byte
    </div>
    <div class="at-cover__main">
      <div class="at-cover__text">
        <p v-if="kicker" class="at-kicker">
          {{ kicker }}
        </p>
        <slot />
      </div>
      <div v-if="volume" class="at-tile" aria-hidden="true">
        <VolumeIcon :volume="volume" />
      </div>
    </div>
    <div class="at-meta">
      <span>python.rainbowbits.cloud</span>
      <span>Marco Farina · Rainbow Bits</span>
      <span>CC BY-NC-SA 4.0</span>
    </div>
  </SlideFrame>
</template>
