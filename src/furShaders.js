export const COMMON_FUR_GLSL = /* glsl */ `
  uniform float uTime;
  uniform float uBreath;
  uniform vec3 uHeadPivot;
  uniform vec4 uHeadQuat;
  uniform vec3 uTailPivot;
  uniform vec4 uTailQuat;
  uniform float uEarTwitch;
  uniform float uShakeAmp;
  uniform float uShakePhase;

  // 配色与花纹 Uniforms
  uniform vec3 uRootColor;
  uniform vec3 uMidColor;
  uniform vec3 uTipColor;
  uniform float uColorBias;
  uniform int uPatternType;
  uniform vec3 uPatternColor;
  uniform vec3 uPatternSecColor;
  uniform float uPatternScale;
  uniform float uPatternSoftness;
  uniform float uWetness;
  uniform float uIridescence;

  // 光照与光学 Uniforms
  uniform vec3 uKeyLightDir;
  uniform vec3 uKeyLightColor;
  uniform vec3 uRimLightDir;
  uniform vec3 uRimLightColor;
  uniform vec3 uSkyAmbient;
  uniform vec3 uGroundAmbient;
  uniform float uSpecPrimary;
  uniform float uSpecShift1;
  uniform float uSpecSecondary;
  uniform float uRoughness;
  uniform float uBacklightSSS;
  uniform float uAoIntensity;

  vec3 quatRotate(vec4 q, vec3 v) {
    return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
  }

  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise3D(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(
        mix(hash31(i + vec3(0,0,0)), hash31(i + vec3(1,0,0)), f.x),
        mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x),
        f.y
      ),
      mix(
        mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
        mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x),
        f.y
      ),
      f.z
    );
  }

  float fbm3(vec3 p) {
    float v = 0.0;
    v += 0.55 * noise3D(p);
    v += 0.30 * noise3D(p * 2.07 + 11.3);
    v += 0.15 * noise3D(p * 4.13 + 23.7);
    return v;
  }

  vec4 slerpIdentity(vec4 q, float w) {
    if (w <= 0.0001) return vec4(0.0, 0.0, 0.0, 1.0);
    if (w >= 0.9999) return q;
    vec4 mixed = mix(vec4(0.0, 0.0, 0.0, 1.0), q, w);
    return normalize(mixed);
  }

  void applyPetSkeleton(
    vec3 restPos,
    vec3 restNorm,
    vec4 bones,
    out vec3 animPos,
    out vec3 animNorm,
    out float shakeTwistOut
  ) {
    vec3 p = restPos;
    vec3 n = restNorm;

    // 1. 胸腹均匀呼吸起伏
    float breathScale = uBreath * bones.w;
    p.xz *= (1.0 + breathScale * 0.048);
    p.y += breathScale * 0.016;

    // 2. 耳朵灵动微颤
    if (bones.z > 0.001) {
      float side = sign(restPos.x);
      float earAngle = uEarTwitch * bones.z * side * 0.18;
      float ce = cos(earAngle);
      float se = sin(earAngle);
      vec3 relE = p - vec3(side * 0.18, 0.50, 0.10);
      relE.xy = mat2(ce, -se, se, ce) * relE.xy;
      p = relE + vec3(side * 0.18, 0.50, 0.10);
      n.xy = mat2(ce, -se, se, ce) * n.xy;
    }

    // 3. 头部歪头与视线追踪旋转
    if (bones.x > 0.001) {
      vec4 qH = slerpIdentity(uHeadQuat, bones.x);
      p = uHeadPivot + quatRotate(qH, p - uHeadPivot);
      n = quatRotate(qH, n);
    }

    // 4. 摇尾巴旋转
    if (bones.y > 0.001) {
      vec4 qT = slerpIdentity(uTailQuat, bones.y);
      p = uTailPivot + quatRotate(qT, p - uTailPivot);
      n = quatRotate(qT, n);
    }

    // 5. 趣味全身抖毛扭转波 (从头向尾传播的延迟正弦波)
    shakeTwistOut = 0.0;
    if (uShakeAmp > 0.0005) {
      float waveLag = (0.45 - restPos.z) * 4.2 + (0.5 - restPos.y) * 1.5;
      float twist = sin(uShakePhase - waveLag) * uShakeAmp * 0.34;
      shakeTwistOut = cos(uShakePhase - waveLag) * uShakeAmp;
      float cs = cos(twist);
      float ss = sin(twist);
      p.xy = mat2(cs, -ss, ss, cs) * p.xy;
      n.xy = mat2(cs, -ss, ss, cs) * n.xy;
    }

    animPos = p;
    animNorm = normalize(n);
  }

  /**
   * 计算三段毛发色素渐变 + 六种程序化生物花纹 + 局部挑染 + 湿润度加深
   */
  vec3 evaluateCoatColor(
    vec3 restPos,
    vec4 region,
    float wBelly,
    float h,
    vec4 dye
  ) {
    // 基础发根 -> 中段 -> 发尖渐变
    float midPoint = clamp(uColorBias, 0.12, 0.88);
    vec3 baseGrad;
    if (h < midPoint) {
      baseGrad = mix(uRootColor, uMidColor, smoothstep(0.0, midPoint, h));
    } else {
      baseGrad = mix(uMidColor, uTipColor, smoothstep(midPoint, 1.0, h));
    }

    float soft = max(0.04, uPatternSoftness);
    vec3 col = baseGrad;

    if (uPatternType == 1) {
      // 白胸雪爪 (Tuxedo / Bib & Socks)
      float chestMask = clamp(wBelly * 1.25 + smoothstep(0.32, 0.44, restPos.z) * smoothstep(0.18, 0.31, restPos.y) * (1.0 - smoothstep(0.06, 0.14, abs(restPos.x))), 0.0, 1.0);
      float socksMask = 1.0 - smoothstep(-0.49, -0.37, restPos.y);
      float tailTip = region.w * smoothstep(-0.42, -0.62, restPos.z);
      float m = clamp(max(chestMask, max(socksMask, tailTip)), 0.0, 1.0);
      m = smoothstep(0.5 - soft * 0.5, 0.5 + soft * 0.5, m);
      vec3 whiteCoat = mix(uPatternColor * 0.86, uPatternColor, h);
      col = mix(col, whiteCoat, m);
    } else if (uPatternType == 2) {
      // 虎斑条纹 (Tabby Stripes)
      vec3 wp = restPos * uPatternScale;
      float warp = fbm3(wp * 0.65) * 2.2;
      float stripeCoord = wp.z * 2.4 + wp.y * 1.35 + abs(wp.x) * 1.2 + warp;
      float wave = sin(stripeCoord * 3.14159);
      float stripeMask = smoothstep(0.15 - soft * 0.7, 0.45 + soft * 0.5, wave);
      // 胸肚保留浅奶油色
      stripeMask *= (1.0 - wBelly * 0.85);
      vec3 darkStripe = mix(uPatternSecColor * 0.75, uPatternSecColor, h * 0.8);
      col = mix(col, darkStripe, stripeMask * 0.78);
      col = mix(col, uPatternColor, wBelly * 0.72);
    } else if (uPatternType == 3) {
      // 三花 / 斑点奶牛 (Calico / Spots)
      float n1 = fbm3(restPos * uPatternScale + vec3(2.1, 4.7, 1.3));
      float n2 = fbm3(restPos * uPatternScale * 1.18 + vec3(9.4, 1.2, 6.8));
      float patchA = smoothstep(0.53 - soft * 0.35, 0.56 + soft * 0.35, n1) * (1.0 - wBelly * 0.55);
      float patchB = smoothstep(0.57 - soft * 0.35, 0.60 + soft * 0.35, n2) * (1.0 - patchA) * (1.0 - wBelly * 0.65);
      col = mix(col, mix(uPatternColor * 0.72, uPatternColor, h), patchA);
      col = mix(col, mix(uPatternSecColor * 0.75, uPatternSecColor, h), patchB);
    } else if (uPatternType == 4) {
      // 喜马拉雅 / 布偶重点色 (Siamese Points: 面具、双耳、四爪、尾巴)
      float snoutDist = length((restPos - vec3(0.0, 0.31, 0.43)) * vec3(1.1, 1.15, 1.0));
      float facePoint = 1.0 - smoothstep(0.12, 0.28 + soft * 0.25, snoutDist);
      float pawPoint = 1.0 - smoothstep(-0.48, -0.31 + soft * 0.15, restPos.y);
      float pointMask = clamp(max(max(facePoint, region.z * 0.95), max(pawPoint * 0.9, region.w * 0.95)), 0.0, 1.0);
      vec3 darkPoint = mix(uPatternColor * 0.72, uPatternColor * 1.12, h * 0.65);
      col = mix(col, darkPoint, pointMask);
    } else if (uPatternType == 5) {
      // 小熊猫 / 赤狐花纹 (白眉白颊 + 深色靴子 + 环纹大尾巴)
      float browSpot = 1.0 - smoothstep(0.035, 0.085, length(vec3(abs(restPos.x) - 0.105, restPos.y - 0.445, restPos.z - 0.365)));
      float cheekWhite = 1.0 - smoothstep(0.06, 0.145, length(vec3(abs(restPos.x) - 0.20, restPos.y - 0.26, restPos.z - 0.28)));
      float muzzleWhite = 1.0 - smoothstep(0.065, 0.135, length(restPos - vec3(0.0, 0.275, 0.42)));
      float earRim = region.z * smoothstep(0.22, 0.31, abs(restPos.x));
      float whiteMask = clamp(browSpot + cheekWhite + muzzleWhite + earRim * 0.7, 0.0, 1.0);

      // 深色小短腿靴子与胸腹
      float darkBoots = (1.0 - smoothstep(-0.48, -0.25, restPos.y)) * (1.0 - whiteMask);
      // 环纹尾巴
      float tailRing = region.w * smoothstep(-0.1, 0.35, sin(length(restPos - vec3(0.0, -0.28, -0.22)) * uPatternScale * 7.5));

      col = mix(col, mix(uPatternSecColor * 0.75, uPatternSecColor, h), clamp(darkBoots * 0.88 + tailRing * 0.68, 0.0, 1.0));
      col = mix(col, uPatternColor, whiteMask * 0.92);
    }

    // 耳廓内侧透出自然浅粉肉感
    float innerEar = region.z * smoothstep(0.06, 0.20, restPos.z) * (1.0 - h * 0.45);
    col = mix(col, vec3(1.0, 0.68, 0.74), innerEar * 0.58);

    // 交互喷枪挑染色
    if (dye.a > 0.001) {
      vec3 dyeGrad = mix(dye.rgb * 0.62, dye.rgb * 1.08, smoothstep(0.15, 0.95, h));
      col = mix(col, dyeGrad, clamp(dye.a, 0.0, 1.0));
    }

    // 湿毛光学变暗效应（液体折射降低漫反射散射）
    col *= mix(1.0, 0.58, uWetness);

    return col;
  }

  /**
   * Kajiya-Kay / Marschner 双瓣偏移各向异性毛发光照 + 逆光透射绒毛金边 (SSS)
   */
  vec3 shadeFurFiber(
    vec3 albedo,
    vec3 tangent,
    vec3 macroNormal,
    vec3 viewDir,
    float h,
    float randVal
  ) {
    vec3 T = normalize(tangent);
    vec3 N = normalize(macroNormal);
    vec3 V = normalize(viewDir);
    vec3 L = normalize(uKeyLightDir);
    vec3 Lrim = normalize(uRimLightDir);

    // 根部到尖端解析体积自遮蔽 (Root AO)
    float ao = mix(1.0 - uAoIntensity * 0.88, 1.0, pow(clamp(h, 0.0, 1.0), 0.58));

    // 包裹漫反射 (Wrap Diffuse) 赋予绒团柔和饱满体积
    float wrapNdotL = clamp((dot(N, L) + 0.55) / 1.55, 0.0, 1.0);
    float shadowCurve = mix(0.32, 1.0, smoothstep(0.0, 0.85, wrapNdotL));

    // 半球天光环境漫反射
    vec3 hemi = mix(uGroundAmbient, uSkyAmbient, N.y * 0.5 + 0.5);
    vec3 diffuse = albedo * (hemi * 0.72 + uKeyLightColor * wrapNdotL * 0.88) * ao;

    // Kajiya-Kay 双层毛鳞片偏移切线
    float shiftJitter = (randVal - 0.5) * 0.08;
    vec3 T1 = normalize(T + N * (uSpecShift1 + shiftJitter));
    vec3 T2 = normalize(T - N * (uSpecShift1 * 1.55 - shiftJitter));

    vec3 H = normalize(L + V);
    float TdotH1 = clamp(dot(T1, H), -1.0, 1.0);
    float TdotH2 = clamp(dot(T2, H), -1.0, 1.0);
    float sinTH1 = sqrt(max(0.0, 1.0 - TdotH1 * TdotH1));
    float sinTH2 = sqrt(max(0.0, 1.0 - TdotH2 * TdotH2));

    float effRough = mix(uRoughness, uRoughness * 0.35, uWetness);
    float exp1 = mix(180.0, 22.0, effRough);
    float exp2 = mix(75.0, 10.0, effRough);

    float dirAtten = smoothstep(-0.45, 0.25, dot(N, L));
    float spec1 = pow(sinTH1, exp1) * uSpecPrimary * mix(1.0, 1.85, uWetness) * dirAtten;
    float spec2 = pow(sinTH2, exp2) * uSpecSecondary * dirAtten;

    // 虹彩薄膜干涉色 (Iridescence)
    vec3 iriTint = 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + dot(V, T) * 1.6 + h * 0.7));
    vec3 secTint = mix(albedo * 1.35 + 0.08, iriTint, uIridescence);

    vec3 specular = (uKeyLightColor * spec1 * 0.85 + secTint * uKeyLightColor * spec2) * smoothstep(0.08, 0.65, h);

    // 逆光透射散射 (Forward Rim Backlight SSS) —— 毛茸茸空气感灵魂！
    float backScatterKey = pow(clamp(dot(V, -L), 0.0, 1.0), 2.6);
    float backScatterRim = pow(clamp(dot(V, -Lrim), 0.0, 1.0), 2.1);
    float fresnelRim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.4);
    float tipTranslucency = mix(0.25, 1.0, pow(h, 0.65));

    vec3 sssTint = mix(albedo, vec3(1.0, 0.92, 0.82), 0.35);
    vec3 sss = sssTint * uBacklightSSS * tipTranslucency * (
      uKeyLightColor * (backScatterKey * 0.55 + fresnelRim * 0.32 * shadowCurve) +
      uRimLightColor * (backScatterRim * 0.68 + fresnelRim * 0.52)
    );

    return diffuse + specular + sss;
  }
`;

export const SHELL_VERTEX_SHADER = /* glsl */ `
  attribute vec4 aRegion;
  attribute vec2 aExtra;
  attribute vec4 aBones;
  attribute float aLayerIndex;

  uniform float uShellCount;
  uniform float uFurLength;
  uniform float uFaceMul;
  uniform float uManeMul;
  uniform float uEarMul;
  uniform float uBellyMul;
  uniform float uTailMul;
  uniform float uGravity;
  uniform vec3 uInertiaOffset;

  varying vec3 vRestPos;
  varying vec3 vWorldPos;
  varying vec3 vAnimNorm;
  varying vec4 vRegion;
  varying float vBelly;
  varying float vFurMask;
  varying float vShellFrac;

  ${COMMON_FUR_GLSL}

  void main() {
    float layerIdx = aLayerIndex;
    float h = layerIdx / max(1.0, uShellCount);
    vShellFrac = h;
    vRestPos = position;
    vRegion = aRegion;
    vBelly = aExtra.x;
    vFurMask = aExtra.y;

    vec3 animPos;
    vec3 animNorm;
    float shakeTwist;
    applyPetSkeleton(position, normal, aBones, animPos, animNorm, shakeTwist);

    float regMul = 1.0;
    regMul = mix(regMul, uFaceMul, aRegion.x);
    regMul = mix(regMul, uManeMul, aRegion.y);
    regMul = mix(regMul, uEarMul, aRegion.z);
    regMul = mix(regMul, uBellyMul, aExtra.x);
    regMul = mix(regMul, uTailMul, aRegion.w);

    // 底绒层控制在针毛总长的 58% 以内，充当蓬松高密绒毛垫
    float shellLen = uFurLength * 0.58 * regMul * aExtra.y;
    float bend = h * h;

    vec3 displaced = animPos + animNorm * (shellLen * h);
    displaced += vec3(0.0, -uGravity * 0.35, 0.0) * shellLen * bend;
    displaced += uInertiaOffset * 0.45 * bend;

    vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
    vWorldPos = worldPos.xyz;
    vAnimNorm = normalize(mat3(modelMatrix) * animNorm);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const SHELL_FRAGMENT_SHADER = /* glsl */ `
  uniform float uUndercoatDensity;

  varying vec3 vRestPos;
  varying vec3 vWorldPos;
  varying vec3 vAnimNorm;
  varying vec4 vRegion;
  varying float vBelly;
  varying float vFurMask;
  varying float vShellFrac;

  ${COMMON_FUR_GLSL}

  void main() {
    float h = vShellFrac;

    // 第 0 层为温润底皮，完全不透明防穿透
    if (h > 0.001) {
      if (vFurMask < 0.05) discard;
      vec3 cellCoord = vRestPos * 95.0;
      float fiber = noise3D(cellCoord);
      float fiberFine = noise3D(cellCoord * 2.3 + 7.1);
      float combined = fiber * 0.68 + fiberFine * 0.32;

      // 随层高收细阈值，模拟浓密底绒尖端消隐
      float threshold = mix(1.0 - uUndercoatDensity * 0.95, 0.94, pow(h, 0.82));
      if (combined < threshold) discard;
    }

    vec3 coatCol = evaluateCoatColor(vRestPos, vRegion, vBelly, h * 0.55, vec4(0.0));
    // 底层皮肤略带暖粉肤色衬底
    if (h <= 0.001) {
      coatCol = mix(coatCol * 0.72, vec3(0.86, 0.68, 0.64), 0.16);
    }

    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 T = normalize(vAnimNorm + vec3(0.0, 0.25, 0.0));
    vec3 lit = shadeFurFiber(coatCol, T, vAnimNorm, V, h * 0.55, 0.5);

    gl_FragColor = vec4(lit, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export const STRAND_VERTEX_SHADER = /* glsl */ `
  attribute vec3 iRootPos;
  attribute vec3 iNormal;
  attribute vec3 iClumpCenter;
  attribute vec4 iRegion;
  attribute vec4 iExtra; // x: wBelly, y: furMask, z: randSeed, w: randLen
  attribute vec4 iBones;
  attribute vec4 iGroom; // xyz: groomOffset, w: trimMul
  attribute vec4 iDye;   // rgb: dyeColor, a: dyeWeight

  uniform float uFurLength;
  uniform float uRootThickness;
  uniform float uTipTaper;
  uniform float uFaceMul;
  uniform float uManeMul;
  uniform float uEarMul;
  uniform float uBellyMul;
  uniform float uTailMul;

  uniform float uClumpStrength;
  uniform float uCurlStrength;
  uniform float uCurlFrequency;
  uniform float uFrizzStrength;
  uniform float uFrizzScale;

  uniform float uGravity;
  uniform float uStiffness;
  uniform vec3 uInertiaOffset;
  uniform float uWindStrength;
  uniform float uWindSpeed;
  uniform vec3 uWindDir;

  // 交互式吹风机与轻抚触碰场
  uniform float uDryerActive;
  uniform vec3 uDryerPos;
  uniform vec3 uDryerNormal;
  uniform float uDryerRadius;
  uniform float uDryerStrength;

  uniform float uTouchActive;
  uniform vec3 uTouchPos;
  uniform float uTouchRadius;

  varying float vHeight;
  varying float vRand;
  varying vec3 vRestPos;
  varying vec4 vRegion;
  varying float vBelly;
  varying vec4 vDye;
  varying vec3 vTangent;
  varying vec3 vMacroNormal;
  varying vec3 vWorldPos;

  ${COMMON_FUR_GLSL}

  void main() {
    float h = position.y; // [0, 1] 沿发丝高度
    float side = position.x; // [-0.5, 0.5] 刀片横向坐标

    vHeight = h;
    vRand = iExtra.z;
    vRestPos = iRootPos;
    vRegion = iRegion;
    vBelly = iExtra.x;
    vDye = iDye;

    // 1. 骨骼蒙皮变换发根、法线、毛簇中心与梳理方向
    vec3 rootPos, rootNorm;
    float shakeTwist;
    applyPetSkeleton(iRootPos, iNormal, iBones, rootPos, rootNorm, shakeTwist);

    vec3 clumpRoot, clumpNorm;
    float dummyTwist;
    applyPetSkeleton(iClumpCenter, iNormal, iBones, clumpRoot, clumpNorm, dummyTwist);

    vec4 qH = slerpIdentity(uHeadQuat, iBones.x);
    vec4 qT = slerpIdentity(uTailQuat, iBones.y);
    vec3 groomWorld = quatRotate(qT, quatRotate(qH, iGroom.xyz));

    // 2. 解剖分区毛长计算
    float regMul = 1.0;
    regMul = mix(regMul, uFaceMul, iRegion.x);
    regMul = mix(regMul, uManeMul, iRegion.y);
    regMul = mix(regMul, uEarMul, iRegion.z);
    regMul = mix(regMul, uBellyMul, iExtra.x);
    regMul = mix(regMul, uTailMul, iRegion.w);

    float strandLen = uFurLength * regMul * iExtra.y * iGroom.w * (0.76 + 0.44 * iExtra.w);

    // 构造局部正交基 (rootNorm, B1, B2)
    vec3 upRef = abs(rootNorm.y) < 0.92 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 B1 = normalize(cross(upRef, rootNorm));
    vec3 B2 = cross(rootNorm, B1);

    // 3. 生长主方向 + 梳刷记忆方向
    vec3 growDir = normalize(rootNorm + groomWorld * 1.45 + vec3(0.0, -0.14, -0.06));

    // 4. 外力场合成（随刚度减弱，随高度 h^1.8 弯曲）
    float flex = 1.0 - uStiffness * 0.68;
    float bendFactor = pow(h, 1.75);

    vec3 force = vec3(0.0);
    // 重力自然下垂（湿毛时加重下垂）
    force += vec3(0.0, -uGravity * mix(1.0, 2.1, uWetness), 0.0) * flex;

    // 弹簧惯性偏移 + 抖毛离心甩动
    force += uInertiaOffset * (0.85 + 0.35 * iExtra.w);
    if (abs(shakeTwist) > 0.001) {
      vec3 radialDir = normalize(vec3(-rootPos.y, rootPos.x, 0.0) + 1e-4);
      force += radialDir * shakeTwist * 0.55;
    }

    // 自然环境微风与阵风湍流
    if (uWindStrength > 0.001) {
      float gust = sin(uTime * uWindSpeed * 2.1 + dot(rootPos, vec3(3.7, 2.4, 3.1)) + iExtra.z * 3.5);
      float flutter = cos(uTime * uWindSpeed * 5.3 + iExtra.z * 19.0) * 0.32;
      force += uWindDir * uWindStrength * (0.65 + 0.45 * gust + flutter) * flex;
    }

    // 吹风机强力高速气旋拨毛！
    if (uDryerActive > 0.5) {
      vec3 toRoot = rootPos - uDryerPos;
      float dDryer = length(toRoot);
      float dryerFalloff = 1.0 - smoothstep(0.0, uDryerRadius * 1.45, dDryer);
      if (dryerFalloff > 0.001) {
        vec3 tangPush = toRoot - uDryerNormal * dot(toRoot, uDryerNormal);
        float tLen = length(tangPush);
        vec3 radialOut = tLen > 0.002 ? tangPush / tLen : B1;
        // 高频气旋抖动模拟真实吹风机吹开底层绒毛
        float highFreq = sin(uTime * 46.0 + iExtra.z * 40.0) * 0.16;
        float highFreq2 = cos(uTime * 39.0 + iExtra.w * 35.0) * 0.16;
        vec3 flutterVec = B1 * highFreq + B2 * highFreq2;
        force += (radialOut * 1.55 - rootNorm * 0.45 + flutterVec) * dryerFalloff * uDryerStrength * 1.65;
      }
    } else if (uTouchActive > 0.5) {
      // 鼠标轻柔抚摸拨开绒毛
      vec3 toTouch = rootPos - uTouchPos;
      float dTouch = length(toTouch);
      float touchFalloff = 1.0 - smoothstep(0.0, uTouchRadius, dTouch);
      if (touchFalloff > 0.001) {
        vec3 pushDir = normalize(toTouch + B1 * 0.05);
        force += (pushDir * 0.45 - rootNorm * 0.22) * touchFalloff;
      }
    }

    // 基础弯曲脊线轨迹
    vec3 spinePos = rootPos + growDir * (strandLen * h) + force * (strandLen * bendFactor);

    // 5. Voronoi 毛簇收拢 (Clumping —— 告别塑料牙刷感的核心！)
    float effClump = clamp(uClumpStrength + uWetness * 0.38, 0.0, 0.96);
    if (effClump > 0.001) {
      vec3 clumpAxis = normalize(clumpNorm + groomWorld * 1.35 + vec3(0.0, -0.14, -0.06));
      vec3 clumpSpine = clumpRoot + clumpAxis * (strandLen * h) + force * (strandLen * bendFactor);
      float clumpProfile = pow(h, 1.25) * effClump;
      spinePos = mix(spinePos, clumpSpine, clumpProfile);
    }

    // 6. 切线空间三维螺旋卷曲 (3D Helical Curl — 泰迪/比熊卷毛)
    if (uCurlStrength > 0.001) {
      float phase = h * uCurlFrequency + iExtra.z * 6.28318;
      float curlRadius = uCurlStrength * strandLen * 0.24 * smoothstep(0.05, 0.65, h);
      spinePos += (B1 * cos(phase) + B2 * sin(phase)) * curlRadius;
    }

    // 7. 多频自然毛躁微扰 (Frizz)
    if (uFrizzStrength > 0.001) {
      float fz1 = sin(h * uFrizzScale + iExtra.z * 31.7);
      float fz2 = cos(h * uFrizzScale * 1.37 + iExtra.w * 27.3);
      float frizzAmp = uFrizzStrength * strandLen * 0.14 * pow(h, 0.85) * (1.0 - uWetness * 0.6);
      spinePos += (B1 * fz1 + B2 * fz2) * frizzAmp;
    }

    // 解析近似发丝切线方向用于 Kajiya-Kay 各向异性高光与朝向屏幕展宽
    vec3 approxTangent = normalize(growDir + force * (1.75 * pow(max(h, 0.05), 0.75)));

    vec4 worldSpine = modelMatrix * vec4(spinePos, 1.0);
    vec3 worldTangent = normalize(mat3(modelMatrix) * approxTangent);
    vec3 worldMacroNorm = normalize(mat3(modelMatrix) * rootNorm);

    // 8. 视角对齐锥形丝带展宽 + 圆柱截面伪法线弯曲
    vec3 toCam = normalize(cameraPosition - worldSpine.xyz);
    vec3 ribbonRight = cross(toCam, worldTangent);
    float rLen = length(ribbonRight);
    ribbonRight = rLen > 0.001 ? ribbonRight / rLen : normalize(mat3(modelMatrix) * B1);

    float taper = max(0.04, 1.0 - pow(h, uTipTaper));
    float width = uRootThickness * taper * mix(1.0, 0.68, uWetness) * smoothstep(0.0, 0.08, iExtra.y * iGroom.w);

    vec3 finalWorldPos = worldSpine.xyz + ribbonRight * (side * width);

    vWorldPos = finalWorldPos;
    vTangent = worldTangent;
    // 横向微倾宏观法线，使每根扁平丝带在光照下呈现饱满圆柱立体感
    vMacroNormal = normalize(worldMacroNorm + ribbonRight * (side * 0.55));

    gl_Position = projectionMatrix * viewMatrix * vec4(finalWorldPos, 1.0);
  }
`;

export const STRAND_FRAGMENT_SHADER = /* glsl */ `
  varying float vHeight;
  varying float vRand;
  varying vec3 vRestPos;
  varying vec4 vRegion;
  varying float vBelly;
  varying vec4 vDye;
  varying vec3 vTangent;
  varying vec3 vMacroNormal;
  varying vec3 vWorldPos;

  ${COMMON_FUR_GLSL}

  void main() {
    vec3 albedo = evaluateCoatColor(vRestPos, vRegion, vBelly, vHeight, vDye);
    // 每根毛丝微小的天然色素明度差异，消除CG机械塑料感
    albedo *= (0.91 + 0.18 * vRand);

    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 color = shadeFurFiber(albedo, vTangent, vMacroNormal, V, vHeight, vRand);

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
