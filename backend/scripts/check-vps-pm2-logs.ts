import { Client } from 'ssh2';

const vpsConfig = {
  host: '103.169.67.62',
  port: 22,
  username: 'ubuntu',
  password: 'Kr1t@12342518'
};

const conn = new Client();

function executeCommand(conn: Client, cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('data', (data: any) => {
        out += data.toString();
        process.stdout.write(data);
      });
      stream.stderr.on('data', (data: any) => {
        out += data.toString();
        process.stderr.write(data);
      });
      stream.on('close', (code: any) => {
        resolve(out);
      });
    });
  });
}

conn.on('ready', async () => {
  console.log('⚡ Connected to VPS, fetching PM2 backend logs...\n');
  try {
    await executeCommand(conn, 'pm2 logs footballhunter-backend --lines 40 --no-daemon');
    conn.end();
  } catch (e: any) {
    console.error('Error running command:', e.message);
    conn.end();
  }
}).connect(vpsConfig);
