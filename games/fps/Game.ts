import {
  AdditiveBlending,
  PerspectiveCamera,
  Raycaster,
  SpriteMaterial,
  Vector3,
  WebGLRenderer,
} from "three";
import { makeEffectArt, makeEnemyArt, makeSurfaces, type EffectArt, type EnemyArt } from "./art";
import { GameAudio } from "./audio";
import { Enemy, Fireballs, Particles, Pickup, type EnemyContext } from "./entities";
import { Input } from "./input";
import { cellCenter, parseLevel, TILE, type Level, type PickupKind } from "./level";
import { Player } from "./player";
import { PIXEL_HEIGHT, RetroPass } from "./post";
import {
  applyDamage,
  applyPickup,
  PLAYER,
  startReload,
  switchWeapon,
  tickArsenal,
  tryFire,
  WEAPONS,
  type WeaponId,
} from "./rules";
import { Viewmodel } from "./viewmodel";
import { LevelAssets, World, type Door } from "./world";

export type GameState = "MENU" | "PLAYING" | "PAUSED" | "GAME_OVER" | "VICTORY";

export type Hud = {
  health: number;
  armor: number;
  weapon: WeaponId;
  mag: number;
  reserve: number;
  hasShotgun: boolean;
  hasKey: boolean;
  reloading: boolean;
};

export type Stats = {
  seconds: number;
  kills: number;
  enemies: number;
  secrets: number;
  totalSecrets: number;
  accuracy: number;
};

export type GameMessage = PickupKind | "locked" | "secret" | "lockFailed";

export type GameEvents = {
  onState: (state: GameState, stats: Stats) => void;
  onHud: (hud: Hud) => void;
  onHit: (kill: boolean) => void;
  onDamage: (amount: number) => void;
  onMessage: (message: GameMessage) => void;
  onFps?: (fps: number) => void;
};

const MOUSE_SENSITIVITY = 0.0022;
const KEY_TURN_SPEED = 2.4;

/**
 * Owns the renderer, the loop and one run of the level. Everything that
 * changes every frame lives here, outside React; React only hears about
 * state changes, HUD values and one-off events through GameEvents.
 */
export class Game {
  state: GameState = "MENU";
  private readonly renderer: WebGLRenderer;
  private readonly camera = new PerspectiveCamera(72, 1, 0.05, 90);
  private readonly post = new RetroPass();
  private readonly viewmodel: Viewmodel;
  private readonly audio = new GameAudio();
  private readonly input: Input;
  private readonly raycaster = new Raycaster();
  private readonly level: Level = parseLevel();
  private readonly levelAssets: LevelAssets;
  private readonly enemyArt: EnemyArt;
  private readonly effectArt: EffectArt;
  private readonly glowMaterial: SpriteMaterial;
  private readonly resizeObserver: ResizeObserver;
  private frameId = 0;
  private lastTime = 0;
  private time = 0;
  /** Redraw once even when not playing (after a resize, restart or setting change). */
  private dirty = true;

  // One run of the level
  private world!: World;
  private player!: Player;
  private enemies: Enemy[] = [];
  private pickups: Pickup[] = [];
  private particles!: Particles;
  private fireballs!: Fireballs;
  private enemyContext!: EnemyContext;
  private stats!: Stats;
  private shots = 0;
  private hits = 0;
  private trauma = 0;
  private recoil = 0;
  private headBob = 0;
  private lockedMessageCooldown = 0;
  private lastHud: Hud | null = null;
  private particleSize = 0.1;

  private fpsFrames = 0;
  private fpsTime = 0;

  private readonly tmpForward = new Vector3();
  private readonly tmpRight = new Vector3();
  private readonly tmpUp = new Vector3();
  private readonly tmpDir = new Vector3();
  private readonly tmpOrigin = new Vector3();
  private readonly damageByEnemy = new Map<Enemy, { amount: number; y: number }>();

  constructor(
    private readonly container: HTMLElement,
    private readonly events: GameEvents,
    options: { crt: boolean; muted: boolean },
  ) {
    this.renderer = new WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    this.renderer.autoClear = false;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const canvas = this.renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.setAttribute("aria-hidden", "true");
    container.appendChild(canvas);

    const surfaces = makeSurfaces();
    this.levelAssets = new LevelAssets(surfaces);
    this.enemyArt = makeEnemyArt();
    this.effectArt = makeEffectArt();
    this.glowMaterial = new SpriteMaterial({
      map: this.effectArt.glow,
      color: 0xffd28a,
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    this.viewmodel = new Viewmodel(surfaces, this.effectArt);
    this.camera.rotation.order = "YXZ";
    this.raycaster.camera = this.camera;
    this.post.crt = options.crt;
    this.audio.setMuted(options.muted);
    this.input = new Input(canvas);

    this.buildRun();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.frameId = requestAnimationFrame(this.frame);
  }

  /* ---------- Public controls (call from click handlers) ---------- */

  async start() {
    this.audio.unlock();
    this.audio.startAmbient();
    this.audio.play("click");
    await this.enterPlay();
  }

  async resume() {
    this.audio.unlock();
    this.audio.play("click");
    await this.enterPlay();
  }

  async restart() {
    this.audio.unlock();
    this.audio.startAmbient();
    this.audio.play("click");
    this.buildRun();
    await this.enterPlay();
  }

  setCrt(on: boolean) {
    this.post.crt = on;
    this.dirty = true;
  }

  setMuted(muted: boolean) {
    this.audio.setMuted(muted);
  }

  /* ---------- Setup ---------- */

  private buildRun() {
    this.disposeRun();
    this.world = new World(this.level, this.levelAssets);
    const scene = this.world.scene;
    this.particles = new Particles(scene);
    this.particles.material.size = this.particleSize;
    this.fireballs = new Fireballs(scene, this.effectArt);

    this.enemies = this.level.enemies.map((s) => new Enemy(s, this.enemyArt[s.kind]));
    for (const e of this.enemies) {
      scene.add(e.sprite);
      this.world.targets.push(e.sprite);
    }
    this.pickups = this.level.pickups.map((p) => new Pickup(p.kind, p.col, p.row, this.effectArt, this.glowMaterial));
    for (const p of this.pickups) scene.add(p.glow, p.sprite);

    const start = cellCenter(this.level.start.col, this.level.start.row);
    // Face south, towards the first door.
    this.player = new Player(start.x, start.z, Math.PI);
    this.viewmodel.reset(this.player.inv.arsenal.current);

    this.stats = {
      seconds: 0,
      kills: 0,
      enemies: this.enemies.length,
      secrets: 0,
      totalSecrets: this.world.doors.filter((d) => d.kind === "secret").length,
      accuracy: 0,
    };
    this.shots = 0;
    this.hits = 0;
    this.trauma = 0;
    this.recoil = 0;
    this.lastHud = null;

    this.enemyContext = {
      world: this.world,
      player: { x: 0, z: 0, eyeY: 0 },
      enemies: this.enemies,
      particles: this.particles,
      hurtPlayer: (n) => this.hurtPlayer(n),
      spit: (from) => {
        const p = this.player;
        const y = from.def.hover + from.def.height * 0.55;
        this.fireballs.launch(from.x, y, from.z, p.x, p.y + 1.2, p.z, 13, 10 + Math.round(Math.random() * 6));
      },
      sound: (name) => this.audio.play(name),
    };
    this.placeCamera(0);
    this.emitHud();
    this.dirty = true;
  }

  private resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.viewmodel.resize(aspect);
    this.post.resize(aspect);
    // Points are sized against the canvas, but drawn into the low-res target.
    this.particleSize = 0.09 * (h * this.renderer.getPixelRatio()) / PIXEL_HEIGHT;
    this.particles.material.size = this.particleSize;
    this.dirty = true;
  }

  /* ---------- State machine ---------- */

  private async enterPlay() {
    if (this.state === "PLAYING") return;
    const ok = await this.input.lock();
    if (!ok) {
      this.events.onMessage("lockFailed");
      return;
    }
    this.setState("PLAYING");
  }

  private setState(state: GameState) {
    if (state === this.state) return;
    this.state = state;
    this.input.active = state === "PLAYING";
    if (state !== "PLAYING") {
      this.input.reset();
      this.input.unlock();
    }
    this.audio.setAmbientLevel(state === "PLAYING" ? 1 : 0.35);
    this.stats.accuracy = this.shots ? Math.round((this.hits / this.shots) * 100) : 0;
    this.dirty = true;
    this.events.onState(state, { ...this.stats });
  }

  private onPointerLockChange = () => {
    if (!this.input.locked && this.state === "PLAYING") this.setState("PAUSED");
  };

  private onVisibilityChange = () => {
    if (document.hidden && this.state === "PLAYING") this.setState("PAUSED");
  };

  /* ---------- Loop ---------- */

  private frame = (now: number) => {
    this.frameId = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, this.lastTime ? (now - this.lastTime) / 1000 : 0);
    this.lastTime = now;
    this.time += dt;

    if (this.state === "PLAYING") this.update(dt);
    // Menus and pauses show a still frame: no need to redraw it 60 times a second.
    if (this.state === "PLAYING" || this.dirty) {
      this.render();
      this.dirty = false;
    }
    this.input.endFrame();

    if (this.events.onFps) {
      this.fpsFrames++;
      this.fpsTime += dt;
      if (this.fpsTime >= 0.5) {
        this.events.onFps(Math.round(this.fpsFrames / this.fpsTime));
        this.fpsFrames = 0;
        this.fpsTime = 0;
      }
    }
  };

  private update(dt: number) {
    const { input, player, world } = this;
    const keys = input.keys;
    this.stats.seconds += dt;

    // 1. Input. Browsers normally eat Esc to release pointer lock (handled in
    // onPointerLockChange); if the key reaches us instead, pause all the same.
    if (input.consumePressed("Escape")) {
      this.setState("PAUSED");
      return;
    }
    const turn = (keys.has("ArrowLeft") ? 1 : 0) - (keys.has("ArrowRight") ? 1 : 0);
    player.look(input.mouseDX * MOUSE_SENSITIVITY - turn * KEY_TURN_SPEED * dt, input.mouseDY * MOUSE_SENSITIVITY);
    const move = {
      forward: (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0),
      strafe: (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0),
      sprint: keys.has("ShiftLeft") || keys.has("ShiftRight"),
      jump: keys.has("Space"),
    };
    const arsenal = player.inv.arsenal;
    let wanted: WeaponId | null = null;
    if (input.consumePressed("Digit1")) wanted = "pistol";
    if (input.consumePressed("Digit2")) wanted = "shotgun";
    if (input.consumePressed("KeyQ") || input.wheel !== 0) wanted = arsenal.current === "pistol" ? "shotgun" : "pistol";
    if (wanted && switchWeapon(arsenal, wanted)) this.viewmodel.show(wanted);
    if (input.consumePressed("KeyR") && startReload(arsenal)) this.audio.play("reload");

    // 2–3. Player movement and collision
    player.update(dt, move, world.collision);
    for (const e of this.enemies) if (e.alive) player.pushOutOf(e.x, e.z, e.def.radius, world.collision);

    // Doors
    this.lockedMessageCooldown = Math.max(0, this.lockedMessageCooldown - dt);
    for (const d of world.doors) {
      const near = Math.hypot(d.x - player.x, d.z - player.z);
      if (d.kind === "auto" && near < 6) d.holdOpen = 2;
      if (d.kind === "locked" && near < 6) {
        if (player.inv.hasKey) d.holdOpen = 2;
        else if (near < 4.6 && this.lockedMessageCooldown === 0) {
          this.lockedMessageCooldown = 3;
          this.events.onMessage("locked");
        }
      }
    }
    world.updateDoors(dt, this.isOccupied, this.onDoorMove);

    // 4. Enemy AI
    const ctx = this.enemyContext;
    ctx.player.x = player.x;
    ctx.player.z = player.z;
    ctx.player.eyeY = player.y + PLAYER.eyeHeight;
    for (const e of this.enemies) e.update(dt, ctx);
    if (this.state !== "PLAYING") return;

    // 5. Weapons
    tickArsenal(arsenal, dt);
    if (input.fireHeld || keys.has("KeyF")) {
      const result = tryFire(arsenal);
      if (result === "fired") this.shoot(arsenal.current);
      else if (result === "reload") this.audio.play("reload");
      else if (result === "empty") this.audio.play("empty");
    }

    // 6. Projectiles
    this.fireballs.update(dt, world, player, this.particles, (n) => this.hurtPlayer(n));
    if (this.state !== "PLAYING") return;

    // 7. Pickups
    for (const p of this.pickups) {
      p.update(this.time, world);
      if (p.taken || Math.hypot(p.x - player.x, p.z - player.z) > 1.4) continue;
      const hadShotgun = arsenal.ammo.shotgun.owned;
      if (!applyPickup(player.inv, p.kind)) continue;
      p.take();
      this.particles.spawn(p.x, 0.8, p.z, 10, 0xffe08a, 1.5, -0.5, 0.5);
      if (p.kind === "shotgun" && !hadShotgun) {
        this.audio.play("weaponPickup");
        this.viewmodel.show("shotgun");
      } else this.audio.play("pickup");
      this.events.onMessage(p.kind);
    }

    // 8. Particles, lamps
    this.particles.update(dt);
    world.updateLamps(this.time);

    // 9. Camera effects and the viewmodel
    this.placeCamera(dt);
    this.viewmodel.update(dt, {
      speed: player.onGround ? player.speed : 0,
      sprinting: move.sprint && move.forward > 0 && player.speed > PLAYER.walkSpeed * 0.9,
      reloading: arsenal.reloading > 0,
      brightness: world.lightAt(player.x, player.z),
    });

    // Exit
    const col = Math.floor(player.x / TILE);
    const row = Math.floor(player.z / TILE);
    if (col === this.level.exit.col && row === this.level.exit.row) {
      this.audio.play("secret");
      this.setState("VICTORY");
    }
    this.emitHud();
  }

  private placeCamera(dt: number) {
    const p = this.player;
    this.headBob += dt * (p.onGround ? p.speed : 0) * 1.4;
    const bob = Math.sin(this.headBob) * 0.06 * Math.min(1, p.speed / PLAYER.walkSpeed);
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    this.recoil = Math.max(0, this.recoil - this.recoil * dt * 9);
    const shake = this.trauma * this.trauma;
    this.camera.position.set(
      p.x + (Math.random() - 0.5) * shake * 0.3,
      p.y + PLAYER.eyeHeight + bob + (Math.random() - 0.5) * shake * 0.3,
      p.z + (Math.random() - 0.5) * shake * 0.3,
    );
    this.camera.rotation.set(
      Math.max(-1.45, Math.min(1.45, p.pitch + this.recoil)),
      p.yaw,
      (Math.random() - 0.5) * shake * 0.08,
    );
  }

  /* ---------- Combat ---------- */

  private shoot(id: WeaponId) {
    const def = WEAPONS[id];
    this.audio.play(id);
    this.viewmodel.fire(id);
    this.trauma = Math.min(1, this.trauma + def.shake);
    this.recoil += def.recoil;
    this.shots++;

    // Gunfire wakes up enemies nearby.
    for (const e of this.enemies) {
      if (e.alive && Math.hypot(e.x - this.player.x, e.z - this.player.z) < 22) e.alert();
    }

    this.camera.updateMatrixWorld();
    this.camera.getWorldPosition(this.tmpOrigin);
    this.camera.getWorldDirection(this.tmpForward);
    this.tmpRight.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    this.tmpUp.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
    this.raycaster.far = def.range;
    this.damageByEnemy.clear();

    for (let i = 0; i < def.pellets; i++) {
      // Uniform spread inside a small cone, centred on the crosshair.
      const a = Math.random() * Math.PI * 2;
      const r = def.pellets > 1 ? Math.sqrt(Math.random()) * def.spread : Math.random() * def.spread;
      this.tmpDir
        .copy(this.tmpForward)
        .addScaledVector(this.tmpRight, Math.cos(a) * r)
        .addScaledVector(this.tmpUp, Math.sin(a) * r)
        .normalize();
      this.raycaster.set(this.tmpOrigin, this.tmpDir);
      const hit = this.raycaster.intersectObjects(this.world.targets, false)[0];
      if (!hit) continue;
      const kind = hit.object.userData.kind as string;
      if (kind === "enemy") {
        const enemy = hit.object.userData.enemy as Enemy;
        const entry = this.damageByEnemy.get(enemy) ?? { amount: 0, y: hit.point.y };
        entry.amount += def.damage;
        this.damageByEnemy.set(enemy, entry);
        continue;
      }
      if (kind === "door") this.shootDoor(hit.object.userData.door as Door);
      // Impact: nudge off the surface along its normal so the puff isn't buried in it.
      const n = hit.face?.normal;
      const x = hit.point.x + (n ? n.x * 0.08 : 0);
      const y = hit.point.y + (n ? n.y * 0.08 : 0);
      const z = hit.point.z + (n ? n.z * 0.08 : 0);
      this.particles.spawn(x, y, z, 3, 0xffc46a, 1.2, 6, 0.25);
      this.particles.spawn(x, y, z, 3, 0x6a625a, 0.8, 3, 0.5);
    }

    if (this.damageByEnemy.size) {
      this.hits++;
      let killed = false;
      for (const [enemy, { amount, y }] of this.damageByEnemy) {
        if (enemy.hurt(amount, this.particles, y)) {
          killed = true;
          this.stats.kills++;
          const i = this.world.targets.indexOf(enemy.sprite);
          if (i >= 0) this.world.targets.splice(i, 1);
          this.audio.play("enemyDeath");
        } else this.audio.play("enemyHit");
      }
      this.events.onHit(killed);
    }
    this.emitHud();
  }

  private shootDoor(door: Door) {
    if (door.kind !== "secret" || door.opening) return;
    door.opening = true;
    this.stats.secrets++;
    this.audio.play("secret");
    this.events.onMessage("secret");
  }

  private hurtPlayer(amount: number) {
    if (this.state !== "PLAYING") return;
    applyDamage(this.player.inv, amount);
    this.trauma = Math.min(1, this.trauma + 0.45);
    this.audio.play("playerHurt");
    this.events.onDamage(amount);
    this.emitHud();
    if (this.player.inv.health <= 0) this.setState("GAME_OVER");
  }

  private isOccupied = (col: number, row: number) => {
    const minX = col * TILE;
    const minZ = row * TILE;
    const inside = (x: number, z: number, r: number) =>
      x + r > minX && x - r < minX + TILE && z + r > minZ && z - r < minZ + TILE;
    if (inside(this.player.x, this.player.z, PLAYER.radius)) return true;
    return this.enemies.some((e) => e.alive && inside(e.x, e.z, e.def.radius));
  };

  private onDoorMove = (door: Door) => {
    if (Math.hypot(door.x - this.player.x, door.z - this.player.z) < 24) this.audio.play("door");
  };

  private emitHud() {
    const inv = this.player.inv;
    const a = inv.arsenal;
    const ammo = a.ammo[a.current];
    const last = this.lastHud;
    const health = Math.max(0, Math.round(inv.health));
    const armor = Math.round(inv.armor);
    const reloading = a.reloading > 0;
    // Field-by-field check: no allocation unless something the HUD shows changed.
    if (
      last &&
      last.health === health &&
      last.armor === armor &&
      last.weapon === a.current &&
      last.mag === ammo.mag &&
      last.reserve === ammo.reserve &&
      last.hasShotgun === a.ammo.shotgun.owned &&
      last.hasKey === inv.hasKey &&
      last.reloading === reloading
    )
      return;
    const hud: Hud = {
      health,
      armor,
      weapon: a.current,
      mag: ammo.mag,
      reserve: ammo.reserve,
      hasShotgun: a.ammo.shotgun.owned,
      hasKey: inv.hasKey,
      reloading,
    };
    this.lastHud = hud;
    this.events.onHud(hud);
  }

  /* ---------- Rendering ---------- */

  private render() {
    const r = this.renderer;
    this.post.time = this.time;
    r.setRenderTarget(this.post.target);
    r.clear();
    r.render(this.world.scene, this.camera);
    r.clearDepth();
    r.render(this.viewmodel.scene, this.viewmodel.camera);
    r.setRenderTarget(null);
    r.clear();
    r.render(this.post.scene, this.post.camera);
  }

  /* ---------- Teardown ---------- */

  private disposeRun() {
    if (!this.world) return;
    for (const e of this.enemies) e.dispose();
    for (const p of this.pickups) p.dispose();
    this.particles.dispose();
    this.fireballs.dispose();
    this.world.dispose();
  }

  dispose() {
    cancelAnimationFrame(this.frameId);
    this.resizeObserver.disconnect();
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.input.dispose();
    this.audio.dispose();
    this.disposeRun();
    this.levelAssets.dispose();
    for (const kind of Object.values(this.enemyArt)) for (const t of Object.values(kind)) t.dispose();
    for (const t of Object.values(this.effectArt)) t.dispose();
    this.glowMaterial.dispose();
    this.viewmodel.dispose();
    this.post.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
