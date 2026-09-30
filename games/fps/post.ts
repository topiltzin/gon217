import {
  BufferAttribute,
  BufferGeometry,
  HalfFloatType,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  Scene,
  ShaderMaterial,
  WebGLRenderTarget,
} from "three";

/** Vertical resolution the world is drawn at before being scaled up with nearest-neighbour filtering. */
export const PIXEL_HEIGHT = 300;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// CRT: barrel distortion, slight chromatic aberration, scanlines, vignette and noise.
// Everything is gated by uCrt so the effect can be switched off completely.
const fragmentShader = /* glsl */ `
  uniform sampler2D tScene;
  uniform float uCrt;
  uniform float uTime;
  uniform vec2 uLowRes;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  void main() {
    if (uCrt < 0.5) {
      gl_FragColor = texture2D(tScene, vUv);
    } else {
      vec2 c = vUv * 2.0 - 1.0;
      c *= 1.0 + 0.03 * dot(c, c);
      vec2 uv = c * 0.5 + 0.5;
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      } else {
        float ca = 0.5 / uLowRes.x;
        vec3 col = vec3(
          texture2D(tScene, uv + vec2(ca, 0.0)).r,
          texture2D(tScene, uv).g,
          texture2D(tScene, uv - vec2(ca, 0.0)).b
        );
        col *= 0.84 + 0.16 * sin(uv.y * uLowRes.y * 6.2831853);
        vec2 v = uv * (1.0 - uv.yx);
        col *= pow(clamp(v.x * v.y * 18.0, 0.0, 1.0), 0.2);
        col += (hash(vUv * (uTime + 1.0)) - 0.5) * 0.012;
        gl_FragColor = vec4(col * 1.1, 1.0);
      }
    }
    #include <colorspace_fragment>
  }
`;

/** Low-resolution render target plus the full-screen pass that upscales it (with optional CRT look). */
export class RetroPass {
  readonly target: WebGLRenderTarget;
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly material: ShaderMaterial;
  private readonly geometry: BufferGeometry;

  constructor() {
    this.target = new WebGLRenderTarget(4, 4, {
      minFilter: NearestFilter,
      magFilter: NearestFilter,
      type: HalfFloatType,
      depthBuffer: true,
    });
    this.material = new ShaderMaterial({
      uniforms: {
        tScene: { value: this.target.texture },
        uCrt: { value: 1 },
        uTime: { value: 0 },
        uLowRes: { value: [4, 4] },
      },
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    // One oversized triangle covers the screen.
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const mesh = new Mesh(this.geometry, this.material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  /** Sizes the low-res target to the screen's aspect ratio. Returns [width, height]. */
  resize(aspect: number): [number, number] {
    const h = PIXEL_HEIGHT;
    const w = Math.max(1, Math.round(h * aspect));
    this.target.setSize(w, h);
    this.material.uniforms.uLowRes.value = [w, h];
    return [w, h];
  }

  set crt(on: boolean) {
    this.material.uniforms.uCrt.value = on ? 1 : 0;
  }

  set time(t: number) {
    this.material.uniforms.uTime.value = t % 100;
  }

  dispose() {
    this.target.dispose();
    this.material.dispose();
    this.geometry.dispose();
  }
}
