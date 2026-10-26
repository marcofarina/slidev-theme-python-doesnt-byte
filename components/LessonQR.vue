<script setup lang="ts">
import QRCode from 'qrcode'
import { computed } from 'vue'

const props = defineProps<{ url: string }>()

// SVG generato qui, senza colori: i moduli prendono `currentColor` dal CSS (token),
// quindi segue il tema senza ricalcolare nulla.
const qr = computed(() => {
  if (!props.url)
    return null
  const { size, data } = QRCode.create(props.url, { errorCorrectionLevel: 'M' }).modules
  let path = ''
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[y * size + x])
        path += `M${x} ${y}h1v1h-1z`
    }
  }
  return { size, path }
})
</script>

<template>
  <svg
    v-if="qr"
    class="at-qr"
    :viewBox="`0 0 ${qr.size} ${qr.size}`"
    shape-rendering="crispEdges"
    role="img"
    :aria-label="`Codice QR: ${url}`"
  >
    <path :d="qr.path" fill="currentColor" />
  </svg>
</template>
