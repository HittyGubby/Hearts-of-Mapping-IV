#version 300 es
// This is the vertex shader.
// Its purpose is to take vertex positions of a 2D quad,
// and pass them through to the fragment shader.
// It also passes along UV coordinates for texture mapping.

precision highp float;

// Input vertex positions for a quad (e.g., -1 to 1)
in vec2 a_pos;

// Output texture coordinate to the fragment shader
out vec2 v_uv;

void main() {
    // Pass the position directly, as we are drawing a fullscreen quad
    gl_Position = vec4(a_pos, 0.0, 1.0);

    // Convert vertex position from [-1, 1] range to [0, 1] range for UV coordinates
    v_uv = a_pos * 0.5 + 0.5;
}
