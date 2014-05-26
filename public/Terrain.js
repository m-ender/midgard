// n is the number of samples and hence polygons to use
// If seed is provided, a seed random number generator is used,
// otherwise defaults to Math.random().
function Terrain(n, pointGenerator, seed)
{
    this.n = n;

    if (seed)
        this.rand = new Math.seedrandom(seed);
    else
        this.rand = Math.random;

    this.pointGenerator = pointGenerator;

    this.voronoi = new Voronoi();

    this.generatePoints();

    this.generateVoronoiData();

    console.log(this.voronoiData);

    this.generateVoronoiGraphics();
    this.generateDelaunayGraphics();
}

Terrain.prototype.generatePoints = function() {
    var i;

    this.points = this.pointGenerator.get(this.n);
    // Update n, because generator may return a different number
    this.n = this.points.length;

    if (debug) console.log('Actual number of polygons: ' + this.n);

    this.markers = [];

    for(i = 0; i < this.n; ++i)
    {
        var p = this.points[i];
        this.markers.push(new Circle(p.x, p.y, 'black', markerRadius));
    }
};

Terrain.prototype.generateVoronoiData = function() {
    // The Voronoi library uses an origin in the upper-left corner.
    // This means we need to flip the sign of the y-boundaries, and
    // half-edges will rotate clockwise.
    var boundingBox = {
        xl: -1, xr: 1,
        yt: -1, yb: 1
    };

    this.voronoiData = this.voronoi.compute(this.points, boundingBox);
};

Terrain.prototype.generateVoronoiGraphics = function() {
    var i, j;

    this.polygons = [];

    for (i = 0; i < this.voronoiData.cells.length; ++i)
    {
        var halfedges = this.voronoiData.cells[i].halfedges;
        var points = [];
        for (j = halfedges.length - 1; j >= 0; --j)
        {
            var edge = halfedges[j].edge;
            if (edge.rSite && edge.rSite.voronoiId === i)
                points.push(edge.va);
            else
                points.push(edge.vb);
        }

        this.polygons.push(new ConvexPolygon(points, colorGenerator.next()));
    }
};

Terrain.prototype.generateDelaunayGraphics = function() {
    var i;

    this.delaunayLines = [];

    for (i = 0; i < this.voronoiData.edges.length; ++i)
    {
        var edge = this.voronoiData.edges[i];
        if (edge.lSite && edge.rSite)
            this.delaunayLines.push(new Line(
                edge.lSite,
                edge.rSite,
                'white',
                lineThickness
            ));
    }
};

Terrain.prototype.render = function() {
    var i;

    for (i = 0; i < this.polygons.length; ++i)
        this.polygons[i].render();
    for (i = 0; i < this.polygons.length; ++i)
        this.polygons[i].render(true);

    for (i = 0; i < this.delaunayLines.length; ++i)
        this.delaunayLines[i].render();

    for (i = 0; i < this.markers.length; ++i)
        this.markers[i].render();
};