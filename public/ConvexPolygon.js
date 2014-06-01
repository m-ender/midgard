// The first parameter is a list of points defining the polygon's vertices.
// Supply each point as an object with properties 'x' and 'y'.
// The color is optional (default black).
function ConvexPolygon(points, color)
{
    this.hidden = false;

    this.points = points;

    this.color = color || 'black';

    if (!(this.color instanceof jQuery.Color))
        this.color = jQuery.Color(this.color);

    // Set up vertices
    var vertexCoords = [];
    for (var i = 0; i < points.length; ++i)
    {
        vertexCoords.push(points[i].x);
        vertexCoords.push(points[i].y);
    }

    this.vertices = {};
    this.vertices.data = new Float32Array(vertexCoords);

    this.vertices.bufferId = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices.bufferId);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices.data, gl.STATIC_DRAW);
}

// Convenience constructor for arrows (i.e. this returns a new
// ConvexPolygon, with vertices set up as necessary).
// Length is the distance from start to tip of the arrow.
// Width is measured at the widest part of the arrow.
// Origin is where the arrow starts (not where it points to).
// Direction is an arbitrary 2D vector (does not need to be
// normalised).
// For now, this just creates isosceles triangles with the origin
// being the centre of the base and the tip being the vertex.
ConvexPolygon.CreateArrow = function(length, width, origin, direction, color)
{
    // Get normalised direction
    var d = sqrt(direction.x*direction.x + direction.y*direction.y);
    var dx = direction.x / d;
    var dy = direction.y / d;

    // Get normal perpendicular to direction
    var nx = -dy;
    var ny = dx;

    // Set up vertices
    var vertices = [
        {
            x: origin.x + nx * width/2,
            y: origin.y + ny * width/2
        },
        {
            x: origin.x + -nx * width/2,
            y: origin.y + -ny * width/2
        },
        {
            x: origin.x + dx * length,
            y: origin.y + dy * length
        },
    ];

    return new ConvexPolygon(vertices, color);
};

ConvexPolygon.prototype.hide = function() { this.hidden = true; };
ConvexPolygon.prototype.show = function() { this.hidden = false; };

// Outline can optionally be set to true to render ... well ...
// only an outline.
// An optional color can overwrite the default (the color provided
// in the constructor for solid rendering and black for outlines).
ConvexPolygon.prototype.render = function(outline, color) {
    if (this.hidden) return;

    gl.useProgram(midgardProgram.program);

    gl.uniform2f(midgardProgram.uCenter, 0, 0);
    gl.uniform1f(midgardProgram.uScale, 1);
    gl.uniform1f(midgardProgram.uAngle, 0);

    gl.enableVertexAttribArray(midgardProgram.aPos);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices.bufferId);
    gl.vertexAttribPointer(midgardProgram.aPos, 2, gl.FLOAT, false, 0, 0);

    if (outline)
        color = color || 'black';
    else
        color = color || this.color;

    if (!(color instanceof jQuery.Color))
        color = jQuery.Color(color);

    gl.uniform4f(midgardProgram.uColor,
                 color.red()/255,
                 color.green()/255,
                 color.blue()/255,
                 1);

    if (outline)
        gl.drawArrays(gl.LINE_LOOP, 0, this.points.length);
    else
        gl.drawArrays(gl.TRIANGLE_FAN, 0, this.points.length);

    gl.disableVertexAttribArray(midgardProgram.aPos);
};

// "Destructor" - this has to be called manually
ConvexPolygon.prototype.destroy = function() {
    gl.deleteBuffer(this.vertices.bufferId);
    delete this.vertices;
};