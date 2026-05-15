import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { ApiService } from './services/api.service';
import { MatchService } from './services/match.service';
import { SignalService } from './services/signal.service';
import { AccuracyService } from './services/accuracy.service';
import { BrowserService } from './services/browser.service';
import prisma from './lib/prisma';
import fs from 'fs';
import path from 'path';

dotenv.config();

// ระบบ Logging ลงไฟล์
const logFile = path.join(__dirname, '../bot.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

export const log = (message: string) => {
  const timestamp = new Date().toLocaleString();
  const formattedMessage = `[${timestamp}] ${message}`;
  console.log(formattedMessage);
  logStream.write(formattedMessage + '\n');
};

export const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

app.get('/matches', async (req, res) => {
  try {
    const matches = await prisma.match.findMany({
      where: { status: 'Live' }, // ดึงเฉพาะคู่ที่ Live จริงๆ
      include: { odds: true, signals: { take: 5, orderBy: { createdAt: 'desc' } } }
    });
    res.json(matches);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/signals', async (req, res) => {
  try {
    const signals = await prisma.signal.findMany({
      where: { match: { status: 'Live' } },
      orderBy: { createdAt: 'desc' },
      include: { match: true }
    });
    res.json(signals);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/bets', async (req, res) => {
  try {
    const bets = await prisma.bet.findMany({
      where: { status: 'Pending' },
      orderBy: { createdAt: 'desc' },
      include: { signal: { include: { match: true } } }
    });
    res.json(bets);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/bets/history', async (req, res) => {
  try {
    const bets = await prisma.bet.findMany({
      orderBy: { createdAt: 'desc' },
      include: { signal: { include: { match: true } } }
    });
    res.json(bets);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/browser/status', (req, res) => {
  res.json({ isReady: BrowserService.getStatus() });
});

app.post('/browser/ready', (req, res) => {
  const { ready } = req.body;
  BrowserService.setReady(ready);
  res.json({ success: true, isReady: ready });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
});

const PORT = process.env.PORT || 3000;

async function runScraper() {
  console.log('--- Starting Scraper Cycle ---');
  try {
    const data = await ApiService.fetchMatches();
    if (data.success && data.data.records) {
      const recordCount = data.data.records.length;
      console.log(`[SCRAPER] Fetched ${recordCount} records`);
      
      const syncedIds = await MatchService.syncMatches(data.data.records);
      
      console.log(`[SCRAPER] Checking signals for ${syncedIds.length} real matches...`);
      for (const matchId of syncedIds) {
        await SignalService.checkSignals(matchId);
      }
      
      await AccuracyService.verifySignals();
      
      io.emit('data_updated');
      console.log('[SCRAPER] Cycle completed successfully');
    }
  } catch (error) {
    console.error('[SCRAPER] Fatal error:', error);
  }
}

if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    
    // เริ่มต้น Browser อัตโนมัติ
    await BrowserService.init();

    runScraper();
    setInterval(runScraper, 30000);
  });
}
