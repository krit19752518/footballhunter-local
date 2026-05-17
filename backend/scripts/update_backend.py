
import os
import re

browser_path = r'c:\FootballHunter2\backend\src\services\browser.service.ts'
signal_path = r'c:\FootballHunter2\backend\src\services\signal.service.ts'
index_path = r'c:\FootballHunter2\backend\src\index.ts'

# 1. Update browser.service.ts
with open(browser_path, 'r', encoding='utf-8') as f:
    browser_code = f.read()

# Update findAndBet signature
browser_code = browser_code.replace(
    'static async findAndBet(leagueName: string, matchName: string, betSide: string, amount: number, targetLine?: string, isTest: boolean = false) {',
    'static async findAndBet(leagueName: string, matchName: string, betSide: string, amount: number, targetLine?: string, isTest: boolean = false, taskId?: string) {'
)

# Update queue push
browser_code = browser_code.replace(
    'this.queue.push({ leagueName, matchName, betSide, amount, targetLine, isTest });',
    'this.queue.push({ leagueName, matchName, betSide, amount, targetLine, isTest, taskId });'
)

# In executeTask and executeFullBetFlow, the task object is pulled. We need to pass taskId to prisma.realBetLog.create.
# First, update destructuring of task
browser_code = browser_code.replace(
    'const { leagueName, matchName, betSide, amount, targetLine, isTest } = task;',
    'const { leagueName, matchName, betSide, amount, targetLine, isTest, taskId } = task;'
)

# Then update prisma.realBetLog.create in executeFullBetFlow / executeTask
browser_code = browser_code.replace(
    '''await prisma.realBetLog.create({
          data: {
            matchName,
            leagueName,
            betSide,
            oddsAtBet: parseFloat(oddsText.replace(/[^0-9.]/g, '')),
            amount: amount,
            status: 'Executed'
          }
        })''',
    '''await prisma.realBetLog.create({
          data: {
            signalId: taskId,
            matchName,
            leagueName,
            betSide,
            oddsAtBet: parseFloat(oddsText.replace(/[^0-9.]/g, '')),
            amount: amount,
            status: 'Executed'
          }
        })'''
)

browser_code = browser_code.replace(
    '''await prisma.realBetLog.create({
        data: {
          matchName,
          leagueName,
          betSide,
          amount: amount,
          status: 'Failed',
          errorMessage: error.message
        }
      })''',
    '''await prisma.realBetLog.create({
        data: {
          signalId: taskId,
          matchName,
          leagueName,
          betSide,
          amount: amount,
          status: 'Failed',
          errorMessage: error.message
        }
      })'''
)

with open(browser_path, 'w', encoding='utf-8') as f:
    f.write(browser_code)

# 2. Update signal.service.ts
with open(signal_path, 'r', encoding='utf-8') as f:
    signal_code = f.read()

# Pass bet.signalId or signal.id to findAndBet
signal_code = signal_code.replace(
    '''BrowserService.findAndBet(
        match.leagueName,
        match.name,
        betSide,
        10, // แทงจริง 10 บาท
        line
      );''',
    '''BrowserService.findAndBet(
        match.leagueName,
        match.name,
        betSide,
        10, // แทงจริง 10 บาท
        line,
        false, // isTest
        signal.id // taskId -> signalId
      );'''
)

with open(signal_path, 'w', encoding='utf-8') as f:
    f.write(signal_code)

# 3. Update index.ts
with open(index_path, 'r', encoding='utf-8') as f:
    index_code = f.read()

# Add real-bets history endpoint
if '/real-bets/history' not in index_code:
    endpoint_code = """
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
"""
    # Insert before app.get('/browser/status'
    index_code = index_code.replace("app.get('/browser/status'", endpoint_code + "\napp.get('/browser/status'")

# Update test-bot endpoint to pass dummy taskId
index_code = index_code.replace(
    '''await BrowserService.findAndBet(
      leagueName,
      matchName,
      betSide,
      amount,
      targetLine,
      true // isTest = true
    );''',
    '''await BrowserService.findAndBet(
      leagueName,
      matchName,
      betSide,
      amount,
      targetLine,
      true, // isTest = true
      'test-task-id' // dummy taskId
    );'''
)

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(index_code)

print("Backend updated successfully!")
