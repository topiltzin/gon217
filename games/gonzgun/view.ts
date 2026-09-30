import {
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  RingGeometry,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  type Texture,
} from "three";
import {
  barrelTexture,
  brickTexture,
  concreteTexture,
  crateTexture,
  firstAidTexture,
  glowTexture,
  splatTexture,
  tagTexture,
  wordTexture,
} from "./art";
import { OBSTACLES, RULES, type GameEvent, type GonzState, type Obstacle, type Pickup } from "./logic";
import { disposeTree, makeFighterModel, setFlash, type Character, type FighterModel } from "./models";

const BULLET_Y = 0.95;
const GRAVITY = 16;
const BLOOD = 0x1d5cff;
const WHITE = new Color(0xffffff);
const GOLD = new Color(0xffd21f);
const RED = new Color(0xff2d2d);
export const PLAYER_COLORS = ["#facc15", "#38bdf8"] as const;

/* ---------- Particles: blue blood droplets and sparks ---------- */

class Burst {
  readonly mesh: InstancedMesh;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly size: Float32Array;
  private readonly stuck: Uint8Array;
  private next = 0;
  private readonly dummy = new Object3D();

  constructor(
    private readonly count: number,
    geometry: IcosahedronGeometry | BoxGeometry,
    material: MeshStandardMaterial | MeshBasicMaterial,
    private readonly maxLife: number,
    private readonly onLand?: (x: number, z: number) => void,
    private readonly gravity = GRAVITY,
  ) {
    this.mesh = new InstancedMesh(geometry, material, count);
    this.mesh.frustumCulled = false;
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.size = new Float32Array(count);
    this.stuck = new Uint8Array(count);
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let i = 0; i < count; i++) this.mesh.setMatrixAt(i, this.dummy.matrix);
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, color?: Color) {
    const i = this.next;
    if (color) {
      this.mesh.setColorAt(i, color);
      this.mesh.instanceColor!.needsUpdate = true;
    }
    this.next = (this.next + 1) % this.count;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.life[i] = this.maxLife * (0.7 + Math.random() * 0.3);
    this.size[i] = size;
    this.stuck[i] = 0;
  }

  update(dt: number) {
    const d = this.dummy;
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const p = i * 3;
      if (!this.stuck[i]) {
        this.vel[p + 1] -= this.gravity * dt;
        this.pos[p] += this.vel[p] * dt;
        this.pos[p + 1] += this.vel[p + 1] * dt;
        this.pos[p + 2] += this.vel[p + 2] * dt;
        if (this.pos[p + 1] <= 0.02) {
          this.pos[p + 1] = 0.02;
          this.stuck[i] = 1;
          this.onLand?.(this.pos[p], this.pos[p + 2]);
        }
      }
      const fade = Math.min(1, this.life[i] / 0.4);
      const s = Math.max(0, this.size[i] * fade * (this.stuck[i] ? 0.6 : 1));
      d.position.set(this.pos[p], this.pos[p + 1], this.pos[p + 2]);
      d.scale.set(s, this.stuck[i] ? s * 0.3 : s, s);
      d.rotation.set(this.pos[p] * 3, this.pos[p + 2] * 3, 0);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Blue puddles on the floor, recycled oldest-first. */
class Splats {
  readonly group = new Group();
  private readonly items: { mesh: Mesh; mat: MeshStandardMaterial; age: number }[] = [];
  private next = 0;

  constructor(texture: Texture, count: number) {
    const geo = new PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < count; i++) {
      const mat = new MeshStandardMaterial({
        color: BLOOD,
        alphaMap: texture,
        transparent: true,
        depthWrite: false,
        roughness: 0.1,
        metalness: 0.2,
        emissive: 0x0a2a9a,
        emissiveIntensity: 0.5,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      });
      const mesh = new Mesh(geo, mat);
      mesh.visible = false;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.items.push({ mesh, mat, age: 0 });
    }
  }

  add(x: number, z: number, size: number) {
    if (Math.abs(x) > 10 || Math.abs(z) > 6) return;
    const it = this.items[this.next];
    this.next = (this.next + 1) % this.items.length;
    it.mesh.visible = true;
    it.mesh.position.set(x, 0.012 + this.next * 0.0003, z);
    it.mesh.rotation.y = Math.random() * Math.PI * 2;
    it.mesh.scale.setScalar(size);
    it.age = 0;
    it.mat.opacity = 0.92;
  }

  update(dt: number) {
    for (const it of this.items) {
      if (!it.mesh.visible) continue;
      it.age += dt;
      if (it.age > 18) it.mat.opacity = Math.max(0, 0.92 - (it.age - 18) / 4);
      if (it.mat.opacity <= 0) it.mesh.visible = false;
    }
  }
}

/** Comic-book words ("POW!") that pop up where hits land and float away. */
class Words {
  readonly group = new Group();
  private readonly items: { sprite: Sprite; age: number; size: number }[] = [];
  private readonly textures = new Map<string, Texture>();
  private next = 0;

  constructor(private readonly reducedMotion: boolean) {
    for (let i = 0; i < 8; i++) {
      const sprite = new Sprite(new SpriteMaterial({ transparent: true, depthTest: false }));
      sprite.visible = false;
      sprite.renderOrder = 20;
      this.group.add(sprite);
      this.items.push({ sprite, age: 0, size: 1 });
    }
  }

  private texture(word: string): Texture {
    let t = this.textures.get(word);
    if (!t) {
      t = wordTexture(word);
      this.textures.set(word, t);
    }
    return t;
  }

  show(word: string, x: number, y: number, z: number, size = 1) {
    const it = this.items[this.next];
    this.next = (this.next + 1) % this.items.length;
    it.sprite.material.map = this.texture(word);
    it.sprite.material.rotation = (Math.random() - 0.5) * 0.5;
    it.sprite.material.needsUpdate = true;
    it.sprite.position.set(x + (Math.random() - 0.5) * 0.6, y, z);
    it.sprite.visible = true;
    it.age = 0;
    it.size = size;
  }

  update(dt: number) {
    for (const it of this.items) {
      if (!it.sprite.visible) continue;
      it.age += dt;
      const life = 0.9;
      if (it.age >= life) {
        it.sprite.visible = false;
        continue;
      }
      const pop = this.reducedMotion ? 1 : it.age < 0.1 ? 0.5 + (it.age / 0.1) * 0.8 : Math.max(1, 1.3 - (it.age - 0.1) * 3);
      const scale = 1.6 * it.size * pop;
      it.sprite.scale.set(scale, scale * 0.5, 1);
      if (!this.reducedMotion) it.sprite.position.y += dt * 1.4;
      it.sprite.material.opacity = Math.min(1, (life - it.age) / 0.3);
    }
  }

  dispose() {
    for (const t of this.textures.values()) t.dispose();
  }
}

const HIT_WORDS = ["POW!", "BAM!", "ZAP!", "WHAM!", "BOP!"];
const CONFETTI = [0xfacc15, 0x38bdf8, 0xf43f5e, 0x34d399, 0xa78bfa, 0xffffff].map((c) => new Color(c));
const DUST = [0x9ca3af, 0x78716c, 0xd6d3d1].map((c) => new Color(c));
const ELECTRIC = [0xffe14d, 0xfff7c2, 0x7dd3fc].map((c) => new Color(c));

/* ---------- The basement ---------- */

function buildBasement(scene: Scene, textures: Texture[]) {
  const track = <T extends Texture>(t: T) => (textures.push(t), t);
  const concrete = track(concreteTexture());
  const floor = new Mesh(new PlaneGeometry(20, 12), new MeshStandardMaterial({ map: concrete, roughness: 0.92 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const void_ = new Mesh(new PlaneGeometry(80, 60), new MeshBasicMaterial({ color: 0x050507 }));
  void_.rotation.x = -Math.PI / 2;
  void_.position.y = -0.05;
  scene.add(void_);

  const brickBack = track(brickTexture());
  const brickSide = track(brickTexture());
  brickSide.repeat.set(4, 1);
  const wallH = 3.4;
  const back = new Mesh(new BoxGeometry(21, wallH, 0.4), new MeshStandardMaterial({ map: brickBack, roughness: 0.95 }));
  back.position.set(0, wallH / 2, -6.2);
  back.receiveShadow = true;
  scene.add(back);
  for (const side of [-1, 1]) {
    const wall = new Mesh(new BoxGeometry(0.4, wallH, 12.4), new MeshStandardMaterial({ map: brickSide, roughness: 0.95 }));
    wall.position.set(side * 10.2, wallH / 2, 0);
    wall.receiveShadow = true;
    scene.add(wall);
  }
  const kerb = new Mesh(new BoxGeometry(20.8, 0.25, 0.3), new MeshStandardMaterial({ color: 0x55575c, roughness: 0.9 }));
  kerb.position.set(0, 0.125, 6.15);
  scene.add(kerb);

  // Pipes along the walls
  const copper = new MeshStandardMaterial({ color: 0xb8733b, roughness: 0.35, metalness: 0.8 });
  const grey = new MeshStandardMaterial({ color: 0x70767c, roughness: 0.4, metalness: 0.7 });
  const pipe = (len: number, r: number, m: MeshStandardMaterial) => new Mesh(new CylinderGeometry(r, r, len, 12), m);
  for (const [y, z, r, m] of [[2.9, -5.85, 0.09, copper], [3.15, -5.8, 0.13, grey]] as const) {
    const p = pipe(20, r, m);
    p.rotation.z = Math.PI / 2;
    p.position.set(0, y, z);
    scene.add(p);
  }
  for (const side of [-1, 1]) {
    const p = pipe(12, 0.08, copper);
    p.rotation.x = Math.PI / 2;
    p.position.set(side * 9.85, 2.8, 0);
    scene.add(p);
  }

  // Graffiti on the back wall
  const tagCanvas = document.createElement("canvas");
  tagCanvas.width = 512;
  tagCanvas.height = 128;
  const g = tagCanvas.getContext("2d")!;
  g.font = "italic 900 96px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineJoin = "round";
  g.strokeStyle = "#1d5cff";
  g.lineWidth = 18;
  g.strokeText("GONZGUN", 256, 66, 460);
  g.fillStyle = "#facc15";
  g.fillText("GONZGUN", 256, 66, 460);
  const graffitiTex = track(new CanvasTexture(tagCanvas));
  graffitiTex.colorSpace = SRGBColorSpace;
  const graffiti = new Mesh(
    new PlaneGeometry(4.4, 1.1),
    new MeshStandardMaterial({ map: graffitiTex, transparent: true, roughness: 0.9, emissive: 0x222222, emissiveMap: graffitiTex }),
  );
  graffiti.position.set(-4.6, 2.2, -5.99);
  scene.add(graffiti);

  // A high, narrow window letting in cold moonlight
  const windowPane = new Mesh(new PlaneGeometry(1.8, 0.45), new MeshBasicMaterial({ color: 0x9fc4ff }));
  windowPane.position.set(4.2, 2.75, -5.99);
  scene.add(windowPane);
  const bars = new MeshStandardMaterial({ color: 0x222226 });
  for (let i = -3; i <= 3; i++) {
    const bar = new Mesh(new BoxGeometry(0.04, 0.5, 0.04), bars);
    bar.position.set(4.2 + i * 0.25, 2.75, -5.97);
    scene.add(bar);
  }

  const crate = track(crateTexture());
  const barrel = track(barrelTexture());
  const pillarMats: { obstacle: Obstacle; mat: MeshStandardMaterial }[] = [];
  for (const o of OBSTACLES) {
    const group = new Group();
    group.position.set(o.x, 0, o.z);
    scene.add(group);
    const add = (m: Mesh, x: number, y: number, z: number) => {
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
      return m;
    };
    switch (o.kind) {
      case "crate": {
        const h = 1.1;
        const count = Math.round(o.hw / 0.6);
        for (let i = 0; i < count; i++) {
          const w = (o.hw * 2) / count;
          add(new Mesh(new BoxGeometry(w - 0.02, h, o.hd * 2), new MeshStandardMaterial({ map: crate, roughness: 0.85 })), -o.hw + w * (i + 0.5), h / 2, 0);
        }
        if (count === 1) {
          const top = add(new Mesh(new BoxGeometry(0.7, 0.7, 0.7), new MeshStandardMaterial({ map: crate, roughness: 0.85 })), 0.05, h + 0.35, 0);
          top.rotation.y = 0.4;
        }
        break;
      }
      case "pillar": {
        const mat = new MeshStandardMaterial({ color: 0x8a8c90, roughness: 0.9, transparent: true });
        add(new Mesh(new BoxGeometry(o.hw * 2, 3.4, o.hd * 2), mat), 0, 1.7, 0);
        const band = new MeshStandardMaterial({ color: 0xf2c200, transparent: true });
        add(new Mesh(new BoxGeometry(o.hw * 2 + 0.02, 0.3, o.hd * 2 + 0.02), band), 0, 0.5, 0);
        pillarMats.push({ obstacle: o, mat }, { obstacle: o, mat: band });
        break;
      }
      case "boiler": {
        const tank = new MeshStandardMaterial({ color: 0x5f6e66, roughness: 0.45, metalness: 0.6 });
        add(new Mesh(new CylinderGeometry(0.85, 0.85, 2.4, 24), tank), 0, 1.2, 0);
        add(new Mesh(new CylinderGeometry(0.87, 0.87, 0.1, 24), grey), 0, 2.4, 0);
        const fire = new MeshBasicMaterial({ color: 0xff7a1a });
        add(new Mesh(new BoxGeometry(0.5, 0.25, 0.05), fire), 0, 0.5, 0.84);
        add(new Mesh(new CylinderGeometry(0.14, 0.14, 0.04, 16), new MeshStandardMaterial({ color: 0xf1f1ea })), 0.4, 1.7, 0.78).rotation.x = Math.PI / 2;
        add(pipe(1.2, 0.1, copper), -0.5, 2.9, 0);
        add(pipe(1.2, 0.1, copper), 0.5, 2.9, 0);
        const glow = new PointLight(0xff8a30, 6, 5, 1.6);
        glow.position.set(0, 0.6, 1.3);
        group.add(glow);
        glow.name = "boiler";
        break;
      }
      case "washer": {
        const white = new MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.35 });
        const dark = new MeshStandardMaterial({ color: 0x2a3440, roughness: 0.15, metalness: 0.4 });
        for (const x of [-0.4, 0.4]) {
          add(new Mesh(new BoxGeometry(0.78, 1.1, 1.5), white), x, 0.55, 0);
          const door = add(new Mesh(new CylinderGeometry(0.24, 0.24, 0.04, 20), dark), x, 0.55, 0.76);
          door.rotation.x = Math.PI / 2;
        }
        break;
      }
      case "shelf": {
        const metal = new MeshStandardMaterial({ color: 0x4b5563, roughness: 0.5, metalness: 0.6 });
        for (const x of [-o.hw + 0.05, o.hw - 0.05]) for (const z of [-o.hd + 0.05, o.hd - 0.05]) add(new Mesh(new BoxGeometry(0.06, 2.2, 0.06), metal), x, 1.1, z);
        const colors = [0xe11d48, 0x16a34a, 0xfacc15, 0x2563eb, 0xf97316];
        for (const y of [0.35, 1.05, 1.75]) {
          add(new Mesh(new BoxGeometry(o.hw * 2, 0.05, o.hd * 2), metal), 0, y, 0);
          for (let i = 0; i < 4; i++) {
            const can = add(
              new Mesh(new CylinderGeometry(0.14, 0.14, 0.3, 12), new MeshStandardMaterial({ color: colors[(i + y * 10) % colors.length | 0], roughness: 0.4, metalness: 0.4 })),
              -o.hw + 0.4 + i * 0.8,
              y + 0.18,
              0.1,
            );
            can.rotation.y = i;
          }
        }
        break;
      }
      case "barrel": {
        add(new Mesh(new CylinderGeometry(o.hw * 0.95, o.hw * 0.95, 1.1, 20), new MeshStandardMaterial({ map: barrel, roughness: 0.6, metalness: 0.3 })), 0, 0.55, 0);
        break;
      }
    }
  }

  // Hanging bulbs
  const bulbs: PointLight[] = [];
  const bulbMat = new MeshBasicMaterial({ color: 0xffe2a8 });
  const cord = new MeshBasicMaterial({ color: 0x111111 });
  for (const [x, z] of [[-5.5, -1.5], [0, 1], [5.5, -1.5]]) {
    const bulb = new Mesh(new SphereGeometry(0.12, 12, 10), bulbMat);
    bulb.position.set(x, 3.3, z);
    const wire = new Mesh(new CylinderGeometry(0.01, 0.01, 2, 4), cord);
    wire.position.set(x, 4.35, z);
    const light = new PointLight(0xffc98a, 22, 13, 1.4);
    light.position.set(x, 3.1, z);
    scene.add(bulb, wire, light);
    bulbs.push(light);
  }
  return { bulbs, pillarMats };
}

/* ---------- Fighters ---------- */

type FighterView = {
  holder: Group;
  model: FighterModel;
  ring: Mesh;
  shield: Mesh;
  tag: Sprite;
  flash: Sprite;
  flashTime: number;
  hitTime: number;
  koTime: number;
  walk: number;
};

export class View {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(38, 16 / 9, 0.1, 100);
  private readonly textures: Texture[] = [];
  private readonly fighters: FighterView[];
  private readonly blood: Burst;
  private readonly sparks: Burst;
  private readonly confetti: Burst;
  private readonly words: Words;
  private readonly kinds: [Character, Character];
  private winner: 0 | 1 | null = null;
  private partyTime = 0;
  private readonly splats: Splats;
  private readonly bulbs: PointLight[];
  private readonly pillarMats: { obstacle: Obstacle; mat: MeshStandardMaterial }[];
  private readonly shotLight = new PointLight(0xffd27a, 0, 7, 1.6);
  private readonly bullets = new Map<number, Group>();
  private readonly bulletPool: Group[] = [];
  private readonly pickups = new Map<number, Group>();
  private readonly glow: Texture;
  private readonly bulletMats: MeshBasicMaterial[];
  private readonly camBase = new Vector3(0, 15.2, 12.2);
  private readonly camTarget = new Vector3(0, 0, 0.7);
  private shake = 0;
  private time = 0;

  constructor(
    characters: [Character, Character],
    tags: [string, string],
    private readonly reducedMotion: boolean,
  ) {
    const s = this.scene;
    s.background = new Color(0x07070c);
    s.add(new AmbientLight(0x8fa0c8, 0.55));
    s.add(new HemisphereLight(0xaab8ff, 0x2a1d12, 0.55));
    const sun = new DirectionalLight(0xfff0dd, 1.1);
    sun.position.set(3, 14, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 9, bottom: -9, near: 1, far: 30 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0015;
    s.add(sun);
    s.add(this.shotLight);

    const built = buildBasement(s, this.textures);
    this.bulbs = built.bulbs;
    this.pillarMats = built.pillarMats;

    this.glow = glowTexture();
    const splat = splatTexture();
    this.textures.push(this.glow, splat);
    this.splats = new Splats(splat, 70);
    s.add(this.splats.group);

    this.blood = new Burst(
      500,
      new IcosahedronGeometry(1, 0),
      new MeshStandardMaterial({ color: BLOOD, emissive: 0x0b2fa8, emissiveIntensity: 0.7, roughness: 0.12, metalness: 0.15 }),
      2.6,
      (x, z) => Math.random() < 0.08 && this.splats.add(x, z, 0.25 + Math.random() * 0.3),
    );
    this.sparks = new Burst(160, new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ color: 0xffc14d }), 0.45);
    this.confetti = new Burst(300, new BoxGeometry(1, 0.15, 0.6), new MeshBasicMaterial({ color: 0xffffff }), 2.4, undefined, 4);
    this.words = new Words(reducedMotion);
    s.add(this.blood.mesh, this.sparks.mesh, this.confetti.mesh, this.words.group);
    this.kinds = characters;

    this.bulletMats = PLAYER_COLORS.map((c) => new MeshBasicMaterial({ color: new Color(c).lerp(new Color(0xffffff), 0.45) }));

    this.fighters = characters.map((kind, i) => {
      const holder = new Group();
      const model = makeFighterModel(kind);
      holder.add(model.root);
      const color = new Color(PLAYER_COLORS[i]);
      const ring = new Mesh(
        new RingGeometry(0.5, 0.62, 32),
        new MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: DoubleSide, depthWrite: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      holder.add(ring);
      const shield = new Mesh(
        new SphereGeometry(0.85, 24, 16),
        new MeshBasicMaterial({ color, transparent: true, opacity: 0.18, blending: AdditiveBlending, depthWrite: false }),
      );
      shield.position.y = 0.75;
      holder.add(shield);
      const tagTex = tagTexture(tags[i], PLAYER_COLORS[i]);
      this.textures.push(tagTex);
      const tag = new Sprite(new SpriteMaterial({ map: tagTex, depthTest: false, transparent: true }));
      tag.scale.set(0.9, 0.45, 1);
      tag.position.y = kind === "sparky" ? 1.95 : 2.1;
      tag.renderOrder = 10;
      holder.add(tag);
      const flash = new Sprite(
        new SpriteMaterial({ map: this.glow, color: 0xffe08a, blending: AdditiveBlending, depthWrite: false, transparent: true }),
      );
      flash.scale.setScalar(0.9);
      flash.visible = false;
      s.add(flash);
      s.add(holder);
      return { holder, model, ring, shield, tag, flash, flashTime: 0, hitTime: 0, koTime: -1, walk: 0 };
    });

    this.camera.position.copy(this.camBase);
    this.camera.lookAt(this.camTarget);
  }

  setAspect(aspect: number) {
    this.camera.aspect = aspect;
    // Pull back on narrow screens so the whole basement still fits.
    const pull = aspect < 1.6 ? Math.min(1.5, 1.6 / aspect) : 1;
    this.camBase.set(0, 15.2 * pull, 12.2 * pull);
    this.camera.updateProjectionMatrix();
  }

  /** One-off effects for what happened this step. */
  react(events: GameEvent[], state: GonzState) {
    for (const e of events) {
      switch (e.type) {
        case "shot": {
          const f = this.fighters[e.owner];
          f.flashTime = 0.06;
          const p = f.model.muzzle.getWorldPosition(new Vector3());
          f.flash.position.copy(p);
          this.shotLight.position.copy(p);
          this.shotLight.intensity = 14;
          break;
        }
        case "hit":
          this.bleed(e.x, e.z, e.angle, 16, 1);
          this.words.show(HIT_WORDS[Math.floor(Math.random() * HIT_WORDS.length)], e.x, 2.1, e.z, 0.8);
          this.fighters[e.target].hitTime = 0.12;
          this.addShake(0.12);
          break;
        case "ko":
          this.bleed(e.x, e.z, e.angle, 70, 1.5);
          for (let i = 0; i < 4; i++) {
            const d = 0.4 + i * 0.45;
            this.splats.add(e.x + Math.cos(e.angle) * d + (Math.random() - 0.5) * 0.5, e.z + Math.sin(e.angle) * d + (Math.random() - 0.5) * 0.5, 0.7 + Math.random() * 0.6);
          }
          this.words.show(e.streak >= 3 ? "WOW!" : e.streak === 2 ? "COMBO!" : "BOOM!", e.x, 2.3, e.z, 1.3);
          this.fighters[e.target].koTime = 0;
          this.fighters[e.target].hitTime = 0.2;
          this.addShake(0.45);
          break;
        case "wall":
          for (let i = 0; i < 8; i++) {
            const a = Math.random() * Math.PI * 2;
            this.sparks.emit(e.x, BULLET_Y, e.z, Math.cos(a) * 3, 1 + Math.random() * 3, Math.sin(a) * 3, 0.05);
          }
          break;
        case "spawn":
          this.fighters[e.fighter].koTime = -1;
          break;
        case "dash": {
          const f = state.fighters[e.fighter];
          const colors = this.kinds[e.fighter] === "sparky" || this.kinds[e.fighter] === "turbo" ? ELECTRIC : DUST;
          for (let i = 0; i < 16; i++) {
            const a = Math.random() * Math.PI * 2;
            this.confetti.emit(f.x, 0.15 + Math.random() * 0.8, f.z, Math.cos(a) * 1.5, 1 + Math.random() * 2, Math.sin(a) * 1.5, 0.08 + Math.random() * 0.06, colors[i % colors.length]);
          }
          break;
        }
        case "win":
          this.winner = e.winner;
          this.partyTime = 0;
          break;
        case "pickup":
          for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2;
            const f = state.fighters[e.fighter];
            this.confetti.emit(f.x, 0.6, f.z, Math.cos(a) * 3, 3, Math.sin(a) * 3, 0.1, CONFETTI[i % CONFETTI.length]);
          }
          this.words.show(e.kind === "health" ? "+40" : "x3!", state.fighters[e.fighter].x, 2.2, state.fighters[e.fighter].z, 0.8);
          break;
        default:
          break;
      }
    }
  }

  private bleed(x: number, z: number, angle: number, count: number, power: number) {
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * 1.6;
      const speed = (1.5 + Math.random() * 4.5) * power;
      this.blood.emit(
        x + Math.cos(angle) * 0.2,
        0.5 + Math.random() * 0.8,
        z + Math.sin(angle) * 0.2,
        Math.cos(a) * speed,
        1 + Math.random() * 4 * power,
        Math.sin(a) * speed,
        0.035 + Math.random() * 0.06,
      );
    }
    this.splats.add(x + Math.cos(angle) * 0.7, z + Math.sin(angle) * 0.7, 0.45 + Math.random() * 0.3);
  }

  private addShake(amount: number) {
    if (!this.reducedMotion) this.shake = Math.min(0.6, this.shake + amount);
  }

  draw(state: GonzState, dt: number) {
    this.time += dt;
    const t = this.time;

    state.fighters.forEach((f, i) => {
      const v = this.fighters[i];
      v.holder.position.set(f.x, 0, f.z);
      v.holder.rotation.y = Math.PI / 2 - f.aim;
      v.walk += ((f.walking ? 1 : 0) - v.walk) * Math.min(1, dt * 10);
      v.model.animate(t, v.walk);
      v.model.power?.(f.triple > 0, t);
      v.hitTime = Math.max(0, v.hitTime - dt);
      // White when hit, gold with triple shot, a red pulse when nearly knocked out.
      if (v.hitTime > 0) setFlash(v.model, 0.9, WHITE);
      else if (f.triple > 0) setFlash(v.model, 0.12 + Math.sin(t * 10) * 0.08, GOLD);
      else if (f.alive && f.hp <= 40) setFlash(v.model, 0.25 + Math.sin(t * 8) * 0.15, RED);
      else setFlash(v.model, 0, WHITE);

      if (!f.alive) {
        if (v.koTime >= 0) v.koTime += dt;
        const fall = Math.min(1, Math.max(0, v.koTime) / 0.35);
        v.model.root.rotation.x = -fall * (Math.PI / 2);
        v.model.root.position.y = fall * 0.15;
        v.holder.visible = v.koTime < RULES.respawnDelay - 0.4;
        v.ring.visible = v.shield.visible = v.tag.visible = false;
      } else {
        v.model.root.rotation.x = 0;
        v.model.root.position.y = 0;
        v.holder.visible = true;
        v.ring.visible = v.tag.visible = true;
        v.shield.visible = f.invulnerable > 0 || f.dashTime > 0;
        if (v.shield.visible) v.shield.scale.setScalar(1 + Math.sin(t * 20) * 0.04);
        // Blink while the spawn shield is up.
        v.model.root.visible = f.invulnerable === 0 || Math.sin(t * 30) > -0.3;
      }

      v.flashTime -= dt;
      v.flash.visible = v.flashTime > 0;
      if (v.flash.visible) v.flash.position.copy(v.model.muzzle.getWorldPosition(v.flash.position));
    });

    // Pillars go see-through when someone is hiding behind them.
    for (const { obstacle: o, mat } of this.pillarMats) {
      const hidden = state.fighters.some((f) => f.alive && f.z < o.z && o.z - f.z < 3.4 && Math.abs(f.x - o.x) < 1.1);
      const target = hidden ? 0.28 : 1;
      mat.opacity += (target - mat.opacity) * Math.min(1, dt * 10);
      mat.depthWrite = mat.opacity > 0.95;
    }

    this.syncBullets(state);
    this.syncPickups(state.pickups, t);
    this.blood.update(dt);
    this.sparks.update(dt);
    this.confetti.update(dt);
    this.words.update(dt);
    this.splats.update(dt);

    this.shotLight.intensity = Math.max(0, this.shotLight.intensity - dt * 160);
    // Bulbs: warm with a faint flicker; one of them is dying.
    this.bulbs.forEach((b, i) => {
      const flicker = i === 2 && !this.reducedMotion && Math.sin(t * 13) + Math.sin(t * 31) > 1.6 ? 0.35 : 1;
      b.intensity = 22 * flicker * (0.96 + Math.sin(t * 5 + i) * 0.04);
    });

    if (this.winner !== null) this.celebrate(state, dt);

    this.shake = Math.max(0, this.shake - dt * 1.6);
    const k = this.shake * this.shake;
    this.camera.position.set(
      this.camBase.x + (Math.random() - 0.5) * k,
      this.camBase.y + (Math.random() - 0.5) * k,
      this.camBase.z + (Math.random() - 0.5) * k,
    );
    this.camera.lookAt(this.camTarget);
  }

  /** The winner turns to the camera and hops while confetti rains; the camera swoops in. */
  private celebrate(state: GonzState, dt: number) {
    const i = this.winner!;
    const f = state.fighters[i];
    const v = this.fighters[i];
    this.partyTime += dt;
    const ease = Math.min(1, dt * 2.5);
    this.camTarget.lerp(new Vector3(f.x, 0.9, f.z), ease);
    this.camBase.lerp(new Vector3(f.x * 0.8, 6.5, f.z + 7.5), ease);
    v.holder.rotation.y = 0;
    v.model.animate(this.time, 1);
    v.model.root.position.y = this.reducedMotion ? 0 : Math.abs(Math.sin(this.partyTime * 6)) * 0.5;
    v.shield.visible = false;
    if (this.partyTime < 2.5 && Math.random() < 0.8) {
      for (let n = 0; n < 3; n++) {
        this.confetti.emit(
          f.x + (Math.random() - 0.5) * 5,
          4 + Math.random(),
          f.z + (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 1.5,
          0,
          (Math.random() - 0.5) * 1.5,
          0.1 + Math.random() * 0.05,
          CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
        );
      }
    }
  }

  private syncBullets(state: GonzState) {
    const seen = new Set<number>();
    for (const b of state.bullets) {
      seen.add(b.id);
      let g = this.bullets.get(b.id);
      if (!g) {
        g = this.bulletPool.pop() ?? this.makeBullet();
        (g.children[0] as Mesh).material = this.bulletMats[b.owner];
        (g.children[1] as Sprite).material.color.set(PLAYER_COLORS[b.owner]);
        g.visible = true;
        this.bullets.set(b.id, g);
      }
      g.position.set(b.x, BULLET_Y, b.z);
      g.rotation.y = Math.PI / 2 - Math.atan2(b.vz, b.vx);
    }
    for (const [id, g] of this.bullets) {
      if (seen.has(id)) continue;
      g.visible = false;
      this.bullets.delete(id);
      this.bulletPool.push(g);
    }
  }

  private makeBullet() {
    const g = new Group();
    const geo = new CylinderGeometry(0.05, 0.05, 0.5, 8);
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 0, -0.15);
    const core = new Mesh(geo, this.bulletMats[0]);
    const halo = new Sprite(new SpriteMaterial({ map: this.glow, blending: AdditiveBlending, depthWrite: false, transparent: true }));
    halo.scale.setScalar(0.55);
    g.add(core, halo);
    this.scene.add(g);
    return g;
  }

  private syncPickups(pickups: Pickup[], t: number) {
    const seen = new Set<number>();
    for (const p of pickups) {
      seen.add(p.id);
      let g = this.pickups.get(p.id);
      if (!g) {
        g = this.makePickup(p);
        this.pickups.set(p.id, g);
        this.scene.add(g);
      }
      const spin = g.children[0];
      spin.rotation.y = t * 2;
      spin.position.y = 0.55 + Math.sin(t * 3 + p.id) * 0.1;
    }
    for (const [id, g] of this.pickups) {
      if (seen.has(id)) continue;
      disposeTree(g, this.glow);
      this.scene.remove(g);
      this.pickups.delete(id);
    }
  }

  private makePickup(p: Pickup) {
    const g = new Group();
    g.position.set(p.x, 0, p.z);
    const spin = new Group();
    g.add(spin);
    if (p.kind === "health") {
      const aid = firstAidTexture();
      const box = new Mesh(new BoxGeometry(0.5, 0.36, 0.36), new MeshStandardMaterial({ map: aid, roughness: 0.5, emissive: 0x331111 }));
      box.castShadow = true;
      spin.add(box);
    } else {
      const gold = new MeshStandardMaterial({ color: 0xffc933, emissive: 0xa86a00, emissiveIntensity: 0.8, roughness: 0.25, metalness: 0.8 });
      spin.add(new Mesh(new OctahedronGeometry(0.28), gold));
      const orbit = new Mesh(new TorusGeometry(0.42, 0.03, 8, 32), gold);
      orbit.rotation.x = Math.PI / 2;
      spin.add(orbit);
      for (let i = 0; i < 3; i++) {
        const dot = new Mesh(new SphereGeometry(0.07, 10, 8), gold);
        const a = (i / 3) * Math.PI * 2;
        dot.position.set(Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42);
        spin.add(dot);
      }
    }
    const halo = new Sprite(
      new SpriteMaterial({ map: this.glow, color: p.kind === "health" ? 0xff6b8a : 0xffd24a, blending: AdditiveBlending, depthWrite: false, transparent: true }),
    );
    halo.scale.setScalar(1.6);
    halo.position.y = 0.55;
    g.add(halo);
    return g;
  }

  dispose() {
    for (const f of this.fighters) f.model.dispose();
    this.words.dispose();
    disposeTree(this.scene);
    for (const t of this.textures) t.dispose();
  }
}
