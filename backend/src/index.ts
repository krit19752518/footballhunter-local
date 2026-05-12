import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { ApiService } from './services/api.service';
import { MatchService } from './services/match.service';
import { SignalService } from './services/signal.service';
import prisma from './lib/prisma';

dotenv.config();

export const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

app.get('/matches', async (req, res) => {
  console.log('[API] GET /matches requested');
  try {
    const matches = await prisma.match.findMany({
      include: { odds: true, signals: { take: 5, orderBy: { createdAt: 'desc' } } }
    });
    console.log(`[API] Returning ${matches.length} matches`);
    res.json(matches);
  } catch (error) {
    console.error('[API] Error fetching matches:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/signals', async (req, res) => {
  console.log('[API] GET /signals requested');
  try {
    const signals = await prisma.signal.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: { match: true }
    });
    console.log(`[API] Returning ${signals.length} signals`);
    res.json(signals);
  } catch (error) {
    console.error('[API] Error fetching signals:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
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
      console.log(`[SCRAPER] Fetched ${data.data.records.length} records`);
      await MatchService.syncMatches(data.data.records);
      
      for (const record of data.data.records) {
        await SignalService.checkSignals(record.id);
      }
      
      io.emit('data_updated');
      console.log('[SCRAPER] Cycle completed successfully');
    } else {
      console.warn('[SCRAPER] API returned no records or failed');
    }
  } catch (error) {
    console.error('[SCRAPER] Fatal error:', error);
  }
}

if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    runScraper();
    setInterval(runScraper, 30000);
  });
}
