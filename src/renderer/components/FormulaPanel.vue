<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

export interface FormulaSection {
  title: string
  formulas: string[]
  variables?: string[]
  notes?: string[]
}

const props = withDefaults(defineProps<{
  title?: string
  sections: FormulaSection[]
  activeSection?: string
}>(), {
  title: '计算公式与边界',
  activeSection: '',
})

const emit = defineEmits<{
  'update:activeSection': [value: string]
}>()

const sectionRefs = ref<Record<string, HTMLElement | null>>({})

const currentActiveSection = computed(() => {
  const hasExplicitActive = props.sections.some(
    section => section.title === props.activeSection,
  )
  if (hasExplicitActive) return props.activeSection
  return props.sections[0]?.title || ''
})

function setSectionRef(title: string, el: unknown) {
  if (el && typeof el === 'object' && '$el' in el) {
    sectionRefs.value[title] = (el as { $el?: HTMLElement }).$el ?? null
    return
  }

  sectionRefs.value[title] = el as HTMLElement | null
}

function selectSection(title: string) {
  emit('update:activeSection', title)
}

watch(
  currentActiveSection,
  async (title) => {
    if (!title) return
    await nextTick()
    sectionRefs.value[title]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    })
  },
)
</script>

<template>
  <a-card class="formula-panel-card" :title="title" size="small">
    <div v-if="sections.length > 1" class="formula-panel-nav">
      <button
        v-for="section in sections"
        :key="`nav-${section.title}`"
        type="button"
        class="formula-panel-nav__item"
        :class="{ 'is-active': section.title === currentActiveSection }"
        @click="selectSection(section.title)"
      >
        {{ section.title }}
      </button>
    </div>
    <div class="formula-panel">
      <section
        v-for="section in sections"
        :key="section.title"
        class="formula-panel-section"
        :class="{ 'is-active': section.title === currentActiveSection }"
        :ref="(el) => setSectionRef(section.title, el)"
        @click="selectSection(section.title)"
      >
        <div class="formula-panel-section__title">{{ section.title }}</div>
        <div class="formula-panel-formulas">
          <div
            v-for="formula in section.formulas"
            :key="formula"
            class="formula-panel-formula"
          >
            {{ formula }}
          </div>
        </div>
        <div
          v-if="section.variables?.length"
          class="formula-panel-meta"
        >
          <strong>变量：</strong>{{ section.variables.join('；') }}
        </div>
        <div
          v-if="section.notes?.length"
          class="formula-panel-notes"
        >
          <div
            v-for="note in section.notes"
            :key="note"
            class="formula-panel-note"
          >
            {{ note }}
          </div>
        </div>
      </section>
    </div>
  </a-card>
</template>
