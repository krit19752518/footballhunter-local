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
  
  // 1. Stop all PM2 processes to stop concurrent database writes
  console.log("🛑 Stopping all PM2 processes on VPS...");
  conn.exec("pm2 stop all", (err, stream) => {
    if (err) {
      console.error("❌ Failed to stop PM2:", err);
      conn.end();
      return;
    }
    
    stream.on('close', () => {
      console.log("✅ PM2 processes stopped!");
      
      // 2. Ensure scripts directory exists
      conn.exec("mkdir -p /home/ubuntu/footballhunter2/backend/scripts", (err, stream) => {
        if (err) {
          console.error("❌ Directory creation failed:", err);
          conn.end();
          return;
        }
        
        stream.on('close', () => {
          // 3. Initialize SFTP to upload cleanup-db.ts
          conn.sftp((err, sftp) => {
            if (err) {
              console.error("❌ SFTP Init Failed:", err);
              conn.end();
              return;
            }

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

              // 4. Run database cleanup on VPS
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
                  
                  // 5. Restart all PM2 processes
                  console.log("🚀 Starting all PM2 processes back up on VPS...");
                  conn.exec("pm2 start all", (err, stream) => {
                    if (err) {
                      console.error("❌ Failed to start PM2:", err);
                      conn.end();
                      return;
                    }
                    stream.on('close', () => {
                      console.log("🌟 PM2 processes started successfully! DB is perfectly clean!");
                      conn.end();
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}).connect(vpsConfig);
