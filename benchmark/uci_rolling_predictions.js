const { spawn } = require('child_process');
const { execFile } = require('child_process');

const args = ['load_benchmark_uci.js','--depth', '8', '--start_train', '1',  '--start_pred', '5', '--stop_pred', '8']
const child = execFile('node', args, (error, stdout, stderr) => {
    if (error) {
      throw error;
    }
    console.log(stdout);
});

  
// const ls = spawn('node', args );