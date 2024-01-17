const express = require('express');
const http = require('http');
const { spawn } = require('child_process');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const port = 5501;

app.use(bodyParser.json());
app.use(cors({ origin: '*' }));

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('runCode', ({ environment, code, input }) => {
    try {
      const imageName = getDockerImageName(environment);

      if (!imageName) {
        socket.emit('output', 'Invalid environment');
        return;
      }

      const command = getDockerRunCommand(imageName, code, environment);

      const ptyProcess = spawn('docker', command, {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: process.env.HOME,
        env: process.env,
      });

      ptyProcess.stdout.on('data', (data) => {
        socket.emit('output', data.toString());
      });

      if (input) {
        // Send input to the running process
        ptyProcess.stdin.write(input + '\n'); // Add a newline after the input
      }

      ptyProcess.stdout.on('exit', () => {
        socket.emit('output', 'Pseudo-terminal has exited.');
      });
    } catch (error) {
      console.error('Error:', error);
      socket.emit('output', 'Internal Server Error');
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

function getDockerRunCommand(imageName, code, environment) {
  switch (environment) {
    case 'python':
      return ['run', '-i', '--rm', imageName, 'python', '-c', code];
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
