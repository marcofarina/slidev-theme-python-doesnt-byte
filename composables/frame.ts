import { computed } from 'vue'
import { useSlideContext } from '@slidev/client'

export type VolumeKey = 'programmatore' | 'artefice' | 'archivista' | 'apprendista'

export const VOLUMES: Record<VolumeKey, { number: number, short: string, title: string }> = {
  programmatore: { number: 1, short: 'Programmatore', title: 'Manuale del Programmatore' },
  artefice: { number: 2, short: 'Artefice', title: 'Manuale dell’Artefice' },
  archivista: { number: 3, short: 'Archivista', title: 'Manuale dell’Archivista' },
  apprendista: { number: 4, short: 'Apprendista', title: 'Biblioteca dell’Apprendista' },
}

export function asVolume(value: unknown): VolumeKey | undefined {
  const key = String(value ?? '').trim().toLowerCase()
  return key in VOLUMES ? (key as VolumeKey) : undefined
}

/** Un valore di configurazione arriva come stringa o numero: lo riduco a stringa pulita. */
export function asText(value: unknown): string {
  return value === undefined || value === null ? '' : String(value).trim()
}

/**
 * Dati della cornice: headmatter del deck (`$slidev.configs`) con override per slide
 * dal frontmatter. Va chiamata dentro il setup di un componente di una slide.
 */
export function useFrameData(volumeOverride?: () => unknown) {
  const { $slidev, $frontmatter, $page } = useSlideContext()
  const configs = computed(() => ($slidev.configs ?? {}) as Record<string, unknown>)
  const pick = (key: string) => asText($frontmatter?.[key] ?? configs.value[key])

  const volume = computed(() => asVolume(volumeOverride?.() ?? pick('volume')))
  const chapter = computed(() => {
    const raw = pick('chapter')
    return /^\d+$/.test(raw) ? raw.padStart(2, '0') : raw
  })
  const lesson = computed(() => pick('lesson') || asText(configs.value.title))
  const lessonUrl = computed(() => pick('lessonUrl'))
  const page = computed(() => $page.value)

  return { volume, chapter, lesson, lessonUrl, page }
}
