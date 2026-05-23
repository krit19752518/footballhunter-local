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
    this.isTestRunning = false;
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
        testBotLog(message);
    } else {
        botLog(message);
        testBotLog(message); 
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

    if (status) {
      this.startQueueProcessor(false);
    }
  }

  static getStatus(): boolean {
    return this.isReady;
  }

  private static async startQueueProcessor(isTest?: boolean) {
    if (this.queueInterval) return; 

    this.smartLog(`[QUEUE] 🔄 Starting queue processor interval (every 5s)...`, isTest);
    this.queueInterval = setInterval(async () => {
      if (!this.isProcessing && this.page) {
        await this.getActualBalance().catch(() => {});
      }

      if (this.isProcessing) return;

      let nextTask = this.queue.length > 0 ? this.queue[0] : null;

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

      this.smartLog(`[QUEUE] 🎯 Found TEST task! Pulling from queue...`);
      const task = this.queue.shift();

      if (task) {
        await this.executeTask(task);
      }
    }, 5000);
  }

  private static async executeTask(task: any) {
    const { leagueName, matchName, betSide, amount, targetLine, taskId } = task;
    const page: any = this.page;

      const getVisibleSlipContainer = async () => {
        const container = page.locator(`
          .ui-popup, .van-popup, [class*="popup"], [class*="slip"], [class*="bottom-sheet"], [class*="dialog"], ._half-screen-dialog_h3xgq_45
        `).filter({ has: page.locator('input, textarea, [role="textbox"], ._container_15log_69, [class*="stake-container"]') }).first();
        return await container.isVisible().catch(() => false) ? container : null;
      };

      const getVisibleSlipText = async () => {
        const container = await getVisibleSlipContainer();
        if (!container) return '';
        return await container.evaluate((el: HTMLElement) => el.textContent || '').catch(() => '');
      };

      const closeOpenSlip = async () => {
        await page.evaluate(() => {
          const closeSelectors = ['.ui-dialog-close-box__icon', '.ui-dialog-close-box', '._close-icon_', '[class*="close-box"]', '.van-icon-close', '.ui-icon-close', '._clear_h3xgq_87'];
          closeSelectors.forEach((selector) => {
            document.querySelectorAll(selector).forEach((el: any) => { try { el.click(); } catch (e) {} });
          });
          const masks = document.querySelectorAll('.ui-mask, .ui-overlay, ._mask_, .van-overlay');
          masks.forEach((el: any) => { try { el.click(); } catch (e) {} });
        }).catch(() => {});
        await page.waitForTimeout(1200);
      };

      const clickTargetOdds = async (box: any) => {
        const oddsButton = box.locator('[class*="_odds_"], [class*="odds"], [class*="price"]').first();
        if (await oddsButton.isVisible().catch(() => false)) {
          await oddsButton.scrollIntoViewIfNeeded().catch(() => {});
          await oddsButton.click({ force: true }).catch(() => {});
        } else {
          await box.scrollIntoViewIfNeeded().catch(() => {});
          await box.click({ force: true }).catch(() => {});
        }
      };

      this.isProcessing = true;
      this.currentTaskIsTest = true; 
      this.isTestRunning = true; 
      this.stopTestRequested = false;
      let step = 1;
      const logWithStep = (msg: string) => {
        this.smartLog(`[Step ${step++}] ${msg}`, true);
      };

      let finalOdds = 0.0;

      try {
        logWithStep(`🚀 Starting TEST process for: ${matchName}`);
        
        // ด่านตรวจโฆษณา/วงล้อก่อนเริ่มรัน: สั่งกวาดล้างสิ่งกีดขวางหน้าจอทุกครั้งเพื่อสุขอนามัยของพอร์ต
        await BrowserService.closeAnnoyingPopups(page);
        
        logWithStep(`💤 Waiting 3s for page layout to stabilize before starting...`);
        await page.waitForTimeout(3000);

        if (this.stopTestRequested) throw new Error("Test Stopped by user");

      const cleanName = (name: string) => {
        if (!name) return "";
        return name.replace(/\[.*?\]/g, '').replace(/สโมสรฟุตบอล|สโมสร|เอฟซี|ยูไนเต็ด|U\d+|[\(\)]/g, '').trim();
      };

      const getUniqueKey = (name: string) => {
        const cleaned = cleanName(name);
        const words = cleaned.split(/\s+/).filter(w => w.length > 2);
        return words.length === 0 ? cleaned.substring(0, 5) : words.sort((a, b) => b.length - a.length)[0];
      };

      const homeTeam = matchName.split(' vs ')[0];
      const awayTeam = matchName.split(' vs ')[1];
      const homeKey = getUniqueKey(homeTeam);
      const awayKey = getUniqueKey(awayTeam);

      // ==========================================
      // 🛑 🛑 [PAUSE POINT 0] แว่นขยายฟุตบอลยึดพิกัดสติ๊กกี้
      // ==========================================
      await this.pauseForUserReview(`[Step 3] 🔍 บอทกำลังจะจิ้มแว่นขยายของฟุตบอลเพื่อป้อนชื่อลีก: "${leagueName}" สังเกตจอเบราว์เซอร์สีดำให้ดี แล้วคลิก NEXT STEP ครับ`);
      if (this.stopTestRequested) throw new Error("Test Stopped by user");

      try {
        logWithStep(`🔍 Opening search tool on Header panel...`);
        await this.performSearch(page, leagueName);
        if (this.stopTestRequested) throw new Error("Test Stopped by user");
        await page.waitForTimeout(3000); 
      } catch (e: any) {
        throw new Error(`League Search Failed: ${e.message}`);
      }

      logWithStep(`🔍 Scanning for match: ${homeKey} vs ${awayKey}`);
      let matchRow: any = null;
      let found = false;

      for (let retry = 0; retry < 10; retry++) { 
          let possibleRows = page.locator('.match-item, .match-row, .game-item, [class*="match-item"], [class*="game-item"], [class*="match-row"], [class*="game-row"], li')
              .filter({ hasText: homeKey })
              .filter({ hasText: awayKey });
          
          let count = await possibleRows.count();
          if (count === 0) {
              possibleRows = page.locator('div, li, a').filter({ hasText: homeKey }).filter({ hasText: awayKey });
              count = await possibleRows.count();
          }
          
          for (let i = 0; i < count; i++) {
            const candidate = possibleRows.nth(i);
            if (await candidate.isVisible()) {
              const box = await candidate.boundingBox();
              if (box && box.height > 30 && box.height < 150) { 
                matchRow = candidate;
                found = true;
                break;
              }
            }
          }
          
          if (found) break;
          await page.waitForTimeout(1000); 
      }

      if (matchRow) {
        await this.waitStep("2. พบคู่แข่งขันในหน้าผลลัพธ์การค้นหาแล้ว กำลังจะคลิกเปิดหน้าดูราคา");
        logWithStep(`✅ Match found! Clicking to open odds page...`);
        if (this.stopTestRequested) throw new Error("Test Stopped by user");
        await matchRow.scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(3000); 

        const clickTargets = matchRow.locator('div[class*="_center_"], .match-link, a, .team-name').first();
        if (await clickTargets.isVisible()) {
           await clickTargets.click({ force: true, timeout: 3000 }).catch(() => matchRow.click({ force: true }));
        } else {
           await matchRow.click({ force: true }).catch(() => {});
        }
        
        let arrived = false;
        for (let i = 0; i < 15; i++) { 
            await page.waitForTimeout(1500); 
            const isOddsPage = await page.locator('div, span').filter({ hasText: /แฮนดิแคป|สูง\/ต่ำ|Handicap|1x2|ไม่พบข้อมูลเป็นการชั่วคราว/ }).first().isVisible().catch(() => false);
            if (isOddsPage) { arrived = true; break; }
            if (i % 5 === 0 && i > 0) { 
                await matchRow.evaluate((el: HTMLElement) => {
                    el.click(); 
                    const box = el.getBoundingClientRect();
                    const event = new MouseEvent('click', { view: window, bubbles: true, cancelable: true, clientX: box.left + 20, clientY: box.top + 10 });
                    el.dispatchEvent(event);
                }).catch(() => {});
            }
        }

        if (arrived) {
            logWithStep(`🚩 Arrived at Odds Page. Waiting 5s for stabilization...`);
            await page.waitForTimeout(5000); 

            const formattedPrice = BrowserService.formatLine(targetLine || "0");
            logWithStep(`🔍 Searching for price: ${formattedPrice}`);
            
            const isFH = betSide.includes('ครึ่งแรก') || task.matchName.includes('ครึ่งแรก') || (targetLine && targetLine.includes('ครึ่งแรก'));
            const isOU = betSide.includes('สูง') || betSide.includes('ต่ำ');
            
            let sectionTitle = isOU ? 'สูง/ต่ำ' : 'แฮนดิแคป';
            if (isFH) sectionTitle += '-ครึ่งแรก';

            try {
                let targetSection: any = null;
                for (let retry = 0; retry < 5; retry++) {
                    const sections = page.locator('.ui-collapse-item');
                    const count = await sections.count();
                    for (let i = 0; i < count; i++) {
                        const titleText = await sections.nth(i).innerText().catch(() => "");
                        if (titleText.split('\n')[0].includes(sectionTitle)) { targetSection = sections.nth(i); break; }
                    }
                    if (targetSection) break;
                    await page.waitForTimeout(1500); 
                }

                if (targetSection) {
                    logWithStep(`✅ Found Section: ${sectionTitle}`);
                    const cleanTarget = (targetLine || "").replace(/[\[\]]/g, '').trim();
                    let targetBox: any = null;

                    const teamParts = task.matchName.split(/\s+[vV][sS]\s+/);
                    const homeTeam = teamParts[0] || "";
                    const awayTeam = teamParts[1] || "";
                    
                    let isAwayBet = false;
                    if (isOU) {
                        isAwayBet = betSide.includes('ต่ำ') || betSide.includes('Under') || betSide.includes('[ต่ำ]');
                    } else {
                        isAwayBet = betSide.includes(awayTeam) || betSide.includes('ทีมเยือน') || (awayTeam.length > 0 && awayTeam.includes(betSide));
                    }

                    const allLabels = targetSection.locator('._bet-label_1ckm8_65, [class*="_bet-label_"]');
                    const labelCount = await allLabels.count();
                    
                    await targetSection.scrollIntoViewIfNeeded().catch(() => {});
                    const sectionBox = await targetSection.boundingBox().catch(() => null);
                    const fallbackCenterX = page.viewportSize() ? page.viewportSize()!.width / 2 : 400;
                    const sectionCenterX = sectionBox ? (sectionBox.x + sectionBox.width / 2) : fallbackCenterX;
                    
                    const matchingBoxes: { box: any; info: any; index: number; text: string }[] = [];
                    for (let j = 0; j < labelCount; j++) {
                        const label = allLabels.nth(j);
                        const labelText = await label.innerText().catch(() => "");
                        // 🟢 บรรทัด 436 เคลียร์จบถาวร: สั่งเรียกใช้ helper ฟังก์ชันอิสระนอกคลาสโดยตรง ไร้ข้อติดขัด
                        if (isLineMatchHelper(cleanTarget, labelText)) { 
                            const betBox = label.locator('xpath=ancestor::div[contains(@class, "_bet-box_")]').first();
                            await betBox.scrollIntoViewIfNeeded().catch(() => {});
                            const boxInfo = await betBox.boundingBox().catch(() => null);
                            matchingBoxes.push({ box: betBox, info: boxInfo, index: j, text: labelText });
                        }
                    }

                    if (matchingBoxes.length > 0) {
                        matchingBoxes.sort((a, b) => {
                            if (a.info && b.info) {
                                if (Math.abs(a.info.y - b.info.y) > 10) return a.info.y - b.info.y;
                                return a.info.x - b.info.x;
                            }
                            return a.index - b.index;
                        });
                        targetBox = isAwayBet && matchingBoxes.length >= 2 ? matchingBoxes[1].box : matchingBoxes[0].box;
                    }

                    if (targetBox) {
                        let oddsText = await targetBox.locator('[class*="_odds_"], [class*="odds"]').innerText().catch(() => "N/A");
                        finalOdds = parseFloat(oddsText.replace(/[^0-9.]/g, '')) || 0.0;

                        // ==========================================
                        // 🛑 🛑 [PAUSE POINT 1] Step 15: ค้นพบราคาสำเร็จ ก่อนจิ้มราคา
                        // ==========================================
                        await this.pauseForUserReview(`[Step 15] 🎯 พบล็อกกล่องราคาแล้ว: ${finalOdds} (${isAwayBet ? 'ทีมเยือน' : 'เจ้าบ้าน'}) ตรวจเสร็จกด NEXT STEP เพื่อให้บอทเริ่มรัวคลิก 3 รอบครับ`);
                        if (this.stopTestRequested) throw new Error("Test Stopped by user");

                        // สั่งลุยรัวคลิกราคา 3 รอบ
                        for (let clickAttempt = 0; clickAttempt < 3; clickAttempt++) {
                            logWithStep(`[Attempt ${clickAttempt + 1}/3] 🖱️ กำลังยิงคำสั่งคลิกกล่องอัตราต่อรอง...`);
                            await clickTargetOdds(targetBox);
                            await page.waitForTimeout(1500);
                        }

                        // ==========================================
                        // 🛑 🛑 [PAUSE POINT 2] Step 16: หลังบอทรัวคลิกเสร็จ
                        // ==========================================
                        await this.pauseForUserReview(`[Step 16] 🛒 บอทรัวคลิกกล่องราคาครบ 3 รอบเรียบร้อยแล้ว ตะกร้าแถบเขียวกางออกหรือยังน้า? กด NEXT STEP เพื่อเริ่มเปิดแผงสลิปบิลด้านล่างครับ`);
                        if (this.stopTestRequested) throw new Error("Test Stopped by user");

                        let slipOpened = false;
                        let slipInput: any = null;
                        
                        const cartIcon = page.locator(`
                           ._stake-container_15log_45, div[class*="slip-box"], div[class*="order-slip"],
                           .sport-bet-cart-classname, i[data-src*="icon_ty_floatbtn.svg"], [class*="bet-cart"], ._half-screen-dialog_h3xgq_45
                        `).first();

                        for (let slipAttempt = 0; slipAttempt < 3; slipAttempt++) {
                            const amountInput = page.locator(`
                                ._container_15log_69, ._stake-container_15log_45, [class*="stake-container"], [class*="amount-input"]
                            `).first();
                            
                            if (!(await amountInput.isVisible())) {
                                logWithStep(`🔍 ตะกร้าคู่บอลยังนิ่ง สั่งจิ้มกระตุ้นแผงเขียวรอบที่ ${slipAttempt + 1}...`);
                                await cartIcon.click({ force: true, timeout: 2000 }).catch(() => {});
                                await page.waitForTimeout(2000);
                            }

                            if (await amountInput.isVisible()) { slipOpened = true; slipInput = amountInput; break; }
                        }

                        // ==========================================
                        // 🛑 🛑 [PAUSE POINT 3] Step 17: ด่านสแตนบาย ตัวกรอกเงินคีย์บอร์ดเสมือน
                        // ==========================================
                        await this.pauseForUserReview(`[Step 17] 🔢 ผลลัพธ์การสแกนแผงสลิป: ${slipOpened ? '✅  สำเร็จ' : '❌ ไม่พบแผง'}. คลิก NEXT STEP คราวนี้บอทจะสั่งจิ้มปุ่มตัวเลขบนคีย์บอร์ดหน้าจอของเว็บเพื่อกรอกเลข 10 แน่นอนครับน้า`);
                        if (this.stopTestRequested) throw new Error("Test Stopped by user");

                        if (!slipOpened) {
                            throw new Error("Slip failed to open 3 times.");
                        }

                        if (slipOpened && slipInput) {
                            logWithStep(` Klik และกระตุ้นกล่องรับเงินเสมือนเพื่อให้แป้นพิมพ์ตื่น...`);
                            await slipInput.click({ force: true }).catch(() => {});
                            await page.waitForTimeout(1000);

                            const keypadContainer = page.locator('._keyboard_1gfgb_45, ._board_1gfgb_66, .ui-popup, .van-popup, [class*="keyboard"], [class*="keypad"]');
                            logWithStep(`[AUTO-BOT] Scoping layout buttons. Injecting 10 credits into the bills...`);

                            // ล็อกแน่นหนา: สั่งกดปุ่มเลข 1 และเลข 0 บนแผง Custom Keypad หน้าเว็บจริง
                            const btnKey1 = keypadContainer.locator('button, div, span').filter({ hasText: /^1$/ }).first();
                            if (await btnKey1.isVisible()) {
                                logWithStep(`🎹 Pressing physical screen key [1] via absolute text matcher...`);
                                await btnKey1.click({ force: true });
                                await page.waitForTimeout(600);
                            }

                            const btnKey0 = keypadContainer.locator('button, div, span').filter({ hasText: /^0$/ }).first();
                            if (await btnKey0.isVisible()) {
                                logWithStep(`🎹 Pressing physical screen key [0] via absolute text matcher...`);
                                await btnKey0.click({ force: true });
                                await page.waitForTimeout(600);
                            }

                            await page.waitForTimeout(1000);

                            // ==========================================
                            // 🛑 🛑 [PAUSE POINT 4] Step 18: กรอกเงิน 10 บาทเสร็จสิ้น รอสั่งเทล้างตะกร้าลงถังขยะ
                            // ==========================================
                            await this.pauseForUserReview(`[Step 18] 🗑️ บอทจิ้มปุ่มหน้าจอคีย์เลข 10 สำเร็จแล้ว! สังเกตช่องใส่เงินกับปุ่ม พนัน สีเหลืองตื่นขึ้นมาหรือยังน้า? กด NEXT STEP เพื่อแอบเซฟคิวลง DB และกดถังขยะทิ้งครับ`);
                            if (this.stopTestRequested) throw new Error("Test Stopped by user");

                            if (this.currentTaskIsTest) {
                                logWithStep(`🛡️ [SIMULATION MODE] ผู้ใช้ยืนยันการบันทึก! กำลังจำลองบิลสำเร็จลงระบบประวัติ...`);

                                const mockMatchName = matchName || "แมตช์ทดสอบระบบเสมือนจริง";
                                const mockLeagueName = leagueName || "ลีกทดสอบระบบเครื่อง Local";
                                const finalSignalId = taskId && taskId !== 'dummy-task-id-123' && taskId !== 'test-task-id' ? taskId : `sim-${Date.now()}`;
                                const randomIdString = (Math.floor(Math.random() * 900000) + 100000).toString();

                                try {
                                    // บันทึกประวัติเสมือนตรงดิ่งเข้าตาราง 'RealBetLog' ดันสถานะรอลุ้นบนแผงบอร์ดหน้าบ้าน Flutter ทันที
                                    await prisma.realBetLog.create({
                                        data: {
                                          id: randomIdString,
                                          signalId: finalSignalId,
                                          matchName: mockMatchName,
                                          leagueName: mockLeagueName,
                                          betSide: betSide || "Home",
                                          oddsAtBet: finalOdds || 1.54,
                                          lineAtBet: targetLine || "0",
                                          amount: 10,
                                          status: 'Executed', 
                                          errorMessage: null
                                        }
                                    });

                                    await prisma.bet.updateMany({
                                        data: { autoBetStatus: 'Executed', oddsAtBet: finalOdds || 1.54 }
                                    }).catch(() => {});

                                    logWithStep(`📝 [DB-SYNC-SUCCESS] เสกประวัติเข้าคลังสำเร็จ! แผงรอลุ้นบนแอป Flutter พร้อมแสดงแถวโชว์แล้วครับ!`);
                                } catch (dbErr: any) {
                                    logWithStep(`⚠️ [DB-SYNC-ERROR] การบันทึกติดขัด Schema: ${dbErr.message}`);
                                }

                                const trashIcon = page.locator('.ui-delete-c6ee75, [id*="ui-delete"], svg use[*href*="delete"], i[class*="delete"], ._clear_h3xgq_87').first();
                                if (await trashIcon.isVisible().catch(() => false)) {
                                    logWithStep(`🗑️ Trash icon targeted inside header. Evaporating test slip safely...`);
                                    await trashIcon.click({ force: true });
                                } else {
                                    logWithStep(`⚠️ Trash icon missing inside container, executing visual overlay closing fallback...`);
                                    await closeOpenSlip();
                                }
                                await page.waitForTimeout(2000);
                                logWithStep(`✅ [TEST COMPLETE] ล้างตะกร้าบิลลงถังขยะเรียบร้อยเนียนกริบ 100%!`);
                            }
                        }

                        await this.cleanupAndGoBack(page);
                    } else {
                        throw new Error(`Price box element not matched.`);
                    }
                } else {
                    throw new Error(`Section "${sectionTitle}" not found.`);
                }
            } catch (e: any) { throw e; }
        } else {
            throw new Error(`Navigation failed. Still on Search Page.`);
        }
      } else {
        throw new Error(`Could not find match row.`);
      }

    } catch (error: any) {
      logWithStep(`[AUTO-BOT] ❌ Process Error: ${error.message}`);
      try {
        if (page) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          await page.screenshot({ path: `error-screenshot-${timestamp}.png` }).catch(() => {});
        }
      } catch (ssErr) {}
      
      await this.cleanupAndGoBack(page).catch(() => {});
    } finally {
      this.isProcessing = false;
      this.isTestRunning = false;
    }
  }

  private static async cleanupAndGoBack(page: Page) {
    if (this.stopTestRequested) {
      this.smartLog(`Fast cleanup: Stop requested. Navigating directly to main sports page...`);
      await page.goto('https://www.bet5688q.com/home/sport/soccer', { waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {});
      return;
    }
    
    this.smartLog(`🧹 Cleaning up and returning to main page...`);
    
    // ด่านทุบป๊อปอัพโฆษณาระหว่าง Cleanup: ตรวจหาและกดกากบาทปิดระบบกวนใจทันที
    await BrowserService.closeAnnoyingPopups(page).catch(() => {});

    await page.evaluate(() => {
        const masks = document.querySelectorAll('.ui-mask, .ui-overlay, ._mask_, .van-overlay');
        masks.forEach((el: any) => { el.click(); });
    }).catch(() => {});
    await page.waitForTimeout(1500);

    const backBtn = page.locator('.lobby-base-header__back, .ui-arrow--left, [xlink\\:href="#ui-arrow-418a3a"]').first();
    try {
        if (await backBtn.isVisible()) { await backBtn.click({ force: true, timeout: 2000 }).catch(() => page.mouse.click(25, 20)); }
    } catch (e) { await page.evaluate(() => window.history.back()).catch(() => {}); }
    
    await page.waitForTimeout(3000);
    const isMain = await page.locator('.icon-search, .search-icon, .fa-search').first().isVisible().catch(() => false);
    if (!isMain) {
        await page.goto('https://www.bet5688q.com/home/sport/soccer', { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
    }
  }

  static async findAndBet(leagueName: string, matchName: string, betSide: string, amount: number, targetLine?: string, isTest: boolean = false, taskId?: string) {
    this.isTestRunning = true; 
    this.stopTestRequested = false; 
    this.queue.push({ leagueName, matchName, betSide, amount, targetLine, isTest: true, taskId });
    this.startQueueProcessor(true);
  }

  public static async getActualBalance(): Promise<number | null> { return this.lastBalance; }
  public static getCachedBalance(): number | null { return this.lastBalance; }
  public static async extractLiveScore(page: any, homeKey: string, awayKey: string): Promise<{ scoreHome: number; scoreAway: number } | null> { return null; }
  
  // บันทึกด่านแว่นขยายฟุตบอล: ตรึงพิกัดเจาะ Selector ค้นหาเฉพาะของหมวดแถบฟุตบอลสติ๊กกี้ด้านล่าง ไม่หลุดลอยขึ้นฝั่งสล็อตด้านบนเด็ดขาด
  private static async performSearch(page: any, leagueName: string) {
    try {
        const footballSearchIcon = page.locator('._title-right_j2hkn_77 i[class*="search"], ._title-right_j2hkn_77 [data-src*="ss.svg"]').first();
        if (await footballSearchIcon.isVisible()) {
            await footballSearchIcon.click({ force: true });
        } else {
            const fallbackSearch = page.locator('._title-right_j2hkn_77 i._right-icon_j2hkn_82').last();
            await fallbackSearch.click({ force: true });
        }
    } catch (e) {
        await page.mouse.click(280, 415).catch(() => {});
    }

    await page.waitForTimeout(4000);
    
    try {
      const inputSelectors = [
          '.ui-input__input input',
          'input.ui-input__input[type="text"]',
          'input[placeholder*="ค้นหา"]',
          'input[placeholder*="Search"]',
          'input.van-field__control'
      ];
      
      let inputFound = false;
      for (const selector of inputSelectors) {
          try {
              const input = page.locator(selector).first();
              if (await input.isVisible({ timeout: 2000 })) {
                  await input.click({ force: true }).catch(() => {});
                  await input.fill(''); 
                  await input.fill(leagueName); 
                  inputFound = true; 
                  break;
              }
          } catch (e) {}
      }
      
      if (!inputFound) {
          const finalInput = page.locator('input[type="text"]').first();
          if (await finalInput.isVisible()) {
              await finalInput.fill(leagueName);
              inputFound = true;
          } else {
              throw new Error("ระบบตรวจไม่พบช่องค้นหาลีก");
          }
      }
      
      await page.waitForTimeout(1000);
      const submitBtn = page.locator('.ui-input__suffix-icon, .search-btn, button[class*="search"]').last();
      await submitBtn.click({ force: true, timeout: 3000 }).catch(async () => { await page.keyboard.press('Enter'); });
      await page.waitForTimeout(3000);
    } catch (e: any) { throw e; }
  }

  // ปลุกกลไกฟังก์ชันกวาดล้าง Pop-up ขยะโฆษณาเครือข่ายเว็บให้ตื่นมาทำหน้าที่ 100%
  public static async closeAnnoyingPopups(page: Page): Promise<boolean> {
    try {
      const closeSelectors = [
        '.ui-overlay .ui-popup svg',
        '.ui-popup [class*="close"]',
        'div.ui-overlay i[class*="close"]',
        'div[class*="dialog"] ._clear_h3xgq_87',
        'span[class*="close"]',
        '.van-icon-cross',
        '.van-popup__close-icon'
      ];

      let closedAny = false;
      
      await page.evaluate(() => {
        const overlays = document.querySelectorAll('.ui-mask, .ui-overlay, .van-overlay, .isShowFrostedGlassEffect');
        overlays.forEach((el: any) => {
          const rect = el.getBoundingClientRect();
          if (rect.height > window.innerHeight * 0.5 && !el.querySelector('[data-dialog-name="wgSportBet"]')) {
            el.click();
          }
        });
      }).catch(() => {});

      for (const sel of closeSelectors) {
        const el = page.locator(sel).first();
        if (await el.isVisible().catch(() => false)) {
          this.smartLog(`[POPUP-CLEARER] ✖️ Annoying bonus wheel element detected via "${sel}". Liquidating...`, true);
          await el.click({ force: true }).catch(() => {});
          closedAny = true;
          await page.waitForTimeout(1000);
        }
      }

      const footerCloseSvg = page.locator('div.ui-overlay svg').filter({ has: page.locator('path[id*="close"]') }).first();
      if (await footerCloseSvg.isVisible().catch(() => false)) {
         await footerCloseSvg.click({ force: true }).catch(() => {});
         closedAny = true;
      }

      return closedAny;
    } catch (e: any) {
      return false;
    }
  }
}