
var circle, apCircle, slider_tex, slider_follow, slider_outline;
var cursor, trail_tex, top_bar, health_bar;
var fail_background, restart, quit;
var miss, three, one, five;

var hitObjects = [];
var scores = [];

var tapped = false;
var health = 1.0;
var fail_time = -1;
var state = "playing";

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
    initLoader();
    circle = loadSprite("Skin/hitcircle.png");
    apCircle = loadSprite("Skin/approachcircle.png");
    slider_tex = loadSprite("slider.png");
    slider_follow = loadSprite("Skin/sliderb0.png");
    slider_outline = loadSprite("Skin/sliderfollowcircle.png");
    cursor = loadSprite("Skin/cursor.png");
    trail_tex = loadSprite("Skin/cursor-smoke.png");
    top_bar = loadSprite("Skin/scorebar-bg.png");
    health_bar = loadSprite("Skin/scorebar-colour.png");
    miss = loadSprite("Skin/score-x.png");
    three = loadSprite("Skin/hit300k.png");
    one = loadSprite("Skin/hit100k.png");
    five = loadSprite("Skin/hit50.png");
    fail_background = loadSprite("Skin/fail-background.png");
    restart = loadSprite("Skin/pause-retry.png");
    quit = loadSprite("Skin/pause-back.png");
    
    setInterval(update, 1000.0/fps);
}

function resetGame()
{
	health = 1.0;
	fail_time = -1.0;
	state = "playing";
	startTime = Date.now();
}

function update() 
{
	updateDisplay();
	if (background != null) 
		drawBackground(background, 0.3);
	
	if (state == "playing")
		drawOsuGameplay();
	else if (state == "fail")
		drawFailScreen();
	
	drawScores();
	drawCursor();
	handleHealth();
	tapped = false;
}

function handleHealth()
{
	health -= 0.001 + (hp_drain_rate / 1000.0);
	health = Math.min(health, 1.0);
	if (health <= 0.0 && fail_time == -1)
		fail_time = Date.now();
	
	if (Date.now() - fail_time >= 1000 && fail_time != -1)
		state = "fail";
}

function drawOsuGameplay()
{
	var currTime = Date.now() - startTime;
	var delay = arTable[approachRate];
	for (var i = 0; i < hitObjects.length; i++) 
	{
		var hit = hitObjects[i];
		if (currTime < hit.time + hit.slider_length + fade_time && currTime > hit.time - delay) 
	    {
	    	var alpha = calcAlpha(hit, currTime, delay);
	    	var rad_offset = (1.0 - alpha) * 0.03;
			if ((hit.type & 0x3) == 1) 
				drawCircle(circle, hit.x, hit.y, circle_rad + rad_offset, hit.colour, alpha);
			else if ((hit.type & 0x3) == 2) 
				drawSliderHit(hit, currTime, alpha);
			drawApCircle(hit, currTime, delay, alpha);
			handleScore(hit, currTime);
		}
	}

	drawUI();
}

function clamp(num, min, max) 
{
	return num <= min ? min : num >= max ? max : num;
}

var re_offset_size = 0;
var qu_offset_size = 0;
function drawFailScreen()
{
	var button_scale = 0.0025;
	drawBackground(fail_background, 1.0);
	
	var restart_w = restart.image.width*button_scale / asp;
	var restart_h = restart.image.height*button_scale;
	if (testAABBCollition(mouse_x, mouse_y, 0, 0, restart_w/2.0, restart_h/2.0))
		re_offset_size += 0.015;
	else
		re_offset_size -= 0.015;
	re_offset_size = clamp(re_offset_size, 0.0, 0.03);
	drawSprite(restart, 0, 0, restart_w+re_offset_size*asp, restart_h+re_offset_size, 1.0, 1.0);
	
	var quit_w = quit.image.width*button_scale / asp;
	var quit_h = quit.image.height*button_scale;
	if (testAABBCollition(mouse_x, mouse_y, 0, -0.3, quit_w/2.0, quit_h/2.0))
		qu_offset_size += 0.015;
	else
		qu_offset_size -= 0.015;
	qu_offset_size = clamp(qu_offset_size, 0.0, 0.03);
	drawSprite(quit, 0, -0.3, quit_w+qu_offset_size*asp, quit_h+qu_offset_size, 1.0, 1.0);
}

function handleScore(hit, currTime)
{
	if (hit.done == false)
	{
		var mouse_pos = [mouse_x, mouse_y];
		var screen_pos = osuScreenCoord([hit.x, hit.y]);
		var dis = vec2.distance(screen_pos, mouse_pos);
		if (tapped && dis <= circle_rad)
			handleTap(hit, currTime);
	
		if (currTime > hit.time + hit.slider_length)
		{
			var offset = 1000;
			if ((hit.type & 0x3) == 2)
				offset = hit.onHitOffset;
			tapHitObject(hit, offset);
		}
	}
}

function handleTap(hit, currTime)
{
	var offset = hit.time - currTime;
	if ((hit.type & 0x3) == 2)
	{
		hit.onHitOffset = offset;
		return;
	}
	tapHitObject(hit, offset);
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
	health += (1.0 - (offset / 1000.0)) * 0.03;
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
		var screen = osuScreenCoord([score.x, score.y]);
		var age = Date.now() - score.age;
		drawSprite(sprite, screen[0], screen[1], (score_scale*sprite.image.width) / asp, 
			score_scale*sprite.image.height, 1.0-(age / 500.0), 1.0);
		
		if (age >= 500)
			to_remove.push(i);
	}
	
	for (var i = 0; i < to_remove.length; i++)
		scores.splice(to_remove[i], 1);
}

function drawUI()
{
	var scale = 0.2;
	var bar_asp = top_bar.image.width / top_bar.image.height;
	var width = (scale * bar_asp) / asp;
	
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
	
	console.log(fail_time);
	if (fail_time != -1.0)
		alpha *= 1.0 - Math.min((Date.now() - fail_time) / 1000.0, 1.0);
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
        		drawCircle(slider_follow, point.p[0], point.p[1], 
        			circle_rad + 0.05, hit.colour, 1.0);
        		
				var screen_pos = osuScreenCoord([hit.x, hit.y]);
				var dis = vec2.distance(screen_pos, [mouse_x, mouse_y]);
        		var outline_rad = Math.min(dis, 0.2);
        		drawCircle(slider_outline, point.p[0], point.p[1], 
        			circle_rad + outline_rad, hit.colour, 1.0);
        		
        		if (dis > circle_rad*4.0)
        			hit.onHitOffset = 1000;
        	}
        	offset += rel_length;
        }
    }
}

