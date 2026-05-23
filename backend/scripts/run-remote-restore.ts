import { Client } from 'ssh2';
import path from 'path';
import fs from 'fs';

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

    const localFile = path.join(__dirname, '../src/scripts/restore-new-active-bets.ts');
    const remoteFile = '/home/ubuntu/footballhunter2/backend/src/scripts/restore-new-active-bets.ts';

    console.log(`📤 Uploading: ${localFile} -> ${remoteFile}`);

    sftp.fastPut(localFile, remoteFile, (err: any) => {
      if (err) {
        console.error("❌ Upload failed:", err);
        conn.end();
        return;
      }
      console.log("✅ File uploaded successfully!");

      const cmd = "cd /home/ubuntu/footballhunter2/backend && npx ts-node src/scripts/restore-new-active-bets.ts";
      console.log(`🏃 Executing remote command: ${cmd}`);

      conn.exec(cmd, (err, stream) => {
        if (err) {
          console.error("❌ Exec command failed:", err);
          conn.end();
          return;
        }
        
        stream.on('data', (data: any) => {
          process.stdout.write(data.toString());
        });
        
        stream.stderr.on('data', (data: any) => {
          process.stderr.write(data.toString());
        });
        
        stream.on('close', (code: any) => {
          console.log(`\n🏁 Remote process finished with exit code: ${code}`);
          conn.end();
        });
      });
    });
  });
}).connect(vpsConfig);

