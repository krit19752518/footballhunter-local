import fs from 'fs';
import path from 'path';

export const logFile = path.join(__dirname, '../../../bot.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

export const testLogFile = path.join(__dirname, '../../../testbot.log');
const testLogStream = fs.createWriteStream(testLogFile, { flags: 'a' });

export const botLog = (message: string) => {
  const timestamp = new Date().toLocaleString('th-TH');
  const formattedMessage = `[${timestamp}] ${message}`;
  console.log(formattedMessage);
  logStream.write(formattedMessage + '\n');
};

export const testBotLog = (message: string) => {
  const timestamp = new Date().toLocaleString('th-TH');
  const formattedMessage = `[${timestamp}] ${message}`;
  console.log(formattedMessage);
  testLogStream.write(formattedMessage + '\n');
};
