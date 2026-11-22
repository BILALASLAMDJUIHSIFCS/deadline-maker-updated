import { useEffect, useRef, useState } from "react";
import { Mesh, Program, Renderer, Triangle } from "ogl";

// Magic Sphere — a full-screen OGL fragment shader that paints an iridescent
// orb (violet → lilac → amber) with a fresnel rim. The colour field flows over
// time and its light tilts toward the cursor.

const vertex = /* glsl */ `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

const fragment = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec3 uSphere;   // center.xy (device px, GL origin bottom-left), radius (px)
uniform vec2 uMouse;    // -1..1

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p = (frag - uSphere.xy) / uSphere.z;
  float d = length(p);
  vec3 col = vec3(0.027, 0.02, 0.043);

  float t = uTime * 0.07;
  vec3 rimCol = mix(vec3(1.0, 0.62, 0.28), vec3(0.82, 0.72, 1.0), smoothstep(-0.6, 0.6, p.y));

  if (d < 1.0) {
    float z = sqrt(1.0 - d * d);
    vec3 n = vec3(p, z);
    vec2 q = n.xy * 1.25 + uMouse * 0.22;
    float f = fbm(q * 1.5 + vec2(t, -t * 0.7) + fbm(q * 2.1 - vec2(t * 0.8, t)) * 0.9);
    float h = n.y * 0.5 + 0.5 + (f - 0.5) * 0.6;

    vec3 umber   = vec3(0.10, 0.05, 0.05);
    vec3 amber   = vec3(0.97, 0.58, 0.18);
    vec3 lilac   = vec3(0.94, 0.89, 1.00);
    vec3 magenta = vec3(0.86, 0.26, 0.95);
    vec3 violet  = vec3(0.47, 0.22, 0.93);

    vec3 c = mix(umber, amber, smoothstep(0.04, 0.42, h));
    c = mix(c, lilac, smoothstep(0.38, 0.56, h) * 0.9);
    c = mix(c, magenta, smoothstep(0.55, 0.8, h));
    c = mix(c, violet, smoothstep(0.78, 1.08, h) * (0.65 + 0.35 * sin(t * 3.0 + n.x * 2.0)));
    c = mix(c, vec3(0.34, 0.44, 0.96), (1.0 - smoothstep(-0.9, 0.15, n.x)) * 0.32);

    vec3 L = normalize(vec3(uMouse.x * 0.6 - 0.15, 0.55 + uMouse.y * 0.3, 0.8));
    c *= 0.42 + 0.78 * clamp(dot(n, L), 0.0, 1.0);

    float fres = pow(1.0 - z, 3.0);
    c += rimCol * fres * 0.85;
    c *= 1.0 - smoothstep(0.86, 0.975, d) * 0.4;
    c += rimCol * smoothstep(0.982, 0.998, d) * 0.7;

    col = mix(col, c, 1.0 - smoothstep(0.994, 1.0, d));
  }

  float g = exp(-max(d - 1.0, 0.0) * 5.0) * step(1.0, d);
  col += mix(vec3(0.55, 0.32, 0.9), rimCol, 0.35) * g * 0.14;
  col += (hash(frag + fract(uTime)) - 0.5) * 0.022;

  gl_FragColor = vec4(col, 1.0);
}
`;

export default function SphereFX() {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: Renderer;
    try {
      renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio || 1, 1.5), alpha: false, antialias: false });
    } catch {
      setFailed(true);
      return;
    }
    const gl = renderer.gl;
    gl.canvas.style.width = "100%";
    gl.canvas.style.height = "100%";
    el.appendChild(gl.canvas);

    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        uTime: { value: 0 },
        uSphere: { value: [0, 0, 1] },
        uMouse: { value: [0, 0] },
      },
    });
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    const layout = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h);
      const dpr = renderer.dpr;
      const wide = w >= 1024;
      const cx = wide ? w * 0.42 : w * 0.5;
      const cy = wide ? h * 0.46 : h * 0.3;
      const r = wide ? Math.min(w, h) * 0.4 : Math.min(w, h) * 0.46;
      program.uniforms.uSphere.value = [cx * dpr, (h - cy) * dpr, r * dpr];
    };
    layout();

    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.ty = -((e.clientY / window.innerHeight) * 2 - 1);
      if (reduce) draw(0);
    };

    let raf = 0;
    const start = performance.now();
    const draw = (time: number) => {
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      program.uniforms.uMouse.value = [mouse.x, mouse.y];
      program.uniforms.uTime.value = time;
      renderer.render({ scene: mesh });
    };
    const loop = (now: number) => {
      draw((now - start) / 1000);
      raf = requestAnimationFrame(loop);
    };

    const onResize = () => {
      layout();
      if (reduce) draw(0);
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onMove, { passive: true });
    if (reduce) draw(0);
    else raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      gl.canvas.remove();
    };
  }, []);

  return (
    <div aria-hidden ref={host} className="pointer-events-none fixed inset-0">
      {failed && (
        <div
          className="absolute left-1/2 top-[30%] aspect-square w-[80vmin] -translate-x-1/2 -translate-y-1/2 rounded-full lg:left-[42%] lg:top-[46%]"
          style={{
            background:
              "radial-gradient(circle at 50% 30%, #d946ef 0%, #7c3aed 30%, #efe3ff 52%, #f59e0b 70%, #1a0d0a 92%)",
          }}
        />
      )}
    </div>
  );
}
