import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Shape,
  SphereGeometry,
  Sprite,
  type Material,
  type Texture,
} from "three";
import { BLOCKY_LOOK, PIXEL_LOOK, blockArm, blockHead, blockPants, blockShirt, type BlockLook } from "./art";

import type { Character } from "./characters";

export type { Character };

/** A fighter's 3D body. Built facing +z; `root` is placed and turned by the view. */
export type FighterModel = {
  root: Group;
  /** Where bullets leave the gun, in the root's space. */
  muzzle: Object3D;
  /** Everything that flashes white when hit. */
  materials: MeshStandardMaterial[];
  animate: (time: number, walk: number) => void;
  /** Optional look for when triple shot is on (Turbo's golden hair). */
  power?: (on: boolean, time: number) => void;
  dispose: () => void;
};

function mat(color: number | string, map?: Texture, extra: Partial<MeshStandardMaterial> = {}) {
  return new MeshStandardMaterial({ color: map ? 0xffffff : color, map, roughness: 0.75, metalness: 0, ...extra });
}

function mesh(geo: BoxGeometry | SphereGeometry | ConeGeometry | CylinderGeometry | ExtrudeGeometry, m: Material | Material[]) {
  const o = new Mesh(geo, m);
  o.castShadow = true;
  return o;
}

/** A chunky toy blaster, barrel along +z. */
function makeGun(accent: number) {
  const gun = new Group();
  const dark = mat(0x2b2f3a, undefined, { roughness: 0.4, metalness: 0.3 });
  const bright = mat(accent, undefined, { roughness: 0.4 });
  const slide = mesh(new BoxGeometry(0.1, 0.1, 0.36), dark);
  slide.position.set(0, 0.04, 0.08);
  const stripe = mesh(new BoxGeometry(0.105, 0.03, 0.26), bright);
  stripe.position.set(0, 0.075, 0.06);
  const grip = mesh(new BoxGeometry(0.08, 0.16, 0.09), dark);
  grip.position.set(0, -0.06, -0.04);
  grip.rotation.x = -0.25;
  const tip = mesh(new CylinderGeometry(0.035, 0.035, 0.06, 10), bright);
  tip.rotation.x = Math.PI / 2;
  tip.position.set(0, 0.04, 0.28);
  gun.add(slide, stripe, grip, tip);
  const muzzle = new Object3D();
  muzzle.position.set(0, 0.04, 0.33);
  gun.add(muzzle);
  return { gun, muzzle, materials: [dark, bright] };
}

/** A block-world person (Blocky or Pixel): cube head, shirt, trousers. 1.6 m tall. */
function makeBlockPerson(look: BlockLook, accent: number, slimArms: boolean): FighterModel {
  const root = new Group();
  const head = blockHead(look);
  const skin = mat(look.palette.s);
  const top = mat(look.shirt[0]);
  const trousers = mat(look.pants[0]);
  const headMats = [head.side, head.side, head.top, head.bottom, head.face, head.back].map((t) => mat(0, t));
  const shirtMat = mat(0, blockShirt(look));
  const pantsMat = mat(0, blockPants(look));
  const armMat = mat(0, blockArm(look));
  const hairMat = mat(0, head.hair);
  const materials = [...headMats, shirtMat, pantsMat, armMat, hairMat, skin, top, trousers];
  const body = new Group();
  root.add(body);

  const headMesh = mesh(new BoxGeometry(0.4, 0.4, 0.4), headMats);
  headMesh.position.y = 1.4;
  const torso = mesh(new BoxGeometry(0.4, 0.6, 0.2), [top, top, top, top, shirtMat, top]);
  torso.position.y = 0.9;
  body.add(headMesh, torso);
  if (look.longHair) {
    // Hair down to the shoulders, and a side ponytail.
    const hair = mesh(new BoxGeometry(0.42, 0.52, 0.08), hairMat);
    hair.position.set(0, 1.32, -0.2);
    const tail = mesh(new BoxGeometry(0.1, 0.34, 0.1), hairMat);
    tail.position.set(0.24, 1.3, -0.12);
    tail.rotation.z = 0.2;
    body.add(hair, tail);
  }

  const limb = (x: number, y: number, m: Material | Material[], w = 0.2) => {
    const pivot = new Group();
    pivot.position.set(x, y, 0);
    const geo = new BoxGeometry(w, 0.6, 0.2);
    geo.translate(0, -0.3, 0);
    pivot.add(mesh(geo, m));
    body.add(pivot);
    return pivot;
  };
  const armSide = [top, top, top, skin, armMat, armMat];
  const legSide = [pantsMat, pantsMat, trousers, trousers, pantsMat, pantsMat];
  const armW = slimArms ? 0.15 : 0.2;
  const armX = 0.2 + armW / 2;
  const leftArm = limb(armX, 1.2, armSide, armW);
  const rightArm = limb(-armX, 1.2, armSide, armW);
  const leftLeg = limb(0.1, 0.6, legSide);
  const rightLeg = limb(-0.1, 0.6, legSide);
  // Right arm points the blaster forward; the left one helps steady it.
  rightArm.rotation.x = -Math.PI / 2;
  leftArm.rotation.set(-1.25, 0, -0.45);

  const { gun, muzzle, materials: gunMats } = makeGun(accent);
  gun.position.set(-armX, 1.18, 0.62);
  body.add(gun);

  return {
    root,
    muzzle,
    materials: [...materials, ...gunMats],
    animate(time, walk) {
      const swing = Math.sin(time * 11) * 0.7 * walk;
      leftLeg.rotation.x = swing;
      rightLeg.rotation.x = -swing;
      body.position.y = Math.abs(Math.sin(time * 11)) * 0.05 * walk;
      headMesh.rotation.y = Math.sin(time * 1.3) * 0.12 * (1 - walk);
    },
    dispose: () => disposeTree(root),
  };
}

/** A round yellow electric critter with tall black-tipped ears, red cheeks and a lightning tail. About 1.1 m tall. */
function makeSparky(): FighterModel {
  const root = new Group();
  const yellow = mat(0xffd21f, undefined, { roughness: 0.55 });
  const black = mat(0x1a1a1a, undefined, { roughness: 0.3 });
  const red = mat(0xe8453c, undefined, { roughness: 0.5 });
  const brown = mat(0x8a5a2b);
  const white = mat(0xffffff, undefined, { roughness: 0.2 });
  const materials = [yellow, black, red, brown, white];

  const body = new Group();
  root.add(body);

  const belly = mesh(new SphereGeometry(0.36, 24, 18), yellow);
  belly.scale.set(1, 1.08, 0.92);
  belly.position.y = 0.46;
  body.add(belly);
  for (const y of [0.52, 0.66]) {
    const stripe = mesh(new BoxGeometry(0.34, 0.06, 0.08), brown);
    stripe.position.set(0, y, -0.3);
    stripe.rotation.x = y > 0.6 ? -0.35 : -0.1;
    body.add(stripe);
  }

  const head = new Group();
  head.position.y = 0.98;
  body.add(head);
  const skull = mesh(new SphereGeometry(0.32, 24, 18), yellow);
  skull.scale.set(1.08, 0.95, 0.95);
  head.add(skull);
  for (const side of [-1, 1]) {
    const eye = mesh(new SphereGeometry(0.055, 12, 10), black);
    eye.position.set(side * 0.13, 0.05, 0.27);
    const shine = mesh(new SphereGeometry(0.02, 8, 6), white);
    shine.position.set(side * 0.13 + 0.015, 0.075, 0.32);
    const cheek = mesh(new SphereGeometry(0.07, 14, 10), red);
    cheek.scale.set(1, 1, 0.4);
    cheek.position.set(side * 0.22, -0.08, 0.22);
    cheek.rotation.y = side * 0.6;
    head.add(eye, shine, cheek);
  }
  const nose = mesh(new SphereGeometry(0.015, 6, 6), black);
  nose.position.set(0, -0.01, 0.305);
  const mouth = mesh(new BoxGeometry(0.08, 0.02, 0.02), brown);
  mouth.position.set(0, -0.08, 0.29);
  head.add(nose, mouth);

  const ears: Group[] = [];
  for (const side of [-1, 1]) {
    const ear = new Group();
    ear.position.set(side * 0.15, 0.2, 0);
    ear.rotation.z = side * -0.45;
    const cone = mesh(new ConeGeometry(0.09, 0.52, 12), yellow);
    cone.position.y = 0.26;
    const tip = mesh(new ConeGeometry(0.036, 0.18, 12), black);
    tip.position.y = 0.44;
    ear.add(cone, tip);
    head.add(ear);
    ears.push(ear);
  }

  // Lightning-bolt tail, flat like a cut-out.
  const bolt = new Shape();
  [[0, 0], [0.12, 0.02], [0.1, 0.22], [0.26, 0.2], [0.24, 0.42], [0.46, 0.4], [0.5, 0.72], [0.14, 0.62], [0.16, 0.46], [0.0, 0.48], [0.02, 0.26], [-0.1, 0.26]].forEach(
    ([x, y], i) => (i ? bolt.lineTo(x, y) : bolt.moveTo(x, y)),
  );
  const tail = new Group();
  tail.position.set(0, 0.28, -0.3);
  const tailMesh = mesh(new ExtrudeGeometry(bolt, { depth: 0.05, bevelEnabled: false }), [yellow, brown]);
  tailMesh.rotation.y = Math.PI / 2;
  tailMesh.position.x = 0.025;
  tailMesh.scale.set(1.2, 1.2, 1);
  tail.add(tailMesh);
  tail.rotation.x = 0.35;
  body.add(tail);

  const feet: Mesh[] = [];
  for (const side of [-1, 1]) {
    const foot = mesh(new SphereGeometry(0.09, 12, 8), yellow);
    foot.scale.set(1, 0.6, 1.5);
    foot.position.set(side * 0.16, 0.05, 0.1);
    root.add(foot);
    feet.push(foot);
    const arm = mesh(new SphereGeometry(0.07, 10, 8), yellow);
    arm.scale.set(1, 1, 2.2);
    arm.position.set(side * 0.2, 0.58, 0.3);
    arm.rotation.y = -side * 0.5;
    body.add(arm);
  }

  const { gun, muzzle, materials: gunMats } = makeGun(0x38bdf8);
  gun.position.set(0, 0.56, 0.5);
  gun.scale.setScalar(1.1);
  body.add(gun);

  return {
    root,
    muzzle,
    materials: [...materials, ...gunMats],
    animate(time, walk) {
      const hop = Math.abs(Math.sin(time * 12));
      body.position.y = hop * 0.1 * walk + Math.sin(time * 2.4) * 0.015;
      feet[0].position.z = 0.1 + Math.sin(time * 12) * 0.12 * walk;
      feet[1].position.z = 0.1 - Math.sin(time * 12) * 0.12 * walk;
      ears[0].rotation.z = 0.45 + Math.sin(time * 3 + 1) * 0.06 + hop * 0.1 * walk;
      ears[1].rotation.z = -0.45 - Math.sin(time * 3) * 0.06 - hop * 0.1 * walk;
      tail.rotation.y = Math.sin(time * (walk ? 10 : 2.5)) * 0.35;
    },
    dispose: () => disposeTree(root),
  };
}

/**
 * A martial-arts hero with wild spiky black hair, an orange training suit,
 * blue undershirt, belt, wristbands and boots. He fires energy blasts from his
 * hands instead of a blaster, and his hair turns gold while triple shot is on.
 */
function makeTurbo(): FighterModel {
  const root = new Group();
  const skin = mat(0xf2c29b, undefined, { roughness: 0.6 });
  const orange = mat(0xf97316, undefined, { roughness: 0.7 });
  const blue = mat(0x1e40af, undefined, { roughness: 0.6 });
  const hair = mat(0x111111, undefined, { roughness: 0.45 });
  const black = mat(0x111111, undefined, { roughness: 0.3 });
  const white = mat(0xffffff, undefined, { roughness: 0.3 });
  const energy = new MeshStandardMaterial({ color: 0x9be7ff, emissive: 0x38bdf8, emissiveIntensity: 1.6, transparent: true, opacity: 0.9 });
  const materials = [skin, orange, blue, hair, black, white];

  const body = new Group();
  root.add(body);

  const legs: Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new Group();
    leg.position.set(side * 0.13, 0.72, 0);
    const pant = mesh(new CylinderGeometry(0.1, 0.13, 0.52, 12), orange);
    pant.position.y = -0.24;
    const boot = mesh(new CylinderGeometry(0.1, 0.1, 0.22, 12), blue);
    boot.position.y = -0.58;
    const toe = mesh(new BoxGeometry(0.16, 0.08, 0.24), blue);
    toe.position.set(0, -0.66, 0.05);
    leg.add(pant, boot, toe);
    body.add(leg);
    legs.push(leg);
  }

  const torso = mesh(new CylinderGeometry(0.24, 0.2, 0.6, 16), orange);
  torso.scale.z = 0.72;
  torso.position.y = 1.02;
  const belt = mesh(new CylinderGeometry(0.215, 0.215, 0.08, 16), blue);
  belt.scale.z = 0.75;
  belt.position.y = 0.76;
  const knot = mesh(new BoxGeometry(0.1, 0.14, 0.04), blue);
  knot.position.set(0.1, 0.72, 0.16);
  const collar = mesh(new ConeGeometry(0.1, 0.2, 3), blue);
  collar.rotation.set(Math.PI / 2 + 0.3, 0, Math.PI);
  collar.position.set(0, 1.24, 0.14);
  const badge = mesh(new CylinderGeometry(0.06, 0.06, 0.02, 16), white);
  badge.rotation.x = Math.PI / 2;
  badge.position.set(-0.12, 1.12, 0.16);
  body.add(torso, belt, knot, collar, badge);

  // Both arms push forward, palms together, for the energy blast.
  for (const side of [-1, 1]) {
    const arm = new Group();
    arm.position.set(side * 0.27, 1.22, 0);
    arm.rotation.order = "YXZ";
    arm.rotation.set(-1.35, -side * 0.4, 0);
    const upper = mesh(new CylinderGeometry(0.075, 0.07, 0.5, 10), skin);
    upper.position.y = -0.25;
    const band = mesh(new CylinderGeometry(0.08, 0.08, 0.1, 10), blue);
    band.position.y = -0.46;
    const hand = mesh(new SphereGeometry(0.08, 10, 8), skin);
    hand.position.y = -0.56;
    arm.add(upper, band, hand);
    body.add(arm);
  }
  const ball = mesh(new SphereGeometry(0.1, 14, 10), energy);
  ball.castShadow = false;
  ball.position.set(0, 1.12, 0.58);
  body.add(ball);
  const muzzle = new Object3D();
  muzzle.position.set(0, 1.12, 0.62);
  body.add(muzzle);

  const head = new Group();
  head.position.y = 1.52;
  body.add(head);
  const face = mesh(new SphereGeometry(0.2, 20, 16), skin);
  face.scale.set(0.95, 1.08, 1);
  head.add(face);
  for (const side of [-1, 1]) {
    const eye = mesh(new SphereGeometry(0.045, 10, 8), white);
    eye.scale.set(1, 1.2, 0.5);
    eye.position.set(side * 0.075, 0.02, 0.18);
    const pupil = mesh(new SphereGeometry(0.025, 8, 6), black);
    pupil.position.set(side * 0.07, 0.02, 0.2);
    const brow = mesh(new BoxGeometry(0.09, 0.02, 0.02), black);
    brow.position.set(side * 0.075, 0.09, 0.19);
    brow.rotation.z = side * -0.35;
    head.add(eye, pupil, brow);
  }
  const mouth = mesh(new BoxGeometry(0.07, 0.015, 0.02), black);
  mouth.position.set(0, -0.1, 0.19);
  head.add(mouth);
  // Spiky hair: cones fanning up, out and back.
  const spikes: [number, number, number, number, number][] = [
    [0, 0.2, -0.02, 0, 0],
    [-0.12, 0.18, 0, 0, 0.6],
    [0.12, 0.18, 0, 0, -0.6],
    [-0.17, 0.08, -0.02, 0, 1.2],
    [0.17, 0.08, -0.02, 0, -1.2],
    [0, 0.16, -0.12, -0.7, 0],
    [-0.1, 0.1, -0.15, -0.9, 0.5],
    [0.1, 0.1, -0.15, -0.9, -0.5],
    [0, 0.02, -0.18, -1.4, 0],
    [-0.06, 0.16, 0.12, 0.5, 0.3],
    [0.07, 0.15, 0.13, 0.5, -0.4],
  ];
  for (const [x, y, z, rx, rz] of spikes) {
    const spike = mesh(new ConeGeometry(0.07, 0.3, 6), hair);
    spike.position.set(x, y, z);
    spike.rotation.set(rx, 0, rz);
    spike.translateY(0.1);
    head.add(spike);
  }
  const cap = mesh(new SphereGeometry(0.205, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.2), hair);
  cap.position.y = 0.02;
  head.add(cap);

  const dark = new Color(0x111111);
  const gold = new Color(0xffd21f);
  return {
    root,
    muzzle,
    materials,
    animate(time, walk) {
      const swing = Math.sin(time * 11) * 0.6 * walk;
      legs[0].rotation.x = swing;
      legs[1].rotation.x = -swing;
      body.position.y = Math.abs(Math.sin(time * 11)) * 0.05 * walk;
      ball.scale.setScalar(0.85 + Math.sin(time * 18) * 0.15);
    },
    power(on, time) {
      hair.color.copy(on ? gold : dark);
      hair.emissive.copy(on ? gold : dark);
      hair.emissiveIntensity = on ? 0.5 + Math.sin(time * 12) * 0.2 : 0;
      energy.emissive.set(on ? 0xffd21f : 0x38bdf8);
    },
    dispose: () => disposeTree(root),
  };
}

export function makeFighterModel(kind: Character): FighterModel {
  switch (kind) {
    case "blocky":
      return makeBlockPerson(BLOCKY_LOOK, 0xfacc15, false);
    case "pixel":
      return makeBlockPerson(PIXEL_LOOK, 0xf472b6, true);
    case "sparky":
      return makeSparky();
    case "turbo":
      return makeTurbo();
  }
}

export function setFlash(model: FighterModel, amount: number, tint = new Color(0xffffff)) {
  for (const m of model.materials) {
    m.emissive.copy(tint);
    m.emissiveIntensity = amount;
  }
}

/** Frees the GPU resources of meshes and sprites under root, including their textures (except `keep`). */
export function disposeTree(root: Object3D, keep?: Texture) {
  root.traverse((o) => {
    if (!(o instanceof Mesh || o instanceof Sprite)) return;
    if (o instanceof Mesh) o.geometry.dispose();
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      const map = (m as MeshStandardMaterial).map;
      if (map && map !== keep) map.dispose();
      m.dispose();
    }
  });
}
