// Provides several methods to generate a distribution
// of points (x,y) in ([-1,1],[-1,1]).

var PointSamplingMethod = {
    Uniform: 'Uniform',
    SquareGrid: 'SquareGrid',
    HexagonalGrid: 'HexagonalGrid',
};

// seed is used by the PRNG-based methods and ignored otherwise.
// If no seed is given, defaults to Math.random().
function PointGenerator(method, seed) {
    if (seed)
        this.rand = new Math.seedrandom(seed);
    else
        this.rand = Math.random;

    this.method = method;
}

// n is the number of points to be generated.
// This number is only guide - especially if points are generated
// on fixed grids, the actual number of points may deviate slightly.
PointGenerator.prototype.generate = function(n) {
    var i, j;

    this.n = n;
    this.points = [];

    switch (this.method)
    {
    // Give each point a completely random position with
    // uniform distribution.
    case PointSamplingMethod.Uniform:
        for(i = 0; i < n; ++i)
        {
            this.points.push({
                x: 2*this.rand() - 1,
                y: 2*this.rand() - 1
            });
        }
        break;

    // Divide the [-1,1] range into roughly n square cells and
    // put one point at the centre of each cell.
    case PointSamplingMethod.SquareGrid:
        var nPerSide = round(sqrt(n));
        var dCell = 2 / nPerSide;
        for (i = 0; i < nPerSide; ++i)
        {
            for (j = 0; j < nPerSide; ++j)
            {
                this.points.push({
                    x: -1 + dCell/2 + i*dCell,
                    y: -1 + dCell/2 + j*dCell
                });
            }
        }
        break;

    // Divide the [-1,1] range into roughly n hexagonal cells and
    // put one point at the centre of each cell.
    case PointSamplingMethod.HexagonalGrid:
        var nHoriz = round(sqrt(sqrt(3)/2*n));
        var nVert = round(2/sqrt(3) * nHoriz);
        var dHoriz = 2 / (nHoriz + 0.5);
        var dVert = sqrt(3)/2 * dHoriz;

        for (j = 0; j < nVert; ++j)
        {
            for (i = 0; i < nHoriz; ++i)
            {
                this.points.push({
                    x: -1 + dHoriz*(1 + j % 2)/2 + i*dHoriz,
                    y: 1 - dVert/2 - j*dVert
                });
            }
        }
        break;
    }
};

PointGenerator.prototype.get = function(n) {
    if (!this.points || this.n != n)
        this.generate(n);

    return this.points;
};