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

    this.config = configuration;

    this.rand = new Math.seedrandom(configuration.seed);

    this.pointGenerator = pointGenerator;

    this.voronoi = new Voronoi();

    this.generatePoints();

    this.generateVoronoiData();

    this.relaxPoints();

    console.log(this.voronoiData);

    this.generatePointMarkers();
    this.generateVoronoiGraphics();
    this.generateDelaunayGraphics();
}

Terrain.prototype.generatePoints = function() {
    var i;

    this.points = this.pointGenerator.get(this.n);
    // Update n, because generator may return a different number
    this.n = this.points.length;

    if (debug) console.log('Actual number of polygons: ' + this.n);
};

Terrain.prototype.generateVoronoiData = function() {
    this.voronoiData = this.voronoi.compute(this.points, this.boundingBox);
};

Terrain.prototype.relaxPoints = function() {
    var i, j, k;

    for (i = 0; i < this.config.relaxationPasses; ++i)
    {
        for (j = 0; j < this.voronoiData.cells.length; ++j)
        {
            // Reset each site as the average of its cell's corners
            var cell = this.voronoiData.cells[j];
            var halfedges = cell.halfedges;

            cell.site.x = cell.site.y = 0;

            for (k = halfedges.length - 1; k >= 0; --k)
            {
                edge = halfedges[k].edge;
                if (edge.rSite && edge.rSite.voronoiId === j)
                {
                    cell.site.x += edge.va.x;
                    cell.site.y += edge.va.y;
                }
                else
                {
                    cell.site.x += edge.vb.x;
                    cell.site.y += edge.vb.y;
                }
            }

            cell.site.x /= halfedges.length;
            cell.site.y /= halfedges.length;
        }

        this.voronoi.recycle(this.voronoiData);
        this.voronoiData = this.voronoi.compute(this.points, this.boundingBox);
    }
};

Terrain.prototype.generatePointMarkers = function() {
    this.markers = [];

    for(i = 0; i < this.n; ++i)
    {
        var p = this.points[i];
        this.markers.push(new Circle(p.x, p.y, 'black', markerRadius));
    }
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

        this.polygons.push(new ConvexPolygon(points, colorGenerator.next(true)));
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

    if (this.config.renderVoronoiCells)
        for (i = 0; i < this.polygons.length; ++i)
            this.polygons[i].render();

    if (this.config.renderVoronoiEdges)
        for (i = 0; i < this.voronoiLines.length; ++i)
            this.voronoiLines[i].render();

    if (this.config.renderDelaunayEdges)
        for (i = 0; i < this.delaunayLines.length; ++i)
            this.delaunayLines[i].render(
                this.config.renderVoronoiCells ? 'white' : 'black'
            );

    if (this.config.renderPointMarkers)
        for (i = 0; i < this.markers.length; ++i)
            this.markers[i].render();
};

Terrain.prototype.destroy = function() {
    var i;

    if (this.config.renderVoronoiCells)
        for (i = 0; i < this.polygons.length; ++i)
            this.polygons[i].destroy();

    if (this.config.renderVoronoiEdges)
        for (i = 0; i < this.voronoiLines.length; ++i)
            this.voronoiLines[i].destroy();

    if (this.config.renderDelaunayEdges)
        for (i = 0; i < this.delaunayLines.length; ++i)
            this.delaunayLines[i].destroy();
};