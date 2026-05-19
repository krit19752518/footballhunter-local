import { Client } from 'ssh2';
import path from 'path';

const vpsConfig = {
  host: '103.169.67.62',
  port: 22,
  username: 'ubuntu',
  password: 'Kr1t@12342518'
};

const conn = new Client();

conn.on('ready', () => {
  console.log("⚡ SSH Connected to VPS successfully!");
  
  conn.sftp((err, sftp) => {
    if (err) {
      console.error("❌ SFTP Init Failed:", err);
      conn.end();
      return;
    }

    // Upload dump-restored-bets.ts to the VPS to make sure it's the latest
    const localFile = path.join(__dirname, '../src/scripts/dump-restored-bets.ts');
    const remoteFile = '/home/ubuntu/footballhunter2/backend/src/scripts/dump-restored-bets.ts';

    sftp.fastPut(localFile, remoteFile, (err: any) => {
      if (err) {
        console.error("❌ Upload failed:", err);
        conn.end();
        return;
      }

      const cmd = "cd /home/ubuntu/footballhunter2/backend && npx ts-node src/scripts/dump-restored-bets.ts";
      conn.exec(cmd, (err, stream) => {
        if (err) {
          console.error("❌ Exec failed:", err);
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
          conn.end();
        });
      });
    });
  });
}).connect(vpsConfig);
