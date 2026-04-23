/**
 * 失效诊断专家系统
 * 基于专家规则树的故障诊断向导
 * Section 5.5
 */

export interface DiagnosisRule {
  id: string
  symptom: string
  category: 'seal' | 'bearing' | 'gear' | 'bolt' | 'general'
  possibleCauses: {
    cause: string
    probability: 'high' | 'medium' | 'low'
    description: string
    suggestions: string[]
    relatedCalculation?: string
  }[]
}

export interface DiagnosisResult {
  rule: DiagnosisRule
  selectedSymptom: string
  causes: DiagnosisRule['possibleCauses']
}

// 密封圈失效规则
const sealRules: DiagnosisRule[] = [
  {
    id: 'seal-leakage',
    symptom: '密封泄漏',
    category: 'seal',
    possibleCauses: [
      {
        cause: '压缩率不足',
        probability: 'high',
        description: 'O型圈压缩率低于推荐范围（静密封<15%，动密封<8%），导致密封接触压力不足',
        suggestions: [
          '检查沟槽深度是否过大',
          '检查O型圈线径是否偏小',
          '重新计算压缩率，确保静密封≥15%',
          '考虑使用硬度更高的材料'
        ],
        relatedCalculation: 'compression'
      },
      {
        cause: '挤出失效',
        probability: 'medium',
        description: '工作压力过高或间隙过大，导致密封圈被挤入配合面间隙',
        suggestions: [
          '检查工作压力是否超过O型圈允许值',
          '检查配合间隙是否过大',
          '添加挡圈（Backup Ring）',
          '降低系统工作压力'
        ],
        relatedCalculation: 'extrusion-check'
      },
      {
        cause: '安装损伤',
        probability: 'medium',
        description: '安装过程中O型圈被锐边划伤或切边',
        suggestions: [
          '检查沟槽边缘是否有倒角',
          '使用安装导向套',
          '涂抹适量润滑脂',
          '检查拉伸率是否超过5%'
        ],
        relatedCalculation: 'stretch'
      },
      {
        cause: '材料老化',
        probability: 'low',
        description: '长期高温或化学腐蚀导致密封圈硬化、龟裂',
        suggestions: [
          '检查工作温度是否超过材料允许范围',
          '检查介质与材料是否兼容',
          '更换为耐高温材料（如FKM替代NBR）',
          '缩短更换周期'
        ]
      }
    ]
  },
  {
    id: 'seal-wear',
    symptom: '密封圈磨损/切边',
    category: 'seal',
    possibleCauses: [
      {
        cause: '表面粗糙度不足',
        probability: 'high',
        description: '配合面表面粗糙度过高，加速密封圈磨损',
        suggestions: [
          '检查轴/孔表面粗糙度 Ra≤0.4μm（动密封）',
          '进行表面研磨或抛光处理',
          '考虑使用镀层保护'
        ]
      },
      {
        cause: '润滑不良',
        probability: 'high',
        description: '干摩擦或润滑不足导致快速磨损',
        suggestions: [
          '增加润滑系统',
          '选择自润滑材料',
          '降低运动速度'
        ]
      },
      {
        cause: '偏心/不同轴',
        probability: 'medium',
        description: '轴与孔不同轴导致O型圈单侧磨损',
        suggestions: [
          '检查同轴度公差',
          '增加导向环',
          '重新对中配合件'
        ]
      }
    ]
  },
  {
    id: 'seal-hardening',
    symptom: '密封圈硬化/龟裂',
    category: 'seal',
    possibleCauses: [
      {
        cause: '超温使用',
        probability: 'high',
        description: '工作温度超过材料允许上限',
        suggestions: [
          '检查实际工作温度',
          '更换为耐高温材料（FKM最高200°C，FFKM可达327°C）',
          '增加冷却系统'
        ]
      },
      {
        cause: '化学腐蚀',
        probability: 'medium',
        description: '密封材料与介质发生化学反应',
        suggestions: [
          '检查介质与材料的化学兼容性',
          '更换为耐腐蚀材料（如PTFE）',
          '添加防腐涂层'
        ]
      },
      {
        cause: '臭氧老化',
        probability: 'low',
        description: '长期暴露在含臭氧环境中',
        suggestions: [
          '使用耐臭氧材料（如EPDM）',
          '避免阳光直射',
          '添加防臭氧剂'
        ]
      }
    ]
  }
]

// 轴承失效规则
const bearingRules: DiagnosisRule[] = [
  {
    id: 'bearing-overheat',
    symptom: '轴承发热/过热',
    category: 'bearing',
    possibleCauses: [
      {
        cause: '润滑不良',
        probability: 'high',
        description: '润滑脂过多/过少、润滑脂老化或选型错误',
        suggestions: [
          '检查润滑脂填充量（通常为轴承空间的30-50%）',
          '检查润滑脂是否老化变质',
          '更换为合适的润滑脂',
          '检查转速是否超过润滑脂极限'
        ]
      },
      {
        cause: '载荷过大',
        probability: 'high',
        description: '实际载荷超过轴承额定载荷',
        suggestions: [
          '检查实际载荷是否超过C_r值',
          '重新选型更大承载能力的轴承',
          '增加支承点分散载荷'
        ],
        relatedCalculation: 'bearing-life'
      },
      {
        cause: '游隙不当',
        probability: 'medium',
        description: '安装游隙过小或过大导致发热',
        suggestions: [
          '检查工作游隙是否在推荐范围',
          '检查安装过盈量是否过大',
          '考虑使用C3或C4游隙组别'
        ],
        relatedCalculation: 'clearance'
      },
      {
        cause: '安装不当',
        probability: 'medium',
        description: '安装时倾斜、不同轴或预紧力过大',
        suggestions: [
          '检查安装同轴度',
          '检查预紧力是否过大',
          '重新安装并确保无倾斜'
        ]
      }
    ]
  },
  {
    id: 'bearing-noise',
    symptom: '轴承异响',
    category: 'bearing',
    possibleCauses: [
      {
        cause: '疲劳剥落',
        probability: 'high',
        description: '滚动接触疲劳导致滚道或滚动体表面剥落',
        suggestions: [
          '检查轴承使用寿命是否接近L10',
          '更换轴承并检查润滑状况',
          '降低载荷或转速以延长寿命'
        ],
        relatedCalculation: 'bearing-life'
      },
      {
        cause: '异物进入',
        probability: 'medium',
        description: '灰尘、金属屑等进入轴承内部',
        suggestions: [
          '检查密封是否完好',
          '清洗轴承并更换新润滑脂',
          '改善工作环境清洁度'
        ]
      },
      {
        cause: '保持架损坏',
        probability: 'low',
        description: '保持架断裂导致滚动体运动失序',
        suggestions: [
          '立即停机检查',
          '更换轴承',
          '检查是否超速运转'
        ]
      }
    ]
  }
]

// 齿轮失效规则
const gearRules: DiagnosisRule[] = [
  {
    id: 'gear-pitting',
    symptom: '齿面点蚀/剥落',
    category: 'gear',
    possibleCauses: [
      {
        cause: '接触疲劳',
        probability: 'high',
        description: '齿面接触应力超过材料接触疲劳极限',
        suggestions: [
          '检查接触应力是否超过许用值',
          '提高齿面硬度（渗碳淬火）',
          '增大模数或齿宽降低接触应力',
          '改善润滑条件'
        ],
        relatedCalculation: 'gear-contact-stress'
      },
      {
        cause: '润滑不良',
        probability: 'medium',
        description: '油膜厚度不足导致金属直接接触',
        suggestions: [
          '检查润滑油粘度是否合适',
          '增加润滑油量',
          '使用极压添加剂'
        ]
      }
    ]
  },
  {
    id: 'gear-tooth-break',
    symptom: '轮齿断裂',
    category: 'gear',
    possibleCauses: [
      {
        cause: '弯曲疲劳',
        probability: 'high',
        description: '齿根弯曲应力超过材料疲劳极限',
        suggestions: [
          '检查弯曲应力是否超过许用值',
          '增大模数',
          '采用正变位提高齿根强度',
          '改善材料（合金钢调质）'
        ],
        relatedCalculation: 'gear-bending-stress'
      },
      {
        cause: '过载断裂',
        probability: 'medium',
        description: '瞬时冲击载荷超过齿轮静强度',
        suggestions: [
          '检查是否有冲击载荷',
          '增加安全系数',
          '采用韧性更好的材料'
        ]
      }
    ]
  }
]

// 螺栓失效规则
const boltRules: DiagnosisRule[] = [
  {
    id: 'bolt-loosening',
    symptom: '螺栓松动',
    category: 'bolt',
    possibleCauses: [
      {
        cause: '预紧力不足',
        probability: 'high',
        description: '预紧扭矩不足或预紧力衰减',
        suggestions: [
          '检查预紧扭矩是否达到推荐值',
          '使用扭矩扳手重新拧紧',
          '考虑使用液压拉伸器',
          '增加防松措施（弹簧垫圈、锁紧螺母、螺纹锁固胶）'
        ],
        relatedCalculation: 'bolt-preload'
      },
      {
        cause: '振动松动',
        probability: 'high',
        description: '长期交变载荷导致预紧力逐渐丧失',
        suggestions: [
          '使用防松垫圈（Nord-Lock等）',
          '采用双螺母防松',
          '增加横向支承面摩擦力',
          '定期检查预紧力'
        ]
      },
      {
        cause: '蠕变松弛',
        probability: 'low',
        description: '高温下材料蠕变导致预紧力衰减',
        suggestions: [
          '检查使用温度是否过高',
          '更换为耐高温材料',
          '使用碟形弹簧补偿松弛'
        ]
      }
    ]
  },
  {
    id: 'bolt-fracture',
    symptom: '螺栓断裂',
    category: 'bolt',
    possibleCauses: [
      {
        cause: '超载断裂',
        probability: 'high',
        description: '拉伸或剪切载荷超过螺栓强度',
        suggestions: [
          '检查实际载荷是否超过许用值',
          '增大螺栓规格或提高性能等级',
          '增加螺栓数量分散载荷'
        ],
        relatedCalculation: 'bolt-strength'
      },
      {
        cause: '疲劳断裂',
        probability: 'medium',
        description: '交变载荷导致的疲劳断裂',
        suggestions: [
          '检查应力幅值是否超过疲劳极限',
          '提高螺栓强度等级',
          '采用柔性螺栓降低应力幅',
          '改善受力分布'
        ]
      },
      {
        cause: '氢脆断裂',
        probability: 'low',
        description: '高强度螺栓电镀后氢脆',
        suggestions: [
          '检查螺栓等级是否≥10.9级',
          '电镀后必须进行去氢处理',
          '改用机械镀锌或达克罗处理'
        ]
      }
    ]
  }
]

// 所有规则汇总
export const allRules: DiagnosisRule[] = [
  ...sealRules,
  ...bearingRules,
  ...gearRules,
  ...boltRules,
]

/**
 * 根据症状查找诊断规则
 */
export const diagnoseBySymptom = (symptom: string): DiagnosisResult | null => {
  const rule = allRules.find(r => r.symptom === symptom)
  if (!rule) return null
  
  return {
    rule,
    selectedSymptom: symptom,
    causes: rule.possibleCauses
  }
}

/**
 * 获取所有症状列表
 */
export const getAllSymptoms = (category?: string): string[] => {
  const filtered = category 
    ? allRules.filter(r => r.category === category)
    : allRules
  return filtered.map(r => r.symptom)
}

/**
 * 获取所有类别
 */
export const getAllCategories = (): string[] => {
  return [...new Set(allRules.map(r => r.category))]
}
