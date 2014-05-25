// n is the number of samples and hence polygons to use
// If seed is provided, a seed random number generator is used,
// otherwise defaults to Math.random().
function Terrain(n, seed)
{
    this.n = n;

    if (seed)
        this.rand = new Math.seedrandom(seed);
    else
        this.rand = Math.random;

    this.generatePoints();
}

Terrain.prototype.generatePoints = function() {
    var i;

    this.points = [];

    for(i = 0; i < this.n; ++i)
    {
        var x = 2*this.rand() - 1;
        var y = 2*this.rand() - 1;

        this.points.push({
            x: x,
            y: y,
            geometry: new Circle(x, y, 'black', markerRadius)
        });
    }
};

Terrain.prototype.render = function() {
    var i;

    for (i = 0; i < this.points.length; ++i)
        this.points[i].geometry.render();
};