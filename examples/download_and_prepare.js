require('dotenv').load();

const csv = require('csv-parse');
const debug = require('debug');
const csvStringify = require('csv-stringify');
const fs = require('fs');
const https = require('https');
const luxon = require('luxon');
const path = require('path');
const stream = require('stream');
const unzipper = require('unzipper');

const log = debug('craft-ai:kit-energy:examples:download_and_prepare');
log.enabled = true;

const DATASET_URL = 'https://archive.ics.uci.edu/ml/machine-learning-databases/00235/household_power_consumption.zip';
const DATASET_FILENAME = 'household_power_consumption.txt';
const PREPARED_DATASET_PATH = path.join(__dirname, './data/uci_household_power_consumption.csv');


// ----
// This script downloads and format the UCI "Individual household electric power consumption Data Set"
// to make it usable by this kit.
// ---

// Retrieve the archive
log(`Retrieving dataset from '${DATASET_URL}'...`);
https.get(DATASET_URL, (response) => {
  log(`Preparing data to '${PREPARED_DATASET_PATH}'!`);
  response
    // Unzip the archive
    .pipe(unzipper.Parse())
    // Look for the desired file in the archive
    .pipe(stream.Transform({
      objectMode: true,
      transform: function(entry, encoding, cb) {
        const fileName = entry.path;
        if (fileName === DATASET_FILENAME) {
          entry
            .on('data', (chunk) => this.push(chunk))
            .on('finish', cb);
        } else {
          entry.autodrain();
          cb();
        }
      }
    }))
    // Parse it as a csv file with semicolon separators
    .pipe(csv({
      columns: true,
      delimiter: ';'
    }))
    // Select the data we are interested in
    .pipe(stream.Transform({
      objectMode: true,
      transform: function(row, encoding, cb) {
        const datetime = luxon.DateTime
          .fromFormat(`${row.Date} ${row.Time}`, 'd/M/y HH:mm:ss', { zone: 'UTC' })
          .setZone('Europe/Paris');
        const transformed = {
          date: datetime.toISO(),
          load: row['Global_active_power'] * 1000 // from kw to w
        };
        this.push(transformed);
        cb();
      }
    }))
    // Serialize to csv
    .pipe(csvStringify({
      header: true
    }))
    // Write to an output file
    .pipe(fs.createWriteStream(PREPARED_DATASET_PATH))
    .on('close', () => {
      log('Dataset successfully downloaded and prepared!');
    })
    .on('error', (err) => {
      log('Error!', err);
      process.exit(1);
    });
});
