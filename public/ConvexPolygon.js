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

ConvexPolygon.prototype.hide = function() { this.hidden = true; };
ConvexPolygon.prototype.show = function() { this.hidden = false; };

// Outline can optionally be set to true to render ... well ...
// only an outline.
ConvexPolygon.prototype.render = function(outline) {
    if (this.hidden) return;

    gl.useProgram(midgardProgram.program);

    gl.uniform2f(midgardProgram.uCenter, 0, 0);
    gl.uniform1f(midgardProgram.uScale, 1);
    gl.uniform1f(midgardProgram.uAngle, 0);

    gl.enableVertexAttribArray(midgardProgram.aPos);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertices.bufferId);
    gl.vertexAttribPointer(midgardProgram.aPos, 2, gl.FLOAT, false, 0, 0);

    if (outline)
    {
        gl.uniform4f(midgardProgram.uColor,
                     0,
                     0,
                     0,
                     1);

        gl.drawArrays(gl.LINE_LOOP, 0, this.points.length);
    }
    else
    {
        gl.uniform4f(midgardProgram.uColor,
                     this.color.red()/255,
                     this.color.green()/255,
                     this.color.blue()/255,
                     1);

        gl.drawArrays(gl.TRIANGLE_FAN, 0, this.points.length);
    }

    gl.disableVertexAttribArray(midgardProgram.aPos);
};
