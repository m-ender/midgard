// Render scale is the percentage of the viewport that will be filled by
// the coordinate range [-1, 1].
// The scaling is done in the shaders, but is has to be taking into account
// in obtaining coordinates from the mouse position.
var renderScale = 1;
var maxCoord = 1/renderScale;

var markerRadius = 0.01;