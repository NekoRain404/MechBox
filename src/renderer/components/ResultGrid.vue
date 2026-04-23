/**
 * ResultGrid - 统一结果展示网格组件
 * 替代各页面重复的 result-grid 和 descriptions 模式
 */
import { defineComponent, h, type VNode } from 'vue'

interface ResultItem {
  label: string
  value: string | number
  type?: 'default' | 'error' | 'warning' | 'success'
  tag?: string
}

export default defineComponent({
  name: 'ResultGrid',
  props: {
    items: { type: Array as () => ResultItem[], required: true },
    columns: { type: Number, default: 2 },
  },
  setup(props) {
    return () =>
      h(
        'div',
        {
          class: 'result-grid',
          style: { gridTemplateColumns: `repeat(${props.columns}, 1fr)` },
        },
        props.items.map((item) => [
          h('div', { class: 'result-label' }, item.label),
          h(
            'div',
            { class: ['result-value', item.type || 'default'] },
            item.tag ? h('a-tag', { color: item.tag }, item.value) : String(item.value)
          ),
        ])
      )
  },
})
