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

// ระบบ Logging หลัก (Live)
const logFile = path.join(__dirname, '../bot.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// ระบบ Logging แยกสำหรับ Test
const testLogFile = path.join(__dirname, '../testbot.log');
const testLogStream = fs.createWriteStream(testLogFile, { flags: 'a' });

export const log = (message: string) => {
  const timestamp = new Date().toLocaleString();
  const formattedMessage = `[${timestamp}] ${message}`;
  console.log(formattedMessage);
  logStream.write(formattedMessage + '\n');
};

export const testLog = (message: string) => {
  const timestamp = new Date().toLocaleString();
  const formattedMessage = `[${timestamp}] ${message}`;
  console.log(formattedMessage);
  testLogStream.write(formattedMessage + '\n');
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
      include: { 
        match: true,
        bet: true // แก้จาก bets เป็น bet
      }
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


app.get('/real-bets/history', async (req, res) => {
  try {
    const realBets = await prisma.realBetLog.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(realBets);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/browser/status', (req, res) => {
  res.json({ isReady: BrowserService.getStatus() });
});

app.get('/browser/balance', async (req, res) => {
  const balance = await BrowserService.getActualBalance();
  res.json({ balance: balance || BrowserService.getCachedBalance() });
});

app.post('/browser/ready', (req, res) => {
  const { ready } = req.body;
  BrowserService.setReady(ready);
  res.json({ success: true, isReady: ready });
});

app.post('/browser/test-bot', async (req, res) => {
  try {
    const { 
      leagueName = 'เอธิโอเปีย พรีเมียร์ ลิก', 
      matchName = 'เอธิโอเปีย เมดิน vs โวไลตตา ดิชา', 
      betSide = 'โวไลตตา ดิชา', 
      amount = 10, 
      targetLine = '0',
      isTest = true
    } = req.body || {};

    log(`[TEST-BOT] 🧪 Triggering dynamic test bot: ${matchName}`);
    
    // ส่งเข้าคิวงานของบอท
    await BrowserService.findAndBet(
      leagueName,
      matchName,
      betSide,
      amount,
      targetLine,
      isTest, 
      'dummy-task-id-123'
    );

    res.json({ success: true, message: 'Test bot triggered', data: { leagueName, matchName, betSide, amount, targetLine, isTest } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/browser/test-bot/next', (req, res) => {
  BrowserService.nextStep();
  res.json({ success: true, message: 'Continuing to next step' });
});

app.post('/browser/test-bot/stop', (req, res) => {
  BrowserService.stopTest();
  res.json({ success: true, message: 'Test stop requested' });
});

app.post('/browser/test-bot/clear', (req, res) => {
  BrowserService.clearQueue();
  res.json({ success: true, message: 'Queue cleared' });
});

app.get('/browser/test-bot/logs', (req, res) => {
  res.json({ success: true, logs: BrowserService.getTestLogs(30) });
});

app.get('/browser/test-bot/status', (req, res) => {
  res.json({ 
    success: true, 
    isQueueEmpty: BrowserService.isQueueEmpty(),
    isTestRunning: BrowserService.getIsTestRunning()
  });
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
