<script lang="ts">
import type { PropType, VNode, VNodeArrayChildren } from 'vue'
import { useSlideContext } from '@slidev/client'
import { defineComponent, Fragment, h, onMounted, onUnmounted, ref, watchSyncEffect } from 'vue'

// Opzioni di una domanda (layout `question`): la lista ordinata dello slot diventa una
// griglia 2 × 2 con le lettere A–D. Al clic successivo `answer` diventa «Corretta» e le
// altre si attenuano; `wrong` marca una risposta sbagliata con «Sbagliata». Il colore non
// è mai l'unico segnale: c'è sempre l'icona e la parola.
//
//   <Options answer="B" wrong="C">
//
//   1. `3`
//   2. `22`
//   …
//
//   </Options>

const CHECK = 'M6.2 11.6 2.6 8l1.1-1.1 2.5 2.5 6.1-6.1L13.4 4.4z'
const CROSS = 'M4.5 3.4 8 6.9l3.5-3.5 1.1 1.1L9.1 8l3.5 3.5-1.1 1.1L8 9.1l-3.5 3.5-1.1-1.1L6.9 8 3.4 4.5z'

let counter = 0

// «B», «b» o «2» → indice 1. Più valori separati da virgole o spazi.
function parseChoices(value: unknown): number[] {
  return String(value ?? '')
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(choice => /^\d+$/.test(choice) ? Number(choice) - 1 : choice.toUpperCase().charCodeAt(0) - 65)
    .filter(index => index >= 0)
}

function isElement(node: unknown, tag: string): node is VNode {
  return typeof node === 'object' && node !== null && (node as VNode).type === tag
}

// Una lista «larga» (righe vuote tra le voci) mette ogni voce in un <p>: lo tolgo.
function itemContent(li: VNode): VNodeArrayChildren {
  const children = li.children
  if (typeof children === 'string')
    return [children]
  if (!Array.isArray(children))
    return []
  const elements = children.filter(child => typeof child === 'object' && child !== null)
  if (elements.length === 1 && isElement(elements[0], 'p'))
    return itemContent(elements[0])
  return children
}

// Le voci della prima lista dello slot, anche dentro un frammento.
function findItems(nodes: VNodeArrayChildren): VNodeArrayChildren[] | undefined {
  for (const node of nodes) {
    if (typeof node !== 'object' || node === null)
      continue
    const children = Array.isArray(node) ? node : node.children
    if (!Array.isArray(node) && (node.type === 'ol' || node.type === 'ul'))
      return Array.isArray(children) ? children.filter(child => isElement(child, 'li')).map(li => itemContent(li as VNode)) : []
    if (Array.isArray(node) || node.type === Fragment) {
      const found = Array.isArray(children) ? findItems(children) : undefined
      if (found)
        return found
    }
  }
  return undefined
}

function stateLabel(correct: boolean) {
  return h('span', { class: 'at-option__state' }, [
    h('svg', { 'viewBox': '0 0 16 16', 'aria-hidden': 'true' }, [h('path', { d: correct ? CHECK : CROSS })]),
    correct ? 'Corretta' : 'Sbagliata',
  ])
}

export default defineComponent({
  name: 'Options',
  props: {
    answer: { type: [String, Number] as PropType<string | number>, default: undefined },
    wrong: { type: [String, Number] as PropType<string | number>, default: undefined },
  },
  setup(props, { slots }) {
    const { $clicksContext } = useSlideContext()
    const revealed = ref(false)

    // Un clic di Slidev, come `v-click`: registrato al montaggio, nell'ordine della slide.
    const id = `pdb-options-${++counter}`
    onMounted(() => {
      if (props.answer === undefined && props.wrong === undefined)
        return
      const info = $clicksContext.calculate('+1')
      if (!info)
        return
      $clicksContext.register(id, info)
      watchSyncEffect(() => {
        revealed.value = info.isActive.value
      })
    })
    onUnmounted(() => $clicksContext.unregister(id))

    return () => {
      const items = findItems(slots.default?.() ?? [])
      if (!items) {
        console.warn('[python-doesnt-byte] <Options> vuole una lista ordinata: 1. … 2. …')
        return h('div', { class: 'at-options' }, slots.default?.())
      }
      const answers = parseChoices(props.answer)
      const wrongs = parseChoices(props.wrong)
      return h('ol', { class: ['at-options', { 'is-revealed': revealed.value }] }, items.map((item, index) => {
        const correct = revealed.value && answers.includes(index)
        const wrong = revealed.value && !correct && wrongs.includes(index)
        const faded = revealed.value && !correct && !wrong
        return h('li', { class: ['at-option', { 'is-correct': correct, 'is-wrong': wrong, 'is-faded': faded }] }, [
          h('span', { class: 'at-option__letter' }, String.fromCharCode(65 + index)),
          h('span', { class: 'at-option__text' }, item),
          correct || wrong ? stateLabel(correct) : null,
        ])
      }))
    }
  },
})
</script>
