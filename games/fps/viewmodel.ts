import {
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  PointLight,
  Scene,
  Sprite,
  SpriteMaterial,
} from "three";
import type { EffectArt, Surfaces } from "./art";
import type { WeaponId } from "./rules";

type Part = [w: number, h: number, d: number, x: number, y: number, z: number, material: "gun" | "grip" | "glove", rotX?: number];

// Original low-poly weapons built from boxes (metres, camera space, -z is forward).
const PISTOL: Part[] = [
  [0.09, 0.08, 0.36, 0, 0.05, -0.12, "gun"],
  [0.085, 0.05, 0.3, 0, 0, -0.1, "gun"],
  [0.03, 0.03, 0.05, 0, 0.1, -0.27, "gun"],
  [0.06, 0.025, 0.03, 0, 0.1, 0.03, "gun"],
  [0.02, 0.05, 0.08, 0, -0.045, -0.07, "gun"],
  [0.08, 0.2, 0.1, 0, -0.1, 0.01, "grip", 0.25],
  [0.15, 0.13, 0.16, 0.005, -0.14, 0.04, "glove"],
  [0.05, 0.05, 0.12, -0.06, -0.08, -0.03, "glove"],
];

const SHOTGUN: Part[] = [
  [0.05, 0.05, 0.72, -0.03, 0.05, -0.34, "gun"],
  [0.05, 0.05, 0.72, 0.03, 0.05, -0.34, "gun"],
  [0.14, 0.11, 0.26, 0, 0.0, 0.04, "gun"],
  [0.12, 0.13, 0.26, 0, -0.05, 0.28, "grip"],
  [0.16, 0.12, 0.14, 0.01, -0.1, 0.12, "glove"],
];
const SHOTGUN_PUMP: Part[] = [
  [0.12, 0.07, 0.2, 0, -0.02, -0.26, "grip"],
  [0.15, 0.1, 0.12, 0, -0.07, -0.26, "glove"],
];

const MUZZLE: Record<WeaponId, [number, number, number]> = { pistol: [0, 0.05, -0.34], shotgun: [0, 0.05, -0.72] };
const REST = { x: 0.1, y: -0.22, z: -0.5 };
/** A slight inward turn so the weapon shows its side, not just its back. */
const YAW = -0.3;

/**
 * First-person weapon, drawn in its own scene and camera on top of the world
 * (after a depth clear) so it never clips into walls.
 */
export class Viewmodel {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(55, 1, 0.01, 5);
  private readonly root = new Group();
  private readonly guns: Record<WeaponId, Group>;
  private readonly pump: Group;
  private readonly flash: Sprite;
  private readonly flashMaterial: SpriteMaterial;
  private readonly flashLight = new PointLight(0xffb45a, 0, 3, 1.5);
  private readonly ambient = new AmbientLight(0xffffff, 1);
  private readonly geometries: BoxGeometry[] = [];
  private readonly materials: MeshLambertMaterial[];
  private current: WeaponId = "pistol";
  private pending: WeaponId | null = null;
  private bob = 0;
  private kick = 0;
  private flashTime = 0;
  private pumpTime = 0;
  /** 0 = raised, 1 = lowered off screen. */
  private lower = 1;

  constructor(surfaces: Surfaces, art: EffectArt) {
    const mat = {
      gun: new MeshLambertMaterial({ map: surfaces.gun }),
      grip: new MeshLambertMaterial({ map: surfaces.grip }),
      glove: new MeshLambertMaterial({ map: surfaces.glove }),
    };
    this.materials = Object.values(mat);
    const build = (parts: Part[]) => {
      const g = new Group();
      for (const [w, h, d, x, y, z, m, rotX] of parts) {
        const geo = new BoxGeometry(w, h, d);
        this.geometries.push(geo);
        const mesh = new Mesh(geo, mat[m]);
        mesh.position.set(x, y, z);
        if (rotX) mesh.rotation.x = rotX;
        g.add(mesh);
      }
      return g;
    };
    this.guns = { pistol: build(PISTOL), shotgun: build(SHOTGUN) };
    this.pump = build(SHOTGUN_PUMP);
    this.guns.shotgun.add(this.pump);
    this.guns.shotgun.visible = false;

    this.flashMaterial = new SpriteMaterial({ map: art.flash, blending: AdditiveBlending, depthWrite: false, transparent: true });
    this.flash = new Sprite(this.flashMaterial);
    this.flash.visible = false;

    this.root.add(this.guns.pistol, this.guns.shotgun, this.flash, this.flashLight);
    this.root.position.set(REST.x, REST.y, REST.z);
    const key = new DirectionalLight(0xffe0c0, 0.8);
    key.position.set(0.5, 1, 0.5);
    this.scene.add(this.ambient, key, this.root);
  }

  resize(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** New run: holds the given weapon, starting lowered so it raises into view. */
  reset(id: WeaponId) {
    this.current = id;
    this.pending = null;
    this.guns.pistol.visible = id === "pistol";
    this.guns.shotgun.visible = id === "shotgun";
    this.lower = 1;
    this.kick = 0;
    this.pumpTime = 0;
    this.flashTime = 0;
    this.flash.visible = false;
    this.flashLight.intensity = 0;
  }

  /** Lowers the current weapon and raises the new one. */
  show(id: WeaponId) {
    if (id !== this.current) this.pending = id;
  }

  fire(id: WeaponId) {
    this.kick = 1;
    this.flashTime = 0.06;
    this.flash.visible = true;
    const [x, y, z] = MUZZLE[id];
    this.flash.position.set(x, y, z - 0.05);
    const s = id === "shotgun" ? 0.4 : 0.26;
    this.flash.scale.set(s, s, 1);
    this.flashMaterial.rotation = Math.random() * Math.PI;
    this.flashLight.position.set(x, y, z);
    this.flashLight.intensity = 3;
    if (id === "shotgun") this.pumpTime = 0.55;
  }

  update(dt: number, s: { speed: number; sprinting: boolean; reloading: boolean; brightness: number }) {
    // Swap: lower, switch, raise.
    const wantLower = this.pending !== null || s.reloading ? 1 : 0;
    this.lower += Math.sign(wantLower - this.lower) * Math.min(Math.abs(wantLower - this.lower), dt * (s.reloading ? 3 : 6));
    if (this.pending && this.lower >= 1) {
      this.guns[this.current].visible = false;
      this.current = this.pending;
      this.guns[this.current].visible = true;
      this.pending = null;
    }

    this.bob += dt * s.speed * 1.4;
    const amp = Math.min(1, s.speed / 7) * (s.sprinting ? 1.6 : 1);
    this.kick = Math.max(0, this.kick - dt * 7);
    this.flashTime -= dt;
    if (this.flashTime <= 0) {
      this.flash.visible = false;
      this.flashLight.intensity = 0;
    }

    const lowerY = s.reloading ? 0.12 : 0.35;
    this.root.position.set(
      REST.x + Math.sin(this.bob) * 0.025 * amp + (s.sprinting ? 0.05 : 0),
      REST.y - Math.abs(Math.cos(this.bob)) * 0.02 * amp - this.lower * lowerY - (s.sprinting ? 0.04 : 0),
      REST.z + this.kick * 0.08,
    );
    this.root.rotation.set(this.kick * 0.25 + (s.reloading ? this.lower * 0.5 : 0), YAW + (s.sprinting ? 0.35 : 0), s.sprinting ? 0.15 : 0);

    // Shotgun pump: back then forward after each shot.
    this.pumpTime = Math.max(0, this.pumpTime - dt);
    const p = this.pumpTime > 0 && this.pumpTime < 0.4 ? Math.sin(((0.4 - this.pumpTime) / 0.4) * Math.PI) : 0;
    this.pump.position.z = p * 0.12;

    this.ambient.intensity = 0.4 + s.brightness * 1.1;
  }

  dispose() {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.flashMaterial.dispose();
  }
}
