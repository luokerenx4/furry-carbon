# FluffyLab — Three.js 实时双层被毛生成与萌宠交互造型系统

基于 **Three.js + Custom GLSL Shaders** 构建的高性能实时生物毛发生成与交互造型工作台（100+ FPS @ 72,000 GPU 实例化多段曲率针毛 + 16 层体积底绒切片）。

## 核心特性

- **混合双层被毛管线 (Dual-Coat Architecture)**
  - **体积底绒层 (Volumetric Undercoat Shells)**：单次实例化 Draw Call 渲染最多 24 层沿曲面法线与重力场弯曲的噪声底绒切片，消除漏底硬边。
  - **GPU 实例化曲率针毛 (GPU Instanced Curved Blades)**：最高 120,000 根 5 段式锥形丝带毛束，骨骼蒙皮、Voronoi 聚簇成束、三维螺旋卷曲、阵风湍流与屏幕对齐半圆柱法线展开均在 Vertex Shader 内完成。
- **Smooth SDF 无接缝有机解剖网格**
  - 内置 **🐶 博美幼犬、🐱 圆脸奶猫、🐰 垂耳绒兔、🦊 小熊猫狐** 四种物种形态，使用光滑有向距离场（Smooth SDF）与对偶 Surface Nets 提取水密皮肤，配合解剖分区毛长遮罩（眼周/鼻头退避、粉嫩内耳廓、脖圈围脖鬃毛、肚皮绒毛、蓬松大尾独立控制）。
- **Kajiya-Kay / Marschner 双瓣各向异性光学与 6 种花色基因**
  - 支持发根-中段-发尖三段色素渐变、双偏移毛鳞片高光（$R$ + $TRT$）、逆光前向透射金边（Rim Backlight SSS）、深层发根 AO、薄膜干涉虹彩，以及纯色、白胸雪爪燕尾服、虎斑条纹、三花/奶牛斑点、暹罗/布偶重点色、赤狐/小熊猫面具环尾。
- **60+ FPS 实时交互梳毛与造型沙盒**
  - 支持 **🤚 抚摸拨毛、🪮 顺毛梳刷、✂️ 修剪推子、🌱 局部生毛、🎨 挑染喷枪、💨 强力吹风机**，以及 **🐕 全身抖毛 (Shake!)** 与 **✨ 开心歪头杀** 物理互动。

## 快速开始

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
npm run preview
```

## 目录结构

- `index.html` — 工作台布局、交互护理栏、性能遥测栏与 Best Practices 技术弹窗
- `src/petGeometry.js` — Smooth SDF 物种建模、对偶 Surface Nets 水密网格提取、解剖权重与晶亮五官生成
- `src/furShaders.js` — 骨骼蒙皮、双层被毛顶点形变、花纹合成与 Kajiya-Kay + SSS 光学着色器
- `src/furSystem.js` — 12 万发根面积加权采样、表面锚定 Voronoi 聚簇、3D 空间哈希实时笔刷与胡克弹簧惯性解算
- `src/presets.js` — 默认参数矩阵与 8 款精选造型预设
- `src/ui.js` — 检视器面板、预设切换与 JSON 导入导出控制
- `src/main.js` — Three.js 摄影棚场景、PMREM 环境反射、交互粒子反馈与主循环
