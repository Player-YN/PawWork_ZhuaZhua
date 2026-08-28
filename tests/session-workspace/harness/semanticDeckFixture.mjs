/**
 * Deterministic 7-frame Paw Work Chinese deck used by the real-tldraw E2E harness.
 * Invokes host compile/apply APIs — does not hand-author tldraw nodes.
 */
export const SEMANTIC_THEME_ID = 'ink-rose';

export function semanticDeckOutline() {
  return {
    themeId: SEMANTIC_THEME_ID,
    kind: 'deck',
    title: 'Paw Work 选区交付',
    frames: [
      {
        id: 'slide-1',
        layoutId: 'title-visual',
        variant: 'dark',
        slots: {
          kicker: 'Chrome 扩展',
          title: '在选区上直接交付',
          subtitle: 'Paw ON · 选中 · 说出结果',
          visual: { kind: 'icon', name: 'paw-print' }
        }
      },
      {
        id: 'slide-2',
        layoutId: 'compare',
        variant: 'paper',
        slots: {
          kicker: '对照',
          title: '运行时绑定，提示词判断',
          left: { title: '之前', value: '手写坐标', body: '模型摆线框，版式停在空卡片。' },
          right: { title: '之后', value: '语义编译', body: '主题与版式一次写入，几何可编辑。' }
        }
      },
      {
        id: 'slide-3',
        layoutId: 'process',
        variant: 'surface',
        slots: {
          kicker: '流程',
          title: '四步工作流',
          steps: [
            { title: '选中', body: '圈选页面证据' },
            { title: '描述', body: '说出想要的结果' },
            { title: '编译', body: '宿主写入画布' },
            { title: '交付', body: '同一份幻灯' }
          ]
        }
      },
      {
        id: 'slide-4',
        layoutId: 'points-icons',
        variant: 'paper',
        slots: {
          kicker: '能力',
          title: '一次会话里的五件事',
          items: [
            { title: '选区', body: '圈选即上下文', icon: 'paw-print' },
            { title: '画布', body: '可编辑幻灯', icon: 'star' },
            { title: '办公', body: '表格文档同会话', icon: 'check' },
            { title: '检索', body: '按需获取网页', icon: 'search' },
            { title: '质量', body: '结构门禁先于交付', icon: 'sparkles' }
          ]
        }
      },
      {
        id: 'slide-5',
        layoutId: 'timeline',
        variant: 'surface',
        slots: {
          kicker: '路径',
          title: '从选中到交付',
          steps: [
            { title: '选中', body: 'Paw ON 圈选' },
            { title: '描述', body: '说出结果' },
            { title: '编译', body: '宿主几何' },
            { title: '交付', body: '可编辑幻灯' }
          ]
        }
      },
      {
        id: 'slide-6',
        layoutId: 'matrix',
        variant: 'paper',
        slots: {
          kicker: '象限',
          title: '工作面',
          cells: [
            { title: '选区', body: '页面证据' },
            { title: '幻灯', body: '16:9 画布' },
            { title: '表格', body: 'Univer 网格' },
            { title: '文档', body: '长文交付' }
          ]
        }
      },
      {
        id: 'slide-7',
        layoutId: 'closing',
        variant: 'dark',
        slots: {
          title: '打开 Paw，选中，说出结果',
          subtitle: '一份画布，七页可编辑',
          cta: '开始使用',
          footer: 'paw.work'
        }
      }
    ]
  };
}

export function slide4ReplaceSlots() {
  return {
    kicker: '同一页，换版式',
    quote: 'replacePlate 只改这一页的孩子，不另开文件。',
    attribution: 'Paw Work'
  };
}

/**
 * Packed-extension E2E outline: same 7-frame Paw Work intro, plus motif + chart visuals.
 * Harness seed keeps timeline/matrix; this path proves icon/motif/chart compile through the tool loop.
 */
export function e2eDeckOutline() {
  const base = semanticDeckOutline();
  return {
    ...base,
    frames: base.frames.map((frame) => {
      if (frame.id === 'slide-5') {
        return {
          id: 'slide-5',
          layoutId: 'title-visual',
          slots: {
            kicker: '路径',
            title: '从选中到交付',
            subtitle: '母题示意工作流',
            visual: { kind: 'motif', id: 'workflow-arrow' }
          }
        };
      }
      if (frame.id === 'slide-6') {
        return {
          id: 'slide-6',
          layoutId: 'title-visual',
          slots: {
            kicker: '数据',
            title: '工作面',
            subtitle: '四类交付都在同一会话',
            visual: {
              kind: 'chart',
              type: 'bar',
              data: [
                { label: '选区', value: 4 },
                { label: '幻灯', value: 3 },
                { label: '表格', value: 2 },
                { label: '文档', value: 2 }
              ]
            }
          }
        };
      }
      return frame;
    })
  };
}
