const path = require('path');

const WEATHER_CACHE_PATH = path.join(__dirname, './data/weather_cache.json');

before('Load weather cache', function() {
  return weatherCache.load(WEATHER_CACHE_PATH).then(() => debug('Weather cache loaded...'));
});

after('Save weather cache', function() {
  return weatherCache.save(WEATHER_CACHE_PATH).then(() => debug('Weather cache saved...'));
});
