function Terrain(configuration, pointGenerator)
{
    // This bounding box is for the Voronoi library, which uses an
    // origin in the upper-left corner.
    // This means we need to flip the sign of the y-boundaries, and
    // half-edges will rotate clockwise.
    this.boundingBox = {
        xl: -1, xr: 1,
        yt: -1, yb: 1
    };

    this.n = configuration.nPolygons;

    this.configuration = configuration;

    this.rand = new Math.seedrandom(configuration.seed);

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
    this.voronoiData = this.voronoi.compute(this.points, this.boundingBox);
};

Terrain.prototype.generateVoronoiGraphics = function() {
    var i, j, edge;

    this.polygons = [];

    for (i = 0; i < this.voronoiData.cells.length; ++i)
    {
        var halfedges = this.voronoiData.cells[i].halfedges;
        var points = [];
        for (j = halfedges.length - 1; j >= 0; --j)
        {
            edge = halfedges[j].edge;
            if (edge.rSite && edge.rSite.voronoiId === i)
                points.push(edge.va);
            else
                points.push(edge.vb);
        }

        this.polygons.push(new ConvexPolygon(points, colorGenerator.next()));
    }

    this.voronoiLines = [];

    for (i = 0; i < this.voronoiData.edges.length; ++i)
    {
        edge = this.voronoiData.edges[i];
        this.voronoiLines.push(new Line(
            edge.va,
            edge.vb
        ));
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

    if (this.configuration.renderVoronoiCells)
        for (i = 0; i < this.polygons.length; ++i)
            this.polygons[i].render();

    if (this.configuration.renderVoronoiEdges)
        for (i = 0; i < this.voronoiLines.length; ++i)
            this.voronoiLines[i].render();

    if (this.configuration.renderDelaunayEdges)
        for (i = 0; i < this.delaunayLines.length; ++i)
            this.delaunayLines[i].render(
                this.configuration.renderVoronoiCells ? 'white' : 'black'
            );

    if (this.configuration.renderPointMarkers)
        for (i = 0; i < this.markers.length; ++i)
            this.markers[i].render();
};