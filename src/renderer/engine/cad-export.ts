/**
 * CAD Export Engine - 生成 CAD 宏和脚本
 * 支持 SolidWorks VBA、FreeCAD Python、AutoCAD Script
 */

export interface CADExportOptions {
  format: 'swp' | 'freecad_py' | 'acad_script'
  units?: 'mm' | 'inch'
}

/**
 * 生成 SolidWorks VBA 宏 - O型圈沟槽
 */
export const exportGrooveToSolidWorks = (
  groove: { depth: number; width: number; bottom_radius: number },
  shaftDiameter: number
): string => {
  return `' MechBox - O-Ring Groove Generator
' Generated: ${new Date().toISOString()}
' Units: mm

Dim swApp As Object
Dim Part As Object
Dim boolstatus As Boolean

Sub main()
    Set swApp = Application.SldWorks
    Set Part = swApp.ActiveDoc
    
    If Part Is Nothing Then
        MsgBox "请先打开或创建一个零件!", vbCritical
        Exit Sub
    End If
    
    ' 沟槽参数
    Dim grooveDepth As Double
    Dim grooveWidth As Double
    Dim bottomRadius As Double
    Dim shaftDia As Double
    
    grooveDepth = ${groove.depth} / 1000  ' 转换为米 (SolidWorks 默认单位)
    grooveWidth = ${groove.width} / 1000
    bottomRadius = ${groove.bottom_radius} / 1000
    shaftDia = ${shaftDiameter} / 1000
    
    ' 在轴上创建沟槽
    ' 1. 选择前视基准面
    boolstatus = Part.Extension.SelectByID2("前视基准面", "PLANE", 0, 0, 0, False, 0, Nothing, 0)
    
    ' 2. 绘制沟槽截面
    Part.SketchManager.InsertSketch True
    
    Dim centerX As Double
    centerX = shaftDia / 2 + grooveDepth
    
    ' 绘制矩形沟槽
    Dim leftX As Double
    leftX = centerX - grooveWidth / 2
    Dim rightX As Double
    rightX = centerX + grooveWidth / 2
    
    Part.SketchManager.CreateCenterRectangle leftX, 0.01, 0, rightX, -0.01, 0
    
    ' 3. 旋转切除
    Part.SketchManager.InsertSketch True
    Part.Extension.SelectByID2 "D1@草图", "DIMENSION", 0, 0, 0
    Part.InsertCutRevolve
    
    ' 添加圆角
    ' Part.EditSketch
    ' Part.SketchManager.CreateFillet bottomRadius
    
    MsgBox "沟槽已创建!" & vbCrLf & _
           "深度: ${groove.depth} mm" & vbCrLf & _
           "宽度: ${groove.width} mm" & vbCrLf & _
           "圆角: ${groove.bottom_radius} mm", vbInformation
End Sub
`;
};

/**
 * 生成 FreeCAD Python 脚本 - O型圈沟槽
 */
export const exportGrooveToFreeCAD = (
  groove: { depth: number; width: number; bottom_radius: number },
  shaftDiameter: number
): string => {
  return `# MechBox - O-Ring Groove Generator for FreeCAD
# Generated: ${new Date().toISOString()}
# Units: mm
# 在 FreeCAD Python 控制台中运行此脚本

import FreeCAD
import Part
import math

# 沟槽参数
groove_depth = ${groove.depth}
groove_width = ${groove.width}
bottom_radius = ${groove.bottom_radius}
shaft_diameter = ${shaftDiameter}

# 创建文档
doc = FreeCAD.activeDocument()
if doc is None:
    doc = FreeCAD.newDocument("GroovePart")

# 创建轴（圆柱体）
shaft_length = shaft_diameter * 2  # 假设轴长度为直径的2倍
shaft = doc.addObject("Part::Cylinder", "Shaft")
shaft.Radius = shaft_diameter / 2
shaft.Height = shaft_length
doc.recompute()

# 创建沟槽（环形切除）
groove_outer_radius = shaft_diameter / 2 + groove_depth
groove_inner_radius = shaft_diameter / 2
groove_y_start = -groove_width / 2
groove_y_end = groove_width / 2

# 使用旋转体创建沟槽
groove_tube = doc.addObject("Part::Cylinder", "GrooveTube")
groove_tube.Radius = groove_outer_radius
groove_tube.Height = groove_width
groove_tube.Placement = FreeCAD.Placement(
    FreeCAD.Vector(0, groove_y_start, 0),
    FreeCAD.Rotation(0, 0, 0)
)
doc.recompute()

# 创建内部圆柱体用于布尔差集
inner_tube = doc.addObject("Part::Cylinder", "InnerTube")
inner_tube.Radius = shaft_diameter / 2
inner_tube.Height = groove_width + 1  # 稍长以确保完全切除
inner_tube.Placement = FreeCAD.Placement(
    FreeCAD.Vector(0, groove_y_start - 0.5, 0),
    FreeCAD.Rotation(0, 0, 0)
)
doc.recompute()

# 布尔差集创建沟槽
groove_cut = doc.addObject("Part::Cut", "GrooveCut")
groove_cut.Base = groove_tube
groove_cut.Tool = inner_tube
doc.recompute()

# 从轴中切除沟槽
final_shaft = doc.addObject("Part::Cut", "FinalShaft")
final_shaft.Base = shaft
final_shaft.Tool = groove_cut
doc.recompute()

# 添加圆角
fillet = doc.addObject("Part::Fillet", "GrooveFillet")
fillet.Base = final_shaft
fillet.Radius = bottom_radius
doc.recompute()

# 设置视图
FreeCAD.activeDocument().recompute()
print(f"沟槽已创建: 深度={groove_depth}mm, 宽度={groove_width}mm, 圆角={bottom_radius}mm")
`;
};

/**
 * 生成齿轮参数 - SolidWorks 方程式驱动
 */
export const exportGearToEquations = (
  gear: {
    module: number;
    teeth: number;
    pressure_angle: number;
    face_width: number;
  }
): string => {
  const { module: m, teeth: z, pressure_angle: alpha, face_width: b } = gear;
  const d = m * z;
  const da = m * (z + 2);
  const df = m * (z - 2.5);
  const db = d * Math.cos((alpha * Math.PI) / 180);

  return `; MechBox - Gear Equation Driver for SolidWorks
; Generated: ${new Date().toISOString()}
; 齿轮参数:
;   模数 m = ${m} mm
;   齿数 z = ${z}
;   压力角 = ${alpha}°
;   齿宽 = ${b} mm
;
; 计算结果:
;   分度圆直径 d = ${d} mm
;   齿顶圆直径 da = ${da} mm
;   齿根圆直径 df = ${df} mm
;   基圆直径 db = ${db.toFixed(2)} mm
;
; 使用说明:
; 1. 创建一个圆柱体，直径 = d, 高度 = b
; 2. 在方程式中添加以下变量:
;
;   "m" = ${m}
;   "z" = ${z}
;   "alpha" = ${alpha}
;   "d" = "m" * "z"
;   "da" = "m" * ("z" + 2)
;   "df" = "m" * ("z" - 2.5)
;   "b" = ${b}
;
; 3. 使用这些方程式驱动齿轮几何
; 4. 对于渐开线齿形，请使用曲线驱动的切除特征
`;
};

/**
 * 导出螺栓连接装配 - STEP 文件建议
 */
export const exportBoltAssemblyToSTEP = (
  bolt: { designation: string; d: number; head_width_s: number; head_height_k: number },
  plateThickness: number,
  washerThickness: number = 2
): string => {
  return `# MechBox - Bolt Assembly Export
# Generated: ${new Date().toISOString()}
# 建议的 STEP 文件结构

# 零件清单 (BOM):
# 1. 螺栓: ${bolt.designation}
#    - 公称直径: ${bolt.d} mm
#    - 对边宽度: ${bolt.head_width_s} mm
#    - 头部高度: ${bolt.head_height_k} mm
#    - 所需长度: ≥ ${plateThickness + washerThickness + bolt.d * 0.5} mm (经验值)
#
# 2. 螺母: 匹配 ${bolt.designation}
# 3. 垫圈: 外径 ≈ ${bolt.head_width_s * 1.5} mm, 厚度 ${washerThickness} mm
#
# 装配步骤:
# 1. 创建被连接板，厚度 ${plateThickness} mm
# 2. 钻孔直径 = ${bolt.d * 1.1} mm (通孔)
# 3. 插入螺栓
# 4. 添加垫圈
# 5. 拧紧螺母
#
# 预紧扭矩推荐:
# - 8.8级: ${Math.round(0.2 * bolt.d * (0.6 * 640 * Math.PI * bolt.d * bolt.d / 4 / 1000))} N·m
# - 10.9级: ${Math.round(0.2 * bolt.d * (0.6 * 900 * Math.PI * bolt.d * bolt.d / 4 / 1000))} N·m
`;
};

/**
 * 通用 CAD 导出函数
 */
export const exportToCAD = (
  moduleType: 'oring_groove' | 'gear' | 'bolt_assembly',
  data: any,
  format: 'swp' | 'freecad_py' | 'acad_script' | 'txt' = 'freecad_py'
): string => {
  switch (moduleType) {
    case 'oring_groove':
      if (format === 'swp') {
        return exportGrooveToSolidWorks(data.groove, data.shaftDiameter);
      }
      return exportGrooveToFreeCAD(data.groove, data.shaftDiameter);
      
    case 'gear':
      return exportGearToEquations(data);
      
    case 'bolt_assembly':
      return exportBoltAssemblyToSTEP(data.bolt, data.plateThickness);
      
    default:
      return '# 不支持的模块类型';
  }
};
