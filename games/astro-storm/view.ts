import {
  AdditiveBlending,
  AmbientLight,
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  FogExp2,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  RingGeometry,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  type Material,
  type Texture,
} from "three";
import { RULES, SPAWN_Z, type AstroEvent, type AstroState } from "./logic";

export type ViewMode = "chase" | "cockpit";

const ASTEROID_SIZE = { 1: 1.1, 2: 2, 3: 3 } as const;

/* ---------- Painted textures (no image files) ---------- */

function canvasTexture(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void, color = true): Texture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  paint(c.getContext("2d")!);
  const t = new CanvasTexture(c);
  if (color) t.colorSpace = SRGBColorSpace;
  return t;
}

function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a * 16807) % 2147483647;
    return a / 2147483647;
  };
}

function glowTexture() {
  return canvasTexture(
    64,
    64,
    (g) => {
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.25, "rgba(255,255,255,0.7)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
    },
    false,
  );
}

/** Deep-space backdrop: dark blue with purple and teal nebula clouds. */
function nebulaTexture() {
  const rnd = seeded(7);
  return canvasTexture(1024, 512, (g) => {
    g.fillStyle = "#03030c";
    g.fillRect(0, 0, 1024, 512);
    const clouds: [number, number, number, string][] = [
      [300, 240, 260, "rgba(124,58,237,0.35)"],
      [420, 300, 200, "rgba(236,72,153,0.22)"],
      [760, 180, 240, "rgba(20,184,166,0.22)"],
      [880, 330, 180, "rgba(56,189,248,0.2)"],
      [120, 360, 180, "rgba(56,189,248,0.15)"],
    ];
    for (const [x, y, r, col] of clouds) {
      for (let i = 0; i < 6; i++) {
        const cx = x + (rnd() - 0.5) * r;
        const cy = y + (rnd() - 0.5) * r * 0.5;
        const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r * (0.4 + rnd() * 0.6));
        grad.addColorStop(0, col);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = grad;
        g.fillRect(0, 0, 1024, 512);
      }
    }
    for (let i = 0; i < 900; i++) {
      const b = 150 + rnd() * 105;
      g.fillStyle = `rgba(${b},${b},255,${0.3 + rnd() * 0.7})`;
      g.fillRect(rnd() * 1024, rnd() * 512, rnd() < 0.05 ? 2 : 1, 1);
    }
  });
}

function planetTexture() {
  const rnd = seeded(3);
  return canvasTexture(512, 256, (g) => {
    const bands = ["#f59e0b", "#d97706", "#fbbf24", "#b45309", "#fcd34d", "#92400e"];
    for (let y = 0; y < 256; y += 8) {
      g.fillStyle = bands[Math.floor(rnd() * bands.length)];
      g.fillRect(0, y, 512, 8 + rnd() * 10);
    }
    g.globalAlpha = 0.35;
    for (let i = 0; i < 40; i++) {
      g.fillStyle = rnd() < 0.5 ? "#fff7ed" : "#7c2d12";
      g.beginPath();
      g.ellipse(rnd() * 512, rnd() * 256, 20 + rnd() * 60, 3 + rnd() * 6, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    g.fillStyle = "#b91c1c";
    g.beginPath();
    g.ellipse(340, 150, 26, 12, 0, 0, Math.PI * 2);
    g.fill();
  });
}

/* ---------- Models ---------- */

/** The player's starfighter: white hull, blue glass canopy, swept wings with blue stripes, twin engines. Nose toward -z. */
function makeShip(glow: Texture) {
  const ship = new Group();
  const hull = new MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35, metalness: 0.4 });
  const dark = new MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.6 });
  const blue = new MeshStandardMaterial({ color: 0x2563eb, roughness: 0.4, metalness: 0.3, emissive: 0x1e3a8a, emissiveIntensity: 0.4 });
  const glass = new MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.05, metalness: 0.2, emissive: 0x0ea5e9, emissiveIntensity: 0.6 });

  const nose = new Mesh(new ConeGeometry(0.42, 3.2, 12), hull);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -1.3;
  const body = new Mesh(new CylinderGeometry(0.45, 0.6, 1.6, 12), hull);
  body.rotation.x = Math.PI / 2;
  body.position.z = 0.9;
  const canopy = new Mesh(new SphereGeometry(0.42, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  canopy.scale.set(0.9, 0.8, 1.9);
  canopy.position.set(0, 0.28, 0.1);
  ship.add(nose, body, canopy);

  for (const side of [-1, 1]) {
    const wing = new Mesh(new BoxGeometry(2.6, 0.08, 1.3), hull);
    wing.position.set(side * 1.45, -0.1, 0.8);
    wing.rotation.set(0, side * 0.35, side * -0.18);
    const stripe = new Mesh(new BoxGeometry(1.6, 0.09, 0.3), blue);
    stripe.position.set(side * 1.6, -0.08, 0.6);
    stripe.rotation.set(0, side * 0.35, side * -0.18);
    const fin = new Mesh(new BoxGeometry(0.08, 1.1, 0.9), blue);
    fin.position.set(side * 2.55, 0.25, 1.1);
    fin.rotation.z = side * -0.25;
    const gun = new Mesh(new CylinderGeometry(0.07, 0.07, 1.4, 8), dark);
    gun.rotation.x = Math.PI / 2;
    gun.position.set(side * RULES.gunOffset, -0.15, -0.3);
    const engine = new Mesh(new CylinderGeometry(0.28, 0.32, 0.9, 12), dark);
    engine.rotation.x = Math.PI / 2;
    engine.position.set(side * 0.55, -0.05, 1.6);
    const flame = new Sprite(new SpriteMaterial({ map: glow, color: 0x67e8f9, blending: AdditiveBlending, depthWrite: false, transparent: true }));
    flame.position.set(side * 0.55, -0.05, 2.15);
    flame.scale.setScalar(0.9);
    flame.name = "flame";
    ship.add(wing, stripe, fin, gun, engine, flame);
  }
  return ship;
}

/** A lumpy rock: an icosahedron with its corners pushed in and out. */
function rockGeometry(seed: number) {
  const geo = new IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position as BufferAttribute;
  const bumps = new Map<string, number>();
  const rnd = seeded(seed);
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    if (!bumps.has(key)) bumps.set(key, 0.72 + rnd() * 0.5);
    v.multiplyScalar(bumps.get(key)!);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** An enemy drone: a dark saucer with a spinning ring and a glowing red eye. Faces +z (toward the player). */
function makeDrone(glow: Texture) {
  const g = new Group();
  const shell = new MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.3, metalness: 0.8 });
  const red = new MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 1.2 });
  const body = new Mesh(new SphereGeometry(1, 20, 12), shell);
  body.scale.set(1.3, 0.55, 1.3);
  const ring = new Mesh(new TorusGeometry(1.5, 0.12, 8, 32), red);
  ring.rotation.x = Math.PI / 2;
  ring.name = "ring";
  const eye = new Mesh(new SphereGeometry(0.35, 12, 10), red);
  eye.position.z = 1.1;
  const halo = new Sprite(new SpriteMaterial({ map: glow, color: 0xff4d4d, blending: AdditiveBlending, depthWrite: false, transparent: true }));
  halo.scale.setScalar(2.2);
  halo.position.z = 1.2;
  for (let i = 0; i < 3; i++) {
    const spike = new Mesh(new ConeGeometry(0.18, 0.9, 6), shell);
    const a = (i / 3) * Math.PI * 2;
    spike.position.set(Math.cos(a) * 1.45, 0, Math.sin(a) * 1.45);
    spike.rotation.set(Math.PI / 2, 0, -a + Math.PI / 2);
    g.add(spike);
  }
  g.add(body, ring, eye, halo);
  return g;
}

/* ---------- Particles ---------- */

class Sparks {
  readonly mesh: InstancedMesh;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly life: Float32Array;
  private readonly size: Float32Array;
  private next = 0;
  private readonly dummy = new Object3D();

  constructor(private readonly count: number) {
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.size = new Float32Array(count);
    this.mesh = new InstancedMesh(
      new BoxGeometry(1, 1, 1),
      new MeshBasicMaterial({ color: 0xffffff, blending: AdditiveBlending, depthWrite: false, transparent: true }),
      count,
    );
    this.mesh.frustumCulled = false;
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let i = 0; i < count; i++) {
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, new Color(0xffffff));
    }
  }

  emit(x: number, y: number, z: number, speed: number, size: number, color: Color, drift: number) {
    const i = this.next;
    this.next = (this.next + 1) % this.count;
    const u = Math.random() * 2 - 1;
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u) * speed * (0.3 + Math.random() * 0.7);
    this.pos.set([x, y, z], i * 3);
    this.vel.set([Math.cos(a) * r, Math.sin(a) * r, u * speed + drift], i * 3);
    this.life[i] = 0.5 + Math.random() * 0.5;
    this.size[i] = size;
    this.mesh.setColorAt(i, color);
    this.mesh.instanceColor!.needsUpdate = true;
  }

  update(dt: number) {
    const d = this.dummy;
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const p = i * 3;
      for (let k = 0; k < 3; k++) this.pos[p + k] += this.vel[p + k] * dt;
      const s = Math.max(0, this.size[i] * Math.min(1, this.life[i] * 2));
      d.position.set(this.pos[p], this.pos[p + 1], this.pos[p + 2]);
      d.scale.setScalar(s);
      d.rotation.set(this.life[i] * 7, this.life[i] * 5, 0);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

const FIRE = [0xffffff, 0xfff3b0, 0xffb347, 0xff6b35].map((c) => new Color(c));
const ROCK = [0x8b7d6b, 0x6b5e4f, 0xa89880].map((c) => new Color(c));

/* ---------- View ---------- */

export class View {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(70, 16 / 9, 0.1, 1200);
  mode: ViewMode = "chase";
  private readonly glow: Texture;
  private readonly textures: Texture[] = [];
  private readonly ship: Group;
  private readonly reticles: LineLoop[] = [];
  private readonly rocks: BufferGeometry[];
  private readonly rockMat = new MeshStandardMaterial({ color: 0x9a8a78, roughness: 0.95, flatShading: true });
  private readonly asteroids = new Map<number, Mesh>();
  private readonly drones = new Map<number, Group>();
  private readonly rings = new Map<number, Group>();
  private readonly lasers = new Map<number, Mesh>();
  private readonly laserPool: Mesh[] = [];
  private readonly plasma = new Map<number, Sprite>();
  private readonly laserGeo = new BoxGeometry(0.14, 0.14, 5);
  private readonly laserMat = new MeshBasicMaterial({ color: 0x4ade80, blending: AdditiveBlending, transparent: true, depthWrite: false });
  private readonly sparks = new Sparks(900);
  private readonly shockwaves: { mesh: Mesh; age: number; size: number }[] = [];
  private readonly stars: Points;
  private readonly streaks: LineSegments;
  private readonly planet: Mesh;
  private readonly camPos = new Vector3(0, 2.3, 9);
  private readonly camLook = new Vector3(0, 0.8, -25);
  private trauma = 0;
  private time = 0;

  constructor(private readonly reducedMotion: boolean) {
    const s = this.scene;
    s.fog = new FogExp2(0x03030c, 0.0042);
    this.glow = glowTexture();
    const nebula = nebulaTexture();
    const planetTex = planetTexture();
    this.textures.push(this.glow, nebula, planetTex);

    const sky = new Mesh(new SphereGeometry(900, 32, 16), new MeshBasicMaterial({ map: nebula, side: BackSide, fog: false }));
    s.add(sky);

    s.add(new AmbientLight(0x6b7bb8, 0.6));
    s.add(new HemisphereLight(0x93c5fd, 0x1e1b4b, 0.6));
    const sun = new DirectionalLight(0xfff1d6, 2.4);
    sun.position.set(120, 80, 60);
    s.add(sun);
    const sunGlow = new Sprite(new SpriteMaterial({ map: this.glow, color: 0xfff1c1, blending: AdditiveBlending, fog: false, depthWrite: false }));
    sunGlow.position.set(260, 170, -700);
    sunGlow.scale.setScalar(160);
    s.add(sunGlow);

    this.planet = new Mesh(new SphereGeometry(90, 48, 32), new MeshStandardMaterial({ map: planetTex, roughness: 0.9, fog: false }));
    this.planet.position.set(-230, -110, -650);
    this.planet.rotation.z = 0.35;
    const atmosphere = new Sprite(new SpriteMaterial({ map: this.glow, color: 0xffb347, blending: AdditiveBlending, fog: false, opacity: 0.5, depthWrite: false }));
    atmosphere.scale.setScalar(250);
    atmosphere.position.copy(this.planet.position);
    s.add(this.planet, atmosphere);

    // Stars that rush past, for a sense of speed.
    const starGeo = new BufferGeometry();
    const starPos = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 300;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 200;
      starPos[i * 3 + 2] = SPAWN_Z * 1.5 + Math.random() * (-SPAWN_Z * 1.5 + 20);
    }
    starGeo.setAttribute("position", new BufferAttribute(starPos, 3));
    this.stars = new Points(starGeo, new PointsMaterial({ color: 0xdbeafe, size: 0.6, sizeAttenuation: true, fog: false }));
    s.add(this.stars);

    const streakGeo = new BufferGeometry();
    const streakPos = new Float32Array(160 * 6);
    for (let i = 0; i < 160; i++) {
      const x = (Math.random() - 0.5) * 60;
      const y = (Math.random() - 0.5) * 36;
      const z = -Math.random() * 120;
      streakPos.set([x, y, z, x, y, z - 3], i * 6);
    }
    streakGeo.setAttribute("position", new BufferAttribute(streakPos, 3));
    this.streaks = new LineSegments(
      streakGeo,
      new LineBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.45, blending: AdditiveBlending, fog: false }),
    );
    s.add(this.streaks);

    this.ship = makeShip(this.glow);
    s.add(this.ship);

    // Two aiming squares ahead of the ship, like a targeting sight.
    for (const [dist, size] of [[18, 1.2], [36, 1.8]] as const) {
      const geo = new BufferGeometry();
      geo.setAttribute("position", new BufferAttribute(new Float32Array([-size, -size, 0, size, -size, 0, size, size, 0, -size, size, 0]), 3));
      const loop = new LineLoop(geo, new LineBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.85, fog: false, depthTest: false }));
      loop.userData.dist = dist;
      loop.renderOrder = 5;
      this.reticles.push(loop);
      s.add(loop);
    }

    this.rocks = [11, 23, 37, 51].map(rockGeometry);
    s.add(this.sparks.mesh);
  }

  setAspect(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  react(events: AstroEvent[], state: AstroState) {
    for (const e of events) {
      switch (e.type) {
        case "boom": {
          const n = 18 + e.size * 16;
          for (let i = 0; i < n; i++) this.sparks.emit(e.x, e.y, e.z, 10 + e.size * 6, 0.25 + Math.random() * 0.3, FIRE[i % FIRE.length], state.speed * 0.3);
          for (let i = 0; i < e.size * 6; i++) this.sparks.emit(e.x, e.y, e.z, 8 + e.size * 3, 0.4 + Math.random() * 0.5, ROCK[i % ROCK.length], state.speed * 0.3);
          this.shockwave(e.x, e.y, e.z, e.size);
          if (Math.abs(e.z) < 20) this.addTrauma(0.25);
          break;
        }
        case "hit":
          for (let i = 0; i < 8; i++) this.sparks.emit(e.x, e.y, e.z, 12, 0.18, FIRE[i % 3], 0);
          break;
        case "crash":
          for (let i = 0; i < 40; i++) this.sparks.emit(e.x, e.y, -1, 12, 0.3, FIRE[i % FIRE.length], 0);
          this.addTrauma(0.8);
          break;
        case "ring":
          for (let i = 0; i < 40; i++) {
            const c = e.kind === "triple" ? new Color(0xfacc15) : new Color(0x38bdf8);
            this.sparks.emit(state.ship.x, state.ship.y, -1, 10, 0.2, c, 0);
          }
          break;
        case "over":
          for (let i = 0; i < 120; i++) this.sparks.emit(state.ship.x, state.ship.y, 0, 16, 0.4, FIRE[i % FIRE.length], 0);
          this.shockwave(state.ship.x, state.ship.y, 0, 3);
          this.addTrauma(1);
          break;
        default:
          break;
      }
    }
  }

  private addTrauma(amount: number) {
    if (!this.reducedMotion) this.trauma = Math.min(1, this.trauma + amount);
  }

  private shockwave(x: number, y: number, z: number, size: number) {
    const mesh = new Mesh(
      new RingGeometry(0.8, 1, 40),
      new MeshBasicMaterial({ color: 0xffd28a, blending: AdditiveBlending, transparent: true, depthWrite: false, side: DoubleSide }),
    );
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.shockwaves.push({ mesh, age: 0, size });
  }

  draw(s: AstroState, dt: number) {
    this.time += dt;
    const t = this.time;
    const ship = s.ship;
    const moveZ = s.speed * dt;

    // Ship attitude: bank into turns, pitch with climbs, spin during a barrel roll.
    const rollSpin = ship.roll > 0 ? (1 - ship.roll / RULES.rollTime) * Math.PI * 2 * -ship.rollDir : 0;
    const bank = -ship.vx * 0.035 + rollSpin;
    this.ship.position.set(ship.x, ship.y, 0);
    this.ship.rotation.set(ship.vy * 0.025, -ship.vx * 0.012, bank);
    this.ship.visible = this.mode === "chase" && s.status === "playing" && (ship.invulnerable === 0 || Math.sin(t * 30) > -0.2);
    this.ship.traverse((o) => {
      if (o.name === "flame") (o as Sprite).scale.setScalar(0.8 + Math.random() * 0.35);
    });
    for (const r of this.reticles) {
      r.visible = this.mode === "chase" && s.status === "playing";
      r.position.set(ship.x + ship.vx * 0.04 * r.userData.dist * 0.1, ship.y + ship.vy * 0.03 * r.userData.dist * 0.1, -r.userData.dist);
    }

    // Stars and speed streaks fly past.
    const sp = this.stars.geometry.attributes.position as BufferAttribute;
    for (let i = 0; i < sp.count; i++) {
      let z = sp.getZ(i) + moveZ * 0.6;
      if (z > 20) z += SPAWN_Z * 1.5 - 20;
      sp.setZ(i, z);
    }
    sp.needsUpdate = true;
    const lp = this.streaks.geometry.attributes.position as BufferAttribute;
    const len = Math.min(8, 1 + s.speed * 0.06);
    for (let i = 0; i < lp.count; i += 2) {
      let z = lp.getZ(i) + moveZ * 1.4;
      if (z > 10) z -= 130;
      lp.setZ(i, z);
      lp.setZ(i + 1, z - len);
    }
    lp.needsUpdate = true;
    this.planet.rotation.y += dt * 0.02;

    this.syncAsteroids(s, dt);
    this.syncDrones(s, t);
    this.syncRings(s, t);
    this.syncLasers(s);
    this.syncPlasma(s);
    this.sparks.update(dt);
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const w = this.shockwaves[i];
      w.age += dt;
      w.mesh.position.z += moveZ * 0.3;
      w.mesh.scale.setScalar(1 + w.age * 18 * w.size);
      (w.mesh.material as MeshBasicMaterial).opacity = Math.max(0, 1 - w.age * 2);
      w.mesh.lookAt(this.camera.position);
      if (w.age > 0.5) {
        this.scene.remove(w.mesh);
        w.mesh.geometry.dispose();
        (w.mesh.material as Material).dispose();
        this.shockwaves.splice(i, 1);
      }
    }

    // Camera: behind the ship, or inside the cockpit.
    this.trauma = Math.max(0, this.trauma - dt * 1.5);
    const shake = this.trauma * this.trauma * 0.6;
    const jitter = () => (Math.random() - 0.5) * shake;
    if (this.mode === "chase") {
      this.camera.fov = 70;
      const ease = Math.min(1, dt * 6);
      // The camera follows only part of the way, so the ship visibly flies across the screen.
      this.camPos.lerp(new Vector3(ship.x * 0.62, ship.y * 0.78 + 2.4, 11), ease);
      this.camLook.lerp(new Vector3(ship.x * 0.45, ship.y * 0.6 + 0.6, -25), ease);
      this.camera.position.set(this.camPos.x + jitter(), this.camPos.y + jitter(), this.camPos.z);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(this.camLook);
    } else {
      this.camera.fov = 80;
      this.camera.position.set(ship.x + jitter(), ship.y + 0.3 + jitter(), -0.3);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(ship.x + ship.vx * 0.4, ship.y + 0.3 + ship.vy * 0.3, -60);
      // Lean with the ship (less with reduced motion; no spin during a roll).
      this.camera.rotateZ(this.reducedMotion ? 0 : -ship.vx * 0.03 + rollSpin * 0.25);
    }
    this.camera.updateProjectionMatrix();
  }

  private syncAsteroids(s: AstroState, dt: number) {
    const seen = new Set<number>();
    for (const a of s.asteroids) {
      seen.add(a.id);
      let m = this.asteroids.get(a.id);
      if (!m) {
        m = new Mesh(this.rocks[a.id % this.rocks.length], this.rockMat);
        m.scale.setScalar(ASTEROID_SIZE[a.size]);
        m.rotation.set(a.id, a.id * 2, 0);
        m.userData.spin = new Vector3((a.id % 5) * 0.3 + 0.2, (a.id % 3) * 0.4 + 0.1, 0.2);
        this.scene.add(m);
        this.asteroids.set(a.id, m);
      }
      m.position.set(a.x, a.y, a.z);
      const spin = m.userData.spin as Vector3;
      m.rotation.x += spin.x * dt;
      m.rotation.y += spin.y * dt;
    }
    for (const [id, m] of this.asteroids) {
      if (seen.has(id)) continue;
      this.scene.remove(m);
      this.asteroids.delete(id);
    }
  }

  private syncDrones(s: AstroState, t: number) {
    const seen = new Set<number>();
    for (const d of s.drones) {
      seen.add(d.id);
      let g = this.drones.get(d.id);
      if (!g) {
        g = makeDrone(this.glow);
        this.scene.add(g);
        this.drones.set(d.id, g);
      }
      g.position.set(d.x, d.y + Math.sin(t * 3 + d.id) * 0.3, d.z);
      g.rotation.z = Math.cos(d.phase) * 0.4;
      g.getObjectByName("ring")!.rotation.z = t * 3;
    }
    for (const [id, g] of this.drones) {
      if (seen.has(id)) continue;
      this.scene.remove(g);
      disposeTree(g, this.glow);
      this.drones.delete(id);
    }
  }

  private syncRings(s: AstroState, t: number) {
    const seen = new Set<number>();
    for (const r of s.rings) {
      seen.add(r.id);
      let g = this.rings.get(r.id);
      if (!g) {
        g = new Group();
        const color = r.kind === "triple" ? 0xfacc15 : 0x38bdf8;
        const torus = new Mesh(
          new TorusGeometry(RULES.ringRadius, 0.22, 10, 48),
          new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, metalness: 0.6, roughness: 0.25 }),
        );
        const halo = new Sprite(new SpriteMaterial({ map: this.glow, color, blending: AdditiveBlending, opacity: 0.5, depthWrite: false }));
        halo.scale.setScalar(RULES.ringRadius * 3.2);
        g.add(torus, halo);
        this.scene.add(g);
        this.rings.set(r.id, g);
      }
      g.position.set(r.x, r.y, r.z);
      g.children[0].rotation.z = t * 1.5;
      g.scale.setScalar(1 + Math.sin(t * 5) * 0.04);
    }
    for (const [id, g] of this.rings) {
      if (seen.has(id)) continue;
      this.scene.remove(g);
      disposeTree(g, this.glow);
      this.rings.delete(id);
    }
  }

  private syncLasers(s: AstroState) {
    const seen = new Set<number>();
    for (const l of s.lasers) {
      seen.add(l.id);
      let m = this.lasers.get(l.id);
      if (!m) {
        m = this.laserPool.pop() ?? new Mesh(this.laserGeo, this.laserMat);
        m.visible = true;
        this.scene.add(m);
        this.lasers.set(l.id, m);
      }
      m.position.set(l.x, l.y, l.z);
      m.rotation.y = Math.atan2(-l.vx, -l.vz);
    }
    for (const [id, m] of this.lasers) {
      if (seen.has(id)) continue;
      m.visible = false;
      this.lasers.delete(id);
      this.laserPool.push(m);
    }
  }

  private syncPlasma(s: AstroState) {
    const seen = new Set<number>();
    for (const p of s.plasma) {
      seen.add(p.id);
      let sprite = this.plasma.get(p.id);
      if (!sprite) {
        sprite = new Sprite(new SpriteMaterial({ map: this.glow, color: 0xff5a36, blending: AdditiveBlending, depthWrite: false }));
        sprite.scale.setScalar(1.6);
        this.scene.add(sprite);
        this.plasma.set(p.id, sprite);
      }
      sprite.position.set(p.x, p.y, p.z);
    }
    for (const [id, sprite] of this.plasma) {
      if (seen.has(id)) continue;
      this.scene.remove(sprite);
      sprite.material.dispose();
      this.plasma.delete(id);
    }
  }

  dispose() {
    disposeTree(this.scene);
    for (const g of this.rocks) g.dispose();
    for (const t of this.textures) t.dispose();
  }
}

/** Frees meshes' and sprites' GPU resources under root, sparing the shared `keep` texture. */
function disposeTree(root: Object3D, keep?: Texture) {
  root.traverse((o) => {
    if (o instanceof Mesh || o instanceof Points || o instanceof LineSegments || o instanceof LineLoop) o.geometry.dispose();
    if (o instanceof Mesh || o instanceof Sprite || o instanceof Points || o instanceof LineSegments || o instanceof LineLoop) {
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        const map = (m as MeshBasicMaterial).map;
        if (map && map !== keep) map.dispose();
        m.dispose();
      }
    }
  });
}
