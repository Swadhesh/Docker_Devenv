const express = require('express');
const { spawn } = require('node-pty');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(cors({ origin: '*' }));

app.post('/runcode', async (req, res) => {
  try {
    const { environment, code } = req.body;
    const imageName = getDockerImageName(environment);

    if (!imageName) {
      return res.status(400).send('Invalid environment');
    }

    const command = getDockerRunCommand(imageName, code, environment);

    const ptyProcess = spawn('docker', command, {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: process.env.HOME,
      env: process.env,
    });

    let output = '';

    ptyProcess.on('data', (data) => {
      output += data;
    });

    await new Promise((resolve) => {
      ptyProcess.on('exit', () => {
        resolve();
      });
    });

    res.send(output);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Internal Server Error');
  }
});


function getDockerRunCommand(imageName, code, environment) {
  switch (environment) {
    case 'python':
      return ['run', '-i', '--rm', imageName, '/bin/sh', '-c', `echo '${code}' > script.py && python script.py`];
    case 'c':
      return ['run', '-i', '--rm', imageName, '/bin/sh', '-c', `echo '${code}' > abc.c && gcc abc.c -o abc && ./abc`];
    case 'openjdk':
      return ['run', '-i', '--rm', imageName, '/bin/sh', '-c', `echo '${code}' > Main.java && javac Main.java && java Main`];
    default:
      return [];
  }
}

function getDockerImageName(environment) {
  switch (environment) {
    case 'python':
      return 'python:latest';
    case 'c':
      return 'gcc:latest';
    case 'openjdk':
      return 'openjdk:latest';
    default:
      return null;
  }
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
