// hi3d-papercraft / paper-3d-assets.js
// 外部 3D GLB 资产加载、厘米制尺度接地与纸艺光影同化模块：
// 1. 解决原生 PBR 材质在无全局环境贴图纸艺世界中的金属死黑、塑料高光与灰黑阴影冲突；
// 2. 通过 Shader 注入共享 PAPER_LIGHT（柔和明暗交界 wrap + 世界环境色阴影透射 leak + PCSS 接触硬化软阴影）；
// 3. 自动按世界单位（默认 1 unit = 1 cm，英雄高 3.6）等比缩放并将底面归零接地，无缝挂接折痕铰链（FlapSpring）。

import * as THREE from 'three';
import { PAPER_LIGHT, paperMaterial, paperLightsChunk, makeCard } from './paperkit-3d.js';
import { toRGB } from './paperkit-2d.js';

const THREE_JSM_CDN = 'https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/';
const DRACO_DECODER_URL = THREE_JSM_CDN + 'libs/draco/gltf/';

let addonsPromise = null;
let sharedLoader = null;
const gltfCache = new Map();
const textureCache = new WeakMap();
const relicEnvCache = new WeakMap();

/**
 * 按需加载 GLTFLoader / DRACOLoader / SkeletonUtils；优先读取页面 importmap 的 three/addons/，未配置时自动回退同版本 CDN
 */
async function ensureAddons() {
  if (addonsPromise) return addonsPromise;
  const loadMod = async (subpath) => {
    try {
      return await import('three/addons/' + subpath);
    } catch {
      return await import(THREE_JSM_CDN + subpath);
    }
  };
  addonsPromise = Promise.all([
    loadMod('loaders/GLTFLoader.js'),
    loadMod('loaders/DRACOLoader.js'),
    loadMod('utils/SkeletonUtils.js'),
  ]).then(([gltfMod, dracoMod, skelMod]) => {
    const draco = new dracoMod.DRACOLoader();
    draco.setDecoderPath(DRACO_DECODER_URL);
    sharedLoader = new gltfMod.GLTFLoader();
    sharedLoader.setDRACOLoader(draco);
    return { loader: sharedLoader, SkeletonUtils: skelMod };
  });
  return addonsPromise;
}

/**
 * 获取带 DRACO 解码支持的共享 GLTFLoader 单例（异步按需初始化）
 */
export async function getGLTFLoader() {
  const { loader } = await ensureAddons();
  return loader;
}

/**
 * 为 relic-satin（点睛圣物档）生成局部柔和棚拍环境贴图，绝不挂载到全局 scene.environment，防止污染纸片死哑光质感
 */
export function getRelicEnvMap(renderer) {
  if (!renderer) return null;
  if (relicEnvCache.has(renderer)) return relicEnvCache.get(renderer);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color('#cfc4b0');
  const skyGeo = new THREE.SphereGeometry(10, 16, 12);
  const pos = skyGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const top = new THREE.Color('#fff4df');
  const mid = new THREE.Color('#dfd3be');
  const bot = new THREE.Color('#8f7558');
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const ny = THREE.MathUtils.clamp(pos.getY(i) / 10, -1, 1);
    tmp.copy(ny >= 0 ? mid : bot).lerp(ny >= 0 ? top : mid, ny >= 0 ? ny : ny + 1);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const dome = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
  envScene.add(dome);
  const rt = pmrem.fromScene(envScene, 0.06);
  pmrem.dispose();
  skyGeo.dispose();
  dome.material.dispose();
  relicEnvCache.set(renderer, rt.texture);
  return rt.texture;
}

/**
 * 调和 AI 生成贴图的反照率：轻轻抬起烘焙死黑暗部，并向场景奶油纸底色（stock）微量偏转以消除数码荧光感
 */
export function harmonizeAlbedoMap(map, renderer, { stock = '#f7f0e2', stockMix = 0.08, shadowFloor = 14, maxTexSize = 1024 } = {}) {
  if (!map || !map.image) return map;
  let perStock = textureCache.get(map);
  const key = `${stock}|${stockMix}|${shadowFloor}`;
  if (perStock && perStock.has(key)) return perStock.get(key);

  const img = map.image;
  const iw = img.naturalWidth || img.videoWidth || img.width || 0;
  const ih = img.naturalHeight || img.videoHeight || img.height || 0;
  if (!iw || !ih || typeof document === 'undefined') return map;

  try {
    const scale = Math.min(1, maxTexSize / Math.max(iw, ih));
    const w = Math.max(1, Math.round(iw * scale));
    const h = Math.max(1, Math.round(ih * scale));
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h);
    const px = data.data;
    const [sr, sg, sb] = toRGB(stock);
    const keep = 1 - stockMix;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] === 0) continue;
      const r = shadowFloor + (px[i] * (255 - shadowFloor)) / 255;
      const g = shadowFloor + (px[i + 1] * (255 - shadowFloor)) / 255;
      const b = shadowFloor + (px[i + 2] * (255 - shadowFloor)) / 255;
      px[i] = Math.round(r * keep + sr * stockMix);
      px[i + 1] = Math.round(g * keep + sg * stockMix);
      px[i + 2] = Math.round(b * keep + sb * stockMix);
    }
    ctx.putImageData(data, 0, 0);
    const out = new THREE.CanvasTexture(cv);
    out.colorSpace = THREE.SRGBColorSpace;
    out.flipY = map.flipY;
    out.wrapS = map.wrapS;
    out.wrapT = map.wrapT;
    out.repeat.copy(map.repeat);
    out.offset.copy(map.offset);
    out.center.copy(map.center);
    out.rotation = map.rotation;
    if (renderer) out.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (!perStock) {
      perStock = new Map();
      textureCache.set(map, perStock);
    }
    perStock.set(key, out);
    return out;
  } catch {
    return map;
  }
}

const RELIC_HEADER = /* glsl */`
uniform float uPaperWrap;
uniform vec3 uPaperLeak;
float gPaperShadow = 1.0;
float gPaperShadowT = 1.0;
`;

const RELIC_WRAPPER = /* glsl */`
void RE_Direct_PaperRelic( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
  float nl = dot( geometryNormal, directLight.direction );
  float wrapFront = saturate( ( nl + uPaperWrap ) / ( 1.0 + uPaperWrap ) );
  vec3 shadowTint = mix( uPaperLeak, vec3( 1.0 ), gPaperShadow );
  reflectedLight.directDiffuse += wrapFront * directLight.color * shadowTint * BRDF_Lambert( material.diffuseColor );
  IncidentLight specLight = directLight;
  specLight.color *= gPaperShadow * 0.45;
  ReflectedLight specOnly = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
  RE_Direct_Physical( specLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, specOnly );
  reflectedLight.directSpecular += specOnly.directSpecular;
  gPaperShadow = 1.0;
  gPaperShadowT = 1.0;
}
#define RE_Direct RE_Direct_PaperRelic
`;

/**
 * 将外部 GLB 的材质同化为与纸艺世界兼容的光影模型
 * @param {THREE.Material} srcMat 原始材质
 * @param {THREE.WebGLRenderer} renderer 渲染器实例
 * @param {object} opts 同化配置：mode ('craft-matte' | 'relic-satin')、stock（纸底色）等
 */
export function harmonizeMaterial(srcMat, renderer, {
  mode = 'craft-matte',
  stock = '#f7f0e2',
  stockMix = 0.08,
  normalScale = 0.35,
  envIntensity = 0.32,
  roughnessRange = [0.38, 0.75],
  maxMetalness = 0.65,
} = {}) {
  if (!srcMat) return paperMaterial({ color: stock });
  const map = srcMat.map ? harmonizeAlbedoMap(srcMat.map, renderer, { stock, stockMix }) : null;
  const baseColor = srcMat.color ? '#' + srcMat.color.getHexString() : '#ffffff';
  const hasEmissive = !!(srcMat.emissiveMap || (srcMat.emissive && (srcMat.emissive.r + srcMat.emissive.g + srcMat.emissive.b) > 0.01));

  // 默认档 craft-matte：直接转为死哑光纸塑材质，与全场卡纸共享 100% 相同的包裹光与彩色阴影
  if (mode !== 'relic-satin') {
    const pm = paperMaterial({
      color: baseColor,
      map,
      normalMap: srcMat.normalMap || null,
      normalScale,
      side: srcMat.side ?? THREE.FrontSide,
      emissive: hasEmissive && srcMat.emissive ? '#' + srcMat.emissive.getHexString() : null,
      emissiveIntensity: srcMat.emissiveIntensity ?? 1,
      vertexColors: !!srcMat.vertexColors,
    });
    if (srcMat.emissiveMap) pm.emissiveMap = srcMat.emissiveMap;
    if (srcMat.alphaMap) pm.alphaMap = srcMat.alphaMap;
    if (srcMat.alphaTest > 0) pm.alphaTest = srcMat.alphaTest;
    if (srcMat.transparent) {
      pm.transparent = true;
      pm.opacity = srcMat.opacity ?? 1;
    }
    return pm;
  }

  // 圣物档 relic-satin：保留受控微高光与局部柔和环境贴图，漫反射与阴影颜色对齐 PAPER_LIGHT
  const m = srcMat.isMeshStandardMaterial
    ? srcMat.clone()
    : new THREE.MeshStandardMaterial({
        color: srcMat.color ? srcMat.color.clone() : new THREE.Color('#ffffff'),
        map,
        normalMap: srcMat.normalMap || null,
        side: srcMat.side ?? THREE.FrontSide,
        vertexColors: !!srcMat.vertexColors,
      });
  m.map = map;
  if (m.normalMap) m.normalScale.set(normalScale, normalScale);
  m.roughness = THREE.MathUtils.clamp(m.roughness ?? 0.52, roughnessRange[0], roughnessRange[1]);
  m.metalness = Math.min(maxMetalness, m.metalness ?? 0.15);
  const env = getRelicEnvMap(renderer);
  if (env) {
    m.envMap = env;
    m.envMapIntensity = envIntensity;
  }
  m.onBeforeCompile = (shader) => {
    const physChunk = THREE.ShaderChunk.lights_physical_pars_fragment || '';
    const reDirectRe = /#define\s+RE_Direct\s+RE_Direct_Physical/;
    if (!reDirectRe.test(physChunk)) return;
    shader.uniforms.uPaperWrap = PAPER_LIGHT.wrap;
    shader.uniforms.uPaperLeak = PAPER_LIGHT.leak;
    const patchedPhys = physChunk.replace(reDirectRe, RELIC_WRAPPER);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + RELIC_HEADER)
      .replace('#include <lights_physical_pars_fragment>', patchedPhys)
      .replace('#include <lights_fragment_begin>', paperLightsChunk());
  };
  m.customProgramCacheKey = () => 'papercraft-relic-satin';
  return m;
}

/**
 * 生成承托 3D 资产的薄卡纸底座（圆盘或多边形），使立体模型与折纸地面自然衔接
 */
export function makePaperPlinth({ radius = 1.4, sides = 20, color = '#e6dec8', paper = null, paint = null, seed = 11, thickness = 0.08 } = {}) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    pts.push([Math.cos(a) * radius, Math.sin(a) * radius]);
  }
  const defaultPaint = paint || (({ g, w, h }) => {
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(60,42,24,0.28)';
    g.lineWidth = Math.max(2, w * 0.035);
    g.beginPath();
    g.arc(w * 0.5, h * 0.5, w * 0.38, 0, Math.PI * 2);
    g.stroke();
  });
  const card = makeCard(pts, {
    paper,
    paint: defaultPaint,
    seed,
    thickness,
    edgeWidth: 0.06,
    pxPerUnit: 48,
    effects: 1,
  });
  // 将 XY 平面的卡片平铺到 XZ 地面上（顶面朝 +Y）
  card.rotation.x = -Math.PI / 2;
  card.position.y = thickness * 0.5 + 0.01;
  return card;
}

/**
 * 加载、缓存、厘米制尺度归一化并光影同化一个 GLB 3D 资产
 * @param {string} url GLB 模型相对路径或 URL
 * @param {object} opts 归一化与材质参数
 * @returns {Promise<{ root: THREE.Group, mixer: THREE.AnimationMixer|null, stats: object }>}
 */
export async function loadHarmonizedAsset(url, {
  renderer = null,
  height = 3.6,
  width = null,
  scale = 1,
  hover = 0,
  yawOffset = 0,
  mode = 'craft-matte',
  stock = '#f7f0e2',
  stockMix = 0.08,
  normalScale = 0.35,
  envIntensity = 0.32,
  castShadow = true,
  receiveShadow = true,
  clip = null,
} = {}) {
  const { loader, SkeletonUtils } = await ensureAddons();
  if (!gltfCache.has(url)) {
    gltfCache.set(url, loader.loadAsync(url));
  }
  const gltf = await gltfCache.get(url);
  const cloned = SkeletonUtils.clone(gltf.scene);

  // 先刷新矩阵测量原始包围盒，按目标厘米制高度/宽度等比缩放并将底面归零到 y = hover
  cloned.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(cloned);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const fitScale = width != null
    ? (size.x > 1e-5 ? width / size.x : 1)
    : (height != null && size.y > 1e-5 ? height / size.y : 1);
  const finalScale = fitScale * scale;

  const alignGroup = new THREE.Group();
  cloned.scale.setScalar(finalScale);
  cloned.position.set(
    -center.x * finalScale,
    -box.min.y * finalScale + hover,
    -center.z * finalScale,
  );
  alignGroup.add(cloned);
  if (yawOffset) alignGroup.rotation.y = yawOffset;

  let meshes = 0;
  let triangles = 0;
  let hasGlow = false;

  cloned.traverse((obj) => {
    if (!obj.isMesh) return;
    meshes++;
    const geo = obj.geometry;
    if (geo) {
      const tri = geo.index ? geo.index.count / 3 : (geo.attributes.position ? geo.attributes.position.count / 3 : 0);
      triangles += Math.round(tri);
      if (!geo.attributes.normal) geo.computeVertexNormals();
    }
    obj.castShadow = castShadow;
    obj.receiveShadow = receiveShadow;
    if (Array.isArray(obj.material)) {
      obj.material = obj.material.map((mat) => harmonizeMaterial(mat, renderer, { mode, stock, stockMix, normalScale, envIntensity }));
    } else {
      obj.material = harmonizeMaterial(obj.material, renderer, { mode, stock, stockMix, normalScale, envIntensity });
    }
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    const emissiveMats = mats.filter((m) => m && (m.emissiveMap || (m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.01)));
    if (emissiveMats.length) {
      hasGlow = true;
      obj.userData.setGlow = (v) => { for (const m of emissiveMats) m.emissiveIntensity = v; };
    }
  });

  let mixer = null;
  if (clip !== null && gltf.animations && gltf.animations.length > 0) {
    mixer = new THREE.AnimationMixer(cloned);
    const chosen = typeof clip === 'number'
      ? gltf.animations[clip]
      : gltf.animations.find((a) => a.name === clip) || gltf.animations[0];
    if (chosen) mixer.clipAction(chosen).play();
  }

  const measuredBox = new THREE.Box3().setFromObject(alignGroup);
  const measuredSize = new THREE.Vector3();
  measuredBox.getSize(measuredSize);

  return {
    root: alignGroup,
    mixer,
    hasGlow,
    stats: {
      url,
      mode,
      meshes,
      triangles,
      width: +measuredSize.x.toFixed(2),
      height: +measuredSize.y.toFixed(2),
      depth: +measuredSize.z.toFixed(2),
    },
  };
}
