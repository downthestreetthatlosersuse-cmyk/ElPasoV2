import * as THREE from "three";

/* ================================================================== */
/*  Alien skeletal rigs — multi-piece joint hierarchies with layered,
    independent animation channels:
      · locomotion  (pelvis bob, leg swing, arm swing, spine twist)
      · attack      (swipes, overhead slams, spit windup, roars)
      · head        (player tracking, idle glances, pain shakes, jaws)
    Every joint pivots at the anatomical point, so rotations read as
    real limb motion instead of whole-mesh wiggles.                  */
/* ================================================================== */

export type RigKind = "grunt" | "brute" | "spitter" | "boss";

export interface RigResources {
  mat: Record<string, THREE.Material>;
  basic: Record<string, THREE.MeshBasicMaterial>;
  geo: Record<string, THREE.BufferGeometry>;
  lambert: (c: number) => THREE.MeshLambertMaterial;
}

export interface AlienRig {
  kind: RigKind;
  group: THREE.Group;
  /* compatibility handles used by the game (flash target, pulsing sac, cape) */
  parts: { body: THREE.Object3D; sac?: THREE.Object3D; cape?: THREE.Object3D };
  hitMeshes: THREE.Mesh[];
  /* skeleton */
  pelvis: THREE.Group;
  spine: THREE.Group;
  chestG: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  chest: THREE.Mesh;
  chestBase: THREE.Vector3;
  jaw: THREE.Group | null;
  shoulders: THREE.Group[];
  elbows: THREE.Group[];
  hands: THREE.Group[];
  hips: THREE.Group[];
  knees: THREE.Group[];
  feet: THREE.Group[];
  legs: { femur: THREE.Group; knee: THREE.Group }[]; /* spitter six-pack */
  capeJ1: THREE.Group | null;
  capeJ2: THREE.Group | null;
  pelvisBaseY: number;
  /* animation state */
  phase: number;
  speedBlend: number;
  atk: number;
  charge: number;
  pain: number;
  roar: number;
  headYaw: number;
  headPitch: number;
  lookTimer: number;
  glanceYaw: number;
  prevPos: THREE.Vector3;
}

/* structural view of the game's Enemy record — avoids a circular import */
export interface RiggedEnemy {
  kind: RigKind;
  rig: AlienRig;
  group: THREE.Group;
  speed: number;
  boss: boolean;
  groupBase: number;
  hitPop: number;
  flashT: number;
  lungeT: number;
  leapT: number;
  chargeT: number;
  spitCd: number;
}

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ease = (t: number) => t * t * (3 - 2 * t);
const bell = (t: number) => Math.sin(clamp(t, 0, 1) * Math.PI);
const normAng = (a: number) => {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
};

/* head pivot heights per kind — keep headshot thresholds honest */
const HEAD_H: Record<RigKind, number> = { grunt: 1.86, brute: 2.28, spitter: 1.74, boss: 2.28 };

/* ---------------------------------------------------------- helpers */

const geoCache: Record<string, THREE.BufferGeometry> = {};
function cg(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  if (!geoCache[key]) geoCache[key] = make();
  return geoCache[key];
}

function joint(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

function bone(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function baseRig(kind: RigKind, group: THREE.Group): AlienRig {
  return {
    kind,
    group,
    parts: { body: group },
    hitMeshes: [],
    pelvis: group,
    spine: group,
    chestG: group,
    neck: group,
    head: group,
    chest: group as unknown as THREE.Mesh,
    chestBase: new THREE.Vector3(1, 1, 1),
    jaw: null,
    shoulders: [],
    elbows: [],
    hands: [],
    hips: [],
    knees: [],
    feet: [],
    legs: [],
    capeJ1: null,
    capeJ2: null,
    pelvisBaseY: 0.6,
    phase: Math.random() * TAU,
    speedBlend: 0,
    atk: 0,
    charge: 0,
    pain: 0,
    roar: 0,
    headYaw: 0,
    headPitch: 0,
    lookTimer: Math.random() * 2,
    glanceYaw: 0,
    prevPos: new THREE.Vector3(),
  };
}

/* ---------------------------------------------------------- grunt */
/*  small green humanoid: digitigrade spring in the step, twin claw
    swipes, a jaw that snaps shut on the strike                     */

function buildGrunt(r: RigResources): AlienRig {
  const g = new THREE.Group();
  const rig = baseRig("grunt", g);
  const gd = r.mat.alienGreenD;
  const gg = r.mat.alienGreen;

  /* blob shadow */
  bone(g, r.geo.shadow, r.basic.shadow, 0, 0.03, 0).rotation.x = -Math.PI / 2;

  rig.pelvis = joint(g, 0, 0.62, 0);
  rig.pelvisBaseY = 0.62;

  /* legs — thigh / shin / foot, pivots at hip, knee, ankle */
  for (const s of [-1, 1]) {
    const hip = joint(rig.pelvis, 0.22 * s, -0.02, 0);
    bone(hip, cg("gThigh", () => new THREE.CylinderGeometry(0.15, 0.1, 0.34, 7)), gd, 0, -0.17, 0);
    const knee = joint(hip, 0, -0.34, 0);
    bone(knee, cg("gShin", () => new THREE.CylinderGeometry(0.1, 0.06, 0.36, 6)), gd, 0, -0.18, 0);
    const foot = joint(knee, 0, -0.36, 0);
    bone(foot, cg("gFoot", () => new THREE.BoxGeometry(0.18, 0.09, 0.34)), gg, 0, -0.03, 0.07);
    for (const ts of [-0.05, 0.05]) {
      const toe = bone(foot, cg("gToe", () => new THREE.ConeGeometry(0.04, 0.15, 4)), r.mat.alienBelly, ts, -0.04, 0.26);
      toe.rotation.x = Math.PI / 2 + 0.25;
    }
    hip.rotation.x = -0.12;
    knee.rotation.x = 0.3;
    foot.rotation.x = -0.15;
    rig.hips.push(hip);
    rig.knees.push(knee);
    rig.feet.push(foot);
  }

  /* spine → chest */
  rig.spine = joint(rig.pelvis, 0, 0.1, 0);
  rig.spine.rotation.x = 0.14;
  rig.chestG = joint(rig.spine, 0, 0.1, 0);
  const chest = bone(rig.chestG, r.geo.gruntBody, gg, 0, 0.13, 0);
  chest.scale.set(1, 1.25, 0.9);
  rig.chest = chest;
  rig.chestBase.set(1, 1.25, 0.9);
  rig.parts.body = chest;

  const belly = bone(rig.chestG, cg("gBelly", () => new THREE.SphereGeometry(0.36, 8, 6)), r.mat.alienBelly, 0, 0, 0.3);
  belly.scale.set(1, 1.15, 0.55);
  const fin = bone(rig.chestG, cg("gFin", () => new THREE.ConeGeometry(0.16, 0.5, 4)), gd, 0, 0.58, -0.42);
  fin.rotation.x = 0.55;
  for (const s of [-1, 1]) {
    const spike = bone(rig.chestG, cg("gSpike", () => new THREE.ConeGeometry(0.09, 0.3, 5)), gd, 0.44 * s, 0.66, -0.05);
    spike.rotation.z = -s * 0.6;
  }

  /* arms — shoulder / elbow / wrist, three splaying claws */
  for (const s of [-1, 1]) {
    const sh = joint(rig.chestG, 0.46 * s, 0.42, 0);
    const upper = bone(sh, r.geo.arm, gd, 0, -0.24, 0);
    upper.rotation.x = Math.PI; /* thick end at the shoulder */
    const elbow = joint(sh, 0, -0.5, 0);
    elbow.rotation.x = -0.35;
    bone(elbow, cg("gFore", () => new THREE.CylinderGeometry(0.085, 0.05, 0.4, 6)), gg, 0, -0.19, 0);
    const hand = joint(elbow, 0, -0.4, 0);
    const clawGeo = cg("gClaw", () => new THREE.ConeGeometry(0.045, 0.24, 4));
    for (let ci = 0; ci < 3; ci++) {
      const claw = bone(hand, clawGeo, r.mat.alienBelly, (ci - 1) * 0.07, -0.08, 0.03);
      claw.rotation.x = Math.PI;
      claw.rotation.z = (ci - 1) * -0.28;
    }
    sh.rotation.z = s * 0.25;
    rig.shoulders.push(sh);
    rig.elbows.push(elbow);
    rig.hands.push(hand);
  }

  /* neck → head → jaw */
  rig.neck = joint(rig.chestG, 0, 0.78, 0);
  rig.head = joint(rig.neck, 0, 0.26, 0);
  const headM = bone(rig.head, r.geo.head, gd, 0, 0, 0);
  headM.scale.set(1, 1.05, 1);
  rig.hitMeshes.push(chest, headM);
  for (const s of [-1, 1]) bone(rig.head, r.geo.eye, r.basic.eye, 0.15 * s, 0.04, 0.26);
  rig.jaw = joint(rig.head, 0, -0.1, 0.1);
  const mouth = bone(rig.jaw, cg("gMouth", () => new THREE.CircleGeometry(0.1, 8)), r.basic.mouth, 0, -0.06, 0.22);
  mouth.rotation.x = -0.25;

  return rig;
}

/* ---------------------------------------------------------- brute / boss */
/*  hulking brawler: heavy guard stance, overhead two-fist slam,
    shoulder-checked charge. Boss adds sac, cape, belt, roar jaw.   */

function buildBrute(r: RigResources, boss: boolean): AlienRig {
  const g = new THREE.Group();
  const rig = baseRig(boss ? "boss" : "brute", g);
  const bodyMat = boss ? r.lambert(0x9c2fde) : r.mat.brutePurple;
  const dark = r.mat.bruteDark;

  const sh = bone(g, r.geo.shadow, r.basic.shadow, 0, 0.03, 0);
  sh.rotation.x = -Math.PI / 2;
  sh.scale.set(1.7, 1.7, 1.7);

  rig.pelvis = joint(g, 0, 0.55, 0);
  rig.pelvisBaseY = 0.55;

  /* stubby power legs */
  for (const s of [-1, 1]) {
    const hip = joint(rig.pelvis, 0.42 * s, -0.03, 0);
    bone(hip, cg("bThigh", () => new THREE.BoxGeometry(0.36, 0.34, 0.4)), dark, 0, -0.17, 0);
    const knee = joint(hip, 0, -0.34, 0);
    bone(knee, cg("bShin", () => new THREE.BoxGeometry(0.3, 0.26, 0.34)), dark, 0, -0.13, 0);
    const foot = joint(knee, 0, -0.26, 0);
    bone(foot, cg("bFoot", () => new THREE.BoxGeometry(0.42, 0.14, 0.56)), bodyMat, 0, -0.05, 0.08);
    hip.rotation.x = -0.1;
    knee.rotation.x = 0.25;
    foot.rotation.x = -0.12;
    rig.hips.push(hip);
    rig.knees.push(knee);
    rig.feet.push(foot);
  }

  rig.spine = joint(rig.pelvis, 0, 0.15, 0);
  rig.spine.rotation.x = 0.1;
  rig.chestG = joint(rig.spine, 0, 0.25, 0);
  const chest = bone(rig.chestG, r.geo.bruteBody, bodyMat, 0, 0.2, 0);
  rig.chest = chest;
  rig.chestBase.set(1, 1, 1);
  rig.parts.body = chest;

  bone(rig.chestG, cg("bPlate", () => new THREE.BoxGeometry(1.15, 0.95, 0.26)), dark, 0, 0.35, 0.5);
  for (let i = 0; i < 3; i++) {
    const spine = bone(rig.chestG, cg("bSpine", () => new THREE.ConeGeometry(0.14, 0.55, 5)), dark, 0, 1.0 - i * 0.55, -0.56);
    spine.rotation.x = -0.5;
  }

  /* massive arms: pauldron, slab upper arm, fist with brass knuckles */
  for (const s of [-1, 1]) {
    const shoulder = joint(rig.chestG, 0.85 * s, 0.88, 0);
    const pauldron = bone(shoulder, cg("bPauld", () => new THREE.SphereGeometry(0.34, 7, 6)), dark, 0, 0.08, 0);
    pauldron.scale.set(1, 0.7, 1);
    bone(shoulder, cg("bUpper", () => new THREE.BoxGeometry(0.32, 0.5, 0.34)), bodyMat, 0, -0.3, 0);
    const elbow = joint(shoulder, 0, -0.55, 0);
    elbow.rotation.x = -0.7;
    bone(elbow, cg("bFore", () => new THREE.BoxGeometry(0.28, 0.44, 0.3)), dark, 0, -0.22, 0);
    const hand = joint(elbow, 0, -0.46, 0);
    bone(hand, r.geo.fist, dark, 0, -0.12, 0);
    const knuck = bone(hand, cg("bKnuck", () => new THREE.ConeGeometry(0.09, 0.28, 4)), r.mat.brass, 0, -0.12, 0.3);
    knuck.rotation.x = Math.PI / 2;
    shoulder.rotation.z = s * 0.15;
    shoulder.rotation.x = -0.3;
    rig.shoulders.push(shoulder);
    rig.elbows.push(elbow);
    rig.hands.push(hand);
  }

  /* horned head with a working lower jaw */
  rig.neck = joint(rig.chestG, 0, 1.15, 0);
  rig.head = joint(rig.neck, 0, 0.18, 0);
  const headM = bone(rig.head, r.geo.bruteHead, dark, 0, 0, 0);
  rig.hitMeshes.push(chest, headM);
  for (const s of [-1, 1]) {
    const horn = bone(rig.head, r.geo.horn, dark, 0.3 * s, 0.37, 0);
    horn.rotation.z = -s * 0.5;
    bone(rig.head, r.geo.eye, r.basic.eye, 0.18 * s, 0.02, 0.34);
    const tusk = bone(rig.head, cg("bTusk", () => new THREE.ConeGeometry(0.07, 0.3, 5)), r.mat.brass, 0.24 * s, -0.28, 0.33);
    tusk.rotation.z = -s * 0.25;
  }
  rig.jaw = joint(rig.head, 0, -0.22, 0.18);
  bone(rig.jaw, cg("bJaw", () => new THREE.BoxGeometry(0.6, 0.16, 0.5)), dark, 0, -0.06, 0.08);

  if (boss) {
    const sac = bone(rig.chestG, r.geo.sac, r.basic.sac, 0, 0.25, -0.55);
    rig.parts.sac = sac;
    /* two-segment cape on hinge joints */
    rig.capeJ1 = joint(rig.chestG, 0, 0.75, -0.55);
    const capeGeo1 = cg("bCape1", () => {
      const p = new THREE.PlaneGeometry(2.6, 1.35);
      p.translate(0, -0.675, 0);
      return p;
    });
    bone(rig.capeJ1, capeGeo1, r.mat.cape, 0, 0, 0);
    rig.capeJ2 = joint(rig.capeJ1, 0, -1.3, 0);
    const capeGeo2 = cg("bCape2", () => {
      const p = new THREE.PlaneGeometry(2.2, 1.15);
      p.translate(0, -0.575, 0);
      return p;
    });
    bone(rig.capeJ2, capeGeo2, r.mat.cape, 0, 0, 0);
    rig.parts.cape = rig.capeJ1;
    bone(rig.pelvis, cg("bBelt", () => new THREE.BoxGeometry(1.65, 0.3, 1.1)), r.mat.brass, 0, 0.05, 0);
    for (const s of [-1, 0, 1]) {
      const horn = bone(rig.head, r.geo.horn, r.mat.brass, 0.32 * s, 0.44, 0.05);
      horn.rotation.z = -s * 0.45;
    }
    g.scale.set(1.5, 1.5, 1.5);
  }

  return rig;
}

/* ---------------------------------------------------------- spitter */
/*  six-legged horror: alternating tripod scuttle, rearing neck,
    hinged jaw + inflating acid sac on the spit windup              */

function buildSpitter(r: RigResources): AlienRig {
  const g = new THREE.Group();
  const rig = baseRig("spitter", g);

  const sh = bone(g, r.geo.shadow, r.basic.shadow, 0, 0.03, 0);
  sh.rotation.x = -Math.PI / 2;
  sh.scale.set(1.1, 1.1, 1.1);

  rig.pelvis = joint(g, 0, 0.66, 0);
  rig.pelvisBaseY = 0.66;
  rig.spine = rig.pelvis;
  rig.chestG = joint(rig.pelvis, 0, 0.05, 0);
  rig.chestG.rotation.x = 0.22;
  const chest = bone(rig.chestG, r.geo.spitBody, r.mat.spitter, 0, 0.05, 0);
  rig.chest = chest;
  rig.chestBase.set(1, 1, 1);
  rig.parts.body = chest;
  rig.hitMeshes.push(chest);

  /* six two-jointed legs around the body, local +Z aimed outward */
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const coxa = joint(rig.chestG, Math.cos(a) * 0.34, 0.02, Math.sin(a) * 0.34);
    coxa.rotation.y = Math.PI / 2 - a;
    const femur = joint(coxa, 0, 0, 0.05);
    bone(femur, cg("sFemur", () => new THREE.CylinderGeometry(0.1, 0.065, 0.34, 6)), r.mat.spitterD, 0, -0.15, 0);
    const knee = joint(femur, 0, -0.3, 0);
    bone(knee, cg("sTibia", () => new THREE.CylinderGeometry(0.06, 0.025, 0.36, 5)), r.mat.spitterD, 0, -0.17, 0);
    femur.rotation.z = 0.72;
    knee.rotation.x = -0.85;
    rig.legs.push({ femur, knee });
  }

  /* rearing neck + jawed head */
  rig.neck = joint(rig.chestG, 0, 0.92, 0.4);
  rig.head = joint(rig.neck, 0, 0.1, 0.06);
  const headM = bone(rig.head, r.geo.head, r.mat.spitterD, 0, 0, 0);
  headM.scale.set(1.1, 1, 1.1);
  rig.hitMeshes.push(headM);
  for (const s of [-1, 1]) bone(rig.head, r.geo.eye, r.basic.eye, 0.2 * s, 0.18, 0.24);
  rig.jaw = joint(rig.head, 0, -0.02, 0.12);
  const mouth = bone(rig.jaw, cg("sMouth", () => new THREE.CircleGeometry(0.17, 8)), r.basic.mouth, 0, -0.02, 0.24);
  mouth.rotation.x = -0.15;

  const sac = bone(rig.chestG, r.geo.sac, r.basic.sac, 0, 0.39, -0.42);
  rig.parts.sac = sac;
  const tail = bone(rig.chestG, cg("sTail", () => new THREE.ConeGeometry(0.14, 0.7, 6)), r.mat.spitter, 0, -0.16, -0.6);
  tail.rotation.x = -1.65;

  return rig;
}

export function buildAlienRig(kind: RigKind, r: RigResources): AlienRig {
  if (kind === "grunt") return buildGrunt(r);
  if (kind === "spitter") return buildSpitter(r);
  return buildBrute(r, kind === "boss");
}

/* ================================================================== */
/*  animation — layered channels summed onto the joint rotations      */
/* ================================================================== */

function updateHead(rig: AlienRig, e: RiggedEnemy, dt: number, player: THREE.Vector3, combat: boolean, t: number) {
  const gp = e.group.position;
  const hy = gp.y + HEAD_H[rig.kind] * e.groupBase;
  const dx = player.x - gp.x;
  const dz = player.z - gp.z;
  const dist = Math.hypot(dx, dz);
  let yawT = 0;
  let pitchT = 0;
  if (combat) {
    /* track the player relative to the body's facing */
    yawT = clamp(normAng(Math.atan2(dx, dz) - e.group.rotation.y), -1.05, 1.05) * 0.85;
    pitchT = clamp(-Math.atan2(player.y + 1.2 - hy, Math.max(0.5, dist)), -0.5, 0.5);
  } else {
    /* attract mode: idle glances around the plaza */
    rig.lookTimer -= dt;
    if (rig.lookTimer <= 0) {
      rig.lookTimer = 1.4 + Math.random() * 2.8;
      rig.glanceYaw = (Math.random() - 0.5) * 1.6;
    }
    yawT = rig.glanceYaw;
    pitchT = Math.sin(t * 0.7 + gp.x) * 0.12;
  }
  rig.headYaw += (yawT - rig.headYaw) * Math.min(1, dt * 7);
  rig.headPitch += (pitchT - rig.headPitch) * Math.min(1, dt * 6);

  /* pain shake on hit */
  let shX = 0;
  let shY = 0;
  if (rig.pain > 0) {
    rig.pain -= dt;
    const p = Math.max(0, rig.pain / 0.3);
    shY = Math.sin(t * 55) * 0.35 * p;
    shX = Math.sin(t * 47) * 0.2 * p;
  }
  rig.neck.rotation.y = rig.headYaw + shY;
  rig.neck.rotation.x = rig.headPitch + shX;
  rig.head.rotation.z = Math.sin(t * 1.3 + gp.z) * 0.04 + shY * 0.4;
}

function poseGrunt(rig: AlienRig, e: RiggedEnemy, t: number) {
  const w = rig.speedBlend * (1 - 0.75 * Math.max(rig.atk, rig.charge));
  const wind = ease(clamp(rig.atk / 0.4, 0, 1));
  const strike = ease(clamp((rig.atk - 0.35) / 0.45, 0, 1));
  const leaping = e.leapT > 0;

  /* legs */
  for (let s = 0; s < 2; s++) {
    const ph = rig.phase + s * Math.PI;
    const swing = Math.sin(ph);
    let hipX = swing * 0.78 * w - 0.1;
    let kneeX = Math.max(0, -Math.sin(ph - 0.75)) * 0.95 * w + 0.26;
    let footX = -swing * 0.35 * w - 0.1;
    if (leaping) {
      hipX = -1.15;
      kneeX = 1.7;
      footX = 0.6;
    }
    rig.hips[s].rotation.x = hipX;
    rig.knees[s].rotation.x = kneeX;
    rig.feet[s].rotation.x = footX;
  }

  /* pelvis: bounce, roll, twist */
  rig.pelvis.position.y = rig.pelvisBaseY + Math.abs(Math.sin(rig.phase)) * 0.07 * w + Math.sin(t * 2.2) * 0.008;
  rig.pelvis.rotation.z = Math.sin(rig.phase) * 0.06 * w;
  rig.pelvis.rotation.y = Math.sin(rig.phase) * 0.1 * w;

  /* spine + chest: forward lean, counter-twist, attack hunch */
  const breathe = Math.sin(t * 2.6) * 0.025 * (1 - w);
  rig.spine.rotation.y = Math.sin(rig.phase + Math.PI) * 0.14 * w;
  rig.chestG.rotation.x = breathe + 0.55 * strike - 0.3 * wind;
  rig.chestG.rotation.y = Math.sin(rig.phase) * -0.1 * w;
  rig.chestG.position.z = 0.32 * strike;

  /* arms: anti-phase swing → windup → double claw swipe */
  for (let s = 0; s < 2; s++) {
    const ph = rig.phase + (s === 0 ? Math.PI : 0);
    let shX = Math.sin(ph) * 0.55 * w - 0.12;
    let elX = -0.35 + Math.sin(ph - 0.6) * 0.25 * w;
    if (leaping) {
      shX = -0.95;
      elX = -0.5;
    }
    shX += -1.75 * (wind - strike) + 1.05 * strike;
    elX += -1.15 * wind + 1.4 * strike;
    rig.shoulders[s].rotation.x = shX;
    rig.elbows[s].rotation.x = elX;
    rig.hands[s].rotation.x = Math.sin(ph - 1.1) * 0.3 * w + 0.5 * strike;
    const splay = 1 + 0.35 * strike;
    rig.hands[s].scale.set(splay, splay, splay);
  }

  /* jaw snaps with the strike */
  if (rig.jaw) rig.jaw.rotation.x = 0.5 * strike + Math.sin(t * 2.2) * 0.04;
  rig.neck.rotation.x += 0.35 * strike;
}

function poseBrute(rig: AlienRig, e: RiggedEnemy, t: number) {
  const boss = rig.kind === "boss";
  const chW = rig.charge;
  const w = rig.speedBlend * (1 - 0.7 * Math.max(rig.atk, chW));
  const wind = ease(clamp(rig.atk / 0.42, 0, 1));
  const strike = ease(clamp((rig.atk - 0.38) / 0.45, 0, 1));
  const roarW = clamp(rig.roar, 0, 1);

  /* legs — heavy plodding gait, wider when charging */
  for (let s = 0; s < 2; s++) {
    const ph = rig.phase + s * Math.PI;
    const swing = Math.sin(ph);
    const amp = 0.52 + chW * 0.28;
    rig.hips[s].rotation.x = swing * amp * w - 0.08 + (chW > 0 ? Math.sin(ph * 2) * 0.18 * chW : 0);
    rig.knees[s].rotation.x = Math.max(0, -Math.sin(ph - 0.7)) * 0.75 * w + 0.22;
    rig.feet[s].rotation.x = -swing * 0.3 * w - 0.08;
  }

  rig.pelvis.position.y = rig.pelvisBaseY + Math.abs(Math.sin(rig.phase)) * 0.05 * w + Math.sin(t * 1.8) * 0.008;
  rig.pelvis.rotation.y = Math.sin(rig.phase) * 0.12 * w;

  /* torso: breathing hulk, charge lean + shake, slam hunch, roar swell */
  const breathe = Math.sin(t * 2.0) * 0.02 * (1 - w);
  rig.spine.rotation.x = 0.42 * chW + 0.5 * strike - 0.15 * wind - 0.25 * roarW + breathe;
  rig.spine.rotation.y = Math.sin(rig.phase + Math.PI) * 0.16 * w;
  rig.chestG.rotation.z = Math.sin(t * 42) * 0.09 * chW + Math.sin(rig.phase) * -0.05 * w;
  rig.chestG.position.z = 0.4 * strike;

  /* arms: guard → alternating charge pump → overhead slam */
  for (let s = 0; s < 2; s++) {
    const ph = rig.phase + s * Math.PI;
    let shX = -0.3 + Math.sin(ph) * 0.45 * w;
    let shZ = (s === 0 ? -1 : 1) * 0.15;
    let elX = -0.7 + Math.sin(ph - 0.5) * 0.2 * w;
    shX += Math.sin(ph * 2) * 0.85 * chW; /* charge pump */
    shX += -2.3 * wind + 1.55 * strike; /* slam arc */
    elX += -0.5 * wind + 0.55 * strike;
    shZ += (s === 0 ? -1 : 1) * 1.05 * roarW; /* roar spread */
    rig.shoulders[s].rotation.x = shX;
    rig.shoulders[s].rotation.z = shZ;
    rig.elbows[s].rotation.x = elX;
    rig.hands[s].rotation.x = Math.sin(ph - 1.0) * 0.25 * w - 0.4 * strike;
  }

  if (rig.jaw) rig.jaw.rotation.x = 0.9 * roarW + 0.45 * strike;
  if (rig.capeJ1) {
    rig.capeJ1.rotation.x = 0.16 + Math.sin(t * 6) * 0.1 + rig.speedBlend * 0.55 + 0.3 * roarW;
    rig.capeJ1.rotation.y = Math.sin(t * 2.3) * 0.08;
  }
  if (rig.capeJ2) {
    rig.capeJ2.rotation.x = Math.sin(t * 6 - 0.9) * 0.18 + rig.speedBlend * 0.4;
  }
  if (boss && rig.jaw) rig.jaw.rotation.x = Math.max(rig.jaw.rotation.x, 0.3 * bell(clamp(rig.roar * 1.2, 0, 1)));
}

function poseSpitter(rig: AlienRig, e: RiggedEnemy, t: number) {
  const w = rig.speedBlend;
  const spitW = clamp(1 - e.spitCd / 0.55, 0, 1);

  /* tripod scuttle — even legs against odd legs, quick skitter phase */
  for (let i = 0; i < rig.legs.length; i++) {
    const ph = rig.phase * 1.6 + (i % 2 === 0 ? 0 : Math.PI) + Math.floor(i / 2) * 0.55;
    const lift = Math.max(0, Math.sin(ph));
    const swing = Math.cos(ph);
    const leg = rig.legs[i];
    leg.femur.rotation.x = swing * 0.5 * w;
    leg.femur.rotation.z = 0.72 + lift * 0.3 * w;
    leg.knee.rotation.x = -0.85 - lift * 0.75 * w;
  }

  rig.pelvis.position.y = rig.pelvisBaseY + Math.abs(Math.sin(rig.phase * 1.6)) * 0.045 * w + Math.sin(t * 2.4) * 0.008;
  rig.pelvis.rotation.z = Math.sin(rig.phase * 1.6) * 0.05 * w;

  /* body: skitter pitch, rears back on spit windup */
  rig.chestG.rotation.x = 0.22 + Math.sin(rig.phase * 3.2) * 0.05 * w - 0.55 * spitW;

  if (rig.jaw) rig.jaw.rotation.x = 1.15 * spitW + Math.sin(t * 3) * 0.05;
  rig.neck.rotation.x += -0.35 * spitW;
}

export function updateAlienRig(
  e: RiggedEnemy,
  dt: number,
  player: THREE.Vector3,
  combat: boolean,
  t: number
) {
  const rig = e.rig;
  if (e.flashT > 0) rig.pain = Math.max(rig.pain, 0.3);

  /* locomotion intensity from real world displacement */
  const gp = e.group.position;
  const spd = Math.hypot(gp.x - rig.prevPos.x, gp.z - rig.prevPos.z) / Math.max(dt, 1e-4);
  rig.prevPos.set(gp.x, gp.y, gp.z);
  const speed01 = clamp(spd / (e.speed * 1.5 + 2.5), 0, 1);
  rig.speedBlend += (speed01 - rig.speedBlend) * Math.min(1, dt * 5);
  rig.phase += dt * (3.4 + rig.speedBlend * 7.0) * (e.kind === "spitter" ? 1.35 : 1);

  /* attack / charge envelopes smoothed so strikes have windup + follow-through */
  const atkT = e.lungeT > 0 ? 1 - e.lungeT / 0.3 : 0;
  rig.atk += (atkT - rig.atk) * Math.min(1, dt * 16);
  rig.charge += ((e.chargeT > 0 ? 1 : 0) - rig.charge) * Math.min(1, dt * 10);
  if (rig.roar > 0) rig.roar = Math.max(0, rig.roar - dt * 0.9);

  updateHead(rig, e, dt, player, combat, t);

  if (e.kind === "grunt") poseGrunt(rig, e, t);
  else if (e.kind === "spitter") poseSpitter(rig, e, t);
  else poseBrute(rig, e, t);

  /* hit squash on the torso, roar swell layered on top */
  const pop = e.hitPop > 0 ? 1 + (e.hitPop / 0.22) * 0.22 : 1;
  const swell = 1 + clamp(rig.roar, 0, 1) * 0.08;
  rig.chest.scale.set(
    rig.chestBase.x * pop * swell,
    rig.chestBase.y / pop * swell,
    rig.chestBase.z * pop * swell
  );

  /* acid sac throbs, inflates on spit windup */
  if (rig.parts.sac) {
    const spitW = e.kind === "spitter" || e.boss ? clamp(1 - e.spitCd / 0.55, 0, 1) : 0;
    const pulse = 1 + Math.sin(t * 5 + gp.x) * 0.15 + spitW * 0.6;
    rig.parts.sac.scale.set(pulse, pulse, pulse);
  }
}
