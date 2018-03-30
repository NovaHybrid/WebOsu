
var combos = [];
var timing_points = [];
var background = null;
var startTime = 0;
var hp_drain_rate = 5;
var approachRate = 7;
var slider_mul = 1.4;
var circle_rad = 0.15;
var fade_time = 100;
var currComboIndex = 0;

var file;
var buttons;
var button_box;
var drop_zone;

function initLoader()
{
	buttons = document.getElementById("buttons");
    button_box = document.getElementById("button_box");
    drop_zone = document.getElementById("drop_zone");
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
	resetGame();
}

function decodeDiffuculty(line) 
{
	var data = line.split(":");
	if (data[0] == "HPDrainRate")
	{
		hp_drain_rate = parseFloat(data[1]);
		console.log("HP Drain Rate: " + hp_drain_rate);
	}
	else if (data[0] == "ApproachRate") 
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
		last_positive_beat = tp.mpb;
	else
		tp.mpb = last_positive_beat * (-tp.mpb / 100.0);
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
        hitObject.onHitOffset = 1000;
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

