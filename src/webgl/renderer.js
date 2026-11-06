
import mapVertexShader from './shaders/map.vert?raw';
import mapFragmentShader from './shaders/map.frag?raw';

// Helper to compile a shader
function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('An error occurred compiling the shaders: ', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

// Helper to create a shader program
function createProgram(gl, vs, fs) {
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Unable to initialize the shader program: ', gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}

// The main renderer object
export async function initRenderer(canvas, provinceMaskUrl, mapWidth, mapHeight, provinceDefinitions, statesUrl) {
    const gl = canvas.getContext('webgl2');
    if (!gl) {
        throw new Error('WebGL2 not supported');
    }

    // Create shader program
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, mapVertexShader);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, mapFragmentShader);
    const program = createProgram(gl, vertexShader, fragmentShader);

    // Get attribute and uniform locations
    const locations = {
        attributes: {
            pos: gl.getAttribLocation(program, 'a_pos'),
        },
        uniforms: {
            mask: gl.getUniformLocation(program, 'u_mask'),
            cameraPos: gl.getUniformLocation(program, 'u_camera_pos'),
            cameraScale: gl.getUniformLocation(program, 'u_camera_scale'),
            mapDims: gl.getUniformLocation(program, 'u_map_dims'),
            screenDims: gl.getUniformLocation(program, 'u_screen_dims'),
            palette: gl.getUniformLocation(program, 'u_palette'),
            paletteDims: gl.getUniformLocation(program, 'u_palette_dims'),
            statePalette: gl.getUniformLocation(program, 'u_state_palette'),
            statePaletteDims: gl.getUniformLocation(program, 'u_state_palette_dims'),
            maskDims: gl.getUniformLocation(program, 'u_mask_dims'),
            fadeMargin: gl.getUniformLocation(program, 'u_fade_margin'),
            provBorder: {
                color: gl.getUniformLocation(program, 'u_prov_border.color'),
                thickness: gl.getUniformLocation(program, 'u_prov_border.thickness'),
                appearZoom: gl.getUniformLocation(program, 'u_prov_border.appearZoom'),
                hideZoom: gl.getUniformLocation(program, 'u_prov_border.hideZoom'),
            },
            stateBorder: {
                color: gl.getUniformLocation(program, 'u_state_border.color'),
                thickness: gl.getUniformLocation(program, 'u_state_border.thickness'),
                appearZoom: gl.getUniformLocation(program, 'u_state_border.appearZoom'),
                hideZoom: gl.getUniformLocation(program, 'u_state_border.hideZoom'),
            },
            countryBorder: {
                color: gl.getUniformLocation(program, 'u_country_border.color'),
                thickness: gl.getUniformLocation(program, 'u_country_border.thickness'),
                appearZoom: gl.getUniformLocation(program, 'u_country_border.appearZoom'),
                hideZoom: gl.getUniformLocation(program, 'u_country_border.hideZoom'),
            },
        },
    };

    // --- Buffer for the fullscreen quad ---
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    // --- Load and process the province mask ---
    const { maskTexture, colorToProvinceIndex, provinceCount, paletteTexture, paletteDims, originalPaletteData, statePaletteTexture, statePaletteDims } = await createGpuResources(gl, provinceMaskUrl, mapWidth, mapHeight, provinceDefinitions, statesUrl);

    // --- CPU-side resources for click detection ---
    const offscreenCanvas = new OffscreenCanvas(mapWidth, mapHeight);
    const offscreenCtx = offscreenCanvas.getContext('2d');
    // We need to redraw the image here for CPU picking
    const image = new Image();
    image.src = provinceMaskUrl;
    await image.decode();
    offscreenCtx.drawImage(image, 0, 0, mapWidth, mapHeight);

    // --- Renderer API ---
    const renderer = {
        gl,
        program,
        locations,
        posBuffer,
        maskTexture,
        paletteTexture,
        paletteDims,
        statePaletteTexture,
        statePaletteDims,
        provinceCount,
        mapDims: { width: mapWidth, height: mapHeight },

        setProvinceColor(provinceIndex, r, g, b, a = 255) {
            const data = new Uint8Array([r, g, b, a]);
            const x = provinceIndex % paletteDims.width;
            const y = Math.floor(provinceIndex / paletteDims.width);

            gl.bindTexture(gl.TEXTURE_2D, paletteTexture);
            gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, data);
            gl.bindTexture(gl.TEXTURE_2D, null);
        },

        getProvinceAt(mapX, mapY) {
            let x = Math.floor(mapX);
            const y = Math.floor(mapHeight - mapY); //flip y because images use top-left origin, WebGL uses bottom-left
            if (x < 0) x = mapWidth + (x % mapWidth);
            else if (x >= mapWidth) x = x % mapWidth;

            if (y < 0 || y >= mapHeight) {
                return { id: 0 }; // Out of bounds
            }

            const pixelData = offscreenCtx.getImageData(x, y, 1, 1).data;
            const colorKey = (pixelData[0] << 16) | (pixelData[1] << 8) | pixelData[2];
            const provinceId = colorToProvinceIndex.get(colorKey) || 0;
            return provinceDefinitions.find(p => p.id === provinceId) || { id: 0 };
        },

        getPaletteData() {
            const framebuffer = gl.createFramebuffer();
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, paletteTexture, 0);

            if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
                console.error("Framebuffer not complete");
                return null;
            }

            const data = new Uint8Array(paletteDims.width * paletteDims.height * 4);
            gl.readPixels(0, 0, paletteDims.width, paletteDims.height, gl.RGBA, gl.UNSIGNED_BYTE, data);

            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.deleteFramebuffer(framebuffer);

            return { data, width: paletteDims.width, height: paletteDims.height };
        },

        render(camera, screenWidth, screenHeight) {
            gl.viewport(0, 0, screenWidth, screenHeight);
            gl.clearColor(0.0, 0.02, 0.16, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT);

            gl.useProgram(program);

            gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
            gl.enableVertexAttribArray(locations.attributes.pos);
            gl.vertexAttribPointer(locations.attributes.pos, 2, gl.FLOAT, false, 0, 0);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, maskTexture);
            gl.uniform1i(locations.uniforms.mask, 0);

            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, paletteTexture);
            gl.uniform1i(locations.uniforms.palette, 1);

            gl.activeTexture(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_2D, statePaletteTexture);
            gl.uniform1i(locations.uniforms.statePalette, 2);

            gl.uniform2f(locations.uniforms.cameraPos, camera.x, camera.y);
            const fov = 90;
            const fovRad = (fov * Math.PI) / 180;
            const zMax = mapHeight / 2.0 / Math.tan(fovRad / 2.0);
            const cameraScale = zMax / camera.z;
            gl.uniform1f(locations.uniforms.cameraScale, cameraScale);
            gl.uniform2f(locations.uniforms.mapDims, mapWidth, mapHeight);
            gl.uniform2f(locations.uniforms.screenDims, screenWidth, screenHeight);
            gl.uniform2f(locations.uniforms.paletteDims, paletteDims.width, paletteDims.height);
            gl.uniform2f(locations.uniforms.statePaletteDims, statePaletteDims.width, statePaletteDims.height);

            gl.uniform2f(locations.uniforms.maskDims, mapWidth, mapHeight);

            // --- New Border Uniforms ---
            gl.uniform1f(locations.uniforms.fadeMargin, 2.0);

            // Province Borders
            gl.uniform4f(locations.uniforms.provBorder.color, 0.1, 0.1, 0.1, 0.2);
            gl.uniform1f(locations.uniforms.provBorder.thickness, 1.0);
            gl.uniform1f(locations.uniforms.provBorder.appearZoom, 10.0);
            gl.uniform1f(locations.uniforms.provBorder.hideZoom, 1024.0);

            // State Borders
            gl.uniform4f(locations.uniforms.stateBorder.color, 0.5, 0.5, 0.5, 0.5);
            gl.uniform1f(locations.uniforms.stateBorder.thickness, 1.0);
            gl.uniform1f(locations.uniforms.stateBorder.appearZoom, 4.0);
            gl.uniform1f(locations.uniforms.stateBorder.hideZoom, 1024.0);

            // Country Borders
            gl.uniform4f(locations.uniforms.countryBorder.color, 0.0, 0.0, 0.0, 0.8);
            gl.uniform1f(locations.uniforms.countryBorder.thickness, 1.0);
            gl.uniform1f(locations.uniforms.countryBorder.appearZoom, 1.0);
            gl.uniform1f(locations.uniforms.countryBorder.hideZoom, 1024.0);

            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
    };

    return { renderer, originalPaletteData };
}

async function createGpuResources(gl, url, mapWidth, mapHeight, provinceDefinitions, statesUrl) {
    // Fetch states data in parallel with image loading
    const statesPromise = fetch(statesUrl).then(res => res.json());

    return new Promise((resolve, reject) => {
        const image = new Image();
        image.src = url;
        image.onload = async () => {
            const states = await statesPromise;

            const canvas = new OffscreenCanvas(mapWidth, mapHeight);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0, mapWidth, mapHeight);
            const imageData = ctx.getImageData(0, 0, mapWidth, mapHeight);
            const data = imageData.data;

            const colorToProvinceId = new Map();
            for (const province of provinceDefinitions) {
                const color = parseInt(province.color, 16);
                colorToProvinceId.set(color, province.id);
            }

            const provinceIdToColor = new Map();
            for (const province of provinceDefinitions) {
                provinceIdToColor.set(province.id, province.color);
            }

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const colorKey = (r << 16) | (g << 8) | b;

                const provinceId = colorToProvinceId.get(colorKey);
                if (provinceId) {
                    // Instead of color, we now write the province ID to the texture.
                    // This will be used to look up the color in the palette texture.
                    data[i] = provinceId & 0xff; // Store ID in red channel
                    data[i + 1] = (provinceId >> 8) & 0xff; // Store ID in green channel
                    data[i + 2] = 0; // Blue and alpha are not used for ID
                    data[i + 3] = 255;
                }
            }

            ctx.putImageData(imageData, 0, 0);

            const maskTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, maskTexture);

            // Wrap and filtering
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

            // Enable smooth interpolation and mipmaps
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
            gl.generateMipmap(gl.TEXTURE_2D);


            const colorToProvinceIndex = new Map();
            const indexToColor = new Map();
            let maxProvinceId = 0;
            for (const province of provinceDefinitions) {
                const color = parseInt(province.color, 16);
                colorToProvinceIndex.set(color, province.id);
                indexToColor.set(province.id, { r: (color >> 16) & 0xff, g: (color >> 8) & 0xff, b: color & 0xff });
                if (province.id > maxProvinceId) {
                    maxProvinceId = province.id;
                }
            }

            // --- Create Country Palette Texture ---
            const paletteSize = Math.ceil(Math.sqrt(maxProvinceId + 1));
            const paletteDims = { width: paletteSize, height: paletteSize };

            // Create Original Palette Data
            const originalPaletteDataArr = new Uint8Array(paletteSize * paletteSize * 4);
            for (let i = 0; i <= maxProvinceId; i++) {
                const color = indexToColor.get(i);
                if (color) {
                    originalPaletteDataArr[i * 4] = color.r;
                    originalPaletteDataArr[i * 4 + 1] = color.g;
                    originalPaletteDataArr[i * 4 + 2] = color.b;
                    originalPaletteDataArr[i * 4 + 3] = 255;
                }
            }

            // Create Initial Palette Data for the GPU texture
            const initialPaletteData = new Uint8Array(paletteSize * paletteSize * 4);
            const provinceDefsById = new Map(provinceDefinitions.map(p => [p.id, p]));
            for (let i = 0; i <= maxProvinceId; i++) {
                const province = provinceDefsById.get(i);
                if (province) {
                    if (province.type === 'sea' || province.type === 'lake') {
                        initialPaletteData[i * 4] = 0;
                        initialPaletteData[i * 4 + 1] = 0;
                        initialPaletteData[i * 4 + 2] = 0;
                        initialPaletteData[i * 4 + 3] = 0; // Transparent
                    } else { // land or lake
                        initialPaletteData[i * 4] = 0x33;
                        initialPaletteData[i * 4 + 1] = 0x33;
                        initialPaletteData[i * 4 + 2] = 0x33;
                        initialPaletteData[i * 4 + 3] = 255; // Opaque
                    }
                }
            }

            const paletteTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, paletteTexture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, paletteSize, paletteSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, initialPaletteData);

            // --- Create State Palette Texture ---
            const provinceToStateId = new Map();
            let maxStateId = 0;
            for (const state of states) {
                if (state.id > maxStateId) maxStateId = state.id;
                for (const provId of state.provinces) {
                    provinceToStateId.set(provId, state.id);
                }
            }

            const statePaletteSize = Math.ceil(Math.sqrt(maxProvinceId + 1));
            const statePaletteDims = { width: statePaletteSize, height: statePaletteSize };
            const statePaletteData = new Uint8Array(statePaletteSize * statePaletteSize * 4);
            for (let i = 0; i <= maxProvinceId; i++) {
                const stateId = provinceToStateId.get(i) || 0;
                statePaletteData[i * 4] = stateId & 0xff;
                statePaletteData[i * 4 + 1] = (stateId >> 8) & 0xff;
                statePaletteData[i * 4 + 2] = 0;
                statePaletteData[i * 4 + 3] = 255;
            }

            const statePaletteTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, statePaletteTexture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, statePaletteSize, statePaletteSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, statePaletteData);


            resolve({
                maskTexture,
                colorToProvinceIndex,
                provinceCount: maxProvinceId,
                paletteTexture,
                paletteDims,
                originalPaletteData: { data: originalPaletteDataArr, width: paletteSize, height: paletteSize },
                statePaletteTexture,
                statePaletteDims
            });
        };
        image.onerror = reject;
    });
}
