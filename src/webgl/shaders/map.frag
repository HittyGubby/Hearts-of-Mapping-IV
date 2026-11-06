#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 out_color;

// === Textures ===
uniform sampler2D u_mask;              // province/state/country lookup map (set LINEAR filter!)
uniform sampler2D u_palette;           // prov id -> final color
uniform sampler2D u_state_palette;     // prov id -> state id

// === Dimensions ===
uniform vec2 u_map_dims;
uniform vec2 u_screen_dims;
uniform vec2 u_palette_dims;
uniform vec2 u_state_palette_dims;
uniform vec2 u_mask_dims;

// === Camera ===
uniform vec2 u_camera_pos;
uniform float u_camera_scale; // zoom

// === Border Parameters ===
struct BorderParams {
    vec4 color;
    float thickness;
    float appearZoom;
    float hideZoom;
};

uniform BorderParams u_prov_border;
uniform BorderParams u_state_border;
uniform BorderParams u_country_border;
uniform float u_fade_margin;


// === Utility ===
float decode_id(vec4 color) {
    if (color.a == 0.0) return -1.0;
    return color.r * 255.0 + color.g * 255.0 * 256.0;
}

vec2 get_palette_uv(float id, vec2 dims) {
    float x = mod(id, dims.x);
    float y = floor(id / dims.x);
    return (vec2(x, y) + 0.5) / dims;
}

float get_state_id(float prov_id) {
    if (prov_id < 0.0) return -1.0;
    vec2 uv = get_palette_uv(prov_id, u_state_palette_dims);
    return decode_id(texture(u_state_palette, uv));
}

vec4 get_display_color(float prov_id) {
    if (prov_id < 0.0) return vec4(0.0, 0.02, 0.16, 1.0); // sea
    vec2 uv = get_palette_uv(prov_id, u_palette_dims);
    return texture(u_palette, uv);
}

float calculate_fade_alpha(float appearZoom, float hideZoom, float currentZoom, float fadeMargin) {
    float appear_start = appearZoom - fadeMargin;
    float hide_end = hideZoom + fadeMargin;
    float fade_in = smoothstep(appear_start, appearZoom, currentZoom);
    float fade_out = 1.0 - smoothstep(hideZoom, hide_end, currentZoom);
    return fade_in * fade_out;
}


// === Smoothed border detection ===
float border_strength(vec2 uv) {
    vec2 texel = 1.0 / u_mask_dims;

    // Sample central + 4 neighbors (linear-filtered!)
    vec4 c = texture(u_mask, uv);
    vec4 l = texture(u_mask, uv - vec2(texel.x, 0.0));
    vec4 r = texture(u_mask, uv + vec2(texel.x, 0.0));
    vec4 u = texture(u_mask, uv + vec2(0.0, texel.y));
    vec4 d = texture(u_mask, uv - vec2(0.0, texel.y));

    // Color distance (works across all map layers)
    float diff = length(c - l) + length(c - r) + length(c - u) + length(c - d);

    // Smooth threshold — controls how wide the anti-aliased band is
    return smoothstep(0.05, 0.25, diff);
}


// === Main ===
void main() {
    // 1. Transform screen UV to map coordinates
    float scale = u_screen_dims.y / u_map_dims.y * u_camera_scale;
    vec2 translate = vec2(
        u_screen_dims.x / 2.0 - u_camera_pos.x * scale,
        u_screen_dims.y / 2.0 - u_camera_pos.y * scale
    );
    vec2 map_coord = (v_uv * u_screen_dims - translate) / scale;

    // 2. Convert to mask UV
    vec2 mask_uv = map_coord / u_map_dims;
    mask_uv.y = 1.0 - mask_uv.y;
    mask_uv.x = fract(mask_uv.x);

    // 3. Out-of-bounds → sea
    if (mask_uv.y < 0.0 || mask_uv.y > 1.0) {
        out_color = vec4(0.0, 0.02, 0.16, 1.0);
        return;
    }

    // 4. Decode center IDs
    vec4 mask_sample = texture(u_mask, mask_uv);
    float center_prov_id = decode_id(mask_sample);
    if (center_prov_id < 0.0) {
        out_color = vec4(0.0, 0.02, 0.16, 1.0);
        return;
    }

    float center_state_id = get_state_id(center_prov_id);
    vec4 center_display_color = get_display_color(center_prov_id);
    vec4 base_color = center_display_color;

// === 5. Detect borders first (ID-space, not color-space) ===
vec2 texel = 1.0 / u_mask_dims;
float border_diff = 0.0;
float center_id = decode_id(mask_sample);

    vec2 offsets[8] = vec2[8](
        vec2(-texel.x, -texel.y), // SW
        vec2( 0.0,          -texel.y), // S
        vec2( texel.x, -texel.y), // SE
        vec2(-texel.x,  0.0),          // W
        vec2( texel.x,  0.0),          // E
        vec2(-texel.x,  texel.y), // NW
        vec2( 0.0,           texel.y), // N
        vec2( texel.x,  texel.y)  // NE
    );

for (int i = 0; i < 8; i++) {
    vec2 neighbor_uv = mask_uv + offsets[i];
    float neighbor_id = decode_id(texture(u_mask, neighbor_uv));
    if (neighbor_id != center_id) {
        border_diff += 1.0;
    }
}
border_diff /= 8.0; // normalize 0–1

// === 6. Compute smoothness from interpolated color difference ===
float smooth_edge = border_strength(mask_uv);

// === 7. Combine both signals ===
// border_diff = “is this a border texel?”
// smooth_edge = “how far am I from that edge?”
float edge_strength = clamp(border_diff * smooth_edge * 2.5, 0.0, 1.0);

// === 8. Hierarchical border level logic (same as before) ===
int max_border_level = 0;
for (int i = 0; i < 8; i++) {
    vec2 neighbor_uv = mask_uv + offsets[i];
    float neighbor_prov_id = decode_id(texture(u_mask, neighbor_uv));
    if (neighbor_prov_id != center_prov_id) {
        int current_level = 1;
        float neighbor_state_id = get_state_id(neighbor_prov_id);
        if (neighbor_state_id != center_state_id) current_level = 2;
        vec4 neighbor_display_color = get_display_color(neighbor_prov_id);
        if (any(notEqual(neighbor_display_color, center_display_color))) current_level = 3;
        if (current_level > max_border_level) max_border_level = current_level;
    }
}

// === 9. Select border style ===
vec4 border_color = vec4(0.0);
float fade_alpha = 0.0;
if (max_border_level == 3) {
    border_color = u_country_border.color;
    fade_alpha = calculate_fade_alpha(u_country_border.appearZoom, u_country_border.hideZoom, u_camera_scale, u_fade_margin);
} else if (max_border_level == 2) {
    border_color = u_state_border.color;
    fade_alpha = calculate_fade_alpha(u_state_border.appearZoom, u_state_border.hideZoom, u_camera_scale, u_fade_margin);
} else if (max_border_level == 1) {
    border_color = u_prov_border.color;
    fade_alpha = calculate_fade_alpha(u_prov_border.appearZoom, u_prov_border.hideZoom, u_camera_scale, u_fade_margin);
}

// === 10. Blend smooth fill + border (no pixel base edge leak) ===
float border_alpha = edge_strength * border_color.a * fade_alpha;
vec3 mixed_color = mix(base_color.rgb, border_color.rgb, border_alpha);
out_color = vec4(mixed_color, 1.0);

}
