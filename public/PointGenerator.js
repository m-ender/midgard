// Provides several methods to generate a distribution
// of points (x,y) in ([-1,1],[-1,1]).

var PointSamplingMethod = {
    Uniform: 'Uniform',
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
    this.n = n;
    this.points = [];

    switch (this.method)
    {
    case PointSamplingMethod.Uniform:
        for(i = 0; i < n; ++i)
        {
            this.points.push({
                x: 2*this.rand() - 1,
                y: 2*this.rand() - 1
            });
        }
    }
};

PointGenerator.prototype.get = function(n) {
    if (!this.points || this.n != n)
        this.generate(n);

    return this.points;
};