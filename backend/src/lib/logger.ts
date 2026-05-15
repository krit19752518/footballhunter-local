import fs from 'fs';
import path from 'path';

const logFile = path.join(__dirname, '../../../bot.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

export const botLog = (message: string) => {
  const timestamp = new Date().toLocaleString('th-TH');
  const formattedMessage = `[${timestamp}] ${message}`;
  console.log(formattedMessage);
  logStream.write(formattedMessage + '\n');
};
