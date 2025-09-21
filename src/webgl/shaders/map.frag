#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 out_color;

// Textures
uniform sampler2D u_mask;
uniform sampler2D u_palette; // prov id -> final color
uniform sampler2D u_state_palette; // prov id -> state id

// Dimensions
uniform vec2 u_map_dims;
uniform vec2 u_screen_dims;
uniform vec2 u_palette_dims;
uniform vec2 u_state_palette_dims;
uniform vec2 u_mask_dims;

// Camera
uniform vec2 u_camera_pos;
uniform float u_camera_scale; // zoom

// Border Parameters
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

// Decodes a 2-channel ID (stored in R and G)
float decode_id(vec4 color) {
    // Don't decode sea pixels
    if (color.a == 0.0) {
        return -1.0;
    }
    return color.r * 255.0 + color.g * 255.0 * 256.0;
}

// Calculates the UV for a palette lookup from an ID
vec2 get_palette_uv(float id, vec2 dims) {
    float x = mod(id, dims.x);
    float y = floor(id / dims.x);
    return (vec2(x, y) + 0.5) / dims;
}

// Looks up the state ID for a given province ID
float get_state_id(float prov_id) {
    if (prov_id < 0.0) return -1.0;
    vec2 uv = get_palette_uv(prov_id, u_state_palette_dims);
    return decode_id(texture(u_state_palette, uv));
}

// Looks up the final display color for a given province ID
vec4 get_display_color(float prov_id) {
    if (prov_id < 0.0) {
        return vec4(0.0, 0.02, 0.16, 1.0); // Sea color
    }
    vec2 uv = get_palette_uv(prov_id, u_palette_dims);
    return texture(u_palette, uv);
}

// Calculates fade alpha based on zoom
float calculate_fade_alpha(float appearZoom, float hideZoom, float currentZoom, float fadeMargin) {
    float appear_start = appearZoom - fadeMargin;
    float hide_end = hideZoom + fadeMargin;

    float fade_in = smoothstep(appear_start, appearZoom, currentZoom);
    float fade_out = 1.0 - smoothstep(hideZoom, hide_end, currentZoom);

    return fade_in * fade_out;
}


void main() {
    // 1. Transform screen UV to map coordinates
    float scale = u_screen_dims.y / u_map_dims.y * u_camera_scale;
    vec2 translate = vec2(
        u_screen_dims.x / 2.0 - u_camera_pos.x * scale,
        u_screen_dims.y / 2.0 - u_camera_pos.y * scale
    );
    vec2 map_coord = (v_uv * u_screen_dims - translate) / scale;

    // 2. Convert map coordinates to UV for the mask texture
    vec2 mask_uv = map_coord / u_map_dims;
    mask_uv.y = 1.0 - mask_uv.y; // Flip Y
    mask_uv.x = fract(mask_uv.x); // Wrap X

    // 3. Check for vertical out-of-bounds
    if (mask_uv.y < 0.0 || mask_uv.y > 1.0) {
        out_color = vec4(0.0, 0.02, 0.16, 1.0); // Sea color
        return;
    }

    // 4. Get Province ID and data for the center pixel
    float center_prov_id = decode_id(texture(u_mask, mask_uv));
    
    // If center is sea, nothing to do
    if (center_prov_id < 0.0) {
        out_color = vec4(0.0, 0.02, 0.16, 1.0); // Sea color
        return;
    }

    float center_state_id = get_state_id(center_prov_id);
    vec4 center_display_color = get_display_color(center_prov_id);
    vec4 base_color = center_display_color;

    // 5. HQx-style Border Detection (8 neighbors)
    vec2 texel_size = 1.0 / u_mask_dims;
    int max_border_level = 0; // 0:none, 1:prov, 2:state, 3:country

    vec2 offsets[8] = vec2[8](
        vec2(-texel_size.x, -texel_size.y), // SW
        vec2( 0.0,          -texel_size.y), // S
        vec2( texel_size.x, -texel_size.y), // SE
        vec2(-texel_size.x,  0.0),          // W
        vec2( texel_size.x,  0.0),          // E
        vec2(-texel_size.x,  texel_size.y), // NW
        vec2( 0.0,           texel_size.y), // N
        vec2( texel_size.x,  texel_size.y)  // NE
    );

    for (int i = 0; i < 8; i++) {
        vec2 neighbor_uv = mask_uv + offsets[i];
        float neighbor_prov_id = decode_id(texture(u_mask, neighbor_uv));

        if (neighbor_prov_id != center_prov_id) {
            // IDs differ, so it's at least a province border
            int current_level = 1;

            // Check if it's a state border
            float neighbor_state_id = get_state_id(neighbor_prov_id);
            if (neighbor_state_id != center_state_id) {
                current_level = 2;
            }
            
            // Check if it's a country border by comparing display color
            vec4 neighbor_display_color = get_display_color(neighbor_prov_id);
            if (any(notEqual(neighbor_display_color, center_display_color))) {
                current_level = 3;
            }

            if (current_level > max_border_level) {
                max_border_level = current_level;
            }
        }
    }

    // 6. Select border style and apply
    if (max_border_level == 0) {
        // Not a border pixel
        out_color = base_color;
        return;
    }

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

    // 7. Mix final color
    // To get sharp lines, we mix based on the border's alpha, not a constant.
    // The final alpha is the border's alpha multiplied by the zoom fade.
    float final_alpha = border_color.a * fade_alpha;
    vec3 mixed_color = mix(base_color.rgb, border_color.rgb, final_alpha);
    
    out_color = vec4(mixed_color, base_color.a);
}