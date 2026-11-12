import * as THREE from 'three';
import { buildPetAnatomy } from './petGeometry.js';
import {
  SHELL_VERTEX_SHADER,
  SHELL_FRAGMENT_SHADER,
  STRAND_VERTEX_SHADER,
  STRAND_FRAGMENT_SHADER,
} from './furShaders.js';

const MAX_STRANDS = 120000;
const MAX_SHELLS = 25; // 0 = base skin, 1..24 = volumetric undercoat shells
const BLADE_SEGMENTS = 5;

/**
 * 创建单根 5 段式锥形毛发刀片基础几何体 (y: 0 -> 1, x: -0.5 -> 0.5)
 */
function createBladeBaseGeometry(segments = BLADE_SEGMENTS) {
  const positions = [];
  const indices = [];

  for (let s = 0; s <= segments; s++) {
    const h = s / segments;
    positions.push(-0.5, h, 0.0);
    positions.push(0.5, h, 0.0);
    if (s < segments) {
      const row = s * 2;
      indices.push(row, row + 1, row + 2);
      indices.push(row + 1, row + 3, row + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  return geo;
}

export class FurPetSystem {
  constructor(scene, params) {
    this.scene = scene;
    this.params = params;

    this.rootGroup = new THREE.Group();
    this.scene.add(this.rootGroup);

    // 共享着色器 Uniforms（皮肤壳层与几何针毛同步驱动）
    this.sharedUniforms = {
      uTime: { value: 0 },
      uBreath: { value: 0 },
      uHeadPivot: { value: new THREE.Vector3(0, 0.24, 0.1) },
      uHeadQuat: { value: new THREE.Vector4(0, 0, 0, 1) },
      uTailPivot: { value: new THREE.Vector3(0, -0.26, -0.24) },
      uTailQuat: { value: new THREE.Vector4(0, 0, 0, 1) },
      uEarTwitch: { value: 0 },
      uShakeAmp: { value: 0 },
      uShakePhase: { value: 0 },

      uShellCount: { value: params.shellLayers },
      uUndercoatDensity: { value: params.undercoatDensity },

      uFurLength: { value: params.furLength },
      uRootThickness: { value: params.rootThickness },
      uTipTaper: { value: params.tipTaper },
      uFaceMul: { value: params.faceLengthMul },
      uManeMul: { value: params.maneLengthMul },
      uEarMul: { value: params.earLengthMul },
      uBellyMul: { value: params.bellyLengthMul },
      uTailMul: { value: params.tailLengthMul },

      uClumpStrength: { value: params.clumpStrength },
      uCurlStrength: { value: params.curlStrength },
      uCurlFrequency: { value: params.curlFrequency },
      uFrizzStrength: { value: params.frizzStrength },
      uFrizzScale: { value: params.frizzScale },

      uRootColor: { value: new THREE.Color(params.rootColor) },
      uMidColor: { value: new THREE.Color(params.midColor) },
      uTipColor: { value: new THREE.Color(params.tipColor) },
      uColorBias: { value: params.colorBias },
      uPatternType: { value: params.patternType },
      uPatternColor: { value: new THREE.Color(params.patternColor) },
      uPatternSecColor: { value: new THREE.Color(params.patternSecondaryColor) },
      uPatternScale: { value: params.patternScale },
      uPatternSoftness: { value: params.patternSoftness },
      uWetness: { value: params.wetness },
      uIridescence: { value: params.iridescence },

      uKeyLightDir: { value: new THREE.Vector3(0.5, 0.7, 0.5).normalize() },
      uKeyLightColor: { value: new THREE.Color(0xfff4e4) },
      uRimLightDir: { value: new THREE.Vector3(-0.5, 0.45, -0.75).normalize() },
      uRimLightColor: { value: new THREE.Color(0xffcf96) },
      uSkyAmbient: { value: new THREE.Color(0x6d7fa8) },
      uGroundAmbient: { value: new THREE.Color(0x3b2d26) },

      uSpecPrimary: { value: params.specPrimary },
      uSpecShift1: { value: params.specShift1 },
      uSpecSecondary: { value: params.specSecondary },
      uRoughness: { value: params.roughness },
      uBacklightSSS: { value: params.backlightSSS },
      uAoIntensity: { value: params.aoIntensity },

      uGravity: { value: params.gravity },
      uStiffness: { value: params.stiffness },
      uInertiaOffset: { value: new THREE.Vector3() },
      uWindStrength: { value: params.windStrength },
      uWindSpeed: { value: params.windSpeed },
      uWindDir: { value: new THREE.Vector3(1, 0.15, 0.3).normalize() },

      uDryerActive: { value: 0 },
      uDryerPos: { value: new THREE.Vector3() },
      uDryerNormal: { value: new THREE.Vector3(0, 0, 1) },
      uDryerRadius: { value: 0.28 },
      uDryerStrength: { value: 0.65 },

      uTouchActive: { value: 0 },
      uTouchPos: { value: new THREE.Vector3() },
      uTouchRadius: { value: 0.24 },
    };

    this.shellMaterial = new THREE.ShaderMaterial({
      uniforms: this.sharedUniforms,
      vertexShader: SHELL_VERTEX_SHADER,
      fragmentShader: SHELL_FRAGMENT_SHADER,
      side: THREE.FrontSide,
    });

    this.strandMaterial = new THREE.ShaderMaterial({
      uniforms: this.sharedUniforms,
      vertexShader: STRAND_VERTEX_SHADER,
      fragmentShader: STRAND_FRAGMENT_SHADER,
      side: THREE.DoubleSide,
    });

    // 隐形射线拾取碰撞体
    this.raycastMesh = null;
    this.shellMesh = null;
    this.strandMesh = null;
    this.facialGroup = null;
    this.speciesConfig = null;

    // 预分配最大发丝实例缓冲区
    this.rootPositions = new Float32Array(MAX_STRANDS * 3);
    this.rootNormals = new Float32Array(MAX_STRANDS * 3);
    this.clumpCenters = new Float32Array(MAX_STRANDS * 3);
    this.regions = new Float32Array(MAX_STRANDS * 4);
    this.extras = new Float32Array(MAX_STRANDS * 4);
    this.bones = new Float32Array(MAX_STRANDS * 4);
    this.groomData = new Float32Array(MAX_STRANDS * 4);
    this.dyeData = new Float32Array(MAX_STRANDS * 4);

    // 空间哈希加速桶（用于 60FPS 实时局部梳毛、推子与染发）
    this.spatialBuckets = new Map();
    this.spatialCellSize = 0.11;

    // 动画与物理状态
    this.headQuatCurrent = new THREE.Quaternion();
    this.headQuatTarget = new THREE.Quaternion();
    this.tailQuatCurrent = new THREE.Quaternion();

    this.inertiaOffset = new THREE.Vector3();
    this.inertiaVelocity = new THREE.Vector3();

    this.shakeTimer = 0;
    this.shakeDuration = 1.15;
    this.tiltTimer = 0;
    this.excitement = 0; // 被抚摸或互动时摇尾加速
    this.blinkTimer = 2.4;
    this.blinkProgress = 0;

    this.buildSpecies(params.species);
    this.syncParams(params);
  }

  /**
   * 生成指定物种的有机 SDF 皮肤网格、底绒壳层与 12 万根预采样针毛
   */
  buildSpecies(species) {
    // 清理旧网格
    if (this.shellMesh) {
      this.rootGroup.remove(this.shellMesh);
      this.shellMesh.geometry.dispose();
    }
    if (this.strandMesh) {
      this.rootGroup.remove(this.strandMesh);
      this.strandMesh.geometry.dispose();
    }
    if (this.raycastMesh) {
      this.rootGroup.remove(this.raycastMesh);
      this.raycastMesh.geometry.dispose();
    }
    if (this.facialGroup) {
      this.rootGroup.remove(this.facialGroup);
    }

    const { geometry: baseSkinGeo, config, facialGroup } = buildPetAnatomy(species);
    this.speciesConfig = config;
    this.facialGroup = facialGroup;
    this.rootGroup.add(this.facialGroup);

    this.sharedUniforms.uHeadPivot.value.copy(config.headPivot);
    this.sharedUniforms.uTailPivot.value.copy(config.tailPivot);

    // 1. 射线拾取隐形网格
    const rayMat = new THREE.MeshBasicMaterial({ visible: false });
    this.raycastMesh = new THREE.Mesh(baseSkinGeo.clone(), rayMat);
    this.rootGroup.add(this.raycastMesh);

    // 2. 多层底绒体积壳层 InstancedBufferGeometry (单次 Draw Call 渲染底皮 + 所有底绒切片)
    const shellGeo = new THREE.InstancedBufferGeometry();
    shellGeo.index = baseSkinGeo.index;
    shellGeo.attributes.position = baseSkinGeo.attributes.position;
    shellGeo.attributes.normal = baseSkinGeo.attributes.normal;
    shellGeo.attributes.aRegion = baseSkinGeo.attributes.aRegion;
    shellGeo.attributes.aExtra = baseSkinGeo.attributes.aExtra;
    shellGeo.attributes.aBones = baseSkinGeo.attributes.aBones;

    const layerIndices = new Float32Array(MAX_SHELLS);
    for (let i = 0; i < MAX_SHELLS; i++) layerIndices[i] = i;
    shellGeo.setAttribute('aLayerIndex', new THREE.InstancedBufferAttribute(layerIndices, 1));
    shellGeo.instanceCount = Math.min(MAX_SHELLS, Math.round(this.params.shellLayers) + 1);

    this.shellMesh = new THREE.Mesh(shellGeo, this.shellMaterial);
    this.shellMesh.frustumCulled = false;
    this.rootGroup.add(this.shellMesh);

    // 3. 在皮肤三角面上按面积×遮罩权重均匀采样 MAX_STRANDS 个发根
    this.sampleStrandsFromSurface(baseSkinGeo);
    this.recomputeClumps(this.params.clumpScale);
    this.buildSpatialHash();

    // 4. 构建 GPU 实例化多段刀片几何体
    const bladeBase = createBladeBaseGeometry(BLADE_SEGMENTS);
    const strandGeo = new THREE.InstancedBufferGeometry();
    strandGeo.index = bladeBase.index;
    strandGeo.attributes.position = bladeBase.attributes.position;

    this.attrRootPos = new THREE.InstancedBufferAttribute(this.rootPositions, 3);
    this.attrNormal = new THREE.InstancedBufferAttribute(this.rootNormals, 3);
    this.attrClump = new THREE.InstancedBufferAttribute(this.clumpCenters, 3);
    this.attrRegion = new THREE.InstancedBufferAttribute(this.regions, 4);
    this.attrExtra = new THREE.InstancedBufferAttribute(this.extras, 4);
    this.attrBones = new THREE.InstancedBufferAttribute(this.bones, 4);
    this.attrGroom = new THREE.InstancedBufferAttribute(this.groomData, 4);
    this.attrDye = new THREE.InstancedBufferAttribute(this.dyeData, 4);

    this.attrGroom.setUsage(THREE.DynamicDrawUsage);
    this.attrDye.setUsage(THREE.DynamicDrawUsage);

    strandGeo.setAttribute('iRootPos', this.attrRootPos);
    strandGeo.setAttribute('iNormal', this.attrNormal);
    strandGeo.setAttribute('iClumpCenter', this.attrClump);
    strandGeo.setAttribute('iRegion', this.attrRegion);
    strandGeo.setAttribute('iExtra', this.attrExtra);
    strandGeo.setAttribute('iBones', this.attrBones);
    strandGeo.setAttribute('iGroom', this.attrGroom);
    strandGeo.setAttribute('iDye', this.attrDye);

    strandGeo.instanceCount = Math.min(MAX_STRANDS, Math.round(this.params.strandCount));

    this.strandMesh = new THREE.Mesh(strandGeo, this.strandMaterial);
    this.strandMesh.frustumCulled = false;
    this.rootGroup.add(this.strandMesh);

    baseSkinGeo.dispose();
  }

  /**
   * 面积加权随机三角面采样（打乱顺序使任意 instanceCount 前缀均全身均匀分布）
   */
  sampleStrandsFromSurface(skinGeo) {
    const pos = skinGeo.attributes.position.array;
    const norm = skinGeo.attributes.normal.array;
    const reg = skinGeo.attributes.aRegion.array;
    const ext = skinGeo.attributes.aExtra.array;
    const bon = skinGeo.attributes.aBones.array;
    const idx = skinGeo.index.array;

    const triCount = idx.length / 3;
    const cdf = new Float64Array(triCount);
    let totalWeight = 0;

    for (let t = 0; t < triCount; t++) {
      const i0 = idx[t * 3];
      const i1 = idx[t * 3 + 1];
      const i2 = idx[t * 3 + 2];

      const ax = pos[i0 * 3], ay = pos[i0 * 3 + 1], az = pos[i0 * 3 + 2];
      const bx = pos[i1 * 3] - ax, by = pos[i1 * 3 + 1] - ay, bz = pos[i1 * 3 + 2] - az;
      const cx = pos[i2 * 3] - ax, cy = pos[i2 * 3 + 1] - ay, cz = pos[i2 * 3 + 2] - az;

      const area = 0.5 * Math.hypot(by * cz - bz * cy, bz * cx - bx * cz, bx * cy - by * cx);
      const maskAvg = (ext[i0 * 2 + 1] + ext[i1 * 2 + 1] + ext[i2 * 2 + 1]) / 3.0;
      // 眼窝和湿鼻头正中心跳过无效毛发采样，提高有效毛发密度
      const densityFactor = maskAvg < 0.08 ? 0.0 : (0.35 + 0.65 * maskAvg);

      totalWeight += area * densityFactor;
      cdf[t] = totalWeight;
    }

    // 确定性高品质伪随机序列
    let seed = 133742;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let s = 0; s < MAX_STRANDS; s++) {
      const rTarget = rand() * totalWeight;
      // 二分查找 CDF
      let lo = 0, hi = triCount - 1;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (cdf[mid] < rTarget) lo = mid + 1;
        else hi = mid;
      }

      const i0 = idx[lo * 3];
      const i1 = idx[lo * 3 + 1];
      const i2 = idx[lo * 3 + 2];

      let u = rand();
      let v = rand();
      if (u + v > 1.0) {
        u = 1.0 - u;
        v = 1.0 - v;
      }
      const w = 1.0 - u - v;

      const px = pos[i0 * 3] * w + pos[i1 * 3] * u + pos[i2 * 3] * v;
      const py = pos[i0 * 3 + 1] * w + pos[i1 * 3 + 1] * u + pos[i2 * 3 + 1] * v;
      const pz = pos[i0 * 3 + 2] * w + pos[i1 * 3 + 2] * u + pos[i2 * 3 + 2] * v;

      let nx = norm[i0 * 3] * w + norm[i1 * 3] * u + norm[i2 * 3] * v;
      let ny = norm[i0 * 3 + 1] * w + norm[i1 * 3 + 1] * u + norm[i2 * 3 + 1] * v;
      let nz = norm[i0 * 3 + 2] * w + norm[i1 * 3 + 2] * u + norm[i2 * 3 + 2] * v;
      const nLen = Math.hypot(nx, ny, nz) || 1.0;
      nx /= nLen; ny /= nLen; nz /= nLen;

      this.rootPositions[s * 3] = px;
      this.rootPositions[s * 3 + 1] = py;
      this.rootPositions[s * 3 + 2] = pz;

      this.rootNormals[s * 3] = nx;
      this.rootNormals[s * 3 + 1] = ny;
      this.rootNormals[s * 3 + 2] = nz;

      for (let c = 0; c < 4; c++) {
        this.regions[s * 4 + c] = reg[i0 * 4 + c] * w + reg[i1 * 4 + c] * u + reg[i2 * 4 + c] * v;
        this.bones[s * 4 + c] = bon[i0 * 4 + c] * w + bon[i1 * 4 + c] * u + bon[i2 * 4 + c] * v;
      }

      const wBelly = ext[i0 * 2] * w + ext[i1 * 2] * u + ext[i2 * 2] * v;
      const furMask = ext[i0 * 2 + 1] * w + ext[i1 * 2 + 1] * u + ext[i2 * 2 + 1] * v;

      this.extras[s * 4] = wBelly;
      this.extras[s * 4 + 1] = furMask;
      this.extras[s * 4 + 2] = rand(); // 独立相位种子
      this.extras[s * 4 + 3] = rand(); // 独立毛长微扰

      // 默认自然顺毛微倾与 1.0 倍修剪系数
      this.groomData[s * 4] = 0.0;
      this.groomData[s * 4 + 1] = 0.0;
      this.groomData[s * 4 + 2] = 0.0;
      this.groomData[s * 4 + 3] = 1.0;

      // 默认无人工挑染
      this.dyeData[s * 4] = 1.0;
      this.dyeData[s * 4 + 1] = 1.0;
      this.dyeData[s * 4 + 2] = 1.0;
      this.dyeData[s * 4 + 3] = 0.0;
    }
  }

  /**
   * 线性时间表面锚定 Voronoi 毛簇划分（保证每簇锚点严格落在真实曲面上）
   */
  recomputeClumps(clumpScale) {
    const scale = Math.max(4.0, clumpScale);
    const cellAnchors = new Map();

    for (let s = 0; s < MAX_STRANDS; s++) {
      const px = this.rootPositions[s * 3];
      const py = this.rootPositions[s * 3 + 1];
      const pz = this.rootPositions[s * 3 + 2];

      const cx = Math.floor(px * scale);
      const cy = Math.floor(py * scale);
      const cz = Math.floor(pz * scale);
      // 打包整数空间键
      const key = ((cx + 512) << 20) | ((cy + 512) << 10) | (cz + 512);

      let anchor = cellAnchors.get(key);
      if (anchor === undefined) {
        anchor = s;
        cellAnchors.set(key, s);
      }

      this.clumpCenters[s * 3] = this.rootPositions[anchor * 3];
      this.clumpCenters[s * 3 + 1] = this.rootPositions[anchor * 3 + 1];
      this.clumpCenters[s * 3 + 2] = this.rootPositions[anchor * 3 + 2];
    }

    if (this.attrClump) {
      this.attrClump.needsUpdate = true;
    }
  }

  /**
   * 建立 3D 空间网格索引，支持 60FPS 实时笔刷护理
   */
  buildSpatialHash() {
    this.spatialBuckets.clear();
    const inv = 1.0 / this.spatialCellSize;

    for (let s = 0; s < MAX_STRANDS; s++) {
      const ix = Math.floor(this.rootPositions[s * 3] * inv);
      const iy = Math.floor(this.rootPositions[s * 3 + 1] * inv);
      const iz = Math.floor(this.rootPositions[s * 3 + 2] * inv);
      const key = `${ix},${iy},${iz}`;
      let list = this.spatialBuckets.get(key);
      if (!list) {
        list = [];
        this.spatialBuckets.set(key, list);
      }
      list.push(s);
    }
  }

  /**
   * 应用局部交互笔刷：顺毛梳刷 (comb)、修剪推子 (trim)、生毛喷雾 (grow)、染发喷枪 (dye)
   */
  applyGroomBrush({ mode, localPoint, localStrokeDir, radius, strength, dyeColor }) {
    const r = radius;
    const rSq = r * r;
    const inv = 1.0 / this.spatialCellSize;

    const minX = Math.floor((localPoint.x - r) * inv);
    const maxX = Math.floor((localPoint.x + r) * inv);
    const minY = Math.floor((localPoint.y - r) * inv);
    const maxY = Math.floor((localPoint.y + r) * inv);
    const minZ = Math.floor((localPoint.z - r) * inv);
    const maxZ = Math.floor((localPoint.z + r) * inv);

    let touchedGroom = false;
    let touchedDye = false;

    const col = dyeColor ? new THREE.Color(dyeColor) : null;

    for (let ix = minX; ix <= maxX; ix++) {
      for (let iy = minY; iy <= maxY; iy++) {
        for (let iz = minZ; iz <= maxZ; iz++) {
          const bucket = this.spatialBuckets.get(`${ix},${iy},${iz}`);
          if (!bucket) continue;

          for (let b = 0; b < bucket.length; b++) {
            const s = bucket[b];
            const dx = this.rootPositions[s * 3] - localPoint.x;
            const dy = this.rootPositions[s * 3 + 1] - localPoint.y;
            const dz = this.rootPositions[s * 3 + 2] - localPoint.z;
            const dSq = dx * dx + dy * dy + dz * dz;
            if (dSq >= rSq) continue;

            const falloff = Math.pow(1.0 - Math.sqrt(dSq) / r, 1.4) * strength;

            if (mode === 'comb' && localStrokeDir) {
              // 投影笔刷滑动向量到皮肤切平面，记录顺毛记忆
              const nx = this.rootNormals[s * 3];
              const ny = this.rootNormals[s * 3 + 1];
              const nz = this.rootNormals[s * 3 + 2];
              const dotN = localStrokeDir.x * nx + localStrokeDir.y * ny + localStrokeDir.z * nz;
              let tx = localStrokeDir.x - nx * dotN;
              let ty = localStrokeDir.y - ny * dotN;
              let tz = localStrokeDir.z - nz * dotN;
              const tLen = Math.hypot(tx, ty, tz);
              if (tLen > 1e-4) {
                tx = (tx / tLen) * 1.15;
                ty = (ty / tLen) * 1.15;
                tz = (tz / tLen) * 1.15;
                const blend = Math.min(1.0, falloff * 0.42);
                this.groomData[s * 4] += (tx - this.groomData[s * 4]) * blend;
                this.groomData[s * 4 + 1] += (ty - this.groomData[s * 4 + 1]) * blend;
                this.groomData[s * 4 + 2] += (tz - this.groomData[s * 4 + 2]) * blend;
                touchedGroom = true;
              }
            } else if (mode === 'trim') {
              const cur = this.groomData[s * 4 + 3];
              this.groomData[s * 4 + 3] = Math.max(0.14, cur - falloff * 0.14);
              touchedGroom = true;
            } else if (mode === 'grow') {
              const cur = this.groomData[s * 4 + 3];
              this.groomData[s * 4 + 3] = Math.min(2.35, cur + falloff * 0.14);
              touchedGroom = true;
            } else if (mode === 'dye' && col) {
              const prevW = this.dyeData[s * 4 + 3];
              const nextW = Math.min(1.0, prevW + falloff * 0.28);
              const colorMix = Math.min(1.0, falloff * 0.45);
              this.dyeData[s * 4] = prevW < 0.02 ? col.r : this.dyeData[s * 4] + (col.r - this.dyeData[s * 4]) * colorMix;
              this.dyeData[s * 4 + 1] = prevW < 0.02 ? col.g : this.dyeData[s * 4 + 1] + (col.g - this.dyeData[s * 4 + 1]) * colorMix;
              this.dyeData[s * 4 + 2] = prevW < 0.02 ? col.b : this.dyeData[s * 4 + 2] + (col.b - this.dyeData[s * 4 + 2]) * colorMix;
              this.dyeData[s * 4 + 3] = nextW;
              touchedDye = true;
            }
          }
        }
      }
    }

    if (touchedGroom) this.attrGroom.needsUpdate = true;
    if (touchedDye) this.attrDye.needsUpdate = true;
    if (touchedGroom || touchedDye) {
      this.excitement = Math.min(1.0, this.excitement + 0.08);
    }
  }

  /**
   * 一键复原所有梳刷、修剪与挑染状态
   */
  resetGrooming() {
    for (let s = 0; s < MAX_STRANDS; s++) {
      this.groomData[s * 4] = 0.0;
      this.groomData[s * 4 + 1] = 0.0;
      this.groomData[s * 4 + 2] = 0.0;
      this.groomData[s * 4 + 3] = 1.0;
      this.dyeData[s * 4 + 3] = 0.0;
    }
    this.attrGroom.needsUpdate = true;
    this.attrDye.needsUpdate = true;
  }

  /**
   * 触发狗狗式全身抖毛动画
   */
  triggerShake() {
    this.shakeTimer = this.shakeDuration;
    this.excitement = 1.0;
  }

  /**
   * 触发超萌开心歪头杀与竖耳摇尾
   */
  triggerHappyTilt() {
    this.tiltTimer = 2.2;
    this.excitement = 1.0;
  }

  /**
   * 相机旋转或宠物拖动时注入弹簧惯性冲量
   */
  addInertiaImpulse(vx, vy, vz) {
    this.inertiaVelocity.x += vx;
    this.inertiaVelocity.y += vy;
    this.inertiaVelocity.z += vz;
  }

  /**
   * 将 UI 参数同步至 GPU Uniforms 与实例化几何数量
   */
  syncParams(params) {
    const prevClumpScale = this._lastClumpScale;
    this.params = params;

    const u = this.sharedUniforms;
    const activeStrands = Math.min(MAX_STRANDS, Math.max(2000, Math.round(params.strandCount)));
    if (this.strandMesh) {
      this.strandMesh.geometry.instanceCount = activeStrands;
    }

    const shells = Math.min(MAX_SHELLS - 1, Math.max(0, Math.round(params.shellLayers)));
    u.uShellCount.value = Math.max(1, shells);
    if (this.shellMesh) {
      this.shellMesh.geometry.instanceCount = shells + 1;
    }

    u.uUndercoatDensity.value = params.undercoatDensity;
    u.uFurLength.value = params.furLength;
    u.uRootThickness.value = params.rootThickness;
    u.uTipTaper.value = params.tipTaper;
    u.uFaceMul.value = params.faceLengthMul;
    u.uManeMul.value = params.maneLengthMul;
    u.uEarMul.value = params.earLengthMul;
    u.uBellyMul.value = params.bellyLengthMul;
    u.uTailMul.value = params.tailLengthMul;

    u.uClumpStrength.value = params.clumpStrength;
    if (prevClumpScale !== undefined && Math.abs(prevClumpScale - params.clumpScale) > 0.05) {
      this.recomputeClumps(params.clumpScale);
    }
    this._lastClumpScale = params.clumpScale;

    u.uCurlStrength.value = params.curlStrength;
    u.uCurlFrequency.value = params.curlFrequency;
    u.uFrizzStrength.value = params.frizzStrength;
    u.uFrizzScale.value = params.frizzScale;
    u.uWetness.value = params.wetness;

    u.uRootColor.value.set(params.rootColor);
    u.uMidColor.value.set(params.midColor);
    u.uTipColor.value.set(params.tipColor);
    u.uColorBias.value = params.colorBias;
    u.uPatternType.value = Number(params.patternType);
    u.uPatternColor.value.set(params.patternColor);
    u.uPatternSecColor.value.set(params.patternSecondaryColor);
    u.uPatternScale.value = params.patternScale;
    u.uPatternSoftness.value = params.patternSoftness;

    u.uSpecPrimary.value = params.specPrimary;
    u.uSpecShift1.value = params.specShift1;
    u.uSpecSecondary.value = params.specSecondary;
    u.uRoughness.value = params.roughness;
    u.uBacklightSSS.value = params.backlightSSS;
    u.uAoIntensity.value = params.aoIntensity;
    u.uIridescence.value = params.iridescence;

    u.uGravity.value = params.gravity;
    u.uStiffness.value = params.stiffness;
    u.uWindStrength.value = params.windStrength;
    u.uWindSpeed.value = params.windSpeed;

    const rad = (params.windAngle * Math.PI) / 180;
    u.uWindDir.value.set(Math.cos(rad), 0.12, Math.sin(rad)).normalize();
  }

  /**
   * 获取当前实际渲染三角面统计用于顶部遥测栏
   */
  getTelemetryStats() {
    const strands = this.strandMesh ? this.strandMesh.geometry.instanceCount : 0;
    const strandTris = strands * BLADE_SEGMENTS * 2;
    const shellInstances = this.shellMesh ? this.shellMesh.geometry.instanceCount : 1;
    const skinTriBase = this.shellMesh ? this.shellMesh.geometry.index.count / 3 : 0;
    const shellTris = skinTriBase * shellInstances;
    return {
      strands,
      shells: Math.max(0, shellInstances - 1),
      totalTriangles: strandTris + shellTris,
    };
  }

  /**
   * 每帧更新生物骨骼动画、眨眼、歪头视线追踪与胡克弹簧惯性
   */
  update(dt, elapsed, pointerNDC) {
    const u = this.sharedUniforms;
    u.uTime.value = elapsed;

    this.excitement = Math.max(0, this.excitement - dt * 0.45);

    // 1. 待机呼吸与摇尾
    if (this.params.idleAnimation) {
      u.uBreath.value = Math.sin(elapsed * 2.4) * 0.5 + 0.5;

      const wagFreq = 2.8 + this.excitement * 5.8;
      const wagAmp = 0.16 + this.excitement * 0.24;
      const tailYaw = Math.sin(elapsed * wagFreq) * wagAmp;
      const tailPitch = Math.cos(elapsed * wagFreq * 0.5) * 0.06;
      const eulerTail = new THREE.Euler(tailPitch, tailYaw, tailYaw * 0.35, 'YXZ');
      this.tailQuatCurrent.setFromEuler(eulerTail);

      // 偶发灵动耳尖微动
      const earPulse = Math.pow(Math.max(0, Math.sin(elapsed * 1.7) * Math.sin(elapsed * 4.3)), 6.0);
      u.uEarTwitch.value = earPulse * 0.85 + (this.tiltTimer > 0 ? Math.sin(elapsed * 12.0) * 0.25 : 0);
    } else {
      u.uBreath.value = 0;
      this.tailQuatCurrent.identity();
      u.uEarTwitch.value = 0;
    }

    u.uTailQuat.value.set(
      this.tailQuatCurrent.x,
      this.tailQuatCurrent.y,
      this.tailQuatCurrent.z,
      this.tailQuatCurrent.w
    );

    // 2. 头部视线追踪与歪头杀
    let headYaw = 0;
    let headPitch = 0;
    let headRoll = 0;

    if (this.params.eyeTracking && pointerNDC) {
      headYaw = THREE.MathUtils.clamp(pointerNDC.x * 0.32, -0.36, 0.36);
      headPitch = THREE.MathUtils.clamp(-pointerNDC.y * 0.22, -0.24, 0.24);
      headRoll = -pointerNDC.x * 0.08;
    } else if (this.params.idleAnimation) {
      headYaw = Math.sin(elapsed * 0.7) * 0.08;
      headPitch = Math.cos(elapsed * 0.9) * 0.04;
    }

    if (this.tiltTimer > 0) {
      this.tiltTimer = Math.max(0, this.tiltTimer - dt);
      const env = Math.sin(Math.min(1, this.tiltTimer / 0.35) * Math.PI * 0.5);
      headRoll += 0.36 * env;
      headPitch -= 0.08 * env;
    }

    const headEuler = new THREE.Euler(headPitch, headYaw, headRoll, 'YXZ');
    this.headQuatTarget.setFromEuler(headEuler);
    this.headQuatCurrent.slerp(this.headQuatTarget, Math.min(1, dt * 7.5));

    u.uHeadQuat.value.set(
      this.headQuatCurrent.x,
      this.headQuatCurrent.y,
      this.headQuatCurrent.z,
      this.headQuatCurrent.w
    );

    // 3. 抖毛扭转波与同步面部挂点变换
    let shakeHeadRoll = 0;
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
      const progress = 1.0 - this.shakeTimer / this.shakeDuration;
      const envelope = Math.sin(progress * Math.PI);
      u.uShakeAmp.value = envelope * 1.15;
      u.uShakePhase.value = progress * 34.0;
      shakeHeadRoll = Math.sin(u.uShakePhase.value - 0.5) * u.uShakeAmp.value * 0.34;
    } else {
      u.uShakeAmp.value = 0;
    }

    if (this.facialGroup && this.speciesConfig) {
      this.facialGroup.position.copy(this.speciesConfig.headPivot);
      this.facialGroup.quaternion.copy(this.headQuatCurrent);
      if (Math.abs(shakeHeadRoll) > 0.001) {
        const qShake = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), shakeHeadRoll);
        this.facialGroup.quaternion.premultiply(qShake);
      }

      // 自然眨眼控制
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) {
        this.blinkProgress += dt * 11.0;
        if (this.blinkProgress >= Math.PI) {
          this.blinkProgress = 0;
          this.blinkTimer = 2.6 + Math.random() * 2.8;
        }
      }
      const blinkScaleY = this.blinkTimer <= 0 ? Math.max(0.08, 1.0 - Math.sin(this.blinkProgress) * 0.94) : 1.0;
      const { eyeGroupL, eyeGroupR } = this.facialGroup.userData;
      if (eyeGroupL && eyeGroupR) {
        eyeGroupL.scale.y = blinkScaleY;
        eyeGroupR.scale.y = blinkScaleY;
      }
    }

    // 4. 全局毛发弹簧阻尼动力学 (Hooke's Law + Velocity Damping)
    const springK = 55.0 + (1.0 - this.params.springBounce) * 65.0;
    const damping = 5.2 + (1.0 - this.params.springBounce) * 9.5;
    const subDt = Math.min(0.033, dt);

    const ax = -springK * this.inertiaOffset.x - damping * this.inertiaVelocity.x;
    const ay = -springK * this.inertiaOffset.y - damping * this.inertiaVelocity.y;
    const az = -springK * this.inertiaOffset.z - damping * this.inertiaVelocity.z;

    this.inertiaVelocity.x += ax * subDt;
    this.inertiaVelocity.y += ay * subDt;
    this.inertiaVelocity.z += az * subDt;

    this.inertiaOffset.x += this.inertiaVelocity.x * subDt;
    this.inertiaOffset.y += this.inertiaVelocity.y * subDt;
    this.inertiaOffset.z += this.inertiaVelocity.z * subDt;

    // 限幅防止极端拖拽拉爆
    if (this.inertiaOffset.length() > 0.42) {
      this.inertiaOffset.setLength(0.42);
    }
    u.uInertiaOffset.value.copy(this.inertiaOffset);
  }
}
