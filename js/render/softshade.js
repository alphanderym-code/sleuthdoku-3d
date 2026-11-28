// Global shading tweaks for the soft, matte "vinyl toy" look. Importing this module patches three's shader chunks once,
// before any program is compiled, so every MeshStandardMaterial gets it (including ones with their own onBeforeCompile):
//  - wrapped diffuse with a warm terminator (cheap subsurface feel)
//  - soft fresnel lift on grazing angles (velvety edges)
import * as THREE from 'three';

const C = THREE.ShaderChunk;
const SRC = 'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );\n\tvec3 irradiance = dotNL * directLight.color;';

if (!C.__softShade) {
  const i = C.lights_physical_pars_fragment.indexOf('void RE_Direct_Physical');
  const head = C.lights_physical_pars_fragment.slice(0, i), tail = C.lights_physical_pars_fragment.slice(i);
  if (!tail.includes(SRC)) console.warn('softshade: light chunk changed, diffuse wrap skipped');
  C.lights_physical_pars_fragment = head + tail.replace(SRC, `float dotNL = saturate( ( dot( geometryNormal, directLight.direction ) + 0.12 ) / 1.12 );
  vec3 irradiance = dotNL * directLight.color * mix( vec3( 1.12, 0.86, 0.78 ), vec3( 1.0 ), smoothstep( 0.0, 0.6, dotNL ) );`);
  C.opaque_fragment = `#ifdef STANDARD
  float softFr = 1.0 - saturate( dot( normalize( normal ), normalize( vViewPosition ) ) );
  // kept low and faded out at the very silhouette: a strong lift there read as a white contour around objects
  outgoingLight *= 1.0 + 0.16 * softFr * softFr * ( 1.0 - smoothstep( 0.82, 1.0, softFr ) );
  // tame sub-pixel specular so MSAA edges do not sparkle in the HDR buffer (emission may still bloom)
  outgoingLight = min( outgoingLight - totalEmissiveRadiance, vec3( 1.35 ) ) + totalEmissiveRadiance;
#endif
${C.opaque_fragment}`;
  Object.defineProperty(C, '__softShade', { value: true, enumerable: false });
}
