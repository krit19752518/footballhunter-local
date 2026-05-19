import fs from 'fs';
import path from 'path';

// ค้นหาตำแหน่งโฟลเดอร์หลักของ backend เพื่อไม่ให้พาธคลาดเคลื่อนระหว่างรัน TS-Node และ Dist JS
const isDist = __dirname.includes(path.join('dist', 'src', 'lib')) || __dirname.includes('dist/src/lib') || __dirname.includes('dist\\src\\lib');
const rootPath = isDist ? path.resolve(__dirname, '../../../') : path.resolve(__dirname, '../../');

export const logFile = path.join(rootPath, 'bot.log');
export const testLogFile = path.join(rootPath, 'testbot.log');

export const botLog = (message: string) => {
  const timestamp = new Date().toLocaleString('th-TH');
  const formattedMessage = `[${timestamp}] ${message}`;
  console.log(formattedMessage);
  try {
    fs.appendFileSync(logFile, formattedMessage + '\n', 'utf8');
  } catch (e) {
    console.error('Failed to write to bot.log:', e);
  }
};

export const testBotLog = (message: string) => {
  const timestamp = new Date().toLocaleString('th-TH');
  const formattedMessage = `[${timestamp}] ${message}`;
  console.log(formattedMessage);
  try {
    fs.appendFileSync(testLogFile, formattedMessage + '\n', 'utf8');
  } catch (e) {
    console.error('Failed to write to testbot.log:', e);
  }
};
