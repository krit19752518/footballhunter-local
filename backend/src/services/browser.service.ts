import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { botLog, testBotLog, testLogFile } from '../lib/logger';
import fs from 'fs';
import prisma from '../lib/prisma';

// 🟢 🌟 ย้ายฟังก์ชันตรวจสอบราคาสลับฝั่ง (isLineMatch) ออกมาเป็นอิสระนอกคลาส ปิดประตูตายปัญหาวนลูป Error TypeScript 100%
function isLineMatchHelper(target: string, web: string): boolean {
  try {
    const parseValue = (val: string): number => {
      const trimmed = val.trim();
      const isNegative = trimmed.startsWith('-');
      const clean = trimmed.replace(/[+-]/g, '').trim(); 
      let value = 0;
      if (clean.includes('/')) {
        const parts = clean.split('/').map(p => parseFloat(p.replace(/[^0-9.-]/g, '')));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          value = (parts[0] + parts[1]) / 2;
        }
      } else {
        value = parseFloat(clean.replace(/[^0-9.-]/g, ''));
      }
      return isNegative ? -value : value;
    };

    const tValue = parseValue(target);
    const wValue = parseValue(web);

    if (isNaN(tValue) || isNaN(wValue)) {
      return web.toLowerCase().includes(target.toLowerCase());
    }
    return Math.abs(Math.abs(tValue) - Math.abs(wValue)) < 0.01;
  } catch {
    return false;
  }
}

export class BrowserService {
  private static browser: Browser | null = null;
  private static context: BrowserContext | null = null;
  public static page: Page | null = null;
  private static isReady: boolean = false;
  private static isProcessing: boolean = false;
  private static queue: any[] = []; // คิวงานที่รอประมวลผล
  private static queueInterval: NodeJS.Timeout | null = null;
// 🟢 จุดที่แก้ไขเพิ่ม: ประกาศสวิตช์ล็อกประตูดักจับ ts-node-dev สั่งรันซ้อนขนาน (แก้ Error ตัวแดงในรูป)
  private static isInitStarted: boolean = false;
  private static isTestRunning: boolean = false; // สำหรับเลือกไฟล์ Log
  private static currentTaskIsTest: boolean = false; // สำหรับจำแนกประเภทงานล่าสุด (Test หรือ Real)
  private static nextStepResolver: (() => void) | null = null;
  private static stopTestRequested: boolean = false;
  private static lastBalance: number | null = null;
  private static lastBalanceTime: number = 0;

  static isQueueEmpty() {
    return this.queue.length === 0 && !this.isTestRunning;
  }

  static getIsTestRunning() {
    const hasTestInQueue = this.queue.some(t => t.isTest);
    const isTestExecuting = this.isTestRunning && this.currentTaskIsTest;
    return hasTestInQueue || isTestExecuting;
  }

  static clearQueue() {
    this.queue = [];
    this.stopTest();
    this.isProcessing = false;
    this.isTestRunning = false; // 🟢 รีเซ็ตเมื่อมีการเคลียร์คิวทั้งหมด
  }

  static getTestLogs(lines: number = 30): string[] {
    try {
      if (!fs.existsSync(testLogFile)) return [];
      const content = fs.readFileSync(testLogFile, 'utf8');
      const allLines = content.split('\n').filter((l: string) => l.trim() !== '');
      return allLines.slice(-lines);
    } catch (e) {
      return [`Error reading logs: ${e}`];
    }
  }

private static smartLog(message: string, forcedIsTest?: boolean) {
    const isTest = forcedIsTest !== undefined ? forcedIsTest : this.currentTaskIsTest;
    
    if (isTest) {
        // ฝั่งงาน Test: เขียนลงไฟล์ Test อย่างเดียว
        testBotLog(message);
    } else {
        // 🟢 ฝั่งงานจริง: เขียนลงไฟล์ Real อย่างเดียว (เอาคำสั่ง testBotLog ที่เคยซ้อนอยู่ออกไปแล้วครับ)
        botLog(message);
    }
  }

  private static async waitStep(stepName: string) {
    this.smartLog(`[STEP-AUTO] 🤖 ดำเนินขั้นตอนอัตโนมัติ: ${stepName}`);
    if (this.page) {
        await this.page.waitForTimeout(1000).catch(() => {});
    }
  }

  // ระบบจุดหยุด Pause ดักรอปุ่ม NEXT STEP สีเขียวฝั่งแอป Flutter
  private static async pauseForUserReview(stepName: string) {
    this.smartLog(`[STEP-PAUSE] ⏸️ ${stepName}`);
    this.smartLog(`[STEP-PAUSE] 👉 ตรวจสอบบนจอเบราว์เซอร์สีดำเรียบร้อยแล้ว คลิกปุ่ม "NEXT STEP" สีเขียวบนแอป Flutter เพื่อไปต่อครับ`);
    
    return new Promise<void>((resolve) => {
        this.nextStepResolver = resolve;
    });
  }

  static nextStep() {
    if (this.nextStepResolver) {
        this.smartLog(`[STEP-NEXT] ⏩ ผู้ใช้กด NEXT. กำลังขยับ Flow ดำเนินงานต่อ...`);
        this.nextStepResolver();
        this.nextStepResolver = null;
    }
  }

  static stopTest() {
    this.stopTestRequested = true;
    if (this.nextStepResolver) {
        this.nextStepResolver(); 
        this.nextStepResolver = null;
    }
    this.smartLog(`[STOP-TEST] 🛑 คำสั่งหยุดการทดสอบได้รับแล้ว.`);
  }

  static formatLine(line: string | number): string {
    if (line === undefined || line === null || line === "") return "0";
    
    let prefix = "";
    let lineStr = line.toString().trim();
    if (lineStr.startsWith("+")) {
      prefix = "+";
      lineStr = lineStr.substring(1);
    } else if (lineStr.startsWith("-")) {
      prefix = "-";
      lineStr = lineStr.substring(1);
    }

    const num = parseFloat(lineStr);
    if (isNaN(num)) return line.toString();

    if (num % 1 === 0.25) {
      const base = Math.floor(num);
      return `${prefix}${base}/${base + 0.5}`;
    } else if (num % 1 === 0.75) {
      const base = Math.floor(num);
      return `${prefix}${base + 0.5}/${base + 1}`;
    }

    return prefix + num.toString();
  }

static async init() {
    // 🟢 บล็อกป้องกันขั้นเด็ดขาด: ตรวจเช็คกลอนล็อกประตู หากฟังก์ชันนี้เคยรันไปแล้วให้ดีดกลับทันที ปิดประตูเรื่อง ts-node-dev สั่งโหลดซ้อนขนาน 100%
    if (this.isInitStarted) return;
    this.isInitStarted = true;

    // บล็อกแก้ไขปัญหาคิวค้างเดิมของน้า
    try {
        const { default: prisma } = await import('../lib/prisma');
        await prisma.bet.updateMany({
            where: { autoBetStatus: { in: ['Queued', 'Pending'] } },
            data: { autoBetStatus: 'Failed', autoBetError: 'RESET_BY_USER_STARTUP' }
        });
        this.smartLog('[STARTUP] 🧹 บอทตรวจพบตั๋วค้างสถานะ Queued/Pending และทำการรีเซ็ตล้างระบบให้สะอาดเรียบร้อยแล้ว!');
    } catch (e) {
        // ข้ามไปก่อนหากตัวแปรฐานข้อมูลยังเชื่อมต่อไม่สมบูรณ์ในช่วงมิลลิวินาทีแรก
    }

    if (this.browser) return;

    this.smartLog('[BROWSER] Launching Chromium...');
    const isHeadless = process.env.HEADLESS === 'true';
    this.smartLog(`[BROWSER] Headless Mode: ${isHeadless}`);
    this.browser = await chromium.launch({
      headless: isHeadless,
      args: isHeadless ? [] : ['--start-maximized']
    });

    this.context = await this.browser.newContext({
      viewport: null 
    });

    this.page = await this.context.newPage();
    try {
      await this.page.goto('https://www.bet5688q.com/', { timeout: 30000 });
    } catch (e: any) {
      this.smartLog(`[BROWSER] Initial load failed: ${e.message}`);
    }

    this.smartLog('[BROWSER] Browser is open. Please login and prepare the betting page.');
  }

  static async getPage() {
    if (!this.page) await this.init();
    return this.page!;
  }

static setReady(status: boolean) {
    this.isReady = status;
    this.smartLog(`[BROWSER] System is ${status ? 'READY' : 'PAUSED'}`);

    // 🟢 แก้ไข: ใส่เงื่อนไขเช็คว่าถ้าระบบจะ READY แต่ยังไม่มีลูป Interval รันอยู่ ถึงค่อยสั่งสร้าง
    // วิธีนี้ป้องกันการกด Apply แล้วสั่งรันซ้ำซ้อนในขณะที่ลูปอาจจะรันอยู่แล้วหรือเคยรันมาก่อน
    if (status) {
      if (!this.queueInterval) {
        this.startQueueProcessor(false);
      } else {
        this.smartLog(`[QUEUE] ⚠️ Queue processor is already running, skipping start.`);
      }
    } 
    // 🟢 เพิ่มเติม: หากสั่ง PAUSE ให้ทำการทำลาย Interval ทิ้งทันที เพื่อเคลียร์หน่วยความจำและปิดประตูเรื่องลูปเบิ้ล
    else {
      if (this.queueInterval) {
        clearInterval(this.queueInterval);
        this.queueInterval = null;
        this.smartLog(`[QUEUE] 🛑 Queue processor stopped.`);
      }
    }
  }

  static getStatus(): boolean {
    return this.isReady;
  }

private static async startQueueProcessor(isTest?: boolean) {
    // 🟢 จุดแก้ไขปรับปรุง: หากตรวจพบลูป Interval เดิมรันค้างอยู่ ให้สั่งเคลียร์ทำลายทิ้งก่อนทันที ป้องกันลูปทำงานเบิ้ลซ้อนคู่ขนาน
    if (this.queueInterval) {
        clearInterval(this.queueInterval);
        this.queueInterval = null;
    }

    this.smartLog(`[QUEUE] 🔄 Starting queue processor interval (every 5s)...`, isTest);
    this.queueInterval = setInterval(async () => {
      if (!this.isProcessing && this.page) {
        await this.getActualBalance().catch(() => {});
      }

      if (this.isProcessing) return;

      if (this.queue.length === 0) {
        if (this.isTestRunning) {
          this.isTestRunning = false;
          this.currentTaskIsTest = false;
          this.smartLog(`🏁 [QUEUE] All test tasks completed. Resetting test running status.`, true);
        }
      }

      let nextTask: any = null;
      let nextTaskIndex = -1;
      if (this.queue.length > 0) {
        const hasRealTask = this.queue.some((task: any) => task.isTest !== true);
        const queueSummaryType = hasRealTask ? false : true;
        this.smartLog(`[QUEUE] 📊 Queue length=${this.queue.length}, hasReal=${hasRealTask}, isTestRunning=${this.isTestRunning}, isReady=${this.isReady}`, queueSummaryType);
        nextTaskIndex = this.queue.findIndex((task: any) => task.isTest !== true);
        if (nextTaskIndex === -1) {
          nextTaskIndex = 0;
        }
        nextTask = this.queue[nextTaskIndex];
      }

      if (!nextTask && !this.isTestRunning && this.isReady) {
        try {
          const staleQueuedCutoff = new Date(Date.now() - 2 * 60 * 1000);
          const pendingBet = await prisma.bet.findFirst({
            where: {
              status: 'Pending',
              OR: [
                { autoBetStatus: 'Pending' },
                { autoBetStatus: 'Queued', createdAt: { lte: staleQueuedCutoff } }
              ]
            },
            include: { signal: { include: { match: true } } },
            orderBy: { createdAt: 'asc' }
          });

          if (pendingBet) {
            await prisma.bet.update({
              where: { id: pendingBet.id },
              data: { autoBetStatus: 'Queued' }
            });

            const { match } = pendingBet.signal;
            const task = {
              leagueName: match.leagueName,
              matchName: match.name,
              betSide: pendingBet.betSide,
              amount: pendingBet.amount,
              targetLine: pendingBet.lineAtBet,
              isTest: false,
              taskId: pendingBet.signalId
            };
            this.queue.push(task);
            nextTask = task;
            this.smartLog(`[QUEUE] 📥 Pulled REAL signal from DB: ${match.name}`);
          }
        } catch (e) {}
      }

      if (!nextTask) return;

      const page = this.page;
      if (!page) return;

      if (!nextTask.isTest && !this.isReady) {
        return;
      }

      // 🟢 จุดแก้ไขปรับปรุง: ดักจับล็อกค่า Index ป้องกันปัญหาคิวหลุดดัชนีไปเป็น -1 จนเบิ้ลคู่ขนานซ้อนกัน
      if (nextTaskIndex === -1) nextTaskIndex = 0;

      this.smartLog(`[QUEUE] 🎯 Found ${nextTask.isTest ? 'TEST' : 'REAL'} task! Pulling from queue... (index=${nextTaskIndex})`, nextTask.isTest);
      const task = this.queue.splice(nextTaskIndex, 1)[0];

      if (task) {
          // 🟢 จุดแก้ไขปรับปรุง: สั่งกรองตัดเศษงานที่ชื่อไอดีซ้ำซ้อนกันออกจากแถวคิวหลักทันทีก่อนกระโดดไปรันสเตปแทง
          this.queue = this.queue.filter((q: any) => !(q.taskId === task.taskId && q.isTest === task.isTest));
          await this.executeTask(task);
      }
    }, 5000);
  }

private static async executeTask(task: any) {
    const { leagueName, matchName, betSide, amount, targetLine, taskId } = task;
    const isSimulationTask = task.isTest === true;
    const page: any = this.page;
    
    this.isProcessing = true;
    this.currentTaskIsTest = isSimulationTask;
    this.isTestRunning = isSimulationTask;

    try {
      // Balance Check ก่อนแทงจริง (ไม่ต้องเช็กเมื่อเป็น Test)
      if (!isSimulationTask) {
        const currentBalance = await this.getActualBalance();
        if (currentBalance !== null && currentBalance < (amount || 10)) {
          this.smartLog(`❌ INSUFFICIENT BALANCE! Required: ${amount || 10}, Current: ${currentBalance}. Aborting...`);
          throw new Error(`Insufficient balance: ${currentBalance} < ${amount || 10}`);
        } else if (currentBalance !== null) {
          this.smartLog(`💰 Balance Check OK: ${currentBalance} ≥ ${amount || 10}`);
        }
      }

      // Step 1: ค้นหาลีก
      await this.performSearch(page, leagueName);
      
      // Step 2: ค้นหาคู่
      const homeTeam = matchName.split(' vs ')[0];
      this.smartLog(`[Step 4] 🔍 ค้นหาคู่: "${homeTeam}"...`);
      const matchRow = page.locator('._list-item-line_1qsqz_83').filter({ hasText: homeTeam }).first();
      await matchRow.waitFor({ state: 'visible', timeout: 10000 });
      await matchRow.click({ force: true });
      await page.waitForTimeout(3000); 

      // 🟢 เพิ่มการรอให้ป้ายราคาแรกปรากฏขึ้น ก่อนเริ่มค้นหา
      await page.locator('._bet-box_1ckm8_45 ._bet-label_1ckm8_65').first().waitFor({ state: 'visible', timeout: 15000 }); 

      // --- Live Score Verification before Staking ---
      if (taskId && taskId !== 'test-task-id') {
        const cleanName = (name: string) => {
          if (!name) return "";
          return name.replace(/\[.*?\]/g, '').replace(/สโมสรฟุตบอล|สโมสร|เอฟซี|ยูไนเต็ด|U\d+|[\(\)]/g, '').trim();
        };
        const getUniqueKey = (name: string) => {
          const cleaned = cleanName(name);
          const words = cleaned.split(/\s+/).filter(w => w.length > 2);
          return words.length === 0 ? cleaned.substring(0, 5) : words.sort((a, b) => b.length - a.length)[0];
        };

        const homeTeamPart = matchName.split(' vs ')[0] || "";
        const awayTeamPart = matchName.split(' vs ')[1] || "";
        const homeKey = getUniqueKey(homeTeamPart);
        const awayKey = getUniqueKey(awayTeamPart);

        this.smartLog(`🕵️ Verifying live score before proceeding...`);
        const signalRecord = await prisma.signal.findUnique({ where: { id: taskId } }).catch(() => null);
        if (signalRecord && signalRecord.value) {
          const signalScoreStr = signalRecord.value; // e.g., "0-0"
          const liveScore = await BrowserService.extractLiveScore(page, homeKey, awayKey);
          if (liveScore) {
            const liveScoreStr = `${liveScore.scoreHome}-${liveScore.scoreAway}`;
            if (liveScoreStr !== signalScoreStr) {
              this.smartLog(`🚨 SCORE CHANGED! Signal Score: ${signalScoreStr}, Web Live Score: ${liveScoreStr}`);
              throw new Error(`Score changed before staking (Signal: ${signalScoreStr}, Live: ${liveScoreStr})`);
            } else {
              this.smartLog(`✅ Score verified matches signal score: ${liveScoreStr}`);
            }
          } else {
            this.smartLog(`⚠️ Could not parse live score from page header. Proceeding with caution...`);
          }
        } else {
          this.smartLog(`ℹ️ No recorded score for Signal ${taskId}. Skipping verification...`);
        }
      }
      // -----------------------------------------------

      // Step 3: หาราคา
      this.smartLog(`[Step 15] 🔍 กำลังหาราคา...`);
      const allBoxes = page.locator('._bet-box_1ckm8_45');
      await allBoxes.first().waitFor({ state: 'visible', timeout: 5000 });
      
      let found = false;
      for (let i = 0; i < await allBoxes.count(); i++) {
          const box = allBoxes.nth(i);
          const labelText = await box.locator('._bet-label_1ckm8_65').textContent({ timeout: 5000 }) || ""; 
          if (isLineMatchHelper(targetLine, labelText)) {
              await box.click({ force: true });
              found = true;
              break;
          }
      }
      if (!found) throw new Error("ไม่พบราคาที่ต้องการ");

      // Step 4: พนัน (ปรับปรุงการเปิดตะกร้าและกระตุ้นช่องกรอกเงิน)
      await page.waitForTimeout(2000);
      
      this.smartLog(`🛒 กำลังกดเปิดตะกร้าด้วยไอคอนสัญลักษณ์...`);
      
      // ดึงตำแหน่งปุ่มตะกร้าจาก Attribute data-src ของไฟล์ไอคอนโดยตรง ปิดประตูเรื่อง Class name เปลี่ยนแปลง
      const cartBtn = page.locator('i[data-src*="icon_ty_floatbtn.svg"]').first();
      await cartBtn.click({ force: true });
      await page.waitForTimeout(2500); // หน่วงเวลาให้แผงตะกร้ากางออกจนนิ่งสนิท

      // ระบุพิกัดช่องกรอกเงินจำลอง (div/span) ตามโครงสร้างจริงของแผงตะกร้าเว็บนี้
      this.smartLog(`💰 กำลังรอช่องกรอกจำนวนเงินเดิมพัน...`);
      const stakeInput = page.locator('._container_1kmnn_70, ._stake_1kmnn_45').first();
      await stakeInput.waitFor({ state: 'visible', timeout: 10000 });
      
      await stakeInput.focus();
      await stakeInput.dispatchEvent('click');
      await stakeInput.click().catch(() => {});
      await page.waitForTimeout(1500); // หน่วงเวลาให้แผงปุ่มคีย์บอร์ดตัวเลข 1-0 เด้งขึ้นมาเต็มที่
      
      // 🟢 จุดปรับปรุงเพื่อรับยอดเงินงานจริง: แยกหลักตัวเลขตามจำนวนเงินเดิมพันจาก Signal (amount)
      const betAmount = amount ? amount.toString() : "10"; 
      this.smartLog(`🔢 กำลังกดปุ่มตัวเลขยอดเดิมพันจริง: ${betAmount} บาท`);
      
      for (const digit of betAmount) {
          await page.locator('button').filter({ hasText: new RegExp(`^${digit}$`) }).first().click();
          await page.waitForTimeout(300); // เว้นจังหวะจิ้มตัวเลขทีละตัว
      }
      await page.waitForTimeout(500);
      
      // 5. กดพนัน
      this.smartLog(`🚀 กำลังกดปุ่มพนัน!`);
      await page.locator('button').filter({ hasText: /^พนัน/ }).first().click({ force: true });
      
      // หน่วงเวลารอให้หน้าต่างสรุปตั๋วสีเขียวลอยขึ้นมาจนเสร็จสิ้น
      this.smartLog(`⏳ กำลังรอระบบเว็บประมวลผลบิลเดิมพัน...`);
      
      const betResult = await Promise.race([
          page.waitForSelector(':text("ส่งแล้ว")', { timeout: 6000 }).then(() => 'SUCCESS'),
          page.waitForSelector(':text("สำเร็จ")', { timeout: 6000 }).then(() => 'SUCCESS'),
          page.waitForSelector(':text("จำนวนเงินของคุณไม่พอ")', { timeout: 6000 }).then(() => 'INSUFFICIENT_FUNDS'),
          page.waitForSelector(':text("ล้มเหลว")', { timeout: 6000 }).then(() => 'FAILED'),
          page.waitForTimeout(6000).then(() => 'TIMEOUT')
      ]).catch(() => 'TIMEOUT');

      if (betResult === 'INSUFFICIENT_FUNDS') {
          const closeCartBtn = page.locator('.van-action-sheet__close, [class*="close"], ._icon_close_').first();
          if (await closeCartBtn.isVisible({ timeout: 1500 })) {
              await closeCartBtn.click({ force: true });
          } else {
              await cartBtn.click({ force: true }).catch(() => {});
          }
          throw new Error("ยอดเงินคงเหลือไม่พอสำหรับการเดิมพัน (Insufficient funds)");
      } else if (betResult === 'FAILED') {
          throw new Error("ระบบเว็บไซต์ปฏิเสธการเดิมพัน หรือเกิดข้อผิดพลาด");
      }
      
      this.smartLog(`✅ ระบบขึ้นหน้ารายงานผลแล้ว กำลังสั่งปิดหน้าต่างสรุปตั๋ว...`);
      await page.waitForTimeout(1500);

      // 1. คลิกปุ่ม "เดิมพันต่อ" เพื่อปิดแผ่นสรุปตั๋วสีเขียว (แผงตะกร้าหลักจะได้โผล่ออกมา)
      const continueBtn = page.locator('button:has-text("เดิมพันต่อ"), div:has-text("เดิมพันต่อ")').first();
      if (await continueBtn.isVisible({ timeout: 3000 })) {
          await continueBtn.click({ force: true });
          this.smartLog(`💛 คลิกปุ่ม "เดิมพันต่อ" เรียบร้อย`);
          await page.waitForTimeout(1500);
      }

      // 2. ยุบแผงตะกร้าลงด้านล่าง โดยไม่มีการกดปุ่มลบ เพื่อรักษายอดค้างเดิมพัน (กรณีเงินหมด) ไว้แทงรวบตามกติกาเว็บ
      try {
          const closeCartPanelBtn = page.locator('.van-action-sheet__close, [class*="close"], ._icon_close_').first();
          if (await closeCartPanelBtn.isVisible({ timeout: 1500 })) {
              await closeCartPanelBtn.click({ force: true });
              this.smartLog(`🔼 สั่งยุบแผงตะกร้าลงเรียบร้อย (รักษาบิลเดิมฝากค้างไว้ในระบบตามเดิม)`);
          } else {
              // หากหาปุ่มกากบาทปิดแผงไม่เจอ ให้ใช้การคลิกซ้ำที่ปุ่มไอคอนตะกร้าเดิมเพื่อยุบหน้าต่างลง
              await cartBtn.click({ force: true }).catch(() => {});
              this.smartLog(`🔼 คลิกไอคอนตะกร้าซ้ำเพื่อยุบแผงหน้าต่างลงเรียบร้อย`);
          }
          await page.waitForTimeout(1000);
      } catch (err) {
          this.smartLog(`⚠️ หน้าจอพร้อมทำงานต่อเรียบร้อยแล้ว`);
      }

      if (isSimulationTask) {
          this.smartLog(`✅ [TEST COMPLETE] บันทึกบิลลง DB สำเร็จ`);
      }

      if (taskId) {
          try {
              const betRecord = await prisma.bet.findUnique({ where: { signalId: taskId } });
              const oddsAtBet = betRecord?.oddsAtBet ?? 1.80;

              // 1. สร้างประวัติการเดิมพันจริงใน RealBetLog
              await prisma.realBetLog.create({
                  data: {
                      signalId: taskId,
                      matchName,
                      leagueName,
                      betSide,
                      oddsAtBet,
                      lineAtBet: targetLine,
                      amount,
                      status: 'Executed'
                  }
              });

              // 2. ปรับสถานะการแทงของบิลเป็น Executed
              await prisma.bet.updateMany({
                  where: { signalId: taskId },
                  data: { autoBetStatus: 'Executed' }
              });
              this.smartLog(`💾 [DATABASE] บันทึก RealBetLog และอัปเดตสถานะบิล [${taskId}] สำเร็จ`);
          } catch (dbErr: any) {
              this.smartLog(`⚠️ ไม่สามารถอัปเดตประวัติลงฐานข้อมูลได้: ${dbErr.message}`);
          }
      }

      await this.cleanupAndGoBack(page);

    } catch (e: any) {
        this.smartLog(`❌ Process Error: ${e.message}`);
        
        // 🟢 จุดแก้ไขปรับปรุง: เพิ่มระบบเคลียร์สถานะตั๋วเดิมพันใน Database ทันทีเพื่อแก้ปัญหาดึงกลับมาวนลูป
        if (taskId) {
            try {
                this.smartLog(`⚙️ กำลังปรับปรุงสถานะไอดีงานที่ล้มเหลว [${taskId}] ในระบบเพื่อป้องกันลูปซ้ำซาก...`);
                await prisma.bet.updateMany({
                    where: { signalId: taskId },
                    data: { autoBetStatus: 'Failed', autoBetError: e.message }
                });
            } catch (dbErr) {
                this.smartLog(`⚠️ ไม่สามารถอัปเดตสเตตัสความล้มเหลวลงฐานข้อมูลได้`);
            }
        }
        
        await this.cleanupAndGoBack(page).catch(() => {});
    } finally {
        this.isProcessing = false;
        this.smartLog(`🏁 [TASK FINISHED] คู่ "${matchName}" เสร็จสิ้น`);
    }
}

private static async cleanupAndGoBack(page: Page) {
    this.smartLog(`🧹 กำลังเคลียร์หน้าจอและย้อนกลับ...`);

    // 1. ปิด Popup ทั้งหมด
    await this.closeAnnoyingPopups(page);

    // 2. เคลียร์ตะกร้า
    const trashBtn = page.locator('._icon_delete_1r548_107, .fa-trash, [class*="delete"]');
    if (await trashBtn.first().isVisible().catch(() => false)) {
        await trashBtn.click({ force: true });
        await page.waitForTimeout(1000);
    }

    // 3. Hard Reset กลับหน้าค้นหาเสมอ เพื่อให้รอบหน้าเริ่มงานใหม่ได้ชัวร์
    await page.goto('https://www.bet5688q.com/home/sport-filter', { waitUntil: 'networkidle' }).catch(() => {});
    
    this.smartLog(`✅ เคลียร์หน้าจอเสร็จสิ้น`);
  }


private static async ensureBasketEmpty(page: Page) {
    this.smartLog(`🛒 ตรวจสอบความสะอาดตะกร้า...`);
    
    // ใช้ Selector ที่เจาะจงไปที่ตัว SVG ตะกร้าเลยครับ (อันนี้จะแม่นยำมาก)
    const cartBtn = page.locator('button, div[role="button"]').filter({ 
        has: page.locator('svg[viewBox="0 0 80 80"]') 
    }).first();

  // 1. ถ้ายังไม่เปิด ให้คลิกเปิด
    if (await cartBtn.isVisible({ timeout: 5000 })) {
        await cartBtn.click({ force: true });
        await page.waitForTimeout(1500); // รอให้ตะกร้ากาง
    }

// 2. หาปุ่มลบ (ถังขยะ)
    const trashBtn = page.locator('._icon_delete_1r548_107, .fa-trash, [class*="delete"], :text("ลบ")').first();
    if (await trashBtn.isVisible({ timeout: 3000 })) {
        this.smartLog(`🗑️ พบของค้าง กำลังลบ...`);
        await trashBtn.click({ force: true });
        await page.waitForTimeout(1000);
    }
    this.smartLog(`✅ ตะกร้าสะอาดแล้ว`);
  }

 static async findAndBet(leagueName: string, matchName: string, betSide: string, amount: number, targetLine?: string, isTest: boolean = false, taskId?: string) {
    // ❌ เดิม: this.isTestRunning = isTest;
    // 🟢 แก้ไข: ตั้งค่า this.isTestRunning ให้เป็น true หากเป็นงานทดสอบ และไม่รีเซ็ตถ้ามีงานทดสอบอื่นค้างอยู่
    if (isTest) {
        this.isTestRunning = true;
    }
    this.stopTestRequested = false;
    const task = { leagueName, matchName, betSide, amount, targetLine, isTest, taskId };
    if (!isTest) {
      const pendingTestCount = this.queue.filter((queued: any) => queued.isTest === true).length;
      if (pendingTestCount > 0) {
        this.queue = this.queue.filter((queued: any) => queued.isTest !== true);
        this.smartLog(`[QUEUE] 🧹 Cleared ${pendingTestCount} pending TEST task(s) to prioritize REAL task`, false);
      }
    }
    this.smartLog(`[QUEUE] 📥 Enqueuing ${isTest ? 'TEST' : 'REAL'} task: ${matchName} | ${betSide} | targetLine=${targetLine} | taskId=${taskId}`, isTest);
    this.queue.push(task);
    
    // 🟢 จุดแก้ไขปรับปรุง: สั่งสตาร์ทลูปคิวเฉพาะตอนที่ระบบยังไม่มีการสร้าง Interval ค้างไว้เท่านั้น สกัดการทำงานซ้อน
    if (!this.queueInterval) {
        this.startQueueProcessor(isTest);
    }
  }

  public static async getActualBalance(): Promise<number | null> {
    const page = this.page;
    if (!page) {
      this.smartLog(`[BALANCE-SYNC] ⚠️ No active page instance found yet.`);
      return this.lastBalance;
    }

    // ถ้ายอดเงินล่าสุดเคยอัปเดตไปไม่ถึง 10 วินาทีที่แล้ว ให้ดึงจาก Cache ทันที เพื่อประหยัด CPU และกัน Log รก
    const now = Date.now();
    if (this.lastBalance !== null && (now - this.lastBalanceTime) < 10000) {
      return this.lastBalance;
    }

    try {
      // ปิด Popup กวนใจก่อนสแกนยอดเงิน
      await this.closeAnnoyingPopups(page).catch(() => {});

      // 1. ลองดึงจาก Selector ทั่วไป (เพิ่มคลาสเฉพาะเจาะจงของเว็บบาลานซ์ด้านซ้ายบน)
      const selectors = [
        '.global-currency-info-index',
        '.currency-count',
        '.currency-info-custom',
        '.lobby-base-header__balance',
        '[class*="balance"]',
        '[class*="credit"]',
        '[class*="money"]',
        '.user-balance',
        '.balance-amount'
      ];
      
      const frames = page.frames();

      // ลองดึงจาก Main page และ IFrames ผ่าน selectors
      for (const frame of frames) {
        for (const sel of selectors) {
          const el = frame.locator(sel).first();
          if (await el.isVisible().catch(() => false)) {
            const text = await el.innerText().catch(() => "");
            const num = parseFloat(text.replace(/[^0-9.]/g, ''));
            if (!isNaN(num) && num > 0) {
              this.smartLog(`[BALANCE-SYNC] 💰 Found balance via selector "${sel}" in frame: ${num}`);
              this.lastBalance = num;
              this.lastBalanceTime = Date.now();
              return num;
            }
          }
        }
      }

      // 2. ดึงผ่าน Text TreeWalker ในทุกเฟรม (ค้นหาตัวเลขทศนิยมเดี่ยวๆ ใน Header)
      for (const frame of frames) {
        const num = await frame.evaluate(() => {
          const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          let node;
          const candidates = [];
          while (node = walk.nextNode()) {
            const txt = node.textContent?.trim() || "";
            // ล้างอักขระพิเศษเพื่อตรวจสอบเฉพาะทศนิยม (รองรับ สัญลักษณ์เงิน และธงชาติ)
            const cleaned = txt.replace(/[^0-9.]/g, '').trim();
            const parts = cleaned.split('.');
            if (parts.length === 2 && parts[1].length === 2) {
              const val = parseFloat(cleaned);
              if (val > 0 && val < 1000000) {
                const parent = node.parentElement;
                if (parent) {
                  const rect = parent.getBoundingClientRect();
                  
                  // ค้นหาและตรวจสอบว่า text นี้อยู่ใน Popup/Dialog/Wheel/Bonus/Activity หรือไม่
                  let isInsidePopup = false;
                  let curr: HTMLElement | null = parent;
                  while (curr) {
                    const cls = (curr.className || "").toString().toLowerCase();
                    const id = (curr.id || "").toString().toLowerCase();
                    if (
                      cls.includes('popup') || cls.includes('dialog') || cls.includes('modal') || 
                      cls.includes('overlay') || cls.includes('mask') || cls.includes('wheel') || 
                      cls.includes('spin') || cls.includes('bonus') || cls.includes('task') ||
                      cls.includes('lucky') || cls.includes('gift') || cls.includes('activity') ||
                      cls.includes('award') || cls.includes('commission') || cls.includes('invite') ||
                      id.includes('popup') || id.includes('dialog') || id.includes('modal') ||
                      id.includes('overlay') || id.includes('mask') || id.includes('wheel') || 
                      id.includes('spin') || id.includes('bonus') || id.includes('task') ||
                      id.includes('lucky') || id.includes('gift') || id.includes('activity') ||
                      id.includes('award') || id.includes('commission') || id.includes('invite')
                    ) {
                      isInsidePopup = true;
                      break;
                    }
                    curr = curr.parentElement;
                  }
                  
                  // กรองให้มั่นใจว่ามองเห็นได้จริง และอยู่ในบริเวณส่วนบนของหน้าจอ (Header/Profile) และไม่อยู่ใน Popup
                  if (!isInsidePopup && rect.width > 0 && rect.height > 0 && rect.top < 400) {
                    candidates.push({ val, top: rect.top });
                  }
                }
              }
            }
          }
          candidates.sort((a, b) => a.top - b.top);
          return candidates.length > 0 ? candidates[0].val : null;
        }).catch(() => null);

        if (num !== null && !isNaN(num) && num > 0) {
          this.smartLog(`[BALANCE-SYNC] 💰 Found balance via dynamic text scan in frame: ${num}`);
          this.lastBalance = num;
          this.lastBalanceTime = Date.now();
          return num;
        }
      }

      this.smartLog(`[BALANCE-SYNC] ℹ️ Scanning page text, nothing found yet. Last balance: ${this.lastBalance}`);
      return this.lastBalance;
    } catch (e: any) {
      this.smartLog(`[BALANCE-SYNC] ❌ Error scraping balance: ${e.message}`);
      return this.lastBalance;
    }
  }

  public static getCachedBalance(): number | null {
    return this.lastBalance;
  }

  public static async extractLiveScore(page: any, homeKey: string, awayKey: string): Promise<{ scoreHome: number; scoreAway: number } | null> {
    try {
      // วิธีการที่ 1: ค้นหาข้อความแบบยึดแพทเทิร์นทศนิยม/สกอร์ (เช่น "0 - 0") ใน Header
      const scoreElements = page.locator('div, span, p');
      const count = await scoreElements.count().catch(() => 0);
      
      for (let i = 0; i < count; i++) {
        const el = scoreElements.nth(i);
        const isVisible = await el.isVisible().catch(() => false);
        if (!isVisible) continue;
        
        const text = await el.innerText().catch(() => "");
        // มองหารูปแบบที่เหมือนสกอร์: เช่น "0 - 0", "3 - 1" (เน้นเครื่องหมายขีดกลาง เพื่อไม่ให้สับสนกับเวลาที่เป็น colon)
        const scorePattern = /^\s*(\d{1,2})\s*-\s*(\d{1,2})\s*$/;
        const match = text.match(scorePattern);
        if (match) {
          // ตรวจสอบตำแหน่งความน่าจะเป็น (เช่น อยู่แถวบน)
          const box = await el.boundingBox().catch(() => null);
          if (box && box.y < 350) { // ส่วนใหญ่ Header สกอร์จะอยู่บนสุดของจอภาพมือถือ
            const scoreHome = parseInt(match[1], 10);
            const scoreAway = parseInt(match[2], 10);
            
            // ป้องกันการจำแนกเวลาสับสนกับสกอร์ (สกอร์ฟุตบอลเป็นไปไม่ได้ที่จะเกิน 15 ลูกต่อทีม)
            if (scoreHome > 15 || scoreAway > 15) {
              continue;
            }
            
            this.smartLog(`[LIVE-SCORE] Found score via format pattern: ${scoreHome}-${scoreAway}`);
            return { scoreHome, scoreAway };
          }
        }
      }

      // วิธีการที่ 2: ค้นหา Node ที่มีชื่อทีมและหาตัวเลขใกล้เคียง
      // ค้นหาตำแหน่งของชื่อทีมเหย้า
      const homeTeamEl = page.locator('div, span').filter({ hasText: homeKey }).first();
      const awayTeamEl = page.locator('div, span').filter({ hasText: awayKey }).first();

      if (await homeTeamEl.isVisible() && await awayTeamEl.isVisible()) {
        // มองหาองค์ประกอบที่มีตัวเลขเดี่ยวๆ ใน Container เดียวกันหรือ Sibling
        // ดึงข้อความทั้งหมดของ Container แถบข้อมูลด้านบน
        const headerText = await page.evaluate(() => {
          const header = document.querySelector('.lobby-base-header, header, [class*="header"]');
          return header ? (header as HTMLElement).innerText : document.body.innerText;
        }).catch(() => "");

        // มองหารูปแบบสกอร์ในข้อความ Header เช่น "ทีม A 0 - 0 ทีม B" (ใช้ขีดกลาง ไม่ใช้ colon)
        const scoreMatches = headerText.match(/(\d{1,2})\s*-\s*(\d{1,2})/);
        if (scoreMatches) {
          const scoreHome = parseInt(scoreMatches[1], 10);
          const scoreAway = parseInt(scoreMatches[2], 10);
          
          if (scoreHome <= 15 && scoreAway <= 15) {
            this.smartLog(`[LIVE-SCORE] Found score via Header match: ${scoreHome}-${scoreAway}`);
            return { scoreHome, scoreAway };
          }
        }
        
        // ค้นหาใน Parent หรือ Sibling ของชื่อทีม
        const homeScore = await page.evaluate((el: any) => {
          const parent = el.parentElement;
          if (!parent) return null;
          // หา child ที่เป็นตัวเลขเดี่ยว
          const numbers = Array.from(parent.querySelectorAll('div, span')).map((e: any) => e.innerText.trim()).filter((t: string) => /^\d+$/.test(t));
          return numbers.length > 0 ? parseInt(numbers[0], 10) : null;
        }, await homeTeamEl.elementHandle()).catch(() => null);

        const awayScore = await page.evaluate((el: any) => {
          const parent = el.parentElement;
          if (!parent) return null;
          const numbers = Array.from(parent.querySelectorAll('div, span')).map((e: any) => e.innerText.trim()).filter((t: string) => /^\d+$/.test(t));
          return numbers.length > 0 ? parseInt(numbers[0], 10) : null;
        }, await awayTeamEl.elementHandle()).catch(() => null);

        if (homeScore !== null && awayScore !== null && homeScore <= 15 && awayScore <= 15) {
          this.smartLog(`[LIVE-SCORE] Found score via relative siblings: ${homeScore}-${awayScore}`);
          return { scoreHome: homeScore, scoreAway: awayScore };
        }
      }

      return null;
    } catch (e: any) {
      this.smartLog(`[LIVE-SCORE] Error parsing score: ${e.message}`);
      return null;
    }
  }
  
  // บันทึกด่านแว่นขยายฟุตบอล: ตรึงพิกัดเจาะ Selector ค้นหาเฉพาะของหมวดแถบฟุตบอลสติ๊กกี้ด้านล่าง ไม่หลุดลอยขึ้นฝั่งสล็อตด้านบนเด็ดขาด
private static async performSearch(page: any, leagueName: string) {
    this.smartLog(`[Step 1] กำลังเริ่มค้นหาลีก: "${leagueName}"...`);
    
    // 1. ไปหน้าค้นหาโดยตรง (Hard Navigation)
    await page.goto('https://www.bet5688q.com/home/sport-filter', { 
        waitUntil: 'networkidle', 
        timeout: 30000 
    }).catch(() => {});
    
    // 2. รอจนช่องค้นหาปรากฏตัวจริงๆ
    const input = page.locator('input[placeholder*="ค้นหา"], input[placeholder*="Search"], input[type="text"]').first();
    await input.waitFor({ state: 'visible', timeout: 15000 });
    
    // 3. กวาดล้าง Popup ทิ้งอีกรอบก่อนกรอก
    await this.closeAnnoyingPopups(page);
    
    // 4. กรอกคำค้นหา
    await input.fill('');
    await input.fill(leagueName);
    await page.keyboard.press('Enter');
    
    // 5. รอให้รายชื่อคู่บอลโหลดออกมา
    await page.waitForTimeout(4000); 
    this.smartLog(`[Step 1] ✅ ค้นหา "${leagueName}" สำเร็จ`);
  }

  // ปลุกกลไกฟังก์ชันกวาดล้าง Pop-up ขยะโฆษณาเครือข่ายเว็บให้ตื่นมาทำหน้าที่ 100%
// 1. เพิ่ม Selector ปิด Popup ให้ครอบคลุมปุ่มกากบาทตัวใหม่
  public static async closeAnnoyingPopups(page: Page): Promise<boolean> {
    try {
      const closeSelectors = [
        '.ui-dialog-close-box__icon', // 🟢 เพิ่มตัวนี้สำหรับ Popup วงล้อ
        '.van-popup__close-icon',
        '.van-icon-cross',
        'div[role="button"][class*="close"]',
        'span[class*="close"]',
        'button[class*="close"]'
      ];

      let closedAny = false;
      for (const sel of closeSelectors) {
        const el = page.locator(sel).first();
        if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
          this.smartLog(`[POPUP-CLEARER] ✖️ พบ Popup ("${sel}") กำลังสั่งปิด...`, true);
          await el.click({ force: true }).catch(() => {});
          closedAny = true;
          await page.waitForTimeout(1000);
        }
      }
      return closedAny;
    } catch (e) { return false; }
  }
}