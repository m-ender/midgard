// Provides several methods to generate a distribution
// of points (x,y) in ([-1,1],[-1,1]).

var PointSamplingMethod = {
    Uniform: 'Uniform',
    SquareGrid: 'SquareGrid',
    PerturbedSquareGrid: 'PerturbedSquareGrid',
    HexagonalGrid: 'HexagonalGrid',
    PerturbedHexagonalGrid: 'PerturbedHexagonalGrid',
};

// seed is used by the PRNG-based methods and ignored otherwise.
function PointGenerator(method, seed) {
    this.rand = new Math.seedrandom(seed);

    this.method = method;
}

// n is the number of points to be generated.
// This number is only guide - especially if points are generated
// on fixed grids, the actual number of points may deviate slightly.
PointGenerator.prototype.generate = function(n) {
    var i, j;
    var nPerSide, dCell;
    var nHoriz, nVert, dHoriz, dVert;

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
        nPerSide = round(sqrt(n));
        dCell = 2 / nPerSide;
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

    // Places the points on a square grid as above, but perturbs each
    // point uniformly within its cell.
    case PointSamplingMethod.PerturbedSquareGrid:
        nPerSide = round(sqrt(n));
        dCell = 2 / nPerSide;
        for (i = 0; i < nPerSide; ++i)
        {
            for (j = 0; j < nPerSide; ++j)
            {
                this.points.push({
                    x: -1 + i*dCell + this.rand() * dCell,
                    y: -1 + j*dCell + this.rand() * dCell
                });
            }
        }
        break;

    // Divide the [-1,1] range into roughly n hexagonal cells and
    // put one point at the centre of each cell.
    case PointSamplingMethod.HexagonalGrid:
        nHoriz = round(sqrt(sqrt(3)/2*n));
        nVert = round(2/sqrt(3) * nHoriz);
        dHoriz = 2 / (nHoriz + 0.5);
        dVert = sqrt(3)/2 * dHoriz;

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

    // Places the points on a hexagonal grid as above, but perturbs each
    // point uniformly within the rectangle enclosing its cell.
    case PointSamplingMethod.PerturbedHexagonalGrid:
        nHoriz = round(sqrt(sqrt(3)/2*n));
        nVert = round(2/sqrt(3) * nHoriz);
        dHoriz = 2 / (nHoriz + 0.5);
        dVert = sqrt(3)/2 * dHoriz;

        for (j = 0; j < nVert; ++j)
        {
            for (i = 0; i < nHoriz; ++i)
            {
                this.points.push({
                    x: -1 + dHoriz*(j % 2)/2 + i*dHoriz + this.rand() * dHoriz,
                    y: 1 - j*dVert - this.rand() * dVert
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