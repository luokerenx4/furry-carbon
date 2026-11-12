import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { DEFAULT_PARAMS } from './presets.js';
import { FurPetSystem } from './furSystem.js';
import { setupStudioUI } from './ui.js';

const params = { ...DEFAULT_PARAMS };

const toolState = {
  activeTool: 'orbit', // 'orbit' | 'comb' | 'trim' | 'grow' | 'dye' | 'dryer'
  brushRadius: 0.28,
  brushStrength: 0.65,
  dyeColor: '#ff6b9d',
};

// 1. 初始化渲染器与摄影棚场景
const container = document.getElementById('canvas-container');
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();

// 生成真实柔光摄影棚 PMREM 环境贴图，让晶亮眼球角膜与湿鼻头拥有灵动环境反光
const pmremGenerator = new THREE.PMREMGenerator(renderer);
const roomEnv = new RoomEnvironment();
scene.environment = pmremGenerator.fromScene(roomEnv, 0.04).texture;
scene.environmentIntensity = 0.55;
roomEnv.dispose();
pmremGenerator.dispose();

const camera = new THREE.PerspectiveCamera(
  35,
  window.innerWidth / window.innerHeight,
  0.1,
  50
);
camera.position.set(0.24, 0.22, 3.68);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.target.set(0, 0.08, 0.0);
controls.minDistance = 1.45;
controls.maxDistance = 5.6;
controls.maxPolarAngle = Math.PI * 0.62;
controls.minPolarAngle = Math.PI * 0.16;

// 2. 摄影棚柔和渐变背景穹顶与软垫展台
const bgUniforms = {
  uTopColor: { value: new THREE.Color('#231d29') },
  uBottomColor: { value: new THREE.Color('#121018') },
  uGlowColor: { value: new THREE.Color('#4a3228') },
};

const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(22, 32, 24),
  new THREE.ShaderMaterial({
    uniforms: bgUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTopColor;
      uniform vec3 uBottomColor;
      uniform vec3 uGlowColor;
      varying vec3 vPos;
      void main() {
        vec3 d = normalize(vPos);
        float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 col = mix(uBottomColor, uTopColor, smoothstep(0.15, 0.88, h));
        float centerGlow = pow(max(0.0, 1.0 - length(d.xy - vec2(0.0, 0.06)) * 0.95), 2.4);
        col += uGlowColor * centerGlow * 0.55;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
);
scene.add(skyDome);

// 精致圆润展台底座 + 柔和接触阴影垫
const pedestalGroup = new THREE.Group();
pedestalGroup.position.y = -0.535;
scene.add(pedestalGroup);

const cushionGeo = new THREE.CylinderGeometry(0.68, 0.76, 0.085, 64);
const cushionMat = new THREE.MeshStandardMaterial({
  color: 0x2c2630,
  roughness: 0.72,
  metalness: 0.06,
});
const cushionMesh = new THREE.Mesh(cushionGeo, cushionMat);
cushionMesh.position.y = -0.042;
pedestalGroup.add(cushionMesh);

const rimRingGeo = new THREE.TorusGeometry(0.71, 0.011, 16, 72);
const rimRingMat = new THREE.MeshStandardMaterial({
  color: 0xd49b6a,
  roughness: 0.28,
  metalness: 0.78,
});
const rimRing = new THREE.Mesh(rimRingGeo, rimRingMat);
rimRing.rotation.x = Math.PI * 0.5;
rimRing.position.y = -0.01;
pedestalGroup.add(rimRing);

const contactShadow = new THREE.Mesh(
  new THREE.PlaneGeometry(1.38, 1.38),
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv * 2.0 - 1.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        float r = length(vUv * vec2(1.0, 0.92));
        float alpha = pow(max(0.0, 1.0 - r), 2.1) * 0.68;
        gl_FragColor = vec4(0.02, 0.01, 0.02, alpha);
      }
    `,
  })
);
contactShadow.rotation.x = -Math.PI * 0.5;
contactShadow.position.y = 0.002;
pedestalGroup.add(contactShadow);

// 3. 交互气旋 / 染雾微粒子反馈系统
const PARTICLE_COUNT = 96;
const pPositions = new Float32Array(PARTICLE_COUNT * 3);
const pVelocities = new Float32Array(PARTICLE_COUNT * 3);
const pLives = new Float32Array(PARTICLE_COUNT);
const pColors = new Float32Array(PARTICLE_COUNT * 3);

const particleGeo = new THREE.BufferGeometry();
particleGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
particleGeo.setAttribute('aLife', new THREE.BufferAttribute(pLives, 1));
particleGeo.setAttribute('aColor', new THREE.BufferAttribute(pColors, 3));

const particleMesh = new THREE.Points(
  particleGeo,
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aLife;
      attribute vec3 aColor;
      varying float vLife;
      varying vec3 vColor;
      void main() {
        vLife = aLife;
        vColor = aColor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (18.0 * sin(aLife * 3.14159)) / max(0.5, -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vLife;
      varying vec3 vColor;
      void main() {
        if (vLife <= 0.001) discard;
        vec2 c = gl_PointCoord * 2.0 - 1.0;
        float d = dot(c, c);
        if (d > 1.0) discard;
        float alpha = pow(1.0 - d, 1.8) * sin(vLife * 3.14159) * 0.65;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
  })
);
particleMesh.frustumCulled = false;
scene.add(particleMesh);

let particleCursor = 0;
function spawnFeedbackParticles(worldOrigin, worldNormal, colorHex, count = 3) {
  const c = new THREE.Color(colorHex);
  for (let n = 0; n < count; n++) {
    const i = particleCursor;
    particleCursor = (particleCursor + 1) % PARTICLE_COUNT;

    const randVec = new THREE.Vector3(
      Math.random() - 0.5,
      Math.random() - 0.5,
      Math.random() - 0.5
    ).normalize();
    const tang = randVec.sub(worldNormal.clone().multiplyScalar(randVec.dot(worldNormal))).normalize();

    pPositions[i * 3] = worldOrigin.x + tang.x * 0.04 + worldNormal.x * 0.05;
    pPositions[i * 3 + 1] = worldOrigin.y + tang.y * 0.04 + worldNormal.y * 0.05;
    pPositions[i * 3 + 2] = worldOrigin.z + tang.z * 0.04 + worldNormal.z * 0.05;

    const speed = 0.65 + Math.random() * 0.75;
    pVelocities[i * 3] = (tang.x * 0.85 + worldNormal.x * 0.35) * speed;
    pVelocities[i * 3 + 1] = (tang.y * 0.85 + worldNormal.y * 0.35 + 0.15) * speed;
    pVelocities[i * 3 + 2] = (tang.z * 0.85 + worldNormal.z * 0.35) * speed;

    pColors[i * 3] = c.r;
    pColors[i * 3 + 1] = c.g;
    pColors[i * 3 + 2] = c.b;
    pLives[i] = 1.0;
  }
}

function updateFeedbackParticles(dt) {
  let dirty = false;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    if (pLives[i] > 0) {
      pLives[i] = Math.max(0, pLives[i] - dt * 2.2);
      pPositions[i * 3] += pVelocities[i * 3] * dt;
      pPositions[i * 3 + 1] += pVelocities[i * 3 + 1] * dt;
      pPositions[i * 3 + 2] += pVelocities[i * 3 + 2] * dt;
      dirty = true;
    }
  }
  if (dirty) {
    particleGeo.attributes.position.needsUpdate = true;
    particleGeo.attributes.aLife.needsUpdate = true;
    particleGeo.attributes.aColor.needsUpdate = true;
  }
}

// 4. Three.js 实体灯光（用于晶亮眼球高光、湿润鼻头与展台同步照明）
const keyLight = new THREE.DirectionalLight(0xfff4e4, 2.2);
const rimLight = new THREE.DirectionalLight(0xffcf96, 1.8);
const hemiLight = new THREE.HemisphereLight(0x8899bb, 0x3b2d26, 1.1);
scene.add(keyLight, rimLight, hemiLight);

// 5. 初始化核心 GPU 双层毛发萌宠系统
const furSystem = new FurPetSystem(scene, params);

const LIGHTING_THEMES = {
  warmSun: {
    keyColor: '#fff2df',
    rimColor: '#ffbe78',
    skyAmb: '#7988ad',
    groundAmb: '#473328',
    bgTop: '#261f2b',
    bgBot: '#120f17',
    bgGlow: '#593927',
    cushion: '#2d252b',
  },
  softStudio: {
    keyColor: '#ffffff',
    rimColor: '#cfe4ff',
    skyAmb: '#8fa2c4',
    groundAmb: '#3d404d',
    bgTop: '#232836',
    bgBot: '#11141c',
    bgGlow: '#36415c',
    cushion: '#252936',
  },
  meadow: {
    keyColor: '#fff8e3',
    rimColor: '#d9ff9c',
    skyAmb: '#7ba8bd',
    groundAmb: '#35452b',
    bgTop: '#1c2b2a',
    bgBot: '#0f1716',
    bgGlow: '#334f3b',
    cushion: '#232e29',
  },
  cyberNeon: {
    keyColor: '#9cf6ff',
    rimColor: '#ff5cd6',
    skyAmb: '#4d469e',
    groundAmb: '#29123b',
    bgTop: '#16112e',
    bgBot: '#090714',
    bgGlow: '#4d1b63',
    cushion: '#1c1530',
  },
};

function updateStudioLighting() {
  const theme = LIGHTING_THEMES[params.lightingPreset] || LIGHTING_THEMES.warmSun;
  const azRad = (params.lightAzimuth * Math.PI) / 180;

  const keyDir = new THREE.Vector3(
    Math.sin(azRad) * 0.78,
    0.66,
    Math.cos(azRad) * 0.78
  ).normalize();

  const rimDir = new THREE.Vector3(
    -Math.sin(azRad + 0.45) * 0.82,
    0.48,
    -Math.cos(azRad + 0.45) * 0.82
  ).normalize();

  const u = furSystem.sharedUniforms;
  u.uKeyLightDir.value.copy(keyDir);
  u.uKeyLightColor.value.set(theme.keyColor);

  u.uRimLightDir.value.copy(rimDir);
  u.uRimLightColor.value.set(theme.rimColor).multiplyScalar(params.rimLightIntensity);

  u.uSkyAmbient.value.set(theme.skyAmb);
  u.uGroundAmbient.value.set(theme.groundAmb);

  keyLight.position.copy(keyDir).multiplyScalar(5);
  keyLight.color.set(theme.keyColor);

  rimLight.position.copy(rimDir).multiplyScalar(5);
  rimLight.color.set(theme.rimColor);
  rimLight.intensity = 1.4 * params.rimLightIntensity;

  hemiLight.color.set(theme.skyAmb);
  hemiLight.groundColor.set(theme.groundAmb);

  bgUniforms.uTopColor.value.set(theme.bgTop);
  bgUniforms.uBottomColor.value.set(theme.bgBot);
  bgUniforms.uGlowColor.value.set(theme.bgGlow);
  cushionMat.color.set(theme.cushion);
}

updateStudioLighting();

// 6. 交互式射线拾取：抚摸、顺毛梳刷、修剪推子、生毛、挑染喷枪与强力吹风机
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2(0, 0);
const brushCursor = document.getElementById('brush-cursor');

let isPointerDown = false;
let prevHitLocal = null;
let prevAzimuth = controls.getAzimuthalAngle();
let prevPolar = controls.getPolarAngle();

function updateBrushRingUI(clientX, clientY, hitDistance) {
  if (toolState.activeTool === 'orbit') {
    brushCursor.classList.add('hidden');
    return;
  }
  brushCursor.classList.remove('hidden');
  brushCursor.classList.toggle('dryer-mode', toolState.activeTool === 'dryer');

  const dist = hitDistance || camera.position.distanceTo(controls.target);
  const fovRad = (camera.fov * Math.PI) / 180;
  const worldPerPixel = (2 * Math.tan(fovRad / 2) * dist) / window.innerHeight;
  const pixelDiameter = Math.max(24, (toolState.brushRadius * 2) / worldPerPixel);

  brushCursor.style.left = `${clientX}px`;
  brushCursor.style.top = `${clientY}px`;
  brushCursor.style.width = `${pixelDiameter}px`;
  brushCursor.style.height = `${pixelDiameter}px`;
}

function performSurfaceInteraction(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointerNDC, camera);
  const hits = furSystem.raycastMesh ? raycaster.intersectObject(furSystem.raycastMesh, false) : [];
  const hit = hits[0] || null;

  updateBrushRingUI(e.clientX, e.clientY, hit?.distance);

  const u = furSystem.sharedUniforms;

  if (!hit) {
    u.uTouchActive.value = 0;
    if (!isPointerDown || toolState.activeTool !== 'dryer') {
      u.uDryerActive.value = 0;
    }
    prevHitLocal = null;
    return;
  }

  const localPt = furSystem.rootGroup.worldToLocal(hit.point.clone());
  const localNorm = hit.face ? hit.face.normal.clone().normalize() : new THREE.Vector3(0, 0, 1);

  if (toolState.activeTool === 'orbit') {
    u.uTouchActive.value = 1;
    u.uTouchPos.value.copy(localPt);
    u.uTouchRadius.value = 0.22;
    u.uDryerActive.value = 0;
    return;
  }

  u.uTouchActive.value = 0;

  if (toolState.activeTool === 'dryer') {
    u.uDryerActive.value = 1;
    u.uDryerPos.value.copy(localPt);
    u.uDryerNormal.value.copy(localNorm);
    u.uDryerRadius.value = toolState.brushRadius;
    u.uDryerStrength.value = isPointerDown
      ? toolState.brushStrength * 1.18
      : toolState.brushStrength * 0.38;
    if (isPointerDown) {
      furSystem.excitement = Math.min(1.0, furSystem.excitement + 0.03);
      spawnFeedbackParticles(hit.point, localNorm, '#8ee5ff', 4);
    }
    return;
  }

  u.uDryerActive.value = 0;

  if (!isPointerDown) {
    prevHitLocal = localPt;
    return;
  }

  let strokeDir = null;
  if (prevHitLocal) {
    strokeDir = localPt.clone().sub(prevHitLocal);
    if (strokeDir.lengthSq() < 1e-6) strokeDir = null;
  }
  prevHitLocal = localPt;

  furSystem.applyGroomBrush({
    mode: toolState.activeTool,
    localPoint: localPt,
    localStrokeDir: strokeDir,
    radius: toolState.brushRadius,
    strength: toolState.brushStrength,
    dyeColor: toolState.dyeColor,
  });

  if (toolState.activeTool === 'dye') {
    spawnFeedbackParticles(hit.point, localNorm, toolState.dyeColor, 3);
  } else if (toolState.activeTool === 'trim') {
    spawnFeedbackParticles(hit.point, localNorm, params.tipColor, 2);
  }
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  isPointerDown = true;

  if (toolState.activeTool === 'orbit') {
    raycaster.setFromCamera(pointerNDC, camera);
    if (furSystem.facialGroup?.userData?.noseMesh) {
      const noseHits = raycaster.intersectObject(furSystem.facialGroup.userData.noseMesh, false);
      if (noseHits.length > 0) {
        furSystem.triggerHappyTilt();
      }
    }
  } else {
    controls.enabled = false;
    performSurfaceInteraction(e);
  }
});

window.addEventListener('pointermove', (e) => {
  const onCanvas = e.target === renderer.domElement;
  if (!onCanvas && !isPointerDown) {
    brushCursor.classList.add('hidden');
    furSystem.sharedUniforms.uTouchActive.value = 0;
    furSystem.sharedUniforms.uDryerActive.value = 0;
    return;
  }
  performSurfaceInteraction(e);
});

window.addEventListener('pointerup', () => {
  isPointerDown = false;
  prevHitLocal = null;
  controls.enabled = toolState.activeTool === 'orbit';
  if (toolState.activeTool !== 'dryer') {
    furSystem.sharedUniforms.uDryerActive.value = 0;
  }
});

// 7. 挂载 UI 工作台面板
setupStudioUI({
  params,
  toolState,
  onParamsChange: () => {
    furSystem.syncParams(params);
    refreshTelemetryLabels();
  },
  onSpeciesChange: (sp) => {
    furSystem.buildSpecies(sp);
    furSystem.syncParams(params);
    furSystem.triggerHappyTilt();
    refreshTelemetryLabels();
  },
  onLightingChange: () => {
    updateStudioLighting();
  },
  onToolChange: (tool) => {
    controls.enabled = tool === 'orbit';
    if (tool !== 'dryer') {
      furSystem.sharedUniforms.uDryerActive.value = 0;
    }
  },
  onShake: () => {
    furSystem.triggerShake();
  },
  onHappyTilt: () => {
    furSystem.triggerHappyTilt();
  },
  onResetGroom: () => {
    furSystem.resetGrooming();
  },
  onScreenshot: () => {
    renderer.render(scene, camera);
    const dataURL = renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `fluffylab-${params.species}-snapshot.png`;
    a.click();
  },
});

// 8. 顶部实时性能遥测与主渲染循环
const elFps = document.getElementById('stat-fps');
const elStrands = document.getElementById('stat-strands');
const elShells = document.getElementById('stat-shells');
const elTris = document.getElementById('stat-tris');

function refreshTelemetryLabels() {
  const stats = furSystem.getTelemetryStats();
  elStrands.textContent = stats.strands.toLocaleString();
  elShells.textContent = `${stats.shells} 层`;
  const triM = stats.totalTriangles / 1e6;
  elTris.textContent = triM >= 1.0
    ? `${triM.toFixed(2)}M`
    : `${Math.round(stats.totalTriangles / 1e3)}K`;
}
refreshTelemetryLabels();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
let frameAccum = 0;
let frames = 0;

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(0.05, clock.getDelta());
  const elapsed = clock.elapsedTime;

  controls.update();

  // 将相机环绕角速度注入毛发惯性弹簧，拖拽旋转时绒毛呈现真实物理滞后与回弹
  const curAz = controls.getAzimuthalAngle();
  const curPol = controls.getPolarAngle();
  let dAz = curAz - prevAzimuth;
  if (dAz > Math.PI) dAz -= Math.PI * 2;
  if (dAz < -Math.PI) dAz += Math.PI * 2;
  const dPol = curPol - prevPolar;
  prevAzimuth = curAz;
  prevPolar = curPol;

  if (Math.abs(dAz) > 1e-4 || Math.abs(dPol) > 1e-4) {
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const impulse = right.multiplyScalar(dAz * 3.2).add(up.multiplyScalar(-dPol * 2.4));
    furSystem.addInertiaImpulse(impulse.x, impulse.y, impulse.z);
  }

  furSystem.update(dt, elapsed, pointerNDC);
  updateFeedbackParticles(dt);
  renderer.render(scene, camera);

  frameAccum += dt;
  frames++;
  if (frameAccum >= 0.45) {
    elFps.textContent = String(Math.round(frames / frameAccum));
    frameAccum = 0;
    frames = 0;
  }
}

animate();
