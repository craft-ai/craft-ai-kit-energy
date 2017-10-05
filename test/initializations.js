const path = require('path');

const WEATHER_CACHE_PATH = path.join(__dirname, './data/weather_cache.json');

before('Load weather cache', function() {
  debug('Loading the weather cache...');
  return weatherCache.load(WEATHER_CACHE_PATH);
});

after('Save weather cache', function() {
  debug('Saving the weather cache...');
  return weatherCache.save(WEATHER_CACHE_PATH);
});
