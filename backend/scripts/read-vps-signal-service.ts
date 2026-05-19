import { Client } from 'ssh2';

const vpsConfig = {
  host: '103.169.67.62',
  port: 22,
  username: 'ubuntu',
  password: 'Kr1t@12342518'
};

const conn = new Client();

conn.on('ready', () => {
  console.log("⚡ Connected to VPS!");
  conn.exec("cat /home/ubuntu/footballhunter2/backend/src/services/signal.service.ts", (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    let data = '';
    stream.on('data', (chunk: any) => {
      data += chunk.toString();
    });
    stream.on('close', () => {
      console.log("=== REMOTE SIGNAL SERVICE CODE ===");
      console.log(data);
      conn.end();
    });
  });
}).connect(vpsConfig);
