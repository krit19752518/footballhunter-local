import { Client } from 'ssh2';

const vpsConfig = {
  host: '103.169.67.62',
  port: 22,
  username: 'ubuntu',
  password: 'Kr1t@12342518'
};

const conn = new Client();

conn.on('ready', () => {
  console.log("⚡ SSH Connected to VPS successfully!");
  console.log("🚀 Starting all PM2 processes back up on VPS...");
  
  conn.exec("pm2 start all", (err, stream) => {
    if (err) {
      console.error("❌ Failed to start PM2:", err);
      conn.end();
      return;
    }
    stream.on('data', (data: any) => {
      process.stdout.write(data.toString());
    });
    stream.stderr.on('data', (data: any) => {
      process.stderr.write(data.toString());
    });
    stream.on('close', () => {
      console.log("🌟 PM2 processes started successfully!");
      conn.end();
    });
  });
}).connect(vpsConfig);
