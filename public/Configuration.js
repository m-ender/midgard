var resolution = 1024; // We're assuming a square aspect ratio

var pixelSize = 2/resolution;

// Render scale is the percentage of the viewport that will be filled by
// the coordinate range [-1, 1].
// The scaling is done in the shaders, but is has to be taking into account
// in obtaining coordinates from the mouse position.
var renderScale = 0.9;
var maxCoord = 1/renderScale;

// A square this big in our [-1, 1] coordinate system will be roughly
// the size of a pixel
var pixelSize = 2*maxCoord/resolution;

var markerRadius = 3*pixelSize;
var lineThickness = 3*pixelSize;

var nPolygons = 256;