var TerrainShape = {
    Square: "Square",
    Circular: "Circular",
    PerlinIsland: "PerlinIsland",
    PerlinWorld: "PerlinWorld",
};

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

    this.extractGraph();

    console.log(this.graph);

    this.assignTerrainShape();

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

Terrain.prototype.extractGraph = function() {
    var i, j, k, corner, edge, halfedge, cell;

    graph = {
        cells: [],
        edges: [],
        corners: [],
    };

    for (i = 0; i < this.voronoiData.vertices.length; ++i)
    {
        corner = this.voronoiData.vertices[i];

        corner.border = (corner.x == this.boundingBox.xl ||
                         corner.x == this.boundingBox.xr ||
                         corner.y == this.boundingBox.yb ||
                         corner.y == this.boundingBox.yt);

        corner.edges = [];
        corner.cells = [];

        graph.corners.push(corner);
    }

    for (i = 0; i < this.voronoiData.edges.length; ++i)
    {
        edge = this.voronoiData.edges[i];

        edge.va.edges.push(edge);
        edge.vb.edges.push(edge);

        edge.border = (edge.va.border && edge.vb.border);

        // Reverse left and right to account for flipped y-axis.
        var temp = edge.lSite;
        edge.lSite = edge.rSite;
        edge.rSite = temp;

        graph.edges.push(edge);
    }

    for (i = 0; i < this.voronoiData.cells.length; ++i)
    {
        cell = this.voronoiData.cells[i];

        cell.corners = [];

        cell.border = false;

        // Reverse half-edges to make them counter-clockwise in our
        // coordinate frame
        cell.halfedges = cell.halfedges.reverse();


        // Add sorted va, vb to halfedge to avoid similar checks in
        // future. Then add sorted va to corners of cell and
        // vice-versa.
        for (j = 0; j < cell.halfedges.length; ++j)
        {
            halfedge = cell.halfedges[j];
            if (halfedge.edge.lSite && halfedge.edge.lSite.voronoiId === i)
            {
                halfedge.va = halfedge.edge.va;
                halfedge.vb = halfedge.edge.vb;
            }
            else
            {
                halfedge.va = halfedge.edge.vb;
                halfedge.vb = halfedge.edge.va;
            }

            cell.corners.push(halfedge.va);
            halfedge.va.cells.push(cell);

            halfedge.border = halfedge.edge.border;
            cell.border = cell.border || halfedge.border;
        }

        // Copy relevant data from site
        cell.x = cell.site.x;
        cell.y = cell.site.y;

        graph.cells.push(cell);
    }

    this.graph = graph;
};

Terrain.prototype.assignTerrainShape = function() {
    var i, j, corner;

    for (i = 0; i < this.voronoiData.vertices.length; ++i)
    {
        corner = this.voronoiData.vertices[i];
        corner.water = !this.isLand(corner);
    }

    for (i = 0; i < this.voronoiData.cells.length; ++i)
    {
        var cell = this.voronoiData.cells[i];
        var halfedges = cell.halfedges;

        var nWaterVertices = 0;

        var border = false;

        for (j = halfedges.length - 1; j >= 0; --j)
        {
            edge = halfedges[j].edge;

            if (!edge.rSite || !edge.lSite)
            {
                border = true;
                break;
            }

            if (edge.rSite.voronoiId === i)
                corner = edge.va;
            else
                corner = edge.vb;

            if (corner.water)
                nWaterVertices++;
        }

        cell.site.water = border || nWaterVertices >= halfedges.length * waterThreshold;
    }
};

// p is a point object with 'x' and 'y' properties
Terrain.prototype.isLand = function(p) {
    switch (this.config.terrainShape)
    {
    case TerrainShape.Square:
        return true;
    case TerrainShape.Circular:
        return sqrt(p.x*p.x + p.y*p.y) < circularIslandRadius;
    case TerrainShape.PerlinIsland:
    case TerrainShape.PerlinWorld:
        return false;
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

    colorGenerator.reset();

    this.polygons = [];

    for (i = 0; i < this.points.length; ++i)
    {
        var voronoiId = this.points[i].voronoiId;
        var halfedges = this.voronoiData.cells[voronoiId].halfedges;
        var points = [];
        for (j = halfedges.length - 1; j >= 0; --j)
        {
            edge = halfedges[j].edge;
            if (edge.rSite && edge.rSite.voronoiId === voronoiId)
                points.push(edge.va);
            else
                points.push(edge.vb);
        }

        //this.polygons.push(new ConvexPolygon(points, colorGenerator.next(true)));
        var color = this.points[i].water ? CellColor.Ocean : CellColor.Land;
        this.polygons.push(new ConvexPolygon(points, color));
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