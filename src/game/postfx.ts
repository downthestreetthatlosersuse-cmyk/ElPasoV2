import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

/* ------------------------------------------------------------------ */
/* Screen-space god rays: the scene is rendered to a low-res target,   */
/* bright regions near the sun are smeared radially toward it.         */
/* ------------------------------------------------------------------ */

const GodRayShader = {
  uniforms: {
    tDiffuse: { value: null },
    tOcc: { value: null },
    uSunUv: { value: new THREE.Vector2(0.25, 0.6) },
    uSunVis: { value: 0 },
    uStrength: { value: 0.028 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tOcc;
    uniform vec2 uSunUv;
    uniform float uSunVis;
    uniform float uStrength;
    varying vec2 vUv;
    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      vec2 delta = (uSunUv - vUv) * 0.021;
      vec2 uv = vUv;
      float ill = 0.0;
      float decay = 1.0;
      for (int i = 0; i < 30; i++) {
        uv += delta;
        vec3 s = texture2D(tOcc, uv).rgb;
        float lum = max(max(s.r, s.g), s.b);
        ill += max(lum - 0.4, 0.0) * decay;
        decay *= 0.94;
      }
      ill *= uSunVis * uStrength;
      vec3 rays = vec3(1.0, 0.58, 0.3) * ill;
      gl_FragColor = vec4(base.rgb + rays, base.a);
    }
  `,
};

/* ------------------------------------------------------------------ */
/* Reactive CRT: barrel curvature, chromatic aberration, interlaced    */
/* scanlines, grain, vignette, damage jitter, heartbeat, nuke flash.   */
/* ------------------------------------------------------------------ */

const CrtShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(640, 360) },
    uInter: { value: 0 },
    uDamage: { value: 0 },
    uNuke: { value: 0 },
    uAber: { value: 0 },
    uLowHp: { value: 0 },
    uHit: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec2 uRes;
    uniform float uInter;
    uniform float uDamage;
    uniform float uNuke;
    uniform float uAber;
    uniform float uLowHp;
    uniform float uHit;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;
      /* damage jitter */
      uv.x += (hash(vec2(floor(uTime * 90.0), floor(uv.y * 60.0))) - 0.5) * uDamage * 0.008;

      /* barrel distortion */
      vec2 c = uv - 0.5;
      float r2 = dot(c, c);
      uv = 0.5 + c * (1.0 + 0.14 * r2 + 0.055 * r2 * r2);

      /* chromatic aberration — stronger at edges and on impact */
      float ab = (0.0008 + uAber * 0.003 + uDamage * 0.0025) * (0.35 + r2 * 2.4);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + c * ab).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - c * ab).b;
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) col = vec3(0.0);

      /* interlaced scanlines */
      float scan = 0.85 + 0.15 * sin((uv.y + uInter) * uRes.y * 3.14159);
      col *= scan;

      /* slight phosphor tint shift */
      col *= vec3(1.045, 1.0, 0.955);

      /* film grain + dither to kill banding */
      float g = hash(uv * uRes + fract(uTime) * 61.7);
      col += (g - 0.5) * 0.04;

      /* vignette */
      float edge = smoothstep(0.32, 0.98, length(c));
      col *= 1.0 - edge * 0.42;

      /* low-hp heartbeat at the edges */
      float pulse = 0.5 + 0.5 * sin(uTime * 6.5);
      col = mix(col, vec3(0.55, 0.02, 0.04), uLowHp * pulse * edge * 0.5);

      /* damage red wash */
      col = mix(col, vec3(0.66, 0.03, 0.05), uDamage * 0.3);

      /* hitstop: desaturate + contrast punch */
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(lum), col, 1.0 - uHit * 0.18);
      col *= 1.0 + uHit * 0.12;

      /* nuke whiteout */
      col = mix(col, vec3(1.3, 1.24, 1.05), uNuke);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

/* ------------------------------------------------------------------ */

export interface PostFX {
  composer: EffectComposer;
  update: (dt: number, camera: THREE.PerspectiveCamera) => void;
  pulseDamage: () => void;
  flashNuke: () => void;
  pulseKill: (big: boolean) => void;
  setLowHp: (t: number) => void;
  setFreeze: (active: boolean) => void;
  dispose: () => void;
}

export function createPostFX(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
  sunPos: THREE.Vector3
): PostFX {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  /* god rays feed off a quarter-res render of the scene */
  const lowRT = new THREE.WebGLRenderTarget(Math.floor(width / 4), Math.floor(height / 4));
  const black = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false });
  const godray = new ShaderPass(GodRayShader);
  godray.uniforms.tOcc.value = lowRT.texture;
  composer.addPass(godray);

  const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.42, 0.55, 0.78);
  composer.addPass(bloom);

  const crt = new ShaderPass(CrtShader);
  crt.uniforms.uRes.value.set(width, height);
  composer.addPass(crt);

  composer.addPass(new OutputPass());

  /* reactive state */
  let damage = 0;
  let nuke = 0;
  let aber = 0;
  let lowHp = 0;
  let hit = 0;
  let elapsed = 0;
  let frame = 0;
  const proj = new THREE.Vector3();

  const update = (dt: number, cam: THREE.PerspectiveCamera) => {
    elapsed += dt;
    frame++;
    damage = Math.max(0, damage - dt * 2.1);
    nuke = Math.max(0, nuke - dt * 1.5);
    aber = Math.max(0, aber - dt * 5);
    hit = Math.max(0, hit - dt * 6);

    /* low-res occlusion render for the light streaks, in two passes:
       1) the whole opaque world as flat black occluders (real depth)
       2) sky + sun (layer 1) depth-tested against them —
       so rays only exist where the sun is genuinely visible, and
       stars / dust / particles / flames never bleed into the smear */
    const prevMask = cam.layers.mask;
    const prevAuto = renderer.autoClear;
    renderer.setRenderTarget(lowRT);
    scene.overrideMaterial = black;
    cam.layers.mask = 1; /* layer 0 only */
    renderer.render(scene, cam);
    scene.overrideMaterial = null;
    cam.layers.mask = 2; /* layer 1 only — sky + sun */
    renderer.autoClear = false;
    renderer.render(scene, cam);
    renderer.autoClear = prevAuto;
    renderer.setRenderTarget(null);
    cam.layers.mask = prevMask;

    /* project the sun into screen space */
    proj.copy(sunPos).project(cam);
    const vis = proj.z < 1 ? 1 : 0;
    godray.uniforms.uSunUv.value.set(proj.x * 0.5 + 0.5, proj.y * 0.5 + 0.5);
    godray.uniforms.uSunVis.value += (vis - godray.uniforms.uSunVis.value) * Math.min(1, dt * 6);

    crt.uniforms.uTime.value = elapsed;
    crt.uniforms.uInter.value = frame % 2 === 0 ? 0 : 0.0014;
    crt.uniforms.uDamage.value = damage;
    crt.uniforms.uNuke.value = nuke;
    crt.uniforms.uAber.value = aber;
    crt.uniforms.uLowHp.value = lowHp;
    crt.uniforms.uHit.value = hit;
  };

  return {
    composer,
    update,
    pulseDamage: () => {
      damage = 1;
      aber = Math.max(aber, 0.45);
    },
    flashNuke: () => {
      nuke = 1;
      aber = 0.6;
    },
    pulseKill: (big: boolean) => {
      aber = Math.max(aber, big ? 0.5 : 0.18);
      hit = Math.max(hit, big ? 0.75 : 0.4);
    },
    setLowHp: (t: number) => {
      lowHp = t;
    },
    setFreeze: (active: boolean) => {
      if (active) hit = Math.max(hit, 0.4);
    },
    dispose: () => {
      lowRT.dispose();
      bloom.dispose();
      composer.dispose();
    },
  };
}
