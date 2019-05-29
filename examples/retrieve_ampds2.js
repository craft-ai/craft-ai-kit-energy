require('dotenv').config();

const csv = require('csv-parse');
const csvStringify = require('csv-stringify');
const debug = require('debug');
const fs = require('fs');
const https = require('https');
const luxon = require('luxon');
const path = require('path');
const stream = require('stream');

const log = debug('craft-ai:kit-energy:examples:retrieve_ampds2');
log.enabled = true;


// This URL was retrieved on 2018/10/18 from https://dataverse.harvard.edu/file.xhtml?persistentId=doi:10.7910/DVN/FIE0S4/XH3RRJ&version=1.2
const CLIMATE_DATASET_URL = 'https://dataverse.harvard.edu/api/access/datafile/2701495?format=original&gbrecs=true';

// This URL was retrieved on 2018/10/18 from https://dataverse.harvard.edu/file.xhtml?persistentId=doi:10.7910/DVN/FIE0S4/FS26TX&version=1.2#
const ELECTRICITY_DATASET_URL = 'https://dataverse.harvard.edu/api/access/datafile/2741425?format=original&gbrecs=true';

const PREPARED_DATASET_PATH = path.join(__dirname, './data/ampds2.csv');


// ----
// This script prepare original files from "AMPds2: The Almanac of Minutely Power dataset (Version 2)"
// to make it usable by this kit.
// ---

return Promise.all([
  new Promise((resolve, reject) => {
    // Electricity data
    log(`Retrieving electricity dataset from '${ELECTRICITY_DATASET_URL}'...`);
    https.get(ELECTRICITY_DATASET_URL, (response) => {
      const electricityReadStream = response
        // Parse it as a CSV file
        .pipe(csv({
          columns: true
        }))
        // Select the data we are interested in
        .pipe(stream.Transform({
          objectMode: true,
          transform: function(row, encoding, next) {
            const datetime = luxon.DateTime
              .fromMillis(row['UNIX_TS'] * 1000, { zone: 'America/Vancouver' });
            const transformed = {
              date: datetime,
              load: row['WHE'] // 'WHE' is in Watts
            };
            this.push(transformed);
            next();
          }
        }));
      // Wait until it is ready
      electricityReadStream
        .once('readable', () => resolve(electricityReadStream));
    });
  }),
  new Promise((resolve, reject) => {
    // Electricity data
    log(`Retrieving climate dataset from '${CLIMATE_DATASET_URL}'...`);
    https.get(CLIMATE_DATASET_URL, (response) => {
      const climateReadStream = response
        // Parse it as a CSV file
        .pipe(csv({
          columns: true
        }))
        // Select the data we are interested in
        .pipe(stream.Transform({
          objectMode: true,
          transform: function(row, encoding, next) {
            const datetime = luxon.DateTime
              .fromFormat(row['Date/Time'], 'y-M-d HH:mm', { zone: 'America/Vancouver' });
            const transformed = {
              date: datetime,
              temperature: row['Temp (C)']
            };
            this.push(transformed);
            next();
          }
        }));
      // Wait until it is ready
      climateReadStream
        .once('readable', () => resolve(climateReadStream));
    });
  })
])
  .then(([electricityReadStream, climateReadStream]) => new Promise((resolve, reject) => {
    log(`Preparing data to '${PREPARED_DATASET_PATH}'...`);
    // Merge everything driving it from the electricity stream
    let currentClimateRow;
    electricityReadStream
      .pipe(stream.Transform({
        objectMode: true,
        transform: function(row, encoding, next) {
          let matchingClimateRow;
          for (; ;) {
            if (!currentClimateRow) {
              currentClimateRow = climateReadStream.read();
              if (!currentClimateRow) {
                break;
              }
            }
            const secondsToCurrentClimateRow = currentClimateRow.date.diff(row.date).as('seconds');
            if (secondsToCurrentClimateRow > 0) {
              // The electricity stream is lagging behind the climate stream.
              // We skip the climate information for this record and keep reading to catch the climate stream.
              break;
            }
            if (secondsToCurrentClimateRow > -60) {
              // Matching climate row found! Both streams are in sync.
              matchingClimateRow = currentClimateRow;
              currentClimateRow = climateReadStream.read();
              break;
            }
            // The climate stream is lagging behind the electricity stream. We keep reading the climate stream.
            currentClimateRow = climateReadStream.read();
          }
          this.push({
            ...row,
            date: row.date.toISO(),
            temperature: matchingClimateRow ? matchingClimateRow.temperature : null,
          });
          next();
        }
      }))
      // Serialize to CSV
      .pipe(csvStringify({
        header: true
      }))
      // Write to an output file
      .pipe(fs.createWriteStream(PREPARED_DATASET_PATH))
      .on('close', resolve)
      .on('error', reject);
  }))
  .then(() => {
    log('Dataset successfully downloaded and prepared!');
  })
  .catch((error) => {
    log('Error!', error);
    process.exit(1);
  });
