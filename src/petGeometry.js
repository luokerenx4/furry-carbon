import * as THREE from 'three';

function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0.0) / k;
  return Math.min(a, b) - h * h * h * k * (1.0 / 6.0);
}

function sdSphere(px, py, pz, cx, cy, cz, r) {
  const dx = px - cx;
  const dy = py - cy;
  const dz = pz - cz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
}

function sdEllipsoid(px, py, pz, cx, cy, cz, rx, ry, rz) {
  const dx = (px - cx) / rx;
  const dy = (py - cy) / ry;
  const dz = (pz - cz) / rz;
  const k0 = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (k0 < 1e-6) return -Math.min(rx, ry, rz);
  const dx2 = (px - cx) / (rx * rx);
  const dy2 = (py - cy) / (ry * ry);
  const dz2 = (pz - cz) / (rz * rz);
  const k1 = Math.sqrt(dx2 * dx2 + dy2 * dy2 + dz2 * dz2);
  return (k0 * (k0 - 1.0)) / k1;
}

function sdCapsule(px, py, pz, ax, ay, az, bx, by, bz, r) {
  const pax = px - ax, pay = py - ay, paz = pz - az;
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const dotBA = bax * bax + bay * bay + baz * baz;
  const h = Math.max(0.0, Math.min(1.0, (pax * bax + pay * bay + paz * baz) / dotBA));
  const dx = pax - bax * h;
  const dy = pay - bay * h;
  const dz = paz - baz * h;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
}

function sdTaperedCapsule(px, py, pz, ax, ay, az, bx, by, bz, ra, rb) {
  const pax = px - ax, pay = py - ay, paz = pz - az;
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const dotBA = bax * bax + bay * bay + baz * baz;
  const h = Math.max(0.0, Math.min(1.0, (pax * bax + pay * bay + paz * baz) / dotBA));
  const dx = pax - bax * h;
  const dy = pay - bay * h;
  const dz = paz - baz * h;
  const r = ra + (rb - ra) * h;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0.0, Math.min(1.0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3.0 - 2.0 * t);
}

/**
 * 定义四个物种的解剖参数配置（眼位、鼻位、SDF 躯干/耳朵/尾巴结构）
 */
export function getSpeciesConfig(species) {
  switch (species) {
    case 'kitten':
      return {
        headPivot: new THREE.Vector3(0, 0.24, 0.1),
        tailPivot: new THREE.Vector3(0, -0.34, -0.22),
        eyeL: new THREE.Vector3(-0.146, 0.362, 0.402),
        eyeR: new THREE.Vector3(0.146, 0.362, 0.402),
        eyeRadius: 0.068,
        nosePos: new THREE.Vector3(0, 0.295, 0.488),
        noseScale: new THREE.Vector3(0.038, 0.027, 0.03),
        noseColor: 0xff8da1,
        whiskerOrigin: new THREE.Vector3(0.115, 0.265, 0.44),
        hasLongWhiskers: true,
      };
    case 'bunny':
      return {
        headPivot: new THREE.Vector3(0, 0.22, 0.08),
        tailPivot: new THREE.Vector3(0, -0.32, -0.28),
        eyeL: new THREE.Vector3(-0.152, 0.348, 0.382),
        eyeR: new THREE.Vector3(0.152, 0.348, 0.382),
        eyeRadius: 0.067,
        nosePos: new THREE.Vector3(0, 0.288, 0.465),
        noseScale: new THREE.Vector3(0.036, 0.026, 0.028),
        noseColor: 0xff96ab,
        whiskerOrigin: new THREE.Vector3(0.11, 0.26, 0.42),
        hasLongWhiskers: true,
      };
    case 'fox':
      return {
        headPivot: new THREE.Vector3(0, 0.24, 0.1),
        tailPivot: new THREE.Vector3(0, -0.33, -0.24),
        eyeL: new THREE.Vector3(-0.145, 0.365, 0.398),
        eyeR: new THREE.Vector3(0.145, 0.365, 0.398),
        eyeRadius: 0.066,
        nosePos: new THREE.Vector3(0, 0.285, 0.532),
        noseScale: new THREE.Vector3(0.042, 0.032, 0.038),
        noseColor: 0x221918,
        whiskerOrigin: new THREE.Vector3(0.105, 0.265, 0.46),
        hasLongWhiskers: true,
      };
    case 'pomeranian':
    default:
      return {
        headPivot: new THREE.Vector3(0, 0.24, 0.1),
        tailPivot: new THREE.Vector3(0, -0.26, -0.24),
        eyeL: new THREE.Vector3(-0.138, 0.365, 0.398),
        eyeR: new THREE.Vector3(0.138, 0.365, 0.398),
        eyeRadius: 0.065,
        nosePos: new THREE.Vector3(0, 0.294, 0.496),
        noseScale: new THREE.Vector3(0.041, 0.031, 0.034),
        noseColor: 0x201817,
        whiskerOrigin: new THREE.Vector3(0.1, 0.268, 0.44),
        hasLongWhiskers: false,
      };
  }
}

/**
 * 评估物种平滑距离场 SDF
 */
function createSpeciesSDF(species) {
  return function evalSDF(x, y, z) {
    const ax = Math.abs(x);

    // 1. 头部主体与圆润脸颊
    let dHead = sdEllipsoid(x, y, z, 0, 0.345, 0.12, 0.325, 0.28, 0.295);
    const dCheeks = sdEllipsoid(ax, y, z, 0.175, 0.268, 0.205, 0.185, 0.145, 0.168);
    dHead = smin(dHead, dCheeks, 0.105);

    // 口鼻部 (Muzzle)
    let dSnout;
    if (species === 'fox') {
      dSnout = sdTaperedCapsule(x, y, z, 0, 0.29, 0.26, 0, 0.278, 0.475, 0.138, 0.072);
    } else if (species === 'bunny') {
      dSnout = sdEllipsoid(x, y, z, 0, 0.278, 0.35, 0.132, 0.098, 0.122);
    } else if (species === 'kitten') {
      const dPad = sdEllipsoid(ax, y, z, 0.052, 0.268, 0.382, 0.092, 0.075, 0.092);
      dSnout = smin(sdEllipsoid(x, y, z, 0, 0.286, 0.37, 0.126, 0.092, 0.116), dPad, 0.048);
    } else {
      // 博美短萌小熊口鼻
      dSnout = sdEllipsoid(x, y, z, 0, 0.286, 0.375, 0.126, 0.095, 0.122);
    }
    dHead = smin(dHead, dSnout, 0.08);

    // 2. 鲜明物种标志性耳朵 + 耳窝微凹
    let dEars;
    let dInnerEarCup = 999.0;
    if (species === 'bunny') {
      // 软萌垂耳兔长垂耳（自然外撇垂落在脸颊两侧，轮廓清晰）
      const dEarUpper = sdTaperedCapsule(ax, y, z, 0.21, 0.54, 0.09, 0.41, 0.35, 0.08, 0.082, 0.095);
      const dEarLower = sdTaperedCapsule(ax, y, z, 0.41, 0.35, 0.08, 0.44, -0.02, 0.12, 0.095, 0.078);
      dEars = smin(dEarUpper, dEarLower, 0.065);
    } else if (species === 'fox') {
      // 灵动大尖耳 + 小熊猫脸颊毛廓
      dEars = sdTaperedCapsule(ax, y, z, 0.19, 0.53, 0.09, 0.38, 0.83, 0.07, 0.13, 0.032);
      dInnerEarCup = sdTaperedCapsule(ax, y, z, 0.21, 0.56, 0.155, 0.35, 0.77, 0.13, 0.072, 0.02);
      const dFoxCheek = sdEllipsoid(ax, y, z, 0.26, 0.245, 0.16, 0.145, 0.12, 0.13);
      dHead = smin(dHead, dFoxCheek, 0.085);
    } else if (species === 'kitten') {
      dEars = sdTaperedCapsule(ax, y, z, 0.19, 0.53, 0.1, 0.32, 0.78, 0.09, 0.12, 0.03);
      dInnerEarCup = sdTaperedCapsule(ax, y, z, 0.21, 0.56, 0.16, 0.3, 0.73, 0.145, 0.068, 0.018);
    } else {
      // 博美标志性俏皮立耳
      dEars = sdTaperedCapsule(ax, y, z, 0.185, 0.54, 0.095, 0.275, 0.77, 0.085, 0.106, 0.036);
      dInnerEarCup = sdTaperedCapsule(ax, y, z, 0.20, 0.57, 0.152, 0.262, 0.72, 0.138, 0.058, 0.018);
    }

    // 3. 坐姿圆润躯干与胸脯围脖
    let dBody = sdEllipsoid(x, y, z, 0, -0.14, -0.02, 0.305, 0.355, 0.295);
    const dChest = sdEllipsoid(x, y, z, 0, 0.04, 0.11, 0.255, 0.225, 0.225);
    const dRump = sdEllipsoid(x, y, z, 0, -0.27, -0.09, 0.325, 0.225, 0.275);
    dBody = smin(dBody, dChest, 0.12);
    dBody = smin(dBody, dRump, 0.12);

    // 四只乖巧雪白肉爪（略微向前探出，清晰可见）
    const dFrontPaws = sdCapsule(ax, y, z, 0.15, -0.22, 0.17, 0.162, -0.455, 0.265, 0.088);
    const dFrontToe = sdEllipsoid(ax, y, z, 0.162, -0.468, 0.31, 0.095, 0.066, 0.105);
    const dHindThigh = sdEllipsoid(ax, y, z, 0.25, -0.33, -0.03, 0.13, 0.148, 0.158);
    const dHindPaws = sdEllipsoid(ax, y, z, 0.245, -0.462, 0.125, 0.096, 0.066, 0.132);

    let dLimbs = smin(dFrontPaws, dFrontToe, 0.052);
    dLimbs = smin(dLimbs, smin(dHindThigh, dHindPaws, 0.075), 0.07);

    // 4. 物种标志性尾巴
    let dTail;
    if (species === 'bunny') {
      dTail = sdSphere(x, y, z, 0, -0.3, -0.37, 0.138);
    } else if (species === 'fox') {
      const t1 = sdTaperedCapsule(x, y, z, 0, -0.33, -0.24, 0.16, -0.21, -0.54, 0.11, 0.17);
      const t2 = sdTaperedCapsule(x, y, z, 0.16, -0.21, -0.54, 0.28, 0.05, -0.68, 0.17, 0.115);
      dTail = smin(t1, t2, 0.09);
    } else if (species === 'kitten') {
      const t1 = sdCapsule(x, y, z, 0, -0.34, -0.24, 0.14, -0.19, -0.48, 0.072);
      const t2 = sdCapsule(x, y, z, 0.14, -0.19, -0.48, 0.22, 0.16, -0.5, 0.068);
      dTail = smin(t1, t2, 0.08);
    } else {
      // 博美背卷大绒球尾
      const t1 = sdTaperedCapsule(x, y, z, 0, -0.25, -0.25, 0, 0.03, -0.41, 0.095, 0.138);
      const t2 = sdSphere(x, y, z, 0, 0.14, -0.31, 0.14);
      dTail = smin(t1, t2, 0.09);
    }

    let d = smin(dBody, dHead, 0.115);
    d = smin(d, dEars, 0.055);
    if (dInnerEarCup < 900.0) {
      d = Math.max(d, -dInnerEarCup);
    }
    d = smin(d, dLimbs, 0.072);
    d = smin(d, dTail, 0.085);

    // 眼窝微凹让大眼睛自然嵌入面部
    const cfg = getSpeciesConfig(species);
    const dSocketL = sdSphere(x, y, z, cfg.eyeL.x, cfg.eyeL.y, cfg.eyeL.z + 0.014, cfg.eyeRadius * 0.86);
    const dSocketR = sdSphere(x, y, z, cfg.eyeR.x, cfg.eyeR.y, cfg.eyeR.z + 0.014, cfg.eyeRadius * 0.86);
    const dSockets = Math.min(dSocketL, dSocketR);
    d = Math.max(d, -dSockets - 0.011);

    return d;
  };
}

/**
 * 计算解剖学区域权重与骨骼绑定权重
 */
function evaluateVertexAnatomy(x, y, z, nx, ny, nz, species, cfg) {
  const ax = Math.abs(x);

  // 1. 面部短毛区 (眼周 + 口鼻区)
  const distSnout = Math.hypot(x, y - 0.305, z - 0.395);
  const wFace = 1.0 - smoothstep(0.11, 0.32, distSnout);

  // 2. 脖圈围脖鬃毛区 (颈胸环绕 + 脸颊下方)
  const distMane = Math.hypot(x * 0.85, y - 0.09, z - 0.08);
  const wMane = (1.0 - smoothstep(0.16, 0.39, distMane)) * (1.0 - wFace * 0.7);

  // 3. 耳朵区
  let wEar = 0.0;
  if (species === 'bunny') {
    const dEarLine = sdCapsule(ax, y, z, 0.25, 0.52, 0.09, 0.44, -0.02, 0.12, 0.0);
    wEar = 1.0 - smoothstep(0.085, 0.18, dEarLine);
  } else {
    const dEarCenter = Math.hypot(ax - 0.28, y - 0.66, z - 0.09);
    wEar = 1.0 - smoothstep(0.13, 0.27, dEarCenter);
  }

  // 4. 尾巴区
  let wTail = 0.0;
  if (z < -0.21 && y < 0.28) {
    wTail = smoothstep(-0.2, -0.32, z) * (1.0 - smoothstep(0.2, 0.36, y));
  }

  // 5. 肚皮胸腹软毛区
  const wBelly = smoothstep(-0.02, 0.2, z) * (1.0 - smoothstep(-0.38, 0.16, y)) * (1.0 - smoothstep(0.1, 0.26, ax));

  // 6. 眼睛、湿鼻头、耳窝内侧与脚垫毛长遮罩 (保持五官与双耳轮廓干净鲜明！)
  const dEyeL = Math.hypot(x - cfg.eyeL.x, y - cfg.eyeL.y, z - cfg.eyeL.z);
  const dEyeR = Math.hypot(x - cfg.eyeR.x, y - cfg.eyeR.y, z - cfg.eyeR.z);
  const dNose = Math.hypot(
    (x - cfg.nosePos.x) / 1.15,
    (y - cfg.nosePos.y) / 1.05,
    (z - cfg.nosePos.z) / 1.15
  );
  const eyeClear = smoothstep(cfg.eyeRadius * 0.94, cfg.eyeRadius * 1.62, Math.min(dEyeL, dEyeR));
  const noseClear = smoothstep(0.044, 0.105, dNose);

  // 耳窝正面绒毛适度压短，露出可爱粉嫩耳廓
  const innerEarTrim = species !== 'bunny' && wEar > 0.2 && nz > 0.25
    ? 1.0 - 0.52 * wEar * smoothstep(0.2, 0.75, nz)
    : 1.0;

  // 头顶两耳之间微收一点点，突出两只立耳可爱的 V 字剪影
  const crownValley = species !== 'bunny' && y > 0.56 && ax < 0.14
    ? 0.72 + 0.28 * (ax / 0.14)
    : 1.0;

  // 前爪小脚趾毛略微收短，呈现圆润山竹爪感
  const pawTrim = y < -0.42 && z > 0.18 ? 0.62 : 1.0;
  const pawPadClear = y < -0.485 && ny < -0.55 ? 0.32 : 1.0;

  const furMask = eyeClear * noseClear * innerEarTrim * crownValley * pawTrim * pawPadClear;

  // 7. 骨骼权重: head, tail, earTwitch, breath
  const wBoneHead = smoothstep(0.13, 0.28, y) * (1.0 - wTail);
  const wBoneTail = wTail;
  const wBoneEar = wEar;
  const wBoneBreath = (1.0 - wBoneHead) * (1.0 - wBoneTail) * smoothstep(-0.42, -0.04, y);

  return {
    wFace,
    wMane,
    wEar,
    wTail,
    wBelly,
    furMask,
    wBoneHead,
    wBoneTail,
    wBoneEar,
    wBoneBreath,
  };
}

/**
 * 使用高精度 Naive Surface Nets 从光滑 SDF 提取无接缝水密有机皮肤网格
 */
export function buildPetAnatomy(species = 'pomeranian') {
  const cfg = getSpeciesConfig(species);
  const evalSDF = createSpeciesSDF(species);

  const minX = -0.60, maxX = 0.60;
  const minY = -0.58, maxY = 0.92;
  const minZ = -0.82, maxZ = 0.64;

  const nx = 62, ny = 76, nz = 74;
  const dx = (maxX - minX) / (nx - 1);
  const dy = (maxY - minY) / (ny - 1);
  const dz = (maxZ - minZ) / (nz - 1);

  const totalGrid = nx * ny * nz;
  const field = new Float32Array(totalGrid);

  const idx = (i, j, k) => (k * ny + j) * nx + i;

  for (let k = 0; k < nz; k++) {
    const z = minZ + k * dz;
    for (let j = 0; j < ny; j++) {
      const y = minY + j * dy;
      const base = (k * ny + j) * nx;
      for (let i = 0; i < nx; i++) {
        field[base + i] = evalSDF(minX + i * dx, y, z);
      }
    }
  }

  const cubeEdges = [
    [0,0,0, 1,0,0], [0,1,0, 1,1,0], [0,0,1, 1,0,1], [0,1,1, 1,1,1],
    [0,0,0, 0,1,0], [1,0,0, 1,1,0], [0,0,1, 0,1,1], [1,0,1, 1,1,1],
    [0,0,0, 0,0,1], [1,0,0, 1,0,1], [0,1,0, 0,1,1], [1,1,0, 1,1,1],
  ];

  const cellToVert = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cellIdx = (i, j, k) => (k * (ny - 1) + j) * (nx - 1) + i;

  const vertPos = [];
  const vertNorm = [];

  const eps = 0.0025;
  const calcGrad = (px, py, pz) => {
    const gx = evalSDF(px + eps, py, pz) - evalSDF(px - eps, py, pz);
    const gy = evalSDF(px, py + eps, pz) - evalSDF(px, py - eps, pz);
    const gz = evalSDF(px, py, pz + eps) - evalSDF(px, py, pz - eps);
    const len = Math.hypot(gx, gy, gz) || 1.0;
    return [gx / len, gy / len, gz / len];
  };

  for (let k = 0; k < nz - 1; k++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        let mask = 0;
        const vals = new Float32Array(8);
        let c = 0;
        for (let dk = 0; dk < 2; dk++) {
          for (let dj = 0; dj < 2; dj++) {
            for (let di = 0; di < 2; di++) {
              const v = field[idx(i + di, j + dj, k + dk)];
              vals[c] = v;
              if (v < 0) mask |= 1 << c;
              c++;
            }
          }
        }
        if (mask === 0 || mask === 255) continue;

        let sx = 0, sy = 0, sz = 0, crossings = 0;
        for (let e = 0; e < 12; e++) {
          const [ax, ay, az, bx, by, bz] = cubeEdges[e];
          const va = vals[(az << 2) | (ay << 1) | ax];
          const vb = vals[(bz << 2) | (by << 1) | bx];
          if ((va < 0) !== (vb < 0)) {
            const t = va / (va - vb);
            sx += minX + (i + ax + (bx - ax) * t) * dx;
            sy += minY + (j + ay + (by - ay) * t) * dy;
            sz += minZ + (k + az + (bz - az) * t) * dz;
            crossings++;
          }
        }

        let px = sx / crossings;
        let py = sy / crossings;
        let pz = sz / crossings;

        for (let iter = 0; iter < 2; iter++) {
          const dVal = evalSDF(px, py, pz);
          const [gx, gy, gz] = calcGrad(px, py, pz);
          px -= dVal * gx * 0.85;
          py -= dVal * gy * 0.85;
          pz -= dVal * gz * 0.85;
        }

        const [nxv, nyv, nzv] = calcGrad(px, py, pz);
        const vIndex = vertPos.length / 3;
        cellToVert[cellIdx(i, j, k)] = vIndex;
        vertPos.push(px, py, pz);
        vertNorm.push(nxv, nyv, nzv);
      }
    }
  }

  const indices = [];
  const emitQuad = (v0, v1, v2, v3) => {
    if (v0 < 0 || v1 < 0 || v2 < 0 || v3 < 0) return;
    const ax = vertPos[v0 * 3], ay = vertPos[v0 * 3 + 1], az = vertPos[v0 * 3 + 2];
    const bx = vertPos[v1 * 3] - ax, by = vertPos[v1 * 3 + 1] - ay, bz = vertPos[v1 * 3 + 2] - az;
    const cx = vertPos[v2 * 3] - ax, cy = vertPos[v2 * 3 + 1] - ay, cz = vertPos[v2 * 3 + 2] - az;
    const crx = by * cz - bz * cy;
    const cry = bz * cx - bx * cz;
    const crz = bx * cy - by * cx;
    const dot = crx * vertNorm[v0 * 3] + cry * vertNorm[v0 * 3 + 1] + crz * vertNorm[v0 * 3 + 2];
    if (dot >= 0) {
      indices.push(v0, v1, v2, v0, v2, v3);
    } else {
      indices.push(v0, v2, v1, v0, v3, v2);
    }
  };

  for (let k = 1; k < nz - 1; k++) {
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const s0 = field[idx(i, j, k)] < 0;
        if (i < nx - 1 && s0 !== (field[idx(i + 1, j, k)] < 0)) {
          emitQuad(
            cellToVert[cellIdx(i, j - 1, k - 1)],
            cellToVert[cellIdx(i, j, k - 1)],
            cellToVert[cellIdx(i, j, k)],
            cellToVert[cellIdx(i, j - 1, k)]
          );
        }
        if (j < ny - 1 && s0 !== (field[idx(i, j + 1, k)] < 0)) {
          emitQuad(
            cellToVert[cellIdx(i - 1, j, k - 1)],
            cellToVert[cellIdx(i - 1, j, k)],
            cellToVert[cellIdx(i, j, k)],
            cellToVert[cellIdx(i, j, k - 1)]
          );
        }
        if (k < nz - 1 && s0 !== (field[idx(i, j, k + 1)] < 0)) {
          emitQuad(
            cellToVert[cellIdx(i - 1, j - 1, k)],
            cellToVert[cellIdx(i, j - 1, k)],
            cellToVert[cellIdx(i, j, k)],
            cellToVert[cellIdx(i - 1, j, k)]
          );
        }
      }
    }
  }

  const vCount = vertPos.length / 3;
  const positions = new Float32Array(vertPos);
  const normals = new Float32Array(vertNorm);
  const regionAttr = new Float32Array(vCount * 4);
  const extraAttr = new Float32Array(vCount * 2);
  const boneAttr = new Float32Array(vCount * 4);

  for (let v = 0; v < vCount; v++) {
    const px = positions[v * 3];
    const py = positions[v * 3 + 1];
    const pz = positions[v * 3 + 2];
    const nxv = normals[v * 3];
    const nyv = normals[v * 3 + 1];
    const nzv = normals[v * 3 + 2];

    const anat = evaluateVertexAnatomy(px, py, pz, nxv, nyv, nzv, species, cfg);
    regionAttr[v * 4] = anat.wFace;
    regionAttr[v * 4 + 1] = anat.wMane;
    regionAttr[v * 4 + 2] = anat.wEar;
    regionAttr[v * 4 + 3] = anat.wTail;

    extraAttr[v * 2] = anat.wBelly;
    extraAttr[v * 2 + 1] = anat.furMask;

    boneAttr[v * 4] = anat.wBoneHead;
    boneAttr[v * 4 + 1] = anat.wBoneTail;
    boneAttr[v * 4 + 2] = anat.wBoneEar;
    boneAttr[v * 4 + 3] = anat.wBoneBreath;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('aRegion', new THREE.BufferAttribute(regionAttr, 4));
  geometry.setAttribute('aExtra', new THREE.BufferAttribute(extraAttr, 2));
  geometry.setAttribute('aBones', new THREE.BufferAttribute(boneAttr, 4));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  const facialGroup = buildFacialFeatures(cfg);

  return {
    geometry,
    config: cfg,
    facialGroup,
  };
}

/**
 * 构建精致高光湿润大眼睛、心形鼻头、微笑嘴线与胡须
 */
function buildFacialFeatures(cfg) {
  const group = new THREE.Group();
  group.position.copy(cfg.headPivot);

  const eyeGroupL = createGlossyEye(cfg.eyeRadius);
  eyeGroupL.position.copy(cfg.eyeL).sub(cfg.headPivot);
  eyeGroupL.rotation.y = -0.18;
  eyeGroupL.rotation.x = -0.06;

  const eyeGroupR = createGlossyEye(cfg.eyeRadius);
  eyeGroupR.position.copy(cfg.eyeR).sub(cfg.headPivot);
  eyeGroupR.rotation.y = 0.18;
  eyeGroupR.rotation.x = -0.06;

  group.add(eyeGroupL, eyeGroupR);

  // 精致湿润心形小鼻头
  const noseGeo = new THREE.SphereGeometry(1, 24, 20);
  const posAttr = noseGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    const taper = 0.68 + 0.38 * (y * 0.5 + 0.5);
    const topIndent = y > 0.3 ? -Math.exp(-x * x * 8.0) * 0.12 : 0.0;
    posAttr.setXYZ(i, x * taper, y + topIndent, z);
  }
  noseGeo.computeVertexNormals();

  const noseMat = new THREE.MeshPhysicalMaterial({
    color: cfg.noseColor,
    roughness: 0.18,
    metalness: 0.02,
    clearcoat: 0.95,
    clearcoatRoughness: 0.1,
  });
  const noseMesh = new THREE.Mesh(noseGeo, noseMat);
  noseMesh.scale.copy(cfg.noseScale);
  noseMesh.position.copy(cfg.nosePos).sub(cfg.headPivot);
  group.add(noseMesh);

  // 鼻头正上方自然亮斑
  const noseSpec = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })
  );
  noseSpec.position.set(-0.22, 0.34, 0.88);
  noseSpec.scale.set(1.2, 0.55, 0.3);
  noseMesh.add(noseSpec);

  // 贴合口鼻表面的微笑 ω 小嘴线
  const mouthMat = new THREE.MeshBasicMaterial({ color: 0x3b2420 });
  const philtrumCurve = new THREE.LineCurve3(
    new THREE.Vector3(0, -0.018, 0.018),
    new THREE.Vector3(0, -0.036, 0.014)
  );
  const philtrum = new THREE.Mesh(new THREE.TubeGeometry(philtrumCurve, 4, 0.0036, 6, false), mouthMat);
  philtrum.position.copy(cfg.nosePos).sub(cfg.headPivot);
  group.add(philtrum);

  for (const side of [-1, 1]) {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, -0.035, 0.014),
      new THREE.Vector3(side * 0.028, -0.052, 0.01),
      new THREE.Vector3(side * 0.05, -0.033, -0.002)
    );
    const tubeGeo = new THREE.TubeGeometry(curve, 12, 0.0038, 6, false);
    const mouthPart = new THREE.Mesh(tubeGeo, mouthMat);
    mouthPart.position.copy(cfg.nosePos).sub(cfg.headPivot);
    group.add(mouthPart);
  }

  // 胡须系统 (Whiskers)
  const whiskerMat = new THREE.MeshStandardMaterial({
    color: 0xfff8f0,
    roughness: 0.28,
    transparent: true,
    opacity: cfg.hasLongWhiskers ? 0.85 : 0.45,
  });

  const wLen = cfg.hasLongWhiskers ? 0.25 : 0.14;
  for (const side of [-1, 1]) {
    for (let w = 0; w < 3; w++) {
      const oy = (w - 1) * 0.018;
      const oz = (1 - Math.abs(w - 1)) * 0.012;
      const origin = new THREE.Vector3(
        side * cfg.whiskerOrigin.x,
        cfg.whiskerOrigin.y + oy,
        cfg.whiskerOrigin.z + oz
      ).sub(cfg.headPivot);

      const mid = origin.clone().add(new THREE.Vector3(side * wLen * 0.55, 0.01 + oy * 0.4, -0.018));
      const tip = origin.clone().add(new THREE.Vector3(side * wLen, -0.024 + oy * 0.9, -0.06));
      const curve = new THREE.QuadraticBezierCurve3(origin, mid, tip);
      const wGeo = new THREE.TubeGeometry(curve, 10, 0.0024 * (1 - w * 0.12), 5, false);
      const wp = wGeo.attributes.position;
      for (let k = 0; k < wp.count; k++) {
        const u = Math.floor(k / 6) / 10;
        const cPt = curve.getPoint(u);
        const cur = new THREE.Vector3().fromBufferAttribute(wp, k);
        cur.sub(cPt).multiplyScalar(1.0 - u * 0.85).add(cPt);
        wp.setXYZ(k, cur.x, cur.y, cur.z);
      }
      wGeo.computeVertexNormals();
      group.add(new THREE.Mesh(wGeo, whiskerMat));
    }
  }

  group.userData = {
    eyeGroupL,
    eyeGroupR,
    noseMesh,
  };

  return group;
}

function createGlossyEye(radius) {
  const wrap = new THREE.Group();

  const irisGeo = new THREE.SphereGeometry(radius, 28, 24);
  const irisMat = new THREE.MeshPhysicalMaterial({
    color: 0x160d0a,
    emissive: 0x1e1008,
    emissiveIntensity: 0.38,
    roughness: 0.04,
    metalness: 0.05,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    envMapIntensity: 0.9,
  });
  const eyeball = new THREE.Mesh(irisGeo, irisMat);
  eyeball.scale.set(0.95, 1.04, 0.88);
  wrap.add(eyeball);

  const crescentGeo = new THREE.SphereGeometry(radius * 0.62, 18, 14);
  const crescentMat = new THREE.MeshBasicMaterial({ color: 0x693b1c });
  const crescent = new THREE.Mesh(crescentGeo, crescentMat);
  crescent.position.set(0, -radius * 0.2, radius * 0.36);
  crescent.scale.set(0.85, 0.55, 0.35);
  wrap.add(crescent);

  const catchMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const catchBig = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.24, 14, 12), catchMat);
  catchBig.position.set(-radius * 0.26, radius * 0.28, radius * 0.79);
  catchBig.scale.set(1.0, 1.1, 0.35);
  wrap.add(catchBig);

  const catchSmall = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.11, 10, 10), catchMat);
  catchSmall.position.set(radius * 0.28, -radius * 0.24, radius * 0.81);
  catchSmall.scale.set(1.0, 1.0, 0.35);
  wrap.add(catchSmall);

  return wrap;
}
