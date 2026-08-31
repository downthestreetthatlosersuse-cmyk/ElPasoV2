import * as THREE from "three";

/* ------------------------------------------------------------------ */
/* THE XENOFORGED — one race, four loadouts.                          */
/* Every alien shares the same anatomy: necro-green flesh over a      */
/* gunmetal endoskeleton, copper cabling, an emerald power core sunk  */
/* into the chest, and a red scanner optic where the right eye was.   */
/* Class is expressed through scale and cybernetics, not species:     */
/*   grunt   "DRONE"     — blade servo-arm, spine port, thin plating  */
/*   spitter "RIFLEMAN"  — right arm replaced by a charge-coil blaster*/
/*   brute   "ENFORCER"  — hydraulic piston fists, armor plate, vents */
/*   boss    "WARLORD"   — twin shoulder plasma pods, crown, cape     */
/*                                                                    */
/* Each rig is a real joint hierarchy (pelvis → spine → chest → neck  */
/* → head → jaw, two-jointed arms/legs). Three independent animation  */
/* layers are summed every frame: locomotion, attack, head tracking.  */
/* ------------------------------------------------------------------ */

export type RigKind = "grunt" | "brute" | "spitter" | "boss";

export interface RigMats {
  flesh: THREE.Material;
  fleshD: THREE.Material;
  plating: THREE.Material;
  dark: THREE.Material;
  brass: THREE.Material;
  joint: THREE.Material;
  cable: THREE.Material;
  core: THREE.MeshBasicMaterial;
  optic: THREE.MeshBasicMaterial;
  mouth: THREE.MeshBasicMaterial;
  eye: THREE.MeshBasicMaterial;
  shadow: THREE.MeshBasicMaterial;
  cape: THREE.Material;
  shadowGeo: THREE.BufferGeometry;
}

export interface AlienRig {
  root: THREE.Group;
  pelvis: THREE.Group;
  spine: THREE.Group;
  chest: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  jaw: THREE.Group;
  shoulderL: THREE.Group;
  shoulderR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
  handL: THREE.Group;
  handR: THREE.Group;
  hipL: THREE.Group;
  hipR: THREE.Group;
  kneeL: THREE.Group;
  kneeR: THREE.Group;
  footL: THREE.Group;
  footR: THREE.Group;
  legs: { hip: THREE.Group; knee: THREE.Group }[];
  body: THREE.Mesh;
  headMesh: THREE.Mesh;
  hitMeshes: THREE.Mesh[];
  muzzle: THREE.Object3D;
  core: THREE.Mesh;
  optic: THREE.Mesh;
  chargeCell?: THREE.Mesh;
  chargeMat?: THREE.MeshBasicMaterial;
  cables: THREE.Mesh[];
  capeSegs: THREE.Mesh[];
  animT: number;
  stepPhase: number;
  atkT: number;
  atkDur: number;
  prevPos: THREE.Vector3;
  moveAmt: number;
  twitchT: number;
  twitchNext: number;
  twitchAmt: number;
  phase: number;
  roar: number;
}

const TAU = Math.PI * 2;
const damp = (a: number, b: number, l: number, dt: number) =>
  THREE.MathUtils.damp(a, b, l, dt);

function grp(parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

/* ------------------------------------------------------------------ */
/* shared rig geometry — created once, reused by every alien          */
/* ------------------------------------------------------------------ */

const G: Record<string, THREE.BufferGeometry> = {};
function geo(): Record<string, THREE.BufferGeometry> {
  if (G.sock) return G;
  G.thigh = new THREE.BoxGeometry(0.22, 0.52, 0.26);
  G.shin = new THREE.BoxGeometry(0.17, 0.48, 0.2);
  G.brace = new THREE.BoxGeometry(0.21, 0.3, 0.24);
  G.foot = new THREE.BoxGeometry(0.2, 0.1, 0.4);
  G.toe = new THREE.ConeGeometry(0.045, 0.16, 5);
  G.kneeCap = new THREE.CylinderGeometry(0.09, 0.09, 0.24, 8);
  G.upperArm = new THREE.BoxGeometry(0.17, 0.4, 0.19);
  G.foreArm = new THREE.BoxGeometry(0.15, 0.38, 0.17);
  G.elbowCap = new THREE.CylinderGeometry(0.075, 0.075, 0.2, 8);
  G.handBlk = new THREE.BoxGeometry(0.16, 0.2, 0.2);
  G.blade = new THREE.BoxGeometry(0.045, 0.5, 0.14);
  G.finger = new THREE.ConeGeometry(0.035, 0.16, 5);
  G.neckRing = new THREE.CylinderGeometry(0.17, 0.2, 0.1, 10);
  G.socket = new THREE.CylinderGeometry(0.085, 0.085, 0.06, 10);
  G.eyeBall = new THREE.SphereGeometry(0.075, 6, 5);
  G.opticLens = new THREE.SphereGeometry(0.062, 8, 6);
  G.rib = new THREE.BoxGeometry(0.62, 0.05, 0.14);
  G.coreClamp = new THREE.CylinderGeometry(0.19, 0.19, 0.06, 12);
  G.throat = new THREE.SphereGeometry(0.07, 6, 5);
  G.tooth = new THREE.ConeGeometry(0.035, 0.11, 5);
  G.cableSeg = new THREE.CylinderGeometry(0.022, 0.022, 1, 5);
  G.vent = new THREE.BoxGeometry(0.4, 0.28, 0.16);
  G.ventSlit = new THREE.BoxGeometry(0.3, 0.035, 0.02);
  G.port = new THREE.CylinderGeometry(0.1, 0.12, 0.1, 8);
  G.hornS = new THREE.ConeGeometry(0.06, 0.3, 6);
  /* blaster */
  G.blTube = new THREE.CylinderGeometry(0.07, 0.085, 0.52, 8);
  G.blCoil = new THREE.CylinderGeometry(0.105, 0.105, 0.05, 10);
  G.blCell = new THREE.BoxGeometry(0.09, 0.22, 0.11);
  G.blMuzzle = new THREE.CylinderGeometry(0.1, 0.07, 0.09, 8);
  G.blProng = new THREE.BoxGeometry(0.03, 0.14, 0.03);
  /* warlord pods */
  G.podBase = new THREE.BoxGeometry(0.3, 0.3, 0.3);
  G.podBarrel = new THREE.CylinderGeometry(0.06, 0.07, 0.55, 8);
  G.podRing = new THREE.CylinderGeometry(0.085, 0.085, 0.05, 8);
  return G;
}

/* ------------------------------------------------------------------ */
/* rig construction                                                   */
/* ------------------------------------------------------------------ */

export function buildAlienRig(kind: RigKind, g: THREE.Group, m: RigMats): AlienRig {
  const gg = geo();
  const drone = kind === "grunt";
  const enforcer = kind === "brute" || kind === "boss";
  const warlord = kind === "boss";
  const rifleman = kind === "spitter";

  /* warlords tower over the rest of the race */
  if (warlord) g.scale.setScalar(1.5);

  let blasterMuzzle: THREE.Object3D | null = null;
  let blasterCell: THREE.Mesh | null = null;
  let blasterCellMat: THREE.MeshBasicMaterial | null = null;
  const capeSegs: THREE.Mesh[] = [];

  /* proportions per class — same skeleton, different bodies */
  const P = drone
    ? { hipY: 0.82, spine: 0.2, chestY: 0.26, neckY: 0.52, shoulder: 0.36, shX: 0.42, headR: 1 }
    : { hipY: 1.02, spine: 0.3, chestY: 0.4, neckY: 0.66, shoulder: 0.52, shX: 0.72, headR: 1.15 };

  const mesh = (
    geoM: THREE.BufferGeometry,
    mat: THREE.Material,
    parent: THREE.Object3D,
    x = 0, y = 0, z = 0,
    rx = 0, ry = 0, rz = 0
  ): THREE.Mesh => {
    const mm = new THREE.Mesh(geoM, mat);
    mm.position.set(x, y, z);
    mm.rotation.set(rx, ry, rz);
    parent.add(mm);
    return mm;
  };

  /* ---------- root / pelvis ---------- */
  const root = grp(g);
  const pelvis = grp(root, 0, P.hipY, 0);
  mesh(new THREE.BoxGeometry(drone ? 0.5 : 0.86, drone ? 0.3 : 0.42, drone ? 0.34 : 0.5), m.flesh, pelvis, 0, 0, 0);
  mesh(new THREE.BoxGeometry(drone ? 0.54 : 0.92, 0.1, drone ? 0.38 : 0.54), m.plating, pelvis, 0, drone ? 0.14 : 0.2, 0);
  for (const s of [-1, 1]) {
    mesh(gg.ventSlit, m.dark, pelvis, s * (drone ? 0.2 : 0.36), -0.06, drone ? 0.16 : 0.24, Math.PI / 2, 0, 0);
  }

  /* ---------- spine + chest ---------- */
  const spine = grp(pelvis, 0, P.spine, 0);
  const chest = grp(spine, 0, P.chestY, 0);

  const chestGeo = new THREE.BoxGeometry(
    drone ? 0.62 : 1.3,
    drone ? 0.56 : 0.94,
    drone ? 0.42 : 0.72
  );
  const body = mesh(chestGeo, m.flesh, chest, 0, 0.05, 0);

  /* sternum plate — every class wears its fuse box on its chest */
  mesh(new THREE.BoxGeometry(drone ? 0.4 : 0.8, drone ? 0.5 : 0.82, 0.1), m.plating, chest, 0, 0.06, drone ? 0.18 : 0.32);

  /* exposed power core — the emerald heart of the race */
  const coreR = drone ? 0.12 : warlord ? 0.2 : 0.16;
  const coreGeo = new THREE.SphereGeometry(coreR, 10, 8);
  const core = mesh(coreGeo, m.core, chest, 0, 0.1, drone ? 0.26 : 0.4);
  mesh(gg.coreClamp, m.brass, chest, 0, 0.1, drone ? 0.24 : 0.38, Math.PI / 2, 0, 0);
  for (const ry of [-0.4, 0.4]) {
    mesh(gg.rib, m.dark, chest, 0, 0.1 + ry * 0.5, drone ? 0.22 : 0.36, 0, ry, 0);
  }

  /* spine column + back hardware */
  mesh(new THREE.BoxGeometry(drone ? 0.14 : 0.24, P.chestY + P.spine + 0.2, drone ? 0.14 : 0.2), m.dark, spine, 0, -(P.chestY + P.spine) * 0.32, drone ? -0.22 : -0.36);
  if (enforcer) {
    mesh(gg.vent, m.plating, chest, 0, 0.18, -0.42);
    for (let i = 0; i < 3; i++) mesh(gg.ventSlit, m.dark, chest, 0, 0.26 - i * 0.08, -0.51);
  } else {
    mesh(gg.port, m.plating, chest, 0, 0.2, -0.24, Math.PI / 2, 0, 0);
  }

  /* copper cabling — hangs off the spine, sways in update */
  const cables: THREE.Mesh[] = [];
  const cable = (parent: THREE.Object3D, x: number, y: number, z: number, len: number, rx: number, rz: number) => {
    const c = mesh(gg.cableSeg, m.cable, parent, x, y, z, rx, 0, rz);
    c.scale.y = len;
    c.position.y = y - len * 0.5 * Math.cos(rx);
    cables.push(c);
    return c;
  };
  cable(spine, drone ? 0.1 : 0.18, 0.1, drone ? -0.24 : -0.4, drone ? 0.5 : 0.7, 0.16, 0.1);
  cable(spine, drone ? -0.08 : -0.16, 0.14, drone ? -0.23 : -0.38, drone ? 0.42 : 0.6, 0.12, -0.14);
  cable(chest, drone ? 0.22 : 0.4, -0.06, drone ? 0.16 : 0.3, drone ? 0.4 : 0.55, -0.1, 0.18);

  /* ---------- neck + head ---------- */
  const neck = grp(chest, 0, P.neckY, 0);
  mesh(gg.neckRing, m.plating, neck, 0, 0.02, 0); /* cervical port ring — race signature */
  mesh(new THREE.CylinderGeometry(drone ? 0.1 : 0.16, drone ? 0.12 : 0.18, 0.16, 8), m.fleshD, neck, 0, 0.1, 0);

  const head = grp(neck, 0, drone ? 0.3 : 0.4, 0);
  const headGeo = new THREE.BoxGeometry(drone ? 0.44 : 0.66, drone ? 0.4 : 0.52, drone ? 0.46 : 0.6);
  const headMesh = mesh(headGeo, m.flesh, head, 0, 0.05, 0);
  mesh(new THREE.BoxGeometry(drone ? 0.46 : 0.68, 0.08, drone ? 0.48 : 0.62), m.plating, head, 0, drone ? 0.24 : 0.3, 0); /* cranial cap */

  /* face — one wet organic eye, one red scanner optic. always. */
  const eyeY = drone ? 0.09 : 0.12;
  const eyeZ = drone ? 0.23 : 0.3;
  const eyeX = drone ? 0.11 : 0.17;
  mesh(gg.socket, m.dark, head, -eyeX, eyeY, eyeZ, Math.PI / 2, 0, 0);
  mesh(gg.eyeBall, m.eye, head, -eyeX, eyeY, eyeZ + 0.02);
  mesh(gg.socket, m.plating, head, eyeX, eyeY, eyeZ, Math.PI / 2, 0, 0);
  const optic = mesh(gg.opticLens, m.optic, head, eyeX, eyeY, eyeZ + 0.02);
  if (drone) {
    /* drones sprout a twitching antennae stub above the optic */
    const ant = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.24, 4), m.dark, head, eyeX + 0.06, 0.36, 0.05, 0, 0, -0.3);
    mesh(new THREE.SphereGeometry(0.03, 6, 5), m.optic, ant, 0, 0.13, 0);
  }

  /* hinged jaw with teeth + throat glow */
  const jaw = grp(head, 0, drone ? -0.12 : -0.16, drone ? 0.14 : 0.2);
  mesh(new THREE.BoxGeometry(drone ? 0.36 : 0.54, drone ? 0.12 : 0.16, drone ? 0.3 : 0.4), m.fleshD, jaw, 0, -0.05, 0.04);
  for (const s of [-1, 1]) {
    mesh(gg.tooth, m.plating, jaw, s * (drone ? 0.1 : 0.16), 0.0, 0.14, Math.PI, 0, 0);
  }
  mesh(gg.throat, m.mouth, jaw, 0, 0.03, -0.05);

  if (warlord) {
    for (const s of [-1, 0, 1]) {
      mesh(gg.hornS, m.brass, head, 0.2 * s, 0.4, -0.05, 0, 0, -s * 0.45);
    }
    mesh(new THREE.BoxGeometry(0.2, 0.14, 0.1), m.brass, head, 0, 0.1, 0.32); /* jaw guard */
  }

  /* ---------- arms ---------- */
  const shoulderL = grp(chest, -P.shX, P.shoulder, 0);
  const shoulderR = grp(chest, P.shX, P.shoulder, 0);

  const buildOrganicArm = (shoulder: THREE.Group, elbowOut: THREE.Group[], handOut: THREE.Group[], bladeArm: boolean) => {
    mesh(new THREE.SphereGeometry(drone ? 0.11 : 0.19, 8, 6), m.plating, shoulder); /* shoulder pad */
    mesh(gg.upperArm, enforcer ? m.plating : m.flesh, shoulder, 0, -0.2, 0);
    if (enforcer) mesh(new THREE.BoxGeometry(0.24, 0.2, 0.26), m.dark, shoulder, 0, -0.34, 0); /* hydraulic sleeve */
    const elbow = grp(shoulder, 0, -0.4, 0);
    mesh(gg.elbowCap, m.joint, elbow, 0, 0, 0, 0, 0, Math.PI / 2);
    if (bladeArm) {
      /* drone servo-blade: the forearm IS the weapon */
      mesh(new THREE.BoxGeometry(0.12, 0.2, 0.14), m.plating, elbow, 0, -0.1, 0);
      mesh(gg.blade, m.dark, elbow, 0, -0.42, 0.02);
      mesh(new THREE.BoxGeometry(0.02, 0.44, 0.02), m.plating, elbow, 0, -0.42, 0.1);
      mesh(new THREE.SphereGeometry(0.05, 6, 5), m.core, elbow, 0, -0.16, 0.1);
    } else {
      mesh(gg.foreArm, enforcer ? m.dark : m.fleshD, elbow, 0, -0.19, 0);
      if (enforcer) mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.2, 8), m.plating, elbow, 0, -0.3, 0); /* piston fist */
      const hand = grp(elbow, 0, -0.4, 0);
      mesh(gg.handBlk, enforcer ? m.plating : m.fleshD, hand, 0, -0.08, 0);
      for (const s of [-1, 1]) {
        mesh(gg.finger, enforcer ? m.brass : m.dark, hand, s * 0.05, -0.2, 0.03, Math.PI, 0, 0);
      }
      handOut.push(hand);
    }
    elbowOut.push(elbow);
  };

  const elbowLs: THREE.Group[] = [];
  const elbowRs: THREE.Group[] = [];
  const handLs: THREE.Group[] = [];
  const handRs: THREE.Group[] = [];

  if (rifleman) {
    /* left arm stays flesh; right arm is gone — replaced by the blaster */
    buildOrganicArm(shoulderL, elbowLs, handLs, false);
    mesh(new THREE.SphereGeometry(0.13, 8, 6), m.plating, shoulderR);
    mesh(gg.upperArm, m.plating, shoulderR, 0, -0.2, 0);
    mesh(new THREE.BoxGeometry(0.22, 0.18, 0.24), m.dark, shoulderR, 0, -0.33, 0);
    const elbowR = grp(shoulderR, 0, -0.4, 0);
    mesh(gg.elbowCap, m.joint, elbowR, 0, 0, 0, 0, 0, Math.PI / 2);
    /* charge-coil blaster assembly hangs along the forearm axis */
    mesh(gg.blTube, m.dark, elbowR, 0, -0.3, 0);
    mesh(gg.blCoil, m.brass, elbowR, 0, -0.16, 0);
    mesh(gg.blCoil, m.brass, elbowR, 0, -0.3, 0);
    mesh(gg.blCoil, m.brass, elbowR, 0, -0.44, 0);
    const chargeMat = new THREE.MeshBasicMaterial({ color: 0x59f0ff, transparent: true, opacity: 0.35 });
    const chargeCell = mesh(gg.blCell, chargeMat, elbowR, 0.0, -0.3, 0.11);
    mesh(gg.blMuzzle, m.plating, elbowR, 0, -0.58, 0);
    for (const s of [-1, 1]) mesh(gg.blProng, m.dark, elbowR, s * 0.06, -0.66, 0);
    const muzzle = grp(elbowR, 0, -0.72, 0);
    mesh(new THREE.SphereGeometry(0.05, 6, 5), m.core, elbowR, 0, -0.58, 0);
    elbowRs.push(elbowR);
    handRs.push(elbowR);
    blasterMuzzle = muzzle;
    blasterCell = chargeCell;
    blasterCellMat = chargeMat;
  } else {
    buildOrganicArm(shoulderL, elbowLs, handLs, drone);
    buildOrganicArm(shoulderR, elbowRs, handRs, drone);
  }

  /* ---------- legs (digitigrade, metal foot-braces — shared by the race) ---------- */
  const legs: { hip: THREE.Group; knee: THREE.Group }[] = [];
  const hipLs: THREE.Group[] = [];
  const hipRs: THREE.Group[] = [];
  const kneeLs: THREE.Group[] = [];
  const kneeRs: THREE.Group[] = [];
  const footLs: THREE.Group[] = [];
  const footRs: THREE.Group[] = [];

  const buildLeg = (side: number) => {
    const hip = grp(pelvis, side * (drone ? 0.18 : 0.3), -0.1, 0);
    mesh(new THREE.SphereGeometry(drone ? 0.1 : 0.16, 8, 6), m.joint, hip);
    mesh(gg.thigh, m.flesh, hip, 0, -0.26, 0);
    if (enforcer) mesh(new THREE.BoxGeometry(0.28, 0.3, 0.3), m.plating, hip, 0, -0.22, 0.02);
    const knee = grp(hip, 0, -0.52, 0);
    mesh(gg.kneeCap, m.joint, knee, 0, 0, 0, 0, 0, Math.PI / 2);
    mesh(gg.shin, m.fleshD, knee, 0, -0.24, 0);
    mesh(gg.brace, m.plating, knee, 0, -0.2, 0.03);
    const ankle = grp(knee, 0, -0.48, 0);
    mesh(gg.foot, m.dark, ankle, 0, -0.05, 0.08);
    for (const s of [-1, 1]) {
      mesh(gg.toe, m.plating, ankle, s * 0.06, -0.08, 0.3, Math.PI / 2 + 0.4, 0, 0);
    }
    legs.push({ hip, knee });
    (side < 0 ? hipLs : hipRs).push(hip);
    (side < 0 ? kneeLs : kneeRs).push(knee);
    (side < 0 ? footLs : footRs).push(ankle);
  };

  if (rifleman) {
    /* six legs — front pair doubled, alternating tripod gait in the animator */
    const angles = [-0.95, -0.45, 0.45, -0.95, 0.45, 0.95];
    for (let i = 0; i < 6; i++) {
      const side = i < 3 ? -1 : 1;
      const hip = grp(pelvis, side * 0.2, -0.05, angles[i] * 0.55);
      hip.rotation.y = angles[i];
      mesh(gg.thigh, m.flesh, hip, 0, -0.22, 0);
      const knee = grp(hip, 0, -0.44, 0);
      mesh(gg.kneeCap, m.joint, knee, 0, 0, 0, 0, 0, Math.PI / 2);
      mesh(gg.shin, m.fleshD, knee, 0, -0.2, 0);
      mesh(gg.brace, m.plating, knee, 0, -0.17, 0.03);
      const ankle = grp(knee, 0, -0.4, 0);
      mesh(gg.foot, m.dark, ankle, 0, -0.04, 0.07);
      legs.push({ hip, knee });
      (i === 1 ? hipLs : i === 4 ? hipRs : []).push(hip);
      (i === 1 ? kneeLs : i === 4 ? kneeRs : []).push(knee);
      (i === 1 ? footLs : i === 4 ? footRs : []).push(ankle);
    }
  } else {
    buildLeg(-1);
    buildLeg(1);
  }

  /* ---------- warlord shoulder plasma pods ---------- */
  let muzzle: THREE.Object3D = chest;
  if (warlord) {
    const pod = grp(chest, 0.62, 0.62, -0.1);
    mesh(gg.podBase, m.plating, pod);
    mesh(new THREE.BoxGeometry(0.2, 0.36, 0.2), m.dark, pod, 0, -0.3, 0);
    for (const s of [-1, 1]) {
      const barrel = grp(pod, s * 0.1, 0.1, 0.18);
      barrel.rotation.x = Math.PI / 2;
      mesh(gg.podBarrel, m.dark, barrel, 0, 0, 0);
      mesh(gg.podRing, m.brass, barrel, 0, 0.14, 0);
      mesh(gg.podRing, m.brass, barrel, 0, -0.06, 0);
      mesh(new THREE.SphereGeometry(0.045, 6, 5), m.core, barrel, 0, 0.28, 0);
    }
    muzzle = grp(pod, 0, 0.1, 0.5);
    /* tattered organic remnant — two chained cape segments trail the warlord */
    const cape1 = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.35), m.cape);
    cape1.position.set(0, -0.45, -0.44);
    cape1.rotation.x = 0.18;
    chest.add(cape1);
    const cape2 = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.15), m.cape);
    cape2.position.set(0, -1.2, -0.02);
    cape2.rotation.x = 0.12;
    cape1.add(cape2);
    capeSegs.push(cape1, cape2);
    mesh(new THREE.BoxGeometry(1.25, 0.24, 0.85), m.brass, pelvis, 0, 0.05, 0); /* war belt */
  }
  if (rifleman && blasterMuzzle) muzzle = blasterMuzzle;

  /* ---------- shadow ---------- */
  const sh = new THREE.Mesh(m.shadowGeo, m.shadow);
  sh.rotation.x = -Math.PI / 2;
  sh.position.y = 0.03;
  const ss = drone ? 1 : 1.7;
  sh.scale.set(ss, ss, ss);
  g.add(sh);

  return {
    root,
    pelvis,
    spine,
    chest,
    neck,
    head,
    jaw,
    shoulderL,
    shoulderR,
    elbowL: elbowLs[0] ?? shoulderL,
    elbowR: elbowRs[0] ?? shoulderR,
    handL: handLs[0] ?? shoulderL,
    handR: handRs[0] ?? shoulderR,
    hipL: hipLs[0] ?? pelvis,
    hipR: hipRs[0] ?? pelvis,
    kneeL: kneeLs[0] ?? pelvis,
    kneeR: kneeRs[0] ?? pelvis,
    footL: footLs[0] ?? pelvis,
    footR: footRs[0] ?? pelvis,
    legs,
    body,
    headMesh,
    hitMeshes: [body, headMesh],
    muzzle,
    core,
    optic,
    chargeCell: rifleman ? blasterCell ?? undefined : undefined,
    chargeMat: rifleman ? blasterCellMat ?? undefined : undefined,
    cables,
    capeSegs,
    roar: 0,
    animT: Math.random() * 10,
    stepPhase: 0,
    atkT: 1e9,
    atkDur: 0.6,
    prevPos: new THREE.Vector3(),
    moveAmt: 0,
    twitchT: 0,
    twitchNext: 2 + Math.random() * 5,
    twitchAmt: 0,
    phase: Math.random() * TAU,
  };
}

/* ------------------------------------------------------------------ */
/* animation — three independent layers: locomotion / attack / head   */
/* ------------------------------------------------------------------ */

export function updateAlienRig(
  rig: AlienRig,
  dt: number,
  kind: RigKind,
  boss: boolean,
  playerPos: THREE.Vector3,
  enemyWorldPos: THREE.Vector3,
  enemyYaw: number,
  moving: boolean,
  speed: number,
  combat: boolean,
  leapT: number,
  leapDur: number,
  attackT: number,
  attackMax: number,
  chargeT: number,
  spitCharge: number,
  hitPop: number,
  flashT: number,
  time: number
) {
  const drone = kind === "grunt";
  const enforcer = kind === "brute" || boss;
  const rifleman = kind === "spitter";
  const t = rig.animT + dt;
  rig.animT = t;

  /* ---- displacement-driven locomotion clock ---- */
  const dx = enemyWorldPos.x - rig.prevPos.x;
  const dz = enemyWorldPos.z - rig.prevPos.z;
  const dist = Math.hypot(dx, dz);
  rig.prevPos.copy(enemyWorldPos);
  const targetMove = Math.min(1, (dist / Math.max(dt, 1e-4)) / Math.max(speed, 0.1));
  rig.moveAmt = damp(rig.moveAmt, moving ? Math.max(targetMove, 0.25) : 0, 8, dt);
  const mv = rig.moveAmt;
  if (mv > 0.02 && dist > 1e-5) {
    const cadence = drone ? 1.9 : enforcer ? (chargeT > 0 ? 1.35 : 0.95) : 1.25;
    rig.stepPhase += (dist / Math.max(speed, 0.1)) * cadence * (drone ? 9 : 6.2) * dt * 10;
  }
  const ph = rig.stepPhase;
  const s = Math.sin(ph);
  const c = Math.cos(ph);

  /* ---- attack envelopes (independent clock) ---- */
  rig.atkT += dt;
  const atkRaw = Math.max(0, 1 - rig.atkT / rig.atkDur);
  const atkW = atkRaw * atkRaw * (3 - 2 * atkRaw); /* smoothstep */
  const atkPhase = Math.min(1, rig.atkT / rig.atkDur);
  const strike = Math.sin(Math.min(1, atkPhase * 1.4) * Math.PI); /* windup → snap */

  /* ---- creepy micro-twitch (race tic) ---- */
  rig.twitchT += dt;
  if (rig.twitchT > rig.twitchNext) {
    rig.twitchT = 0;
    rig.twitchNext = 2.5 + Math.random() * 5;
    rig.twitchAmt = 1;
  }
  rig.twitchAmt *= Math.exp(-dt * 9);
  const tw = rig.twitchAmt * Math.sin(rig.twitchT * 62);

  /* ================= LOCOMOTION LAYER ================= */
  const idle = Math.sin(t * (drone ? 2.6 : 1.8) + rig.phase);

  rig.pelvis.position.y = (drone ? 0.82 : 1.02) + Math.abs(c) * 0.09 * mv + idle * 0.015 * (1 - mv);
  rig.pelvis.rotation.z = s * 0.1 * mv;
  rig.pelvis.rotation.x = mv * (drone ? 0.16 : enforcer ? 0.2 : 0.1);
  rig.pelvis.rotation.y = s * 0.08 * mv;

  rig.spine.rotation.x = idle * 0.03 * (1 - mv) + mv * (drone ? 0.1 : 0.14);
  rig.spine.rotation.y = -s * 0.12 * mv;
  rig.chest.rotation.x = idle * 0.05 * (1 - mv) + Math.abs(s) * 0.05 * mv;
  rig.chest.rotation.z = -s * 0.06 * mv;

  if (leapT > 0) {
    const k = 1 - leapT / leapDur;
    const tuck = Math.sin(k * Math.PI);
    rig.hipL.rotation.x = -1.5 * tuck;
    rig.hipR.rotation.x = -1.5 * tuck;
    rig.kneeL.rotation.x = 2.2 * tuck;
    rig.kneeR.rotation.x = 2.2 * tuck;
    rig.footL.rotation.x = -0.8 * tuck;
    rig.footR.rotation.x = -0.8 * tuck;
    rig.shoulderL.rotation.x = -2.4 * tuck;
    rig.shoulderR.rotation.x = -2.4 * tuck;
  } else if (rifleman) {
    /* alternating tripod scuttle across six legs */
    for (let i = 0; i < rig.legs.length; i++) {
      const L = rig.legs[i];
      const tripod = i % 2 === 0 ? s : -s;
      L.hip.rotation.x = tripod * 0.55 * mv;
      L.knee.rotation.x = Math.max(0, -tripod) * 0.7 * mv + 0.12;
    }
    rig.hipL.rotation.x = 0;
    rig.hipR.rotation.x = 0;
  } else {
    const amp = drone ? 0.95 : 0.72;
    const swingL = s * amp * mv;
    const swingR = -s * amp * mv;
    rig.hipL.rotation.x = swingL;
    rig.hipR.rotation.x = swingR;
    rig.kneeL.rotation.x = Math.max(0, -swingL) * (drone ? 1.5 : 1.1) * mv + 0.06;
    rig.kneeR.rotation.x = Math.max(0, -swingR) * (drone ? 1.5 : 1.1) * mv + 0.06;
    rig.footL.rotation.x = -swingL * 0.35 * mv;
    rig.footR.rotation.x = -swingR * 0.35 * mv;
    /* arms counter-swing */
    rig.shoulderL.rotation.x = -s * (drone ? 0.55 : 0.4) * mv;
    rig.shoulderR.rotation.x = s * (drone ? 0.55 : 0.4) * mv;
    rig.shoulderL.rotation.z = drone ? 0.28 : 0.16;
    rig.shoulderR.rotation.z = drone ? -0.28 : -0.16;
    rig.elbowL.rotation.x = -(0.5 + Math.max(0, s) * 0.4 * mv);
    rig.elbowR.rotation.x = -(0.5 + Math.max(0, -s) * 0.4 * mv);
    rig.handL.rotation.x = 0.25 * s * mv;
    rig.handR.rotation.x = -0.25 * s * mv;
  }

  /* ================= ATTACK LAYER (additive) ================= */
  if (drone) {
    /* double claw swipe — right servo-blade leads */
    rig.shoulderR.rotation.x += (-2.3 * strike + 0.9 * atkW) * atkW;
    rig.shoulderL.rotation.x += (-1.9 * strike + 0.7 * atkW) * atkW;
    rig.shoulderR.rotation.z += -0.5 * atkW;
    rig.elbowR.rotation.x += -0.8 * strike * atkW;
    rig.elbowL.rotation.x += -0.6 * strike * atkW;
    rig.chest.rotation.x += -0.22 * strike * atkW;
    rig.jaw.rotation.x = 0.9 * strike * atkW;
  } else if (rifleman) {
    /* raise the blaster arm, aim, recoil on the shot */
    rig.shoulderR.rotation.x = -(1.15 + 0.3 * strike) * atkW + rig.shoulderR.rotation.x * (1 - atkW);
    rig.shoulderR.rotation.z = -0.12 * atkW;
    rig.elbowR.rotation.x = -0.18 * atkW;
    rig.chest.rotation.x += -0.1 * strike * atkW;
    rig.jaw.rotation.x = 0.7 * atkW;
    if (rig.chargeMat) {
      rig.chargeMat.opacity = 0.35 + 0.6 * atkW + 0.08 * Math.sin(t * 22);
      rig.chargeCell!.scale.setScalar(1 + 0.55 * atkW + 0.08 * Math.sin(t * 22));
    }
  } else {
    /* enforcer overhead slam */
    const both = enforcer;
    rig.shoulderR.rotation.x += (-2.7 * strike + 1.1 * atkW) * atkW;
    if (both) rig.shoulderL.rotation.x += (-2.7 * strike + 1.1 * atkW) * atkW;
    rig.shoulderR.rotation.z += 0.35 * atkW;
    if (both) rig.shoulderL.rotation.z += -0.35 * atkW;
    rig.elbowR.rotation.x += -0.5 * strike * atkW;
    if (both) rig.elbowL.rotation.x += -0.5 * strike * atkW;
    rig.chest.rotation.x += (-0.3 * strike + 0.18 * atkW) * atkW;
    rig.jaw.rotation.x = 0.8 * strike * atkW;
    if (chargeT > 0) {
      rig.chest.rotation.z = Math.sin(t * 42) * 0.1;
      rig.shoulderR.rotation.x -= 0.8 * mv;
      rig.shoulderL.rotation.x -= 0.8 * mv;
    } else {
      rig.chest.rotation.z = damp(rig.chest.rotation.z, 0, 10, dt);
    }
  }

  /* ================= HEAD LAYER (independent tracker) ================= */
  const headBase = drone ? 1.9 : enforcer ? 2.4 : 1.9;
  const wx = enemyWorldPos.x + Math.sin(enemyYaw) * 0.2;
  const wz = enemyWorldPos.z + Math.cos(enemyYaw) * 0.2;
  const tx = playerPos.x - wx;
  const tz = playerPos.z - wz;
  const ty = playerPos.y + 1.2 - (enemyWorldPos.y + headBase);
  const dh = Math.hypot(tx, tz);
  const wantYaw = Math.atan2(tx, tz) - enemyYaw;
  const wantPitch = Math.atan2(ty, dh);
  const clampA = (v: number, m: number) => Math.max(-m, Math.min(m, v));

  const track = combat ? 1 : 0.35;
  let headYaw = clampA(wrapAngle(wantYaw), drone ? 1.1 : 0.85) * track;
  let headPitch = clampA(wantPitch, 0.55) * track;
  if (!combat) {
    /* attract mode: the horde watches you wander the plaza */
    headYaw += Math.sin(t * 0.7 + rig.phase) * 0.35;
    headPitch += Math.sin(t * 0.5 + rig.phase * 2) * 0.12;
  }
  headYaw += strike * atkW * (drone ? 0.3 : 0.2); /* lean into the blow */
  headYaw += tw * 0.5;
  headPitch += tw * 0.25;
  if (hitPop > 0) {
    const k = hitPop / 0.22;
    headYaw += Math.sin(t * 55) * 0.5 * k; /* pain shake */
    headPitch -= 0.3 * k;
  }
  if (spitCharge) headPitch -= 0.5 * (1 - spitCharge); /* rears before firing */

  const l = 14;
  rig.neck.rotation.y = damp(rig.neck.rotation.y, headYaw * 0.4, l, dt);
  rig.head.rotation.y = damp(rig.head.rotation.y, headYaw * 0.65, l, dt);
  rig.head.rotation.x = damp(rig.head.rotation.x, -headPitch, l, dt);
  rig.head.rotation.z = damp(rig.head.rotation.z, -headYaw * 0.12 + tw * 0.3, l, dt);
  rig.jaw.rotation.x = Math.max(rig.jaw.rotation.x, spitCharge * 0.9);
  rig.jaw.rotation.x = damp(rig.jaw.rotation.x, rig.jaw.rotation.x, 6, dt);

  /* warlord entrance roar */
  rig.roar = Math.max(0, rig.roar - dt * 0.7);
  if (rig.roar > 0) {
    rig.jaw.rotation.x = Math.max(rig.jaw.rotation.x, rig.roar * 1.25);
    rig.shoulderL.rotation.z -= 0.9 * rig.roar;
    rig.shoulderR.rotation.z += 0.9 * rig.roar;
    rig.chest.scale.multiplyScalar(1 + 0.14 * rig.roar);
    rig.head.rotation.x -= 0.28 * rig.roar;
  }

  /* ================= living details ================= */
  /* core breathes; brighter under attack charge */
  rig.core.scale.setScalar(1 + 0.14 * Math.sin(t * 6 + rig.phase) + 0.5 * atkW + (spitCharge ? 0.4 : 0));
  /* scanner optic burns hotter when tracking */
  rig.optic.scale.setScalar(1 + 0.18 * Math.sin(t * 9 + rig.phase) + 0.25 * (combat ? 1 : 0));
  /* cables sway with gait */
  for (let i = 0; i < rig.cables.length; i++) {
    rig.cables[i].rotation.x = 0.12 + Math.sin(t * 2.2 + i * 2.1 + rig.phase) * 0.1 + mv * s * 0.12;
    rig.cables[i].rotation.z += (Math.sin(t * 1.7 + i) * 0.06 - rig.cables[i].rotation.z) * Math.min(1, 4 * dt);
  }
  /* cape physics — two chained segments trail the warlord */
  const capeBase = 0.18 + mv * 0.24 + atkW * 0.3;
  for (let i = 0; i < rig.capeSegs.length; i++) {
    const target = capeBase + Math.sin(t * 6 + i * 0.9) * (0.05 + mv * 0.09);
    rig.capeSegs[i].rotation.x = damp(rig.capeSegs[i].rotation.x, target, 7, dt);
  }
  /* hit squash rides the chest bone */
  if (hitPop > 0) {
    const pop = 1 + (hitPop / 0.22) * 0.16;
    rig.chest.scale.set(pop, 1 / pop, pop);
  } else {
    rig.chest.scale.set(1, 1, 1);
  }
  void flashT;
}

function wrapAngle(a: number) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}
