#define PI 3.1415926538

uniform sampler2D tDiffuse;
uniform vec2 resolution;

varying vec2 vUv;

vec2 curveRemapUV(vec2 uv)
{
  vec2 curvature = vec2(5., 5.);
  // as we near the edge of our screen apply greater distortion using a sinusoid.

  uv = uv * 2.0 - 1.0;
  vec2 offset = abs(uv.yx) / vec2(curvature.x, curvature.y);
  uv = uv + uv * offset * offset;
  uv = uv * 0.5 + 0.5;
  return uv;
}

vec4 scanLineIntensity(float uv, float resolution, float opacity)
{
  float intensity = sin(uv * resolution * PI);
  intensity = ((0.5 * intensity) + 0.5) * 0.9 + 0.1;
  return vec4(vec3(pow(intensity, opacity)), 1.0);
}

void main() {
  vec2 greenUv = curveRemapUV(vec2(vUv.x, vUv.y));

  if (greenUv.x < 0.0 || greenUv.y < 0.0 || greenUv.x > 1.0 || greenUv.y > 1.0){
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    float offset = abs(vUv.x - .5) * -.02;

    vec2 redUv = curveRemapUV(vec2(vUv.x + offset, vUv.y + offset));
    vec2 blueUv = curveRemapUV(vec2(vUv.x - offset, vUv.y - offset));

    float red = texture(tDiffuse, redUv).r;
    float green = texture(tDiffuse, greenUv).g;
    float blue = texture(tDiffuse, blueUv).b;

    vec4 baseColor = vec4(red, green, blue, 1.0);
    vec2 scanLineOpacity = vec2(.25);

    // baseColor *= scanLineIntensity(greenUv.x, resolution.y, scanLineOpacity.x);
    baseColor *= scanLineIntensity(greenUv.y, resolution.x, scanLineOpacity.y);

    float vignet = 1.0 - distance(vUv - .5, vec2(0.));
    vignet = pow(vignet, 1.8);
    vignet = clamp(0.0, 1.0, vignet);

    baseColor *= vignet;

    gl_FragColor = baseColor;
  }
}
