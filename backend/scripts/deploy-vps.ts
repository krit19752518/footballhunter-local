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

function uploadFileSFTP(sftp: any, localFile: string, remoteFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.fastPut(localFile, remoteFile, (err: any) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function makeRemoteDir(sftp: any, remoteDir: string): Promise<void> {
  return new Promise((resolve) => {
    sftp.mkdir(remoteDir, (err: any) => {
      resolve(); // ละเลยหากโฟลเดอร์มีอยู่แล้ว
    });
  });
}

async function uploadFolderSFTP(sftp: any, localDir: string, remoteDir: string, ignorePaths: string[] = []) {
  await makeRemoteDir(sftp, remoteDir);
  const items = fs.readdirSync(localDir);
  for (const item of items) {
    const localPath = path.join(localDir, item);
    const remotePath = remoteDir + '/' + item;
    
    if (ignorePaths.some(p => localPath.includes(p))) {
      continue;
    }
    
    const stat = fs.statSync(localPath);
    if (stat.isDirectory()) {
      await uploadFolderSFTP(sftp, localPath, remotePath, ignorePaths);
    } else {
      console.log(`📤 Uploading: ${localPath} -> ${remotePath}`);
      await uploadFileSFTP(sftp, localPath, remotePath);
    }
  }
}

conn.on('ready', async () => {
  console.log('⚡ Connected to Ubuntu VPS successfully via SSH!');
  
  try {
    conn.sftp(async (err, sftp) => {
      if (err) throw err;
      
      console.log('📂 Creating remote directory structure...');
      await executeCommand(conn, 'mkdir -p /home/ubuntu/footballhunter2/backend /home/ubuntu/footballhunter2/frontend/build/web');
      
      console.log('📤 Uploading backend files...');
      const backendLocal = path.join(__dirname, '..');
      const backendRemote = '/home/ubuntu/footballhunter2/backend';
      
      // อัปโหลดไฟล์หลักทีละไฟล์เพื่อหลีกเลี่ยงการดึงโฟลเดอร์ขยะขนาดใหญ่
      console.log('📤 Uploading backend tsconfig.json...');
      await uploadFileSFTP(sftp, path.join(backendLocal, 'tsconfig.json'), `${backendRemote}/tsconfig.json`);
      console.log('📤 Uploading backend package.json...');
      await uploadFileSFTP(sftp, path.join(backendLocal, 'package.json'), `${backendRemote}/package.json`);
      console.log('📤 Uploading backend .env...');
      await uploadFileSFTP(sftp, path.join(backendLocal, '.env'), `${backendRemote}/.env`);
      console.log('📝 Configuring HEADLESS=true and local database URL in remote .env...');
      await executeCommand(conn, `echo "" >> ${backendRemote}/.env && echo "HEADLESS=true" >> ${backendRemote}/.env && sed -i 's/103.169.67.62/localhost/g' ${backendRemote}/.env`);
      
      console.log('📤 Uploading backend src/ folder...');
      await uploadFolderSFTP(sftp, path.join(backendLocal, 'src'), `${backendRemote}/src`);
      
      console.log('📤 Uploading compiled backend dist/ folder...');
      await uploadFolderSFTP(sftp, path.join(backendLocal, 'dist'), `${backendRemote}/dist`);
      
      console.log('📤 Uploading backend prisma/ folder...');
      await uploadFolderSFTP(sftp, path.join(backendLocal, 'prisma'), `${backendRemote}/prisma`);

      console.log('📤 Uploading compiled frontend web release files...');
      const frontendLocalBuild = path.join(__dirname, '../../frontend/build/web');
      const frontendRemoteBuild = '/home/ubuntu/footballhunter2/frontend/build/web';
      await uploadFolderSFTP(sftp, frontendLocalBuild, frontendRemoteBuild);
      
      console.log('✅ All files uploaded successfully! Starting Ubuntu Linux environment setup...');
      
      // 1. อัปเดตและอัปเกรด Node.js เป็น v20 (เนื่องจาก Prisma v7 บังคับ Node v20+)
      console.log('🌐 Upgrading Node.js to v20 on VPS...');
      await executeCommand(conn, `
        curl -fsSL https://deb.nodesource.com/setup_20.x -o setup_20.x
        echo "Kr1t@12342518" | sudo -S bash setup_20.x
        echo "Kr1t@12342518" | sudo -S apt-get update
        echo "Kr1t@12342518" | sudo -S apt-get install -y nodejs
        rm setup_20.x
        echo "Node.js version after upgrade: $(node -v)"
      `);
      
      // 2. ติดตั้ง PM2 สำหรับควบคุม Process ในพื้นหลังตลอด 24 ชม.
      console.log('🛡️ Installing PM2 globally...');
      await executeCommand(conn, `
        if ! command -v pm2 &> /dev/null; then
          echo "Installing PM2..."
          echo "Kr1t@12342518" | sudo -S npm install -g pm2
        else
          echo "PM2 is already installed"
        fi
      `);

      // 3. จัดการพอร์ต VPS และติดตั้งบราวเซอร์ Chromium สำหรับระบบสแกน
      console.log('🔧 Setting up dependencies & Playwright Chromium...');
      await executeCommand(conn, `
        cd /home/ubuntu/footballhunter2/backend
        echo "Installing production npm packages..."
        npm install --omit=dev
        
        echo "Installing Playwright Chromium and OS library dependencies..."
        npx playwright install chromium
        npx playwright install-deps chromium
        
        echo "Generating Prisma Client..."
        npx prisma generate
      `);

      // 4. สั่งเริ่มการทำงานของแอปฝั่งหลังบ้านและหน้าบ้านด้วย PM2 (ล้างค่าตัวเก่าก่อนหากมีอยู่)
      console.log('🚀 Starting/Restarting processes with PM2...');
      await executeCommand(conn, `
        pm2 stop all || true
        pm2 delete all || true
        
        echo "Starting Backend Server on Port 3000..."
        cd /home/ubuntu/footballhunter2/backend
        pm2 start dist/src/index.js --name "footballhunter-backend"
        
        echo "Starting Frontend Web server on Port 8080..."
        pm2 start "npx http-server /home/ubuntu/footballhunter2/frontend/build/web -p 8080 -c-1" --name "footballhunter-frontend"
        
        echo "Saving PM2 process list..."
        pm2 save
        
        echo "PM2 process status:"
        pm2 list
      `);

      console.log('\n🌟 VPS DEPLOYMENT COMPLETED PERFECTLY! 🌟');
      conn.end();
    });
  } catch (err: any) {
    console.error('❌ Deployment Failed:', err.message);
    conn.end();
  }
}).connect(vpsConfig);
