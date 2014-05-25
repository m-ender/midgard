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

    this.generatePoints();
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

Terrain.prototype.render = function() {
    var i;

    for (i = 0; i < this.markers.length; ++i)
        this.markers[i].render();
};