
var circle, apCircle, slider_tex, slider_follow;
var cursor, trail_tex, top_bar, health_bar;
var miss, three, one, five;
var combos = [];
var hitObjects = [];
var timing_points = [];
var scores = [];
var background = null;
var startTime = 0;
var approachRate = 7;
var slider_mul = 1.4;
var circle_rad = 0.15;
var fade_time = 100;
var currComboIndex = 0;
var file;
var buttons;
var button_box;
var drop_zone;
var tapped = false;

var arTable = [
	1800, 1680, 1560, 1440, 1320, 
	1200, 1050, 900, 750, 600, 450
]

var mouse_x = 0, mouse_y = 0;
var trails = [];
var max_trails = 10;

function getMouseCoords(event)
{
	var x = event.clientX / display.width;
    var y = event.clientY / display.height;
    mouse_x = x * 2.0 - 1.0;
    mouse_y = -(y * 2.0 - 1.0);
    
    trails.push([mouse_x, mouse_y]);
    if (trails.length > max_trails)
    	trails.shift();
}

document.onkeydown = function(event)
{
	var key = String.fromCharCode(event.which);
	if (key == 'Z' || key == 'X')
		tapped = true;
	console.log(key);
}

function initOsu() 
{
	initGameEngine();
    circle = loadSprite("Skin/hitcircle.png");
    apCircle = loadSprite("Skin/approachcircle.png");
    slider_tex = loadSprite("slider.png");
    slider_follow = loadSprite("Skin/sliderfollowcircle.png");
    cursor = loadSprite("Skin/cursor.png");
    trail_tex = loadSprite("Skin/cursor-smoke.png");
    top_bar = loadSprite("Skin/scorebar-bg.png");
    health_bar = loadSprite("Skin/scorebar-colour.png");
    miss = loadSprite("Skin/score-x.png");
    three = loadSprite("Skin/hit300k.png");
    one = loadSprite("Skin/hit100k.png");
    five = loadSprite("Skin/hit50.png");
    buttons = document.getElementById("buttons");
    button_box = document.getElementById("button_box");
    drop_zone = document.getElementById("drop_zone");
    
    setInterval(update, 1000.0/fps);
}

function fileDropped(event)
{
	console.log("file dropped");
	event.preventDefault();
	file = event.dataTransfer.items[0].getAsFile();
	hitObjects = [];

	JSZip.loadAsync(file).then(function(zip) 
	{
		while (button_box.firstChild) {
			button_box.removeChild(button_box.firstChild);
		}
		zip.forEach(function (relativePath, zipEntry) 
		{
			console.log("Found file: " + zipEntry.name);
			if (zipEntry.name.endsWith('.osu'))
			{
				var btn = document.createElement("button");
				btn.innerHTML = zipEntry.name;
				btn.onclick = function()
				{
					loadMap(zipEntry.name);
				}
				button_box.appendChild(btn);
			}
		});
		buttons.style = "margin-top:0px;";
	}, function (e) {});
}

function dragOverHandler(event) 
{
	event.preventDefault();
}

function loadMap(map)
{
	combos = [];
	hitObjects = [];
	timing_points = [];
	closeBox();

	JSZip.loadAsync(file).then(function(zip) 
	{
		return zip.file(map).async("text");
	}).then(function(txt) 
	{
		var lines = txt.split('\n');
		decodeMap(lines);
	});
}

function closeBox()
{
	buttons.style = "margin-top:50%;";
}

function decodeMap(lines) 
{
    currComboIndex = 0;
	var mode = "";
	for(var i = 0; i < lines.length; i++) 
    {
		var line = lines[i];
        if (line.trim() == "") 
        {
            continue;
        }
        
		if (line.startsWith('[')) 
        {
			mode = line.substring(1, line.length-2);
			console.log("Mode: " + mode);
		}
		else 
        {
			switch(mode)
			{
				case "Difficulty": decodeDiffuculty(line); break;
				case "Events": decodeEvents(line); break;
				case "TimingPoints": decodeTimings(line); break;
                case "Colours": decodeColours(line); break;
				case "HitObjects": decodeHit(line); break;
			}
		}
	}
	
	closeBox();
	display.style = "display:block;opacity:1";
	drop_zone.style = "display:none";
	startTime = Date.now();
}

function decodeDiffuculty(line) 
{
	var data = line.split(":");
	if (data[0] == "ApproachRate") 
    {
		approachRate = parseInt(data[1]);
		console.log("Approach Rate: " + approachRate);
	}
	else if (data[0] == "SliderMultiplier")
	{
		slider_mul = parseFloat(data[1]);
		console.log("Slider Multiplier: " + slider_mul);
	}
}

function decodeEvents(line)
{
	var data = line.split(",");
	if (data.length == 5) 
    {
		var fileName = data[2].substring(1, data[2].length - 1);
		loadImageFromZip(fileName);
		background = loadSprite("Song/" + fileName);
		console.log("Background: " + fileName);
	}
}

function loadImageFromZip(image_path)
{
	var path_len = image_path.length;
	var type = image_path.substring(path_len - 3, path_len);
	JSZip.loadAsync(file).then(function(zip) 
	{
		return zip.file(image_path).async("base64");
	}).then(function(txt) 
	{
		var img_url = "data:image/" + type + ";base64," + txt;
		background = loadSprite(img_url);
	});
}

var last_positive_beat = 0;

function decodeTimings(line)
{
	var data = line.split(",");
	var tp = new Object();
	
	tp.offset = timing_points.length == 0 ? 0 : parseInt(data[0]);
	tp.mpb = parseFloat(data[1]);
	tp.meter = parseFloat(data[2]);
	timing_points.push(tp);
	console.log("Timing point at " + tp.offset);
	
	if (tp.mpb >= 0)
	{
		last_positive_beat = tp.mpb;
	}
	else
	{
		tp.mpb = last_positive_beat * (-tp.mpb / 100.0);
	}
}

function decodeColours(line) 
{
    var data = line.split(":");
    var colourData = data[1].split(",");
    
    var colour = [];
    for (var i = 0; i < colourData.length; i++) 
    {
        colour.push(parseInt(colourData[i]) / 255.0);
    }
    
    var name = data[0];
    var id = parseInt(name.substring(5, name.length));
    combos.push(colour);
    console.log(name + ": " + colour);
}

function findTimingPoint(time)
{
	var max_point = {offset:0};
	for (var i = 0; i < timing_points.length; i++)
	{
		var tp = timing_points[i];
		if (tp.offset < time && max_point.offset < tp.offset)
			max_point = tp;
	}
	return max_point;
}

function decodeHit(line) 
{
	var hitObject = new Object();
	
	var data = line.split(",");
	hitObject.x = parseFloat(data[0]) / 512.0;
	hitObject.y = 1.0 - (parseFloat(data[1]) / 384.0);
	hitObject.time = parseInt(data[2]);
	hitObject.type = parseInt(data[3]);
	hitObject.tp = findTimingPoint(hitObject.time);
	hitObject.slider_length = 0;
	
	if ((hitObject.type & 0x3) == 2) 
    {
		var sliderInfo = data[5];
		var points = sliderInfo.split("|");
		
		hitObject.points = [];
		for (var i = 1; i < points.length; i++) 
        {
			var point = points[i].split(":");
			var x = parseFloat(point[0]) / 512.0;
			var y = 1.0 - (parseFloat(point[1]) / 384.0);
			hitObject.points.push([x, y]);
		}
		
		hitObject.sliderType = points[0];
        hitObject.sliders = genSliderMesh(hitObject);
        hitObject.pixel_length = parseFloat(data[7]);
        hitObject.slider_length = hitObject.pixel_length / 
        	(100.0 * slider_mul) * hitObject.tp.mpb;
	}
	
    if ((hitObject.type & 0x4) == 0x4) 
    {
    	var skip = (hitObject.type >> 3) & 0x3;
    	currComboIndex += 1 + skip;
    	currComboIndex = currComboIndex % combos.length;
    }
	hitObject.colour = combos[currComboIndex];
	hitObject.done = false;
    
	hitObjects.push(hitObject);
}

function update() 
{
	updateDisplay();
	if (background != null) 
		drawBackground(background);
	
	var currTime = Date.now() - startTime;
	var delay = arTable[approachRate];
	for (var i = 0; i < hitObjects.length; i++) 
    {
		var hit = hitObjects[i];
		if (currTime < hit.time + hit.slider_length + fade_time && currTime > hit.time - delay) 
        {
        	var alpha = calcAlpha(hit, currTime, delay);
			if ((hit.type & 0x3) == 1) 
				drawCircle(circle, hit.x, hit.y, circle_rad, hit.colour, alpha);
			else if ((hit.type & 0x3) == 2) 
				drawSliderHit(hit, currTime, alpha);
			drawApCircle(hit, currTime, delay, alpha);
			handleScore(hit, currTime);
		}
	}
	
	drawScores();
	drawUI();
	drawCursor();
	tapped = false;
}

function handleScore(hit, currTime)
{
	if (hit.done == false)
	{
		var mouse_pos = [mouse_x, mouse_y];
		var screen_pos = [(hit.x*2.0-1.0) / asp * osuAsp * scale, (hit.y*2.0-1.0) * scale];
		var dis = vec2.distance(screen_pos, mouse_pos);
		if (tapped && dis <= circle_rad)
			handleTap(hit, currTime);
	
		if (currTime > hit.time + hit.slider_length)
			tapHitObject(hit, 1000);
	}
}

function handleTap(hit, currTime)
{
	if ((hit.type & 0x3) == 2)
	{
		
		return;
	}
	tapHitObject(hit, hit.time - currTime);
}

function tapHitObject(hit, offset)
{
	hit.done = true;
	var x = hit.x;
	var y = hit.y;
	if ((hit.type & 0x3) == 2)
	{
		var point = hit.points[hit.points.length-1];
		x = point[0];
		y = point[1];
	}
	
	var sprite = miss;
	if (offset < 100)
		sprite = three;
	else if (offset < 200)
		sprite = one;
	else if (offset < 300)
		sprite = five;
	scores.push({sprite: sprite, x: x, y: y, age: Date.now()});
}

function drawScores()
{
	var score_scale = 0.002;
	var to_remove = [];
	for (var i = 0; i < scores.length; i++)
	{
		var score = scores[i];
		var sprite = score.sprite;
		var x = ((score.x * 2.0 - 1.0) / asp * osuAsp) * scale;
		var y = (score.y * 2.0 - 1.0) * scale;
		var age = Date.now() - score.age;
		drawSprite(sprite, x, y, (score_scale*sprite.width) / asp, 
			score_scale*sprite.height, 1.0-(age / 500.0), 1.0);
		
		if (age >= 500)
			to_remove.push(i);
	}
	
	for (var i = 0; i < to_remove.length; i++)
		scores.splice(to_remove[i], 1);
}

var health = 1.0;
var time = 0;
function drawUI()
{
	var scale = 0.2;
	var bar_asp = top_bar.width / top_bar.height;
	var width = (scale * bar_asp) / asp;
	
	health = Math.sin(time);
	time += 0.01;
	drawSprite(top_bar, -1 + width/2, 1 - scale/2, width, scale, 1.0, 1.0);
	drawSprite(health_bar, -1 + width/2 + 0.01/asp, 1 - scale/2 - 0.04, 
		width, scale, 1.0, health);
}

function drawCursor()
{
	// Draw trails
    var cursor_size = 0.15;
	for (var i = 0; i < trails.length; i++)
	{
		var pos = trails[i];
		drawSprite(trail_tex, pos[0], pos[1], 
			cursor_size / asp, cursor_size, i / trails.length, 1.0);
	}
	
	// Draw cursor
    var x = mouse_x;
    var y = mouse_y;
    drawSprite(cursor, x, y, (cursor_size*2) / asp, cursor_size*2, 1.0, 1.0);
    
    trails.push([mouse_x, mouse_y]);
    if (trails.length > max_trails)
    	trails.shift();
}

function calcAlpha(hit, currTime, delay)
{
	var alpha = 1.0;
	if (currTime > hit.time + hit.slider_length)
	{
		var factor = (currTime - (hit.time + hit.slider_length)) / fade_time;
		alpha = 1.0 - factor;
	}
	if (currTime < hit.time - delay + fade_time)
	{
		var factor = ((hit.time - delay + fade_time) - currTime) / fade_time;
		alpha = 1.0 - factor;
	}
	return alpha;
}

function drawApCircle(hit, currTime, delay, alpha)
{
	var x = hit.x;
	var y = hit.y;
	if (currTime < hit.time)
	{
		var offset = 1.0 - ((currTime - (hit.time - delay)) / delay);
		drawCircle(apCircle, x, y, circle_rad + (offset * 0.2), hit.colour, alpha);
	}
}

function drawSliderHit(hit, currTime, alpha)
{
	var total_length = 0.0;
	for (var i = 0; i < hit.sliders.length; i++)
	{
		var slider = hit.sliders[i].slider;
		total_length += slider.length;
	}

	var offset = 0.0;
	for (var i = 0; i < hit.sliders.length; i++)
    {
    	var slider_info = hit.sliders[i];
    	var slider = slider_info.slider;
		drawSlider(slider_tex, slider.model, hit.colour, alpha);
		
		// Draw follow circle
        if (currTime > hit.time)
        {
        	var rel_length = slider.length / total_length;
        	var factor = (currTime - hit.time) / hit.slider_length;
        	if (factor > offset && factor < offset + rel_length)
        	{
        		factor = (factor - offset) / rel_length;
        		var point = getCurvePoint(factor, slider_info.points);
        		drawCircle(slider_follow, point.p[0], point.p[1], circle_rad, hit.colour, 1.0);
        	}
        	offset += rel_length;
        }
    }
}

function genSliderMesh(hit) 
{
	var start = [hit.x, hit.y];
	var end = hit.points[hit.points.length-1];
	var slider_rad = circle_rad + 0.05;
    
	if(hit.sliderType == "P" || hit.sliderType == "L")
    {
    	var points = [start].concat(hit.points);
		return [{slider: genCurveMesh(points, slider_rad), points: points}];
	}
	else if(hit.sliderType == "B")
    {
        var sliders = [];
		var currPoints = [start];
		for (var i = 0; i < hit.points.length; i++) 
        {
			var point = hit.points[i];
			if (currPoints.length > 0)
            {
				var lastPoint = currPoints[currPoints.length-1];
				if (point[0] == lastPoint[0] && point[1] == lastPoint[1])
                {
					sliders.push({slider: genCurveMesh(currPoints, slider_rad), 
						points: currPoints});
					currPoints = [];
				}
			}
			currPoints.push(point);
		}
		sliders.push({slider: genCurveMesh(currPoints, slider_rad), 
			points: currPoints});
        return sliders;
	}
}

// 165,124, 101,145, 59,79, 59,79, 134,8, 197,55, 190,96, 273,92, 273,92, 223,139, 244,181, 275,211, 271,258, 271,258, 274,196, 331,171, 331,171, 329,186, 317,189

// ABC CDEFG G

