
// Define constants
const fps = 30;
var scale = 0.7;
var osuAsp = 512.0 / 384.0;
var asp;

// Define quad data
var quad_vertices = [
    -0.5,0.5,0.0,
    -0.5,-0.5,0.0,
    0.5,-0.5,0.0, 
    0.5,0.5,0.0
];
var quad_textures = [
    0, 0,
    0, 1,
    1, 1,
    1, 0
];
var quad_indices = [
    0,1,2, 
    2,3,0
];

var gl, display;
var quad, shader;
var texture_load = 0;

function initGameEngine() 
{
	display = document.getElementById("display");
	gl = display.getContext("webgl2");
    gl.enable(gl.BLEND);
	gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, 
		gl.ONE, gl.ONE_MINUS_SRC_ALPHA);   
    
    quad = loadModel(quad_vertices, quad_textures, quad_indices);
	var vertCode = document.getElementById("vert").text;
	var fragCode = document.getElementById("frag").text;
    shader = loadShader(vertCode, fragCode);
}

function loadModel(vertices, textures, indices) 
{
	var vao = gl.createVertexArray();
	gl.bindVertexArray(vao);
	
	var vertex_buffer = loadBuffer(vertices, 0, 3);
    var texture_buffer = loadBuffer(textures, 1, 2);
	var index_buffer = loadIndex(indices);
	gl.bindVertexArray(null);
	return {vao: vao, length: indices.length};
}

function loadBuffer(data, index, unit_size) 
{
	var buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    gl.vertexAttribPointer(index, unit_size, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(index);
	return buffer;
}

function loadIndex(data) 
{
	var index = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data), gl.STATIC_DRAW);
    return index;
}

function genLineMesh(p1, p2, rad) 
{
    var diff = vec2.create(), 
        dir = vec2.create(),
        offset = vec2.create(),
        ends = vec2.create();
    vec2.sub(diff, p2, p1);
	vec2.normalize(dir, diff);
    var invDir = [dir[1], dir[0]];
    
    vec2.multiply(offset, invDir, [rad/1.5, rad/1.5]);
    vec2.multiply(ends, dir, [rad/1.5, rad/1.5]);
    var positions = [
        // Start
        p1[0]-offset[0]+ends[0], p1[1]+offset[1]+ends[1], 0.0,
        p1[0]+offset[0]+ends[0], p1[1]-offset[1]+ends[1], 0.0,
        p1[0]+offset[0], p1[1]-offset[1], 0.0,
        p1[0]-offset[0], p1[1]+offset[1], 0.0,
        
        // End
        p2[0]-offset[0]-ends[0], p2[1]+offset[1]-ends[1], 0.0,
        p2[0]+offset[0]-ends[0], p2[1]-offset[1]-ends[1], 0.0,
        p2[0]+offset[0], p2[1]-offset[1], 0.0,
        p2[0]-offset[0], p2[1]+offset[1], 0.0,

    	// Body
        p1[0]-offset[0]+ends[0], p1[1]+offset[1]+ends[1], 0.0,
        p1[0]+offset[0]+ends[0], p1[1]-offset[1]+ends[1], 0.0,
        p2[0]+offset[0]-ends[0], p2[1]-offset[1]-ends[1], 0.0,
        p2[0]-offset[0]-ends[0], p2[1]+offset[1]-ends[1], 0.0,
    ];
    var textures = [
        // Start
		0.5, 0.0,
		0.5, 1.0,
		0.0, 1.0,
		0.0, 0.0,
		
        // End
		0.5, 0.0,
		0.5, 1.0,
		0.0, 1.0,
		0.0, 0.0,
        
        // Body
		0.5, 0.0,
		0.5, 1.0,
		0.7, 1.0,
		0.7, 0.0,
    ];
    var index = [
    	0,1,2, 
    	2,3,0,
    	
    	6,7,4,
    	4,5,6,

    	8,9,10, 
    	10,11,8
    ];
    return loadModel(positions, textures, index);
}

function getCurvePoint(time, points) 
{
    var new_points = [];
    for (var i = 0; i < points.length-1; i++)
    {
        var p0 = points[i];
        var p1 = points[i+1];
        var p3 = [];
        
        var diff = [], factor = [];
        vec2.sub(diff, p1, p0);
        vec2.multiply(factor, diff, [time,time]);
        vec2.add(p3, p0, factor);
        new_points.push(p3);
    }
    
    if (new_points.length == 1)
    {
        var grad = [];
        vec2.sub(grad, points[1], points[0]);
        vec2.normalize(grad, grad);
        return {p: new_points[0], g: grad};
    }
    return getCurvePoint(time, new_points);
}

function calcCurveLength(points)
{
	var res = 20.0;
	var step = 1.0 / res;
	var pre_point = points[0];
	var length = 0;
	for (var time = step; time < 1.0; time += step)
    {
		var point = getCurvePoint(time, points);
		length += vec2.distance(point.p, pre_point);
    	pre_point = point.p;
    }
    return length;
}

function calcCurveMeshSegment(time, points, rad)
{
    var point = getCurvePoint(time, points);
    var normal = [-point.g[1], point.g[0]];
    vec2.multiply(normal, normal, [((rad/2.0) / asp) * osuAsp, rad/2.0]);
    
    var p0 = [], p1 = [];
    vec2.add(p0, point.p, normal);
    vec2.sub(p1, point.p, normal);
    return [p0[0], p0[1], 0.0, 
            p1[0], p1[1], 0.0];
}

function genCurveMesh(points, rad)
{
    var positions = [];
    var textures = [];
    var indices = [];
    
    var res = 20.0;
    var step = 1.0 / res;
    var i = 0;
    for (var time = 0.0; time < 1.0; time += step*2.0)
    {
        positions = positions.concat(calcCurveMeshSegment(time, points, rad));
        positions = positions.concat(calcCurveMeshSegment(time + step, points, rad));
        textures = textures.concat([0.5,0.0, 0.5,1.0, 0.7,0.0, 0.7,1.0]);
        indices = indices.concat([i+0,i+1,i+2, i+2,i+3,i+1]);
        i += 2;
        if (time <= 1.0 - step*2.0)
        {
            textures = textures.concat([0.5,0.0, 0.5,1.0, 0.7,0.0, 0.7,1.0]);
            indices = indices.concat([i+0,i+1,i+2, i+2,i+3,i+1]);
            i += 2;
        }
    }
    
    return {model: loadModel(positions, textures, indices), 
    	length: calcCurveLength(points)};
}

function loadShader(vertSrc, fragSrc) 
{
    var shaderProgram = gl.createProgram();
    var vertShader = compileShader(vertSrc, gl.VERTEX_SHADER);
    var fragShader = compileShader(fragSrc, gl.FRAGMENT_SHADER);
    
    gl.attachShader(shaderProgram, vertShader);
	gl.attachShader(shaderProgram, fragShader);
	gl.linkProgram(shaderProgram);
    gl.useProgram(shaderProgram);
    
    gl.bindAttribLocation(shaderProgram, 0, "position");
    gl.bindAttribLocation(shaderProgram, 1, "textureCoord");
    
    var defuse = gl.getUniformLocation(shaderProgram, "defuse");
    var transform = gl.getUniformLocation(shaderProgram, "transform");
    var colour = gl.getUniformLocation(shaderProgram, "colour");
    var alpha = gl.getUniformLocation(shaderProgram, "alpha");
    var crop = gl.getUniformLocation(shaderProgram, "crop");
    gl.uniform1i(defuse, 0);
    return {program: shaderProgram, transform: transform, 
    	colour: colour, alpha: alpha, crop: crop};
}

function compileShader(src, type) 
{
    var shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert('Shader compile error: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function loadSprite(file_path) 
{
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    texture_load++;
    
    var image = new Image();
    image.onload = function() 
    {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
            gl.RGBA, gl.UNSIGNED_BYTE, image);
        
        if (isPowerOf2(image.width) && isPowerOf2(image.height)) 
        {
            gl.generateMipmap(gl.TEXTURE_2D);
        }
        else 
        {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        texture_load--;
    }
    image.src = file_path;
	return {texture: texture, image: image};
}

function isPowerOf2(value) 
{
    return (value & (value - 1)) == 0;
}

function updateDisplay() 
{
	display.width  = window.innerWidth;
	display.height = window.innerHeight;
	asp = parseFloat(display.width) / parseFloat(display.height);
	gl.viewport(0, 0, display.width, display.height);
	gl.clearColor(0, 0, 0, 1.0);
	gl.clear(gl.COLOR_BUFFER_BIT);
}

function drawModel(model, sprite) 
{
    // Bind texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sprite.texture);

    // Bind model and render
    gl.bindVertexArray(model.vao);
    gl.drawElements(gl.TRIANGLES, model.length, gl.UNSIGNED_SHORT, 0);
}

function osuScreenCoord(p)
{
	var x = (p[0] * 2.0 - 1.0) / asp * osuAsp * scale;
	var y = (p[1] * 2.0 - 1.0) * scale;
	return [x, y];
}

function drawCircle(sprite, x, y, rad, colour, alpha) 
{
	gl.useProgram(shader.program);
    var screen = osuScreenCoord([x, y]);
    var position = [screen[0], screen[1], 0];
    var size = [rad*2.0/asp, rad*2.0, 1.0];
    
    var transform = mat4.create();
    mat4.translate(transform, transform, position);
    mat4.scale(transform, transform, size);
    gl.uniformMatrix4fv(shader.transform, false, transform);
    gl.uniform3f(shader.colour, colour[0], colour[1], colour[2]);
    gl.uniform1f(shader.alpha, alpha);
    gl.uniform1f(shader.crop, 1.0);
    drawModel(quad, sprite);
}

function drawSlider(sprite, slider, colour, alpha)
{
    gl.useProgram(shader.program);
    
    var transform = mat4.create();
    mat4.scale(transform, transform, [scale / asp * osuAsp * 2.0, scale * 2.0, 1.0]);
    mat4.translate(transform, transform, [-0.5, -0.5, 0]);
    gl.uniformMatrix4fv(shader.transform, false, transform);
    gl.uniform3f(shader.colour, colour[0], colour[1], colour[2]);
    gl.uniform1f(shader.alpha, alpha);
    gl.uniform1f(shader.crop, 1.0);
    drawModel(slider, sprite);
}

function drawSprite(sprite, x, y, width, height, alpha, crop)
{
	gl.useProgram(shader.program);
	
	var transform = mat4.create();
	mat4.translate(transform, transform, [x, y, 0.0]);
    mat4.scale(transform, transform, [width, height, 1.0]);
    gl.uniformMatrix4fv(shader.transform, false, transform);
    gl.uniform3f(shader.colour, 1, 1, 1);
    gl.uniform1f(shader.alpha, alpha);
    gl.uniform1f(shader.crop, crop);
    drawModel(quad, sprite);
}

function drawBackground(sprite) 
{
	gl.useProgram(shader.program);
    var fade = 0.3;

    var image_asp = sprite.image.width / sprite.image.height;
    var transform = mat4.create();
    mat4.scale(transform, transform, [(2.0 / asp) * image_asp, 2.0, 1.0]);
    gl.uniformMatrix4fv(shader.transform, false, transform);
    gl.uniform3f(shader.colour, fade, fade, fade);
    gl.uniform1f(shader.alpha, 1.0);
    gl.uniform1f(shader.crop, 1.0);

    drawModel(quad, sprite);
}

