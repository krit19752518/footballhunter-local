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
  
  // Ensure the scripts directory exists on VPS first
  conn.exec("mkdir -p /home/ubuntu/footballhunter2/backend/scripts", (err, stream) => {
    if (err) {
      console.error("❌ Directory creation failed:", err);
      conn.end();
      return;
    }
    
    // Once the command is sent, we can initialize SFTP directly
    conn.sftp((err, sftp) => {
      if (err) {
        console.error("❌ SFTP Init Failed:", err);
        conn.end();
        return;
      }

      // Upload cleanup-db.ts to the VPS
      const localFile = path.join(__dirname, 'cleanup-db.ts');
      const remoteFile = '/home/ubuntu/footballhunter2/backend/scripts/cleanup-db.ts';

      console.log("📤 Uploading cleanup-db.ts to VPS...");
      sftp.fastPut(localFile, remoteFile, (err: any) => {
        if (err) {
          console.error("❌ Upload failed:", err);
          conn.end();
          return;
        }
        console.log("✅ Uploaded successfully!");

        const cmd = "cd /home/ubuntu/footballhunter2/backend && npx ts-node scripts/cleanup-db.ts";
        console.log("🏃 Executing database cleanup on VPS...");
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
            console.log("🏁 Database cleanup execution finished!");
            conn.end();
          });
        });
      });
    });
  });
}).connect(vpsConfig);
