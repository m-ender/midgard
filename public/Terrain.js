var TerrainShape = {
    Square: "Square",
    Circular: "Circular",
    PerlinIsland: "PerlinIsland",
    PerlinWorld: "PerlinWorld",
};

var CellRenderMode = {
    // Each cell gets a unique color
    Identity: "Identity",
    // Color based on ocean/lake/beach/land
    Classification: "Classification",
    // Land color based on elevation
    Elevation: "Elevation",
    // Land color based on moisture
    Moisture: "Moisture",
    // Land color based on temperature
    Temperature: "Temperature",
    // Don't render cells at all
    Transparent: "Transparent",
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

    // Set up RNG to be used by SimplexNoise
    var rng = { random: new Math.seedrandom(configuration.seed) };
    this.simplex = new SimplexNoise(rng);

    this.voronoi = new Voronoi();

    this.generatePoints();
    this.generateVoronoiData();
    this.relaxPoints();

    console.log(this.voronoiData);

    this.extractGraph();

    console.log(this.graph);

    this.assignTerrainShape();
    this.determineElevation();
    this.generateRivers();
    this.determineMoisture();
    this.determineTemperature();

    this.generatePointMarkers();
    this.generateVoronoiGraphics();
    this.generateDelaunayGraphics();
    this.generateDownslopeGraphics();
    this.generateRiverGraphics();
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
        bordercells: [],
        edges: [],
        corners: [],
    };

    for (i = 0; i < this.voronoiData.vertices.length; ++i)
    {
        corner = this.voronoiData.vertices[i];

        corner.border = (abs(corner.x - this.boundingBox.xl) < Voronoi.ε ||
                         abs(corner.x - this.boundingBox.xr) < Voronoi.ε ||
                         abs(corner.y - this.boundingBox.yb) < Voronoi.ε ||
                         abs(corner.y - this.boundingBox.yt) < Voronoi.ε);

        corner.edges = [];
        corner.cells = [];
        corner.neighbors = [];

        graph.corners.push(corner);
    }

    for (i = 0; i < this.voronoiData.edges.length; ++i)
    {
        edge = this.voronoiData.edges[i];

        edge.va.edges.push(edge);
        edge.vb.edges.push(edge);

        edge.va.neighbors.push(edge.vb);
        edge.vb.neighbors.push(edge.va);

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
        cell.neighbors = [];

        cell.border = false;

        // Reverse half-edges to make them counter-clockwise in our
        // coordinate frame
        cell.halfedges = cell.halfedges.reverse();


        // Add sorted va, vb and neighbors to halfedge to avoid similar
        // checks in future. Then add sorted va to corners of cell and
        // vice-versa.
        for (j = 0; j < cell.halfedges.length; ++j)
        {
            halfedge = cell.halfedges[j];
            if (halfedge.edge.lSite && halfedge.edge.lSite.voronoiId === i)
            {
                halfedge.va = halfedge.edge.va;
                halfedge.vb = halfedge.edge.vb;

                if (halfedge.edge.rSite)
                    cell.neighbors.push(this.voronoiData.cells[halfedge.edge.rSite.voronoiId]);
            }
            else
            {
                halfedge.va = halfedge.edge.vb;
                halfedge.vb = halfedge.edge.va;

                if (halfedge.edge.lSite)
                    cell.neighbors.push(this.voronoiData.cells[halfedge.edge.lSite.voronoiId]);
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

        // Create a list of cells lying on the border for convenience
        if (cell.border)
            graph.bordercells.push(cell);
    }

    // Remove detached corners
    var properCorners = [];
    for (i = 0; i < graph.corners.length; ++i)
    {
        corner = graph.corners[i];

        if (corner.neighbors.length ||
            corner.edges.length ||
            corner.cells.length)
        {
            properCorners.push(corner);
        }
    }

    graph.corners = properCorners;

    this.graph = graph;
};

Terrain.prototype.assignTerrainShape = function() {
    var i, j, corner, cell, neighbor;

    // Assign land or water to corners based on terrain function
    for (i = 0; i < this.graph.corners.length; ++i)
    {
        corner = this.graph.corners[i];
        corner.water = !this.isLand(corner);
    }

    // Determine if cells are water or land. Border cells are
    // always water, others are water if a certain percentage
    // or adjacent corners are water.
    for (i = 0; i < this.graph.cells.length; ++i)
    {
        cell = this.graph.cells[i];

        var nWaterCorners = 0;

        for (j = cell.corners.length - 1; j >= 0; --j)
            if (cell.corners[j].water)
                nWaterCorners++;

        cell.water = cell.border || nWaterCorners >= cell.corners.length * waterThreshold;
        cell.ocean = false;
    }

    // Now flood fill the water cells from the border
    var queue = [];

    for (i = 0; i < this.graph.bordercells.length; ++i)
    {
        cell = this.graph.bordercells[i];
        cell.checked = true;
        queue.push(cell);
    }

    while (queue.length)
    {
        cell = queue.pop();
        cell.ocean = true;

        for (i = 0; i < cell.neighbors.length; ++i)
        {
            neighbor = cell.neighbors[i];
            if (!neighbor.checked && neighbor.water)
            {
                neighbor.checked = true;
                queue.push(neighbor);
            }
        }
    }

    // Find coastal cells (ocean with land neighbor or vice-versa)
    for (i = 0; i < this.graph.cells.length; ++i)
    {
        cell = this.graph.cells[i];

        cell.coast = false;

        for (j = 0; j < cell.neighbors.length; ++j)
        {
            neighbor = cell.neighbors[j];
            if (neighbor.ocean && !cell.water ||
                !neighbor.water && cell.ocean)
            {
                cell.coast = true;
                break;
            }
        }
    }

    // Fix corners and add lists of specific corner types for
    // convenience
    this.graph.landCorners = [];
    this.graph.landAndLakeCorners = [];
    this.graph.lakeCorners = [];
    this.graph.oceanCorners = [];
    this.graph.waterCorners = [];
    this.graph.coastCorners = [];
    for (i = 0; i < this.graph.corners.length; ++i)
    {
        corner = this.graph.corners[i];

        var nOceanCells = 0;
        var nLandCells = 0;
        var nLakeCells = 0;

        for (j = 0; j < corner.cells.length; ++j)
        {
            cell = corner.cells[j];

            if (cell.ocean)
                ++nOceanCells;
            else if (cell.water)
                ++nLakeCells;
            else
                ++nLandCells;
        }

        corner.coast = nLandCells > 0 && nOceanCells > 0;
        corner.water = !corner.coast && (nOceanCells + nLakeCells > 0);
        corner.ocean = corner.water && nOceanCells > 0;

        if (!corner.water && !corner.coast) this.graph.landCorners.push(corner);
        if (!corner.ocean && !corner.coast) this.graph.landAndLakeCorners.push(corner);
        if (!corner.ocean &&  corner.water) this.graph.lakeCorners.push(corner);
        if (corner.ocean) this.graph.oceanCorners.push(corner);
        if (corner.water) this.graph.waterCorners.push(corner);
        if (corner.coast) this.graph.coastCorners.push(corner);
    }
};

// p is a point object with 'x' and 'y' properties
Terrain.prototype.isLand = function(p) {
    var terrainValue;

    switch (this.config.terrainShape)
    {
    case TerrainShape.Square:
        return true;
    case TerrainShape.Circular:
        return sqrt(p.x*p.x + p.y*p.y) < circularIslandRadius;
    case TerrainShape.PerlinIsland:
        terrainValue = 0.7 - sqrt(p.x*p.x + p.y*p.y);

        // Do I even need more octaves here?
        terrainValue += 0.7*this.simplex.noise(2*p.x, 2*p.y);

        return terrainValue > 0;
    case TerrainShape.PerlinWorld:
        terrainValue = 0;

        var amplitude = 1;
        var frequency = 1;
        var persistence = 0.7;

        for (var i = 0; i < perlinWorldOctaves; ++i)
        {
            terrainValue += amplitude*this.simplex.noise(frequency*p.x, frequency*p.y);
            frequency *= 2;
            amplitude *= persistence;
        }

        return terrainValue > 0;
    }
};

Terrain.prototype.determineElevation = function() {
    var i, j, corner, neihbor, cell, edge, queue;


    queue = [];

    // Determine shortest distance from ocean, with
    // lakes not counting. Assign elevation by adding
    // the distance at each step (this should yield
    // a quadratic distribution).
    for (i = 0; i < this.graph.corners.length; ++i)
    {
        corner = this.graph.corners[i];

        corner.elevation = corner.distance = corner.border ? 0 : Infinity;

        if (corner.border)
            queue.push(corner);
    }

    while (queue.length)
    {
        corner = queue.shift();

        for (j = 0; j < corner.neighbors.length; ++j)
        {
            neighbor = corner.neighbors[j];

            var distance = corner.distance + 0.01;

            if (!corner.water && !neighbor.water)
                distance += 1;

            if (distance < neighbor.distance)
            {
                neighbor.distance = distance;
                neighbor.elevation = distance*distance;
                queue.push(neighbor);
            }
        }
    }

    // Determine maximum peak
    this.maxElevation = 0;

    for (i = 0; i < this.graph.corners.length; ++i)
    {
        corner = this.graph.corners[i];

        if (corner.elevation > this.maxElevation)
            this.maxElevation = corner.elevation;
    }

    // Now set cell elevations to average of corners
    for (i = 0; i < this.graph.cells.length; ++i)
    {
        cell = this.graph.cells[i];

        cell.elevation = 0;

        for (j = 0; j < cell.corners.length; ++j)
            cell.elevation += cell.corners[j].elevation;

        cell.elevation /= cell.corners.length;
    }

    // Determine downslopes on land and lake corners
    for (i = 0; i < this.graph.landAndLakeCorners.length; ++i)
    {
        corner = this.graph.landAndLakeCorners[i];

        var maximumDescent = 0;

        for (j = 0; j < corner.neighbors.length; ++j)
        {
            neighbor = corner.neighbors[j];

            var descent = corner.elevation - neighbor.elevation;
            if (descent > maximumDescent)
            {
                maximumDescent = descent;
                corner.downslope = neighbor;
            }
        }

        for (j = 0; j < corner.edges.length; ++j)
        {
            edge = corner.edges[j];

            if (edge.va === corner.downslope ||
                edge.vb === corner.downslope)
            {
                corner.downslopeEdge = edge;
                break;
            }
        }
    }
};

Terrain.prototype.generateRivers = function() {
    var i, j, edge, corner;

    for (i = 0; i < this.graph.corners.length; ++i)
        this.graph.corners[i].river = 0;

    for (i = 0; i < this.graph.edges.length; ++i)
        this.graph.edges[i].river = 0;

    var nSprings = floor(this.n * springsPerPolygon);

    j = 1000*nSprings;
    while (nSprings)
    {
        // Guard for small maps that don't have enough corner to
        // place the required number of springs.
        if (j-- === 0) break;

        i = floor(this.rand() * this.graph.landCorners.length);
        corner = this.graph.landCorners[i];

        if (corner.elevation < minSpringElevation*this.maxElevation ||
            corner.elevation > maxSpringElevation*this.maxElevation ||
            corner.river)
            continue;

        do
        {
            corner.river += 1;
            corner.downslopeEdge.river += 1;
            corner = corner.downslope;
        } while (!corner.coast);

        corner.river += 1;

        --nSprings;
    }
};

Terrain.prototype.determineMoisture = function() {
    var i, j, corner, neighbor, cell, queue;

    queue = [];

    for (i = 0; i < this.graph.corners.length; ++i)
    {
        corner = this.graph.corners[i];

        if ((corner.water || corner.river) && !corner.ocean)
        {
            corner.moisture = corner.river ? Math.min(3, 2 * corner.river) : 1;
            queue.push(corner);
        }
        else
        {
            corner.moisture = 0;
        }
    }

    while (queue.length)
    {
        corner = queue.shift();

        var newMoisture = corner.moisture * moistureAttenuation;

        for (j = 0; j < corner.neighbors.length; ++j)
        {
            neighbor = corner.neighbors[j];

            if (newMoisture > neighbor.moisture)
            {
                neighbor.moisture = newMoisture;
                queue.push(neighbor);
            }
        }
    }

    // Set coastal and ocean corners to maximum moisture
    for (i = 0; i < this.graph.corners.length; ++i)
    {
        corner = this.graph.corners[i];
        if (corner.ocean || corner.coast)
            corner.moisture = 1;
    }

    // Redistribute moisture to an even distribution between 0 and 1.
    var nonOceanCorners = this.graph.landAndLakeCorners.concat(this.graph.coastCorners).sort(function(a, b) {
        if (a.moisture < b.moisture) return -1;
        else if (a.moisture > b.moisture) return 1;
        return 0;
    });

    for (i = 0; i < nonOceanCorners.length; ++i)
    {
        nonOceanCorners[i].moisture = i / (nonOceanCorners.length-1);
    }

    this.maxMoisture = 1;

    // Now set cell moisture to average of corners
    for (i = 0; i < this.graph.cells.length; ++i)
    {
        cell = this.graph.cells[i];

        cell.moisture = 0;

        for (j = 0; j < cell.corners.length; ++j)
            cell.moisture += cell.corners[j].moisture;

        cell.moisture /= cell.corners.length;
    }
};

Terrain.prototype.determineTemperature = function() {
    var i, j, corner, cell;

    // Set temperature based on altitude
    // Potential other factors: latitude, moderate temperature
    // near the ocean.
    for (i = 0; i < this.graph.corners.length; ++i)
    {
        corner = this.graph.corners[i];
        corner.temperature = (corner.ocean || corner.coast) ?
                                20
                             :
                                50 - sqrt(corner.elevation / this.maxElevation) * 80;
    }

    this.maxTemperature = 50;

    // Now set cell temperature to average of corners
    for (i = 0; i < this.graph.cells.length; ++i)
    {
        cell = this.graph.cells[i];

        cell.temperature = 0;

        for (j = 0; j < cell.corners.length; ++j)
            cell.temperature += cell.corners[j].temperature;

        cell.temperature /= cell.corners.length;
    }
};

Terrain.prototype.generatePointMarkers = function() {
    this.markers = [];

    for(i = 0; i < this.graph.cells.length; ++i)
    {
        var p = this.graph.cells[i];
        this.markers.push(new Circle(p.x, p.y, 'black', markerRadius));
    }
};

Terrain.prototype.generateVoronoiGraphics = function() {
    var i, j, edge;

    colorGenerator.reset();

    this.polygons = [];

    for (i = 0; i < this.graph.cells.length; ++i)
    {
        var cell = this.graph.cells[i];

        // Make a copy of the corners to act as the vertex list
        var points = cell.corners.slice();

        var polygon = new ConvexPolygon(points, colorGenerator.next(true));
        polygon.classificationColor = !cell.water ?
                                        (cell.coast ? CellColor.Beach : CellColor.Land)
                                      :
                                        (cell.ocean ? CellColor.Ocean : CellColor.Lake);

        polygon.elevationColor = cell.water ?
                                    polygon.classificationColor
                                 : jQuery.Color({
                                    hue: 100,
                                    saturation: 0.5 - cell.elevation / this.maxElevation / 3,
                                    lightness: 0.4 + cell.elevation / this.maxElevation * 0.6,
                                    alpha: 1
                                 });

        polygon.moistureColor = cell.water ?
                                    polygon.classificationColor
                                 : jQuery.Color({
                                    hue: 60 + 100*cell.moisture,
                                    saturation: 1/3,
                                    lightness: 0.5,
                                    alpha: 1
                                 });

        polygon.temperatureColor = cell.water ?
                                    polygon.classificationColor
                                 : jQuery.Color({
                                    hue: 240 - (cell.temperature + 30) * 3,
                                    saturation: 0.5,
                                    lightness: 0.5,
                                    alpha: 1
                                 });

        this.polygons.push(polygon);
    }

    this.voronoiLines = [];

    for (i = 0; i < this.graph.edges.length; ++i)
    {
        edge = this.graph.edges[i];
        this.voronoiLines.push(new Line(
            edge.va,
            edge.vb
        ));
    }
};

Terrain.prototype.generateDelaunayGraphics = function() {
    var i;

    this.delaunayLines = [];

    for (i = 0; i < this.graph.edges.length; ++i)
    {
        var edge = this.graph.edges[i];
        if (edge.lSite && edge.rSite)
            this.delaunayLines.push(new Line(
                edge.lSite,
                edge.rSite,
                'white',
                lineThickness
            ));
    }
};

Terrain.prototype.generateDownslopeGraphics = function() {
    this.downslopeArrows = [];

    for (i = 0; i < this.graph.landAndLakeCorners.length; ++i)
    {
        var corner = this.graph.landAndLakeCorners[i];

        var dx = corner.downslope.x - corner.x;
        var dy = corner.downslope.y - corner.y;

        var direction = { x: dx, y: dy };

        var length = sqrt(dx*dx + dy*dy) * 0.75;

        this.downslopeArrows.push(ConvexPolygon.CreateArrow(length, length/2, corner, direction, CellColor.River));
    }
};

Terrain.prototype.generateRiverGraphics = function() {
    this.riverLines = [];

    for (i = 0; i < this.graph.edges.length; ++i)
    {
        var edge = this.graph.edges[i];
        if ((!edge.va.water || !edge.vb.water) &&
            edge.river)
        {
            this.riverLines.push(new Line(
                edge.va,
                edge.vb,
                CellColor.River,
                sqrt(edge.river) * pixelSize
            ));
        }
    }
};

Terrain.prototype.render = function() {
    var i;
    var delaunayColor;

    switch (this.config.cellRenderMode)
    {
    case CellRenderMode.Identity:
        delaunayColor = 'black';
        for (i = 0; i < this.polygons.length; ++i)
            this.polygons[i].render();
        break;
    case CellRenderMode.Classification:
        delaunayColor = 'white';
        for (i = 0; i < this.polygons.length; ++i)
            this.polygons[i].render(false, this.polygons[i].classificationColor);
        break;
    case CellRenderMode.Elevation:
        delaunayColor = 'white';
        for (i = 0; i < this.polygons.length; ++i)
            this.polygons[i].render(false, this.polygons[i].elevationColor);
        break;
    case CellRenderMode.Moisture:
        delaunayColor = 'white';
        for (i = 0; i < this.polygons.length; ++i)
            this.polygons[i].render(false, this.polygons[i].moistureColor);
        break;
    case CellRenderMode.Temperature:
        delaunayColor = 'white';
        for (i = 0; i < this.polygons.length; ++i)
            this.polygons[i].render(false, this.polygons[i].temperatureColor);
        break;
    case CellRenderMode.Transparent:
        delaunayColor = 'black';
        break;
    }

    if (this.config.renderVoronoiEdges)
        for (i = 0; i < this.voronoiLines.length; ++i)
            this.voronoiLines[i].render();

    if (this.config.renderDelaunayEdges)
        for (i = 0; i < this.delaunayLines.length; ++i)
            this.delaunayLines[i].render(delaunayColor);

    if (this.config.renderPointMarkers)
        for (i = 0; i < this.markers.length; ++i)
            this.markers[i].render();

    if (this.config.renderRivers)
        for (i = 0; i < this.riverLines.length; ++i)
            this.riverLines[i].render();

    if (this.config.renderDownslopes)
        for (i = 0; i < this.downslopeArrows.length; ++i)
        {
            this.downslopeArrows[i].render();
            this.downslopeArrows[i].render(true);
        }
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