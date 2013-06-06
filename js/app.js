$(function(){
  var map = L.map('map').setView([42.42, -83.02 ], 16);

  baseLayer = L.tileLayer('http://a.tiles.mapbox.com/v3/matth.map-zmpggdzn/{z}/{x}/{y}.png');
  map.addLayer(baseLayer);


  var bounds = map.getBounds();
  var esriBounds =  [
                      [bounds._southWest.lng, bounds._southWest.lat],
                      [bounds._northEast.lng, bounds._northEast.lat]
                   ];
  console.log(bounds);
  console.log(esriBounds);

  api.getObjectsInBBoxFromESRI(esriBounds, {
    endpoint: 'http://tigerweb.geo.census.gov/arcgis/rest/services/Tracts_Blocks/MapServer/2/',
    name: ['NAME'],
    id: 'BLOCK'
  }, function(error, data){
    console.log(data);
    var blocks = L.geoJson(data);
    map.addLayer(blocks);
  }.bind(this));

});


var api = {};


// ESRI stuff

// Generate a query URL
// A sample URL might look like this:
//  http://ags.wingis.org/ArcGIS/rest/services/1_Parcels/MapServer/1/query?
//  geometryType=esriGeometryEnvelope
//  &geometry=-89.097769,42.271545,-89.092362,42.274038
//  &f=json&outFields=*&inSR=4326
//
// Sample options might looks like this:
// {
//   "type": "ArcGIS Server",
//   "endpoint": "http://ags.wingis.org/ArcGIS/rest/services/1_Parcels/MapServer/1/",
//   "name": ["LOPHouseNumber", "LOPPrefixDirectional", "LOPStreetName"],
//   "id": "PrimaryPIN"
// }
//
// @param {Object} bbox A bounding box specified as an array of coordinates:
// [[west, south], [east, north]]
// @param {Object} options Options for the query. Must include:
//    endpoint: the URL of the needed Arc Server collection
//    name: an array of keys that, when concatenated, name each location
//      (eg, 'house number' + 'street name')
//    id: the primary ID for each location (eg, parcel ID)
function generateArcQueryURL(bbox, options) {
  var url = options.endpoint;

  // Set the requested fields
  var outFields = _.reduce(options.name, function(memo, field){ return memo + ',' + field; }, options.id);
  url += 'query?' + 'outFields=' + outFields;

  // Add the geometry query
  // Given the bounding box, generate a URL to ge the responses from the API.
  var serializedBounds = bbox.join(',');

  url += '&geometryType=esriGeometryEnvelope';
  url += '&geometry=' + serializedBounds;

  // We want JSON back
  url += '&f=json';

  // Make sure the server know's we're sending EPSG 4326
  // And that we want to get the same back
  url += '&inSR=4326';
  url += '&outSR=4326';

  // And finally, set a callback:
  url += '&callback=?';

  console.log(url);
  return url;
}


// Generate GeoJSON from ESRI's JSON data format
//
// @param {Array} geometry A list of features from a geoserver
function generateGeoJSONFromESRIGeometry(geometry) {
  var multiPolygon = {
    type: 'MultiPolygon',
    coordinates: []
  };

  _.each(geometry.rings, function(ring) {
    multiPolygon.coordinates.push([ring]);
  });

  return multiPolygon;
}

// Given a map bounding box, get the objects in the bbox from the given ESRI
// server.
//
// @param {Object} bbox A bounding box specified as an array of coordinates:
//              [[west, south], [east, north]]
// @param {Object} options
// @param {Function} callback With two parameters, error and results, a
// GeoJSON FeatureCollection
api.getObjectsInBBoxFromESRI = function(bbox, options, callback) {
  var url = generateArcQueryURL(bbox, options);

  // Get geo objects from the ArcServer API. Don't force non-caching on IE,
  // since these should rarely change and could be requested multiple times
  // in a session.
  $.ajax({
    url: url,
    dataType: 'json',
    cache: false,
    success: function (data){
      console.log("data", data);
      if(data) {
        // Create a GeoJSON FeatureCollection from the ESRI-style data.
        var featureCollection = {
          type: 'FeatureCollection'
        };
        featureCollection.features = _.map(data.features, function (item) {
          return {
            type: 'Feature',
            id: item.attributes[options.id],
            geometry: generateGeoJSONFromESRIGeometry(item.geometry),
            properties: {
              //block: generateNameFromAttributes(item.attributes, options)
            }
          };
        });

        // Pass the FeatureCollection to the callback.
        callback(null, featureCollection);
      } else {
        callback({
          type: 'APIError',
          message: 'Got no data from the Arc Server endpoint'
        });
      }
    }
  });

};
