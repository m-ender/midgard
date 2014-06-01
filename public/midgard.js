var debug = true;

var canvas;
var messageBox;
var optionsBox;
var debugBox;

var gl;

// Objects holding data for individual shader programs
var midgardProgram = {};
var viewPort = {};

// Timing
// We need these to fix the framerate
var fps = 60;
var interval = 1000/fps;
var lastTime;

// Rotation of the entire map
var angle = 0;

var circles = [];
var polygons = [];
var lines = [];

var configuration = {
    nPolygons: 2048,
    seed: 0,
    pointSamplingMethod: PointSamplingMethod.Uniform,
    relaxationPasses: 2,
    terrainShape: TerrainShape.PerlinIsland,
    cellRenderMode: CellRenderMode.Elevation,
    renderVoronoiEdges: false,
    renderDelaunayEdges: false,
    renderPointMarkers: false,
    renderDownslopes: false,
    renderRivers: true,
};

var terrain;

window.onload = init;

function init()
{
    canvas = document.getElementById("gl-canvas");

    // This is the size we are rendering to
    viewPort.width = resolution;
    viewPort.height = resolution;
    // This is the actual extent of the canvas on the page
    canvas.style.width = viewPort.width;
    canvas.style.height = viewPort.height;
    // This is the resolution of the canvas (which will be scaled to the extent, using some rather primitive anti-aliasing techniques)
    canvas.width = viewPort.width;
    canvas.height = viewPort.height;

    // By attaching the event to document we can control the cursor from
    // anywhere on the page and can even drag off the browser window.
    document.addEventListener('mousedown', handleMouseDown, false);
    document.addEventListener('mouseup', handleMouseUp, false);
    document.addEventListener('mousemove', handleMouseMove, false);
    document.addEventListener('keypress', handleCharacterInput, false);

    messageBox = $('#message');
    optionsBox = $('#options');
    debugBox = $('#debug');

    if (!debug)
        renderInstructions();

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) {
        messageBox.html("WebGL is not available!");
    } else {
        messageBox.html("WebGL up and running!");
    }

    renderMenu();

    gl.clearColor(1, 1, 1, 1);

    // Load shaders and get uniform locations
    midgardProgram.program = InitShaders(gl, "basic-vertex-shader", "minimal-fragment-shader");
    // add uniform locations
    midgardProgram.uRenderScale = gl.getUniformLocation(midgardProgram.program, "uRenderScale");
    midgardProgram.uGridAngle = gl.getUniformLocation(midgardProgram.program, "uGridAngle");
    midgardProgram.uCenter = gl.getUniformLocation(midgardProgram.program, "uCenter");
    midgardProgram.uColor = gl.getUniformLocation(midgardProgram.program, "uColor");
    midgardProgram.uScale = gl.getUniformLocation(midgardProgram.program, "uScale");
    midgardProgram.uAngle = gl.getUniformLocation(midgardProgram.program, "uAngle");
    // add attribute locations
    midgardProgram.aPos = gl.getAttribLocation(midgardProgram.program, "aPos");

    // fill uniforms that are already known
    gl.useProgram(midgardProgram.program);
    gl.uniform1f(midgardProgram.uRenderScale, renderScale);
    gl.uniform1f(midgardProgram.uGridAngle, angle);

    gl.useProgram(null);

    prepareCircles();

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    CheckError();

    generateNewSeed();
    generateNewTerrain();

    drawScreen();
    //lastTime = Date.now();
    //update();
}

function renderInstructions()
{
    debugBox.html('How to play:<br><br>' +
                  'This is not a game...');
}

function renderMenu()
{
    optionsBox.html('Number of polygons ≈ ' +
                    '<input id="nPolygons" type="text" value="' + configuration.nPolygons + '" /><br>' +
                    'Relaxation passes: ' +
                    '<input id="relaxationPasses" type="text" value="' + configuration.relaxationPasses + '" /><br>' +
                    'Seed: <input id="seed" type="text" value="" /> ' +
                    '<a id="newSeed">random</a><br>' +
                    '<a id="newTerrain">Regenerate Terrain</a><br><br>' +

                    'Point sampling method:<br>' +
                    '<select id="pointSamplingMethod"></select><br><br>' +
                    'Terrain shape:<br>' +
                    '<select id="terrainShape"></select><br><br>' +

                    'Rendering options<br><br>' +
                    'Voronoi cells:<br>' +
                    '<span id="cellRenderMode"></span><br>' +
                    '<a><input type="checkbox" class="renderSwitch" id="renderVoronoiEdges"> ' +
                    '<label for="renderVoronoiEdges">Voronoi cell boundaries</label></a><br>' +
                    '<a><input type="checkbox" class="renderSwitch" id="renderDelaunayEdges"> ' +
                    '<label for="renderDelaunayEdges">Delaunay triangulation</label></a><br>' +
                    '<a><input type="checkbox" class="renderSwitch" id="renderPointMarkers"> ' +
                    '<label for="renderPointMarkers">Sampled points</label></a><br>' +
                    '<a><input type="checkbox" class="renderSwitch" id="renderDownslopes"> ' +
                    '<label for="renderDownslopes">Downslopes</label></a><br>' +
                    '<a><input type="checkbox" class="renderSwitch" id="renderRivers" checked> ' +
                    '<label for="renderRivers">Rivers</label></a>');

    for (var method in PointSamplingMethod)
    {
        if (PointSamplingMethod.hasOwnProperty(method))
            optionsBox.find('#pointSamplingMethod').append(
                '<option value="' + method + '">' +
                method.replace(/(?!^)(?=[A-Z])/g, ' ') +
                '</option>'
            );
    }

    for (var shape in TerrainShape)
    {
        if (TerrainShape.hasOwnProperty(shape))
            optionsBox.find('#terrainShape').append(
                '<option value="' + shape + '"' + (configuration.terrainShape === shape ? ' selected="selected"' : '') + '">' +
                shape.replace(/(?!^)(?=[A-Z])/g, ' ') +
                '</option>'
            );
    }

    for (var mode in CellRenderMode)
    {
        if (CellRenderMode.hasOwnProperty(mode))
            optionsBox.find('#cellRenderMode').append(
                '<a><input type="radio" class="renderSwitch" id="' + mode + '" name="cellRenderMode" value="' + mode + '"' +
                    (configuration.cellRenderMode === mode ? ' checked="checked"' : '') + '">' +
                '<label for="' + mode + '">' + mode.replace(/(?!^)(?=[A-Z])/g, ' ') + '</label></a><br>'
            );
    }



    optionsBox.find('#nPolygons').bind('change', function(e) {
        configuration.nPolygons = +e.target.value;
    });
    optionsBox.find('#relaxationPasses').bind('change', function(e) {
        configuration.relaxationPasses = +e.target.value;
    });
    optionsBox.find('#seed').bind('change', function(e) {
        configuration.seed = +e.target.value;
    });
    optionsBox.find('#newSeed').bind('click', generateNewSeed);
    optionsBox.find('#newTerrain').bind('click', generateNewTerrain);
    optionsBox.find('#pointSamplingMethod').bind('change', function(e){
        configuration.pointSamplingMethod = e.target.value;
        generateNewTerrain();
    });
    optionsBox.find('#terrainShape').bind('change', function(e){
        configuration.terrainShape = e.target.value;
        generateNewTerrain();
    });

    optionsBox.find('.renderSwitch').bind('change', setRenderSwitches);
}

function generateNewSeed()
{
    configuration.seed = floor(Math.random() * MAX_INT);
    optionsBox.find('#seed').val(configuration.seed);
}

function generateNewTerrain()
{
    if (terrain) terrain.destroy();

    var pointGenerator = new PointGenerator(configuration.pointSamplingMethod, configuration.seed);

    terrain = new Terrain(configuration, pointGenerator);

    drawScreen();
}

function setRenderSwitches()
{
    configuration.cellRenderMode = optionsBox.find('input:radio[name="cellRenderMode"]:checked')[0].value;
    configuration.renderVoronoiEdges = optionsBox.find('#renderVoronoiEdges')[0].checked;
    configuration.renderDelaunayEdges = optionsBox.find('#renderDelaunayEdges')[0].checked;
    configuration.renderPointMarkers = optionsBox.find('#renderPointMarkers')[0].checked;
    configuration.renderDownslopes = optionsBox.find('#renderDownslopes')[0].checked;
    configuration.renderRivers = optionsBox.find('#renderRivers')[0].checked;

    drawScreen();
}

function InitShaders(gl, vertexShaderId, fragmentShaderId)
{
    var vertexShader;
    var fragmentShader;

    var vertexElement = document.getElementById(vertexShaderId);
    if(!vertexElement)
    {
        messageBox.html("Unable to load vertex shader '" + vertexShaderId + "'");
        return -1;
    }
    else
    {
        vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, vertexElement.text);
        gl.compileShader(vertexShader);
        if(!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS))
        {
            messageBox.html("Vertex shader '" + vertexShaderId + "' failed to compile. The error log is:</br>" + gl.getShaderInfoLog(vertexShader));
            return -1;
        }
    }

    var fragmentElement = document.getElementById(fragmentShaderId);
    if(!fragmentElement)
    {
        messageBox.html("Unable to load fragment shader '" + fragmentShaderId + "'");
        return -1;
    }
    else
    {
        fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fragmentElement.text);
        gl.compileShader(fragmentShader);
        if(!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS))
        {
            messageBox.html("Fragment shader '" + fragmentShaderId + "' failed to compile. The error log is:</br>" + gl.getShaderInfoLog(fragmentShader));
            return -1;
        }
    }

    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if(!gl.getProgramParameter(program, gl.LINK_STATUS))
    {
        messageBox.html("Shader program failed to link. The error log is:</br>" + gl.getProgramInfoLog(program));
        return -1;
    }

    return program;
}

// This is a fixed-framerate game loop. dT is not constant, though
function update()
{
    // window.requestAnimFrame(update, canvas);

    currentTime = Date.now();
    var dTime = currentTime - lastTime;

    if (dTime > interval)
    {
        // The modulo is to take care of the case that we skipped a frame
        lastTime = currentTime - (dTime % interval);

        var steps = floor(dTime / interval);

        dTime = steps * interval / 1000; // Now dTime is in seconds

        /* Update state using dTime */

        drawScreen();
    }
}

function drawScreen()
{
    var i;

    gl.enable(gl.BLEND);

    gl.viewport(0, 0, viewPort.width, viewPort.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(midgardProgram.program);
    gl.uniform1f(midgardProgram.uGridAngle, 0);

    terrain.render();

    for (i = 0; i < polygons.length; ++i)
    {
        polygons[i].render();
        polygons[i].render(true);
    }

    for (i = 0; i < lines.length; ++i)
        lines[i].render();

    for (i = 0; i < circles.length; ++i)
        circles[i].render();

    gl.useProgram(null);

    gl.disable(gl.BLEND);
}

function handleMouseMove(event) {
    var rect = canvas.getBoundingClientRect();
    var coords = normaliseCursorCoordinates(event, rect);

    if (debug)
    {
        debugBox.find('#xcoord').html(coords.x);
        debugBox.find('#ycoord').html(coords.y);
    }
}

function handleMouseDown(event) {
    var rect = canvas.getBoundingClientRect();
    var coords = normaliseCursorCoordinates(event, rect);

    if (coords.x < -maxCoord || coords.x > maxCoord || coords.y < -maxCoord || coords.y > maxCoord)
        return;

    if (debug)
    {
        debugBox.find('#xdown').html(coords.x);
        debugBox.find('#ydown').html(coords.y);
    }

    mouseDown = true;
}

function handleMouseUp(event) {
    var rect = canvas.getBoundingClientRect();
    var coords = normaliseCursorCoordinates(event, rect);

    if (debug)
    {
        debugBox.find('#xup').html(coords.x);
        debugBox.find('#yup').html(coords.y);
    }

    mouseDown = false;
}

function handleCharacterInput(event) {
    var character = String.fromCharCode(event.charCode);

    switch (character)
    {
    /* do stuff */
    }
}

// Takes the mouse event and the rectangle to normalise for
// Outputs object with x, y coordinates in [-maxCoord,maxCoord] with positive
// y pointing upwards.
// It also accounts for the rotation of the grid.
function normaliseCursorCoordinates(event, rect)
{
    var x = (2*(event.clientX - rect.left) / resolution - 1) / renderScale;
    var y = (1 - 2*(event.clientY - rect.top) / resolution) / renderScale; // invert, to make positive y point upwards
    return {
        x:  x*cos(angle) + y*sin(angle),
        y: -x*sin(angle) + y*cos(angle)
    };
}

function CheckError(msg)
{
    var error = gl.getError();
    if (error !== 0)
    {
        var errMsg = "OpenGL error: " + error.toString(16);
        if (msg) { errMsg = msg + "</br>" + errMsg; }
        messageBox.html(errMsg);
    }
}

