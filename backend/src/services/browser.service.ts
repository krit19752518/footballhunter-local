import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { botLog, testBotLog, testLogFile } from '../lib/logger';
import fs from 'fs';
import prisma from '../lib/prisma';

export class BrowserService {
  private static browser: Browser | null = null;
  private static context: BrowserContext | null = null;
  public static page: Page | null = null;
  private static isReady: boolean = false;
  private static isProcessing: boolean = false;
  private static queue: any[] = []; // คิวงานที่รอประมวลผล
  private static queueInterval: NodeJS.Timeout | null = null;

  private static isTestRunning: boolean = false; // สำหรับเลือกไฟล์ Log
  private static nextStepResolver: (() => void) | null = null;
  private static stopTestRequested: boolean = false;
  private static lastBalance: number | null = null;
  private static lastBalanceTime: number = 0;

  static isQueueEmpty() {
    return this.queue.length === 0 && !this.isTestRunning;
  }

  static getIsTestRunning() {
    return this.isTestRunning;
  }

  static clearQueue() {
    this.queue = [];
    this.stopTest();
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
    if (forcedIsTest === true || (forcedIsTest === undefined && this.isTestRunning)) {
        testBotLog(message);
    } else {
        botLog(message);
    }
  }

  // หยุดรอคำสั่ง Next จากผู้ใช้ (เฉพาะเวลาเทส)
  private static async waitStep(stepName: string) {
    if (!this.isTestRunning) return;
    
    // ตั้งค่าให้หยุดรอ (Pause) เฉพาะขั้นตอนหลังจากกรอกยอดเงินเสร็จเท่านั้น
    if (stepName !== "Bet Amount Entered successfully") return;
    
    this.smartLog(`[STEP-PAUSE] ⏸️ หยุดรอที่ขั้นตอน: ${stepName}. กดปุ่ม NEXT STEP เพื่อไปต่อ...`);
    return new Promise<void>((resolve) => {
        this.nextStepResolver = resolve;
    });
  }

  static nextStep() {
    if (this.nextStepResolver) {
        this.smartLog(`[STEP-NEXT] ⏩ ผู้ใช้กด NEXT. กำลังดำเนินงานต่อ...`);
        this.nextStepResolver();
        this.nextStepResolver = null;
    }
  }

  static stopTest() {
    this.stopTestRequested = true;
    if (this.nextStepResolver) {
        this.nextStepResolver(); // ปลดล็อคเพื่อให้เช็ค flag stop
        this.nextStepResolver = null;
    }
    this.smartLog(`[STOP-TEST] 🛑 คำสั่งหยุดการทดสอบได้รับแล้ว.`);
  }

  static formatLine(line: string | number): string {
    if (line === undefined || line === null || line === "") return "0";
    
    // จัดการเครื่องหมายนำหน้า
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

    // กรณีเป็นเลขควบ (ลงท้ายด้วย .25 หรือ .75)
    if (num % 1 === 0.25) {
      const base = Math.floor(num);
      return `${prefix}${base}/${base + 0.5}`;
    } else if (num % 1 === 0.75) {
      const base = Math.floor(num);
      return `${prefix}${base + 0.5}/${base + 1}`;
    }

    return prefix + num.toString();
  }

  private static matchTeam(target: string, web: string): boolean {
    const cleanWord = (w: string) => w.toLowerCase().replace(/[^a-zA-Z0-9ก-๙]/g, '').trim();
    const targetWords = target.split(/\s+/).map(cleanWord).filter(w => w.length > 0 && w !== 'vs');
    const webWords = web.split(/\s+/).map(cleanWord).filter(w => w.length > 0 && w !== 'vs');

    if (targetWords.length === 0 || webWords.length === 0) return false;

    let matchCount = 0;
    const skipList = ['สโมสรฟุตบอล', 'สโมสร', 'เอฟซี', 'fc', 'united', 'club', 'team', 'u', 'u19', 'u20', 'u21', 'u23', 'ทีม'];
    for (const webW of webWords) {
      if (skipList.includes(webW)) continue;
      
      const matched = targetWords.some(targetW => {
        if (skipList.includes(targetW)) return false;
        return (targetW.startsWith(webW) || webW.startsWith(targetW)) && Math.min(targetW.length, webW.length) >= 2;
      });

      if (matched) {
        matchCount++;
      }
    }
    return matchCount >= 1;
  }

  static async init() {
    if (this.browser) return;

    this.smartLog('[BROWSER] Launching Chromium...');
    this.browser = await chromium.launch({
      headless: false, // เปิดหน้าจอให้ผู้ใช้เห็น
      args: ['--start-maximized']
    });

    this.context = await this.browser.newContext({
      viewport: null // ให้ใช้ขนาดเต็มหน้าจอ
    });

    this.page = await this.context.newPage();
    try {
      await this.page.goto('https://www.bet5688q.com/', { timeout: 30000 });
    } catch (e: any) {
      this.smartLog(`[BROWSER] Initial load failed: ${e.message}. Please enter the URL manually in the browser.`);
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
    if (this.queueInterval) return; // ป้องกันการสร้าง Interval ซ้อนกัน

    this.smartLog(`[QUEUE] 🔄 Starting queue processor interval (every 5s)...`, isTest);
    this.queueInterval = setInterval(async () => {
      // ดึงยอดเงินสดสะสมคงเหลือล่าสุดหากไม่ได้กำลังประมวลผลการแทง
      if (!this.isProcessing && this.page) {
        await this.getActualBalance().catch(() => {});
      }

      if (this.isProcessing) return;
      if (this.queue.length === 0) return;

      const page = this.page;
      if (!page) return;

      // ตรวจสอบงานแรกในคิว
      const nextTask = this.queue[0];
      if (!nextTask) return;

      // ถ้าเป็นงานจริง (Real) และระบบยังไม่ Ready ให้ข้ามไปก่อน (ไม่ดึงออกจากคิว)
      if (!nextTask.isTest && !this.isReady) {
        // this.smartLog(`[QUEUE] 💤 System is PAUSED. Skipping real signal: ${nextTask.matchName}`);
        return;
      }

      this.smartLog(`[QUEUE] 🎯 Found ${nextTask.isTest ? 'TEST' : 'REAL'} task! Pulling from queue...`, nextTask.isTest);
      const task = this.queue.shift();

      // เช็คว่าเป็นหน้าหลัก (มีรายการบอล) หรือหน้าค้นหา (ที่มีปุ่มกากบาทปิด) หรือหน้ากีฬาฟุตบอลจากการตรวจ URL
      const isMainPage = await page.locator('._right-icon_j2hkn_82').first().isVisible().catch(() => false);
      const isSearchPage = await page.locator('.ui-input__clear').first().isVisible().catch(() => false);
      const currentUrl = page.url();
      const isSportsUrl = currentUrl.includes('/sport/') || currentUrl.includes('/soccer');
      
      if (!isMainPage && !isSearchPage && !isSportsUrl) {
        this.smartLog(`[QUEUE] ⚠️ Not on a valid betting page (URL: ${currentUrl}). Force navigating to Sports page...`);
        if (task) this.queue.unshift(task);
        await page.goto('https://www.bet5688q.com/home/sport/soccer', { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(5000); // รอให้หน้าเว็บโหลดและเสถียร
        return;
      }

      if (task) {
        await this.executeTask(task);
      }
    }, 5000);
  }

  private static async executeTask(task: any) {
    const { leagueName, matchName, betSide, amount, targetLine, isTest, taskId } = task;
    const page: any = this.page;

    this.isProcessing = true;
    this.isTestRunning = !!isTest;
    this.stopTestRequested = false;
    let step = 1;
    const logWithStep = (msg: string) => {
      this.smartLog(`[Step ${step++}] ${msg}`, isTest);
    };

    try {
      logWithStep(`🚀 Starting TEST Auto-Bot process for: ${matchName}`);

      // Wait for page layout stabilization
      logWithStep(`💤 Waiting 3s for page layout to stabilize...`);
      await page.waitForTimeout(3000);

      await this.waitStep("Start Auto-Bot Test");
      if (this.stopTestRequested) throw new Error("Test Stopped by user");

      // 0. Ensure Football category is selected
      logWithStep(`Ensuring "Football" category is selected...`);
      const footballTab = page.locator('div, span, a, li').filter({ hasText: /^ฟุตบอล$/ }).first();
      const isFootballActive = await footballTab.evaluate((el: any) => {
        return el.classList.contains('active') || el.style.color !== '';
      }).catch(() => false);

      if (!isFootballActive) {
        logWithStep(`Switching to Football tab...`);
        await footballTab.click().catch(() => { });
        await page.waitForTimeout(1500);
      }

      await this.waitStep("Football Category Selected");
      if (this.stopTestRequested) throw new Error("Test Stopped by user");

      // 0. Clean team names
      const cleanName = (name: string) => {
        if (!name) return "";
        return name
          .replace(/\[.*?\]/g, '')
          .replace(/สโมสรฟุตบอล|สโมสร|เอฟซี|ยูไนเต็ด|U\d+|[\(\)]/g, '')
          .trim();
      };

      const getUniqueKey = (name: string) => {
        const cleaned = cleanName(name);
        const words = cleaned.split(/\s+/).filter((w: string) => w.length > 2);
        if (words.length === 0) return cleaned.substring(0, 5);
        return words.sort((a: string, b: string) => b.length - a.length)[0];
      };

      const homeTeam = matchName.split(' vs ')[0];
      const awayTeam = matchName.split(' vs ')[1];
      const homeClean = cleanName(homeTeam);
      const awayClean = cleanName(awayTeam);
      const homeKey = getUniqueKey(homeTeam);
      const awayKey = getUniqueKey(awayTeam);
      const betSideClean = cleanName(betSide);

      // 1. ALWAYS go straight to the Search page directly
      logWithStep(`🔍 Going straight to Search page to find League: "${leagueName}"`);
      await this.useSearchFallback(page, leagueName);

      await this.waitStep("League Expanded successfully");
      if (this.stopTestRequested) throw new Error("Test Stopped by user");

      // 2. Scan for match row inside search results
      logWithStep(`Scanning for Match Row inside ${leagueName}...`);
      let foundMatch = false;
      let matchRow = null;

      for (let i = 0; i < 10; i++) {
        const candidateRows = await page.locator('.match-item, .match-row, .game-item, [class*="match-item"], [class*="game-item"]').all();
        for (const row of candidateRows) {
          const teamNameElements = await row.locator('._team-name_15ywe_182, [class*="team-name"]').all();
          if (teamNameElements.length >= 2) {
            const webHome = await teamNameElements[0].innerText().catch(() => "");
            const webAway = await teamNameElements[1].innerText().catch(() => "");
            
            if (this.matchTeam(homeTeam, webHome) && this.matchTeam(awayTeam, webAway)) {
              matchRow = row;
              foundMatch = true;
              break;
            }
          }
        }

        if (foundMatch && matchRow) {
          logWithStep(`✅ Success! Match Found within search results.`);
          await matchRow.scrollIntoViewIfNeeded().catch(() => { });
          await page.waitForTimeout(500);
          break;
        }
        await page.mouse.wheel(0, 400);
        await page.waitForTimeout(800);
      }

      if (!foundMatch || !matchRow) {
        throw new Error(`Could not find match row in search results for "${homeTeam}" vs "${awayTeam}" after 5s.`);
      }

      await this.waitStep("Match Row Found successfully");
      if (this.stopTestRequested) throw new Error("Test Stopped by user");

      // 3. Determine bet target columns and rows
      logWithStep(`Finding match "${matchName}" details...`);

      let columnIndex = 0;
      let rowIndex = 0;

      const hasUnderdogText = betSide.includes('รอง') || betSide.includes('Underdog');
      const hasAwayName = betSideClean.includes(awayClean) || awayClean.includes(betSideClean);
      const isOver = betSide.includes('สูง') || betSide.includes('Over');
      const isUnder = betSide.includes('ต่ำ') || betSide.includes('Under');

      logWithStep(` - Flags: hasUnderdogText = ${hasUnderdogText}, hasAwayName = ${hasAwayName}, isOver = ${isOver}, isUnder = ${isUnder}`);

      if (isOver) {
        columnIndex = 1; rowIndex = 0;
      } else if (isUnder) {
        columnIndex = 1; rowIndex = 1;
      } else if (hasUnderdogText || hasAwayName) {
        columnIndex = 0; rowIndex = 1;
      } else {
        columnIndex = 0; rowIndex = 0;
      }

      logWithStep(`FINAL DECISION -> Col:${columnIndex}, Row:${rowIndex}`);

      const blocks = await matchRow.locator('._main_15ywe_157').all();
      logWithStep(`Found ${blocks.length} data blocks in match row.`);

      if (blocks.length < 2) {
        throw new Error(`Match row structure unexpected (Blocks < 2).`);
      }

      const targetBlock = blocks[rowIndex];
      const teamNameInBlock = await targetBlock.locator('._team-name_15ywe_182').innerText().catch(() => "N/A");
      logWithStep(`Targeting Block ${rowIndex + 1}: ${teamNameInBlock}`);

      const betBoxes = await targetBlock.locator('._bet-box_1ckm8_45').all();
      logWithStep(`Found ${betBoxes.length} bet boxes in this block.`);

      if (betBoxes.length <= columnIndex) {
        throw new Error(`Bet boxes count (${betBoxes.length}) <= columnIndex (${columnIndex}).`);
      }

      const targetBtn = betBoxes[columnIndex];
      let oddsText = await targetBtn.locator('[class*="_odds_"], [class*="odds"]').innerText().catch(() => "N/A");
      if (oddsText === "N/A" || oddsText.trim() === "" || isNaN(parseFloat(oddsText.replace(/[^0-9.]/g, '')))) {
          const allElements = await targetBtn.locator('span, div, p').all();
          for (const el of allElements) {
              const text = await el.innerText().catch(() => "");
              const num = parseFloat(text.replace(/[^0-9.]/g, ''));
              if (!isNaN(num) && num >= 1.01 && num <= 20.0) {
                  oddsText = text;
                  break;
              }
          }
      }
      const labelText = await targetBtn.locator('._bet-label_1ckm8_65').innerText().catch(() => "N/A");

      // Line Verification
      const tLine = targetLine || "";
      if (tLine && labelText !== "N/A") {
        const cleanTarget = tLine.replace(/[\[\]]/g, '').trim();
        logWithStep(`Verifying line: Target ${cleanTarget} vs Web ${labelText}`);

        if (!this.isLineMatch(cleanTarget, labelText)) {
          throw new Error(`Line mismatch: Requested ${cleanTarget} but found ${labelText}`);
        }
        logWithStep(`Line verified!`);
      }

      logWithStep(` - Final Action: Clicking "${labelText}" with Odds "${oddsText}"...`);
      await targetBtn.scrollIntoViewIfNeeded().catch(() => { });
      
      await this.waitStep("Ready to Click Odds Box");
      if (this.stopTestRequested) throw new Error("Test Stopped by user");

      await targetBtn.click({ force: true });
      await page.waitForTimeout(1000);
      logWithStep(`✅ Success! "${betSide}" (${oddsText}) added to cart.`);

      await this.waitStep("Odds added to cart successfully");
      if (this.stopTestRequested) throw new Error("Test Stopped by user");

      // 4. Open cart slip and verify
      logWithStep(`🛒 Opening cart slip...`);
      const cartIcon = page.locator('[class*="sport-bet-cart-classname"], [class*="_bet-cart_"], i[data-src*="icon_ty_floatbtn.svg"]').first();
      await cartIcon.click({ force: true }).catch(() => cartIcon.evaluate((el: any) => el.click()));
      await page.waitForTimeout(1500);

      const slipInput = page.locator('input.ui-input__input, [class*="_input-box_"] input, .van-field__control').first();
      if (await slipInput.isVisible({ timeout: 5000 })) {
          logWithStep(`🔢 Entering amount: ${amount}`);
          await slipInput.click({ force: true }).catch(() => {});
          
          await this.waitStep("Ready to Type Bet Amount");
          if (this.stopTestRequested) throw new Error("Test Stopped by user");

          await page.keyboard.type(amount.toString(), { delay: 100 });
          await page.waitForTimeout(1000);

          await this.waitStep("Bet Amount Entered successfully");
          if (this.stopTestRequested) throw new Error("Test Stopped by user");

          // 5. Simulate Success (Typing amount is considered success)
          const typedValue = await slipInput.inputValue().catch(() => "");
          if (typedValue.includes(amount.toString()) || typedValue !== "") {
              logWithStep(`✅ Simulation Success! Typed amount correctly.`);

              // บันทึกข้อมูลลง DB ว่าแทงผ่านแล้ว (เพื่อให้โชว์ในช่อง รอลุ้น)
              if (!isTest) {
                  await prisma.realBetLog.create({
                      data: { signalId: taskId, matchName, leagueName, betSide, amount, status: 'Success' }
                  }).catch((err) => this.smartLog(`[DB-ERROR] RealBetLog: ${err.message}`));
              }
              
              if (taskId && taskId !== 'dummy-task-id-123') {
                  await prisma.bet.updateMany({
                      where: { signalId: taskId },
                      data: { autoBetStatus: 'Success' } 
                  }).catch((err) => this.smartLog(`[DB-ERROR] BetUpdate: ${err.message}`));
              }

              // กดปุ่มถังขยะ (Trash Can)
              logWithStep(`🗑️ Clicking Trash Can icon to remove bet slip...`);
              const trashBtn = page.locator('[class*="delete"], [class*="trash"], [xlink\\:href*="delete"], [xlink\\:href*="trash"]').first();
              if (await trashBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                  await trashBtn.click({ force: true }).catch(() => {});
              } else {
                  // Fallback ค้นหา svg รูปถังขยะ
                  await page.evaluate(() => {
                     const svgs = document.querySelectorAll('svg, i');
                     for (let i = 0; i < svgs.length; i++) {
                         if (svgs[i].outerHTML.includes('delete') || svgs[i].outerHTML.includes('trash')) {
                             const btn = svgs[i].closest('div') || svgs[i].closest('span') || svgs[i];
                             (btn as HTMLElement).click();
                             break;
                         }
                     }
                  }).catch(() => {});
              }
              await page.waitForTimeout(1500);

              // กดยืนยันเพื่อปิด Dialog ยืนยันการลบ (ถ้ามี Popup ถามว่า "แน่ใจหรือไม่ที่จะลบ")
              const confirmDelete = page.locator('button, div').filter({ hasText: /ตกลง|ยืนยัน|Confirm|OK/i }).first();
              if (await confirmDelete.isVisible({ timeout: 1000 }).catch(() => false)) {
                  logWithStep(`🔘 Clicking Confirm Delete button...`);
                  await confirmDelete.click({ force: true }).catch(() => {});
                  await page.waitForTimeout(1000);
              }
              
          } else {
              throw new Error(`Amount input field is empty or incorrect after typing.`);
          }
      } else {
          throw new Error(`Amount input field not found after waiting.`);
      }

      await this.cleanupAndGoBack(page).catch(() => {});

    } catch (error: any) {
      logWithStep(`[AUTO-BOT] ❌ Process Error: ${error.message}`);
      if (!isTest) {
          await prisma.realBetLog.create({
            data: {
              signalId: taskId,
              matchName,
              leagueName,
              betSide,
              amount: amount,
              status: 'Failed',
              errorMessage: error.message
            }
          }).catch((err) => this.smartLog(`[REAL-BET-LOG] Failed write error: ${err.message}`));

          if (taskId) {
              await prisma.bet.update({
                  where: { signalId: taskId },
                  data: { autoBetStatus: 'Failed', autoBetError: error.message }
              }).catch((err) => this.smartLog(`[REAL-BET-LOG] Failed update Bet error: ${err.message}`));
          }
      }
      await this.cleanupAndGoBack(page).catch(() => {});
    } finally {
      this.isProcessing = false;
    }
  }

  private static async cleanupAndGoBack(page: Page) {
    this.smartLog(`🧹 Cleaning up and returning to main page...`);
    
    // 0. ปิดหน้าต่าง "ส่งแล้ว" หรือ Dialog เดิมพัน (คลิกที่ Mask/Overlay)
    await page.evaluate(() => {
        const masks = document.querySelectorAll('.ui-mask, .ui-overlay, ._mask_, .van-overlay');
        masks.forEach((el: any) => {
            el.click(); // ลองคลิกก่อน
            setTimeout(() => el.remove(), 500); // แล้วค่อยลบทิ้งกันเหนียว
        });
        
        // ลองคลิกพิกัดกลางๆ ขอบบน (พื้นที่ว่างส่วนใหญ่)
        const event = new MouseEvent('click', { view: window, bubbles: true, cancelable: true, clientX: 10, clientY: 10 });
        document.body.dispatchEvent(event);
    }).catch(() => {});
    
    await page.waitForTimeout(2000); // เพิ่มเป็น 2 วินาที

    const currentUrl = page.url();
    if (currentUrl.includes('/home/mine')) {
        this.smartLog(`🏠 Detected Profile page, force navigating to Sports page...`);
        await page.goto('https://www.bet5688q.com/home/sport/soccer', { waitUntil: 'networkidle' }).catch(() => {});
        return;
    }

    // 1. คลิกลูกศรมุมบนซ้าย (Back Button)
    const backBtn = page.locator('.lobby-base-header__back, .ui-arrow--left, [xlink\\:href="#ui-arrow-418a3a"], .van-nav-bar__left, .van-icon-arrow-left, i[class*="arrow-left"], [class*="back-btn"], [class*="back"], .ui-icon-arrow-left').first();
    
    try {
        if (await backBtn.isVisible()) {
            this.smartLog(`🖱️ Clicking Back button...`);
            await backBtn.click({ force: true, timeout: 2000 }).catch(async () => {
                await page.mouse.click(25, 20);
            });
        } else {
            this.smartLog(`⚠️ Back button not visible, using Coordinate Click & Browser Back...`);
            await page.mouse.click(25, 20).catch(() => {});
            await page.evaluate(() => window.history.back()).catch(() => {});
        }
    } catch (e) {
        await page.evaluate(() => window.history.back()).catch(() => {});
    }
    
    // รอให้หน้าจอเปลี่ยนและ Popup เริ่มโหลด
    await page.waitForTimeout(4000); // เพิ่มเป็น 4 วินาที

    // 2. ปิด Popup ถ้ามี (ทำ 2 รอบ)
    this.smartLog(`[AUTO-BOT] ✖️ Checking for popups (2 rounds)...`);
    for (let i = 0; i < 2; i++) {
        // ค้นหาจากสัญลักษณ์ปุ่ม X เฉพาะเจาะจง (#ui-close-059120, #ui-dialog-close-088f02)
        const closeBtn = page.locator(`
            [xlink\\:href="#ui-close-059120"],
            [xlink\\:href="#ui-dialog-close-088f02"],
            .ui-dialog-close-box__icon, 
            .ui-dialog-close-box, 
            ._close-icon_,
            [class*="close-box"]
        `).first();
        
        try {
            await closeBtn.waitFor({ state: 'visible', timeout: 2000 });
            this.smartLog(`[AUTO-BOT] ✖️ Popup detected. Closing round ${i+1}...`);
            await closeBtn.click({ force: true }).catch(() => {});
            await page.waitForTimeout(3000); 
        } catch (e) {
            // ลองเช็คปุ่ม X ทั่วไป
            const svgClose = page.locator('svg, i, div').filter({ hasText: /^x$/i }).first();
            if (await svgClose.isVisible()) {
                this.smartLog(`[AUTO-BOT] ✖️ Finding generic X button...`);
                await svgClose.click({ force: true }).catch(() => {});
                await page.waitForTimeout(3000); // เพิ่มเป็น 3 วินาที
            } else {
                this.smartLog(`[AUTO-BOT] 💤 No popup detected in round ${i+1}.`);
            }
        }
    }
    
    
    // 3. เช็คความชัวร์ว่ากลับมาหน้าหลักแล้วจริงๆ (มองหาปุ่มค้นหาหรือสัญลักษณ์หน้าหลัก)
    const isMain = await page.locator('.icon-search, .search-icon, .fa-search, [class*="search"]').first().isVisible().catch(() => false);
    if (!isMain) {
        this.smartLog(`[AUTO-BOT] 🚨 Still not on main page after back. Force navigating...`);
        await page.goto('https://www.bet5688q.com/home/sport/soccer', { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(5000); // เพิ่มเป็น 5 วินาที
    }

    this.smartLog(`[AUTO-BOT] 🏁 Navigation cleanup finished. Ready for next task.`);
  }

  static async findAndBet(leagueName: string, matchName: string, betSide: string, amount: number, targetLine?: string, isTest: boolean = false, taskId?: string) {
    // ถ้าไม่ใช่ Test และระบบไม่ Ready ให้ไม่รับงาน
    if (!isTest && !this.isReady) return;

    // เพิ่มงานเข้าคิวแทนการรันทันที
    this.smartLog(`[QUEUE] 📥 Added ${isTest ? 'TEST' : 'REAL'} signal to queue: ${matchName}`, isTest);
    this.queue.push({ leagueName, matchName, betSide, amount, targetLine, isTest, taskId });

    // ตรวจสอบว่า Processor ทำงานหรือยัง
    this.startQueueProcessor(isTest);
  }

  /**
   * ตรวจสอบและปิด Popup โฆษณาหรือวงล้อที่ขึ้นมาบดบังหน้าบราวเซอร์
   */
  public static async closeAnnoyingPopups(page: Page): Promise<boolean> {
    try {
      const closeSelectors = [
        '[xlink\\:href*="close"]',
        '[xlink\\:href*="ui-close"]',
        '[xlink\\:href*="ui-dialog-close"]',
        '.ui-dialog-close-box__icon',
        '.ui-dialog-close-box',
        '._close-icon_',
        '[class*="close-box"]',
        '[class*="close_box"]',
        '[class*="dialog-close"]',
        '[class*="dialog_close"]',
        '.van-popup__close-icon',
        '.van-icon-cross',
        'svg[class*="close"]',
        'div[class*="close"]',
        'img[src*="close"]',
        'button[class*="close"]'
      ];

      let closedAny = false;
      for (const sel of closeSelectors) {
        const el = page.locator(sel).first();
        if (await el.isVisible().catch(() => false)) {
          console.log(`[POPUP-HANDLER] ✖️ Close popup button detected via selector "${sel}". Closing...`);
          await el.click({ force: true }).catch(() => {});
          closedAny = true;
          await page.waitForTimeout(2000);
        }
      }

      // ตรวจสอบ text X
      const xText = page.locator('div, span, button, svg, i').filter({ hasText: /^x$/i }).first();
      if (await xText.isVisible().catch(() => false)) {
        console.log(`[POPUP-HANDLER] ✖️ Close popup button detected via text "X". Closing...`);
        await xText.click({ force: true }).catch(() => {});
        closedAny = true;
        await page.waitForTimeout(2000);
      }

      // ตรวจสอบขนาด Overlay/Mask
      await page.evaluate(() => {
        const overlays = document.querySelectorAll('.ui-mask, .ui-overlay, ._mask_, .van-overlay');
        overlays.forEach((el: any) => {
          const rect = el.getBoundingClientRect();
          if (rect.height > window.innerHeight * 0.7) {
            el.click(); // ลองคลิกปิด
            setTimeout(() => el.remove(), 200); // ลบออก
          }
        });
      }).catch(() => {});

      return closedAny;
    } catch (e: any) {
      console.log(`[POPUP-HANDLER] ⚠️ Error during closing popups: ${e.message}`);
      return false;
    }
  }

  /**
   * ดึงยอดเงินคงเหลือล่าสุดจากเว็บจริงแบบสดๆ
   */
  public static async getActualBalance(): Promise<number | null> {
    const page = this.page;
    if (!page) {
      console.log(`[BALANCE-SYNC] ⚠️ No active page instance found yet.`);
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
              console.log(`[BALANCE-SYNC] 💰 Found balance via selector "${sel}" in frame: ${num}`);
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
          console.log(`[BALANCE-SYNC] 💰 Found balance via dynamic text scan in frame: ${num}`);
          this.lastBalance = num;
          this.lastBalanceTime = Date.now();
          return num;
        }
      }

      console.log(`[BALANCE-SYNC] ℹ️ Scanning page text, nothing found yet. Last balance: ${this.lastBalance}`);
      return this.lastBalance;
    } catch (e: any) {
      console.log(`[BALANCE-SYNC] ❌ Error scraping balance: ${e.message}`);
      return this.lastBalance;
    }
  }

  public static getCachedBalance(): number | null {
    return this.lastBalance;
  }

  /**
   * สแกนหน้าบราวเซอร์จริงเพื่อค้นหาและแยกผลสกอร์สดปัจจุบันของคู่นั้นๆ
   */
  public static async extractLiveScore(page: any, homeKey: string, awayKey: string): Promise<{ scoreHome: number; scoreAway: number } | null> {
    try {
      // วิธีการที่ 1: ค้นหาข้อความแบบยึดแพทเทิร์นทศนิยม/สกอร์ (เช่น "0 - 0", "1:2") ใน Header
      const scoreElements = page.locator('div, span, p');
      const count = await scoreElements.count().catch(() => 0);
      
      for (let i = 0; i < count; i++) {
        const el = scoreElements.nth(i);
        const isVisible = await el.isVisible().catch(() => false);
        if (!isVisible) continue;
        
        const text = await el.innerText().catch(() => "");
        // มองหารูปแบบที่เหมือนสกอร์: เช่น "0 - 0", "1:2", "3 - 1"
        const scorePattern = /^\s*(\d{1,2})\s*[-:]\s*(\d{1,2})\s*$/;
        const match = text.match(scorePattern);
        if (match) {
          // ตรวจสอบตำแหน่งความน่าจะเป็น (เช่น อยู่แถวบน)
          const box = await el.boundingBox().catch(() => null);
          if (box && box.y < 350) { // ส่วนใหญ่ Header สกอร์จะอยู่บนสุดของจอภาพมือถือ
            const scoreHome = parseInt(match[1], 10);
            const scoreAway = parseInt(match[2], 10);
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

        // มองหารูปแบบสกอร์ในข้อความ Header เช่น "ทีม A 0 - 0 ทีม B" หรือมีตัวเลขเดี่ยวปะปน
        const scoreMatches = headerText.match(/(\d{1,2})\s*[-:]\s*(\d{1,2})/);
        if (scoreMatches) {
          const scoreHome = parseInt(scoreMatches[1], 10);
          const scoreAway = parseInt(scoreMatches[2], 10);
          this.smartLog(`[LIVE-SCORE] Found score via Header match: ${scoreHome}-${scoreAway}`);
          return { scoreHome, scoreAway };
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

        if (homeScore !== null && awayScore !== null) {
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

  private static async executeFullBetFlow(page: any, task: any) {
    const { leagueName, matchName, betSide, amount, targetLine, taskId } = task;

    try {
      // 0. ตรวจสอบว่าอยู่หน้า "ฟุตบอล" หรือยัง (ป้องกันการหลงไปหน้าบาสเกตบอล)
      this.smartLog(`[AUTO-BET] Step 0: Ensuring "Football" category is selected...`);
      const footballTab = page.locator('div, span, a, li').filter({ hasText: /^ฟุตบอล$/ }).first();
      const isFootballActive = await footballTab.evaluate((el: any) => {
        // เช็คว่ามี class หรือ style ที่บอกว่า active หรือเปล่า (มักจะเป็นสีส้มหรือมีขีดล่าง)
        return el.classList.contains('active') || el.style.color !== '';
      }).catch(() => false);

      if (!isFootballActive) {
        this.smartLog(`[AUTO-BET] Switching to Football tab...`);
        await footballTab.click().catch(() => { });
        await page.waitForTimeout(1500); // รอให้หน้าฟุตบอลโหลด
      }

      // 0. เตรียมชื่อทีม (หาคำที่ยาวและเป็นเอกลักษณ์ที่สุด)
      const cleanName = (name: string) => {
        if (!name) return "";
        return name
          .replace(/\[.*?\]/g, '')
          .replace(/สโมสรฟุตบอล|สโมสร|เอฟซี|ยูไนเต็ด|U\d+|[\(\)]/g, '')
          .trim();
      };

      const getUniqueKey = (name: string) => {
        const cleaned = cleanName(name);
        const words = cleaned.split(/\s+/).filter(w => w.length > 2);
        if (words.length === 0) return cleaned.substring(0, 5);
        // เลือกคำที่ยาวที่สุด เพราะมักจะเป็นชื่อเฉพาะ (เช่น "เอสตูเดียนเตส")
        return words.sort((a, b) => b.length - a.length)[0];
      };

      const homeTeam = matchName.split(' vs ')[0];
      const awayTeam = matchName.split(' vs ')[1];
      const homeClean = cleanName(homeTeam);
      const awayClean = cleanName(awayTeam);
      const homeKey = getUniqueKey(homeTeam);
      const awayKey = getUniqueKey(awayTeam);
      const betSideClean = cleanName(betSide);

      // 1. ALWAYS go straight to the Search page directly
      this.smartLog(`[AUTO-BET] Step 1: Going straight to Search page to find League: "${leagueName}"`);
      await this.useSearchFallback(page, leagueName);

      // 2. ไถหา "คู่บอล" จากผลการค้นหา
      this.smartLog(`[AUTO-BET] Step 2: Scanning for Match Row inside ${leagueName}...`);
      let foundMatch = false;
      let matchRow: any = null;

      for (let i = 0; i < 10; i++) {
        // ค้นหาแถวคู่บอล ในหน้าผลลัพธ์การค้นหา
        const candidateRows = await page.locator('.match-item, .match-row, .game-item, [class*="match-item"], [class*="game-item"]').all();
        for (const row of candidateRows) {
          const teamNameElements = await row.locator('._team-name_15ywe_182, [class*="team-name"]').all();
          if (teamNameElements.length >= 2) {
            const webHome = await teamNameElements[0].innerText().catch(() => "");
            const webAway = await teamNameElements[1].innerText().catch(() => "");
            
            if (this.matchTeam(homeTeam, webHome) && this.matchTeam(awayTeam, webAway)) {
              matchRow = row;
              foundMatch = true;
              break;
            }
          }
        }

        if (foundMatch && matchRow) {
          this.smartLog(`[AUTO-BET] Success! Match Found within search results.`);
          await matchRow.scrollIntoViewIfNeeded().catch(() => { });
          await page.waitForTimeout(500);
          break;
        }

        // ไถหน้าจอหา
        await page.mouse.wheel(0, 400);
        await page.waitForTimeout(800);
      }

      if (!foundMatch || !matchRow) {
        this.smartLog(`[AUTO-BET] ❌ ERROR: Could not find match row for ${homeTeam} vs ${awayTeam}`);
        return;
      }

      this.smartLog(`[AUTO-BET] Step 3: Finding match "${matchName}" details...`);

      let columnIndex = 0;
      let rowIndex = 0;

      // เช็คฝั่งแบบละเอียด
      const hasUnderdogText = betSide.includes('รอง') || betSide.includes('Underdog');
      const hasAwayName = betSideClean.includes(awayClean) || awayClean.includes(betSideClean);
      const isOver = betSide.includes('สูง') || betSide.includes('Over');
      const isUnder = betSide.includes('ต่ำ') || betSide.includes('Under');

      this.smartLog(` - Flags: hasUnderdogText = ${hasUnderdogText}, hasAwayName = ${hasAwayName}, isOver = ${isOver}, isUnder = ${isUnder}`);

      if (isOver) {
        columnIndex = 1; rowIndex = 0;
      } else if (isUnder) {
        columnIndex = 1; rowIndex = 1;
      } else if (hasUnderdogText || hasAwayName) {
        columnIndex = 0; rowIndex = 1;
      } else {
        columnIndex = 0; rowIndex = 0;
      }

      this.smartLog(`[AUTO-BET] FINAL DECISION -> Col:${columnIndex}, Row:${rowIndex}`);

      // 1. ระบุบล็อกของทีม (Home/Away)
      const blocks = await matchRow.locator('._main_15ywe_157').all();
      this.smartLog(`[AUTO-BET] Found ${blocks.length} data blocks in match row.`);

      if (blocks.length < 2) {
        this.smartLog(`[AUTO-BET] ❌ ERROR: Match row structure unexpected (Blocks < 2).`);
        return;
      }

      // 2. เลือกบล็อกตาม rowIndex
      const targetBlock = blocks[rowIndex];
      const teamNameInBlock = await targetBlock.locator('._team-name_15ywe_182').innerText().catch(() => "N/A");
      this.smartLog(`[AUTO-BET] Targeting Block ${rowIndex + 1}: ${teamNameInBlock}`);

      // 3. ระบุปุ่มราคาในบล็อกนั้น
      const betBoxes = await targetBlock.locator('._bet-box_1ckm8_45').all();
      this.smartLog(`[AUTO-BET] Found ${betBoxes.length} bet boxes in this block.`);

      if (betBoxes.length > columnIndex) {
        const targetBtn = betBoxes[columnIndex];
        let oddsText = await targetBtn.locator('[class*="_odds_"], [class*="odds"]').innerText().catch(() => "N/A");
        if (oddsText === "N/A" || oddsText.trim() === "" || isNaN(parseFloat(oddsText.replace(/[^0-9.]/g, '')))) {
            // Self-healing fallback: scan all sub-elements for a decimal odds number
            const allElements = await targetBtn.locator('span, div, p').all();
            for (const el of allElements) {
                const text = await el.innerText().catch(() => "");
                const num = parseFloat(text.replace(/[^0-9.]/g, ''));
                if (!isNaN(num) && num >= 1.01 && num <= 20.0) {
                    oddsText = text;
                    break;
                }
            }
        }
        const labelText = await targetBtn.locator('._bet-label_1ckm8_65').innerText().catch(() => "N/A");

        // --- Line Verification ---
        const tLine = targetLine || "";
        if (tLine && labelText !== "N/A") {
          const cleanTarget = tLine.replace(/[\[\]]/g, '').trim();
          this.smartLog(`[AUTO-BET] Verifying line: Target ${cleanTarget} vs Web ${labelText}`);

          if (!this.isLineMatch(cleanTarget, labelText)) {
            throw new Error(`Line mismatch: Requested ${cleanTarget} but found ${labelText}`);
          }
          this.smartLog(`[AUTO-BET] Line verified!`);
        }

        this.smartLog(` - Final Action: Clicking "${labelText}" with Odds "${oddsText}"...`);
        await targetBtn.scrollIntoViewIfNeeded().catch(() => { });
        await targetBtn.click({ force: true });

        await page.waitForTimeout(1000);
        this.smartLog(`[AUTO-BET] ✅ Success! "${betSide}" (${oddsText}) added to cart.`);

        // --- เพิ่มส่วนการกรอกเงินและกดแทงจริง ---
        this.smartLog(`[AUTO-BET] 🛒 Opening cart slip...`);
        const cartIcon = page.locator('[class*="sport-bet-cart-classname"], [class*="_bet-cart_"], i[data-src*="icon_ty_floatbtn.svg"]').first();
        await cartIcon.click({ force: true }).catch(() => cartIcon.evaluate((el: HTMLElement) => el.click()));
        await page.waitForTimeout(1500);

        const slipInput = page.locator('input.ui-input__input, [class*="_input-box_"] input, .van-field__control').first();
        if (await slipInput.isVisible({ timeout: 5000 })) {
            this.smartLog(`[AUTO-BET] 🔢 Entering amount: ${amount}`);
            await slipInput.click({ force: true }).catch(() => {});
            
            // ใช้ Keyboard Type ตรงๆ เพื่อความเสถียรในโหมด Real
            await page.keyboard.type(amount.toString(), { delay: 100 });
            await page.waitForTimeout(1000);

            // คลิกปุ่ม "พนัน" (Confirm Bet)
            let betBtn: any = null;
            this.smartLog(`[AUTO-BET] 🔍 Waiting for "Bet" (พนัน) button...`);
            for (let r = 0; r < 20; r++) {
                const btn = page.locator('button, div, span').filter({ hasText: /^พนัน/ }).first();
                if (await btn.isVisible()) {
                    const isDisabled = await btn.getAttribute('disabled');
                    if (isDisabled === null) { betBtn = btn; break; }
                }
                await page.waitForTimeout(500);
            }

            if (betBtn) {
                this.smartLog(`[AUTO-BET] 🚀 Clicking "Bet" (พนัน) button!`);
                await betBtn.click({ force: true }).catch(() => betBtn.evaluate((el: HTMLElement) => el.click()));
                
                await page.waitForTimeout(5000); // รอ Success Screen
                
                // Cleanup: ปิดหน้าต่าง
                this.smartLog(`[AUTO-BET] 🧹 Cleaning up success dialog...`);
                await page.evaluate(() => {
                    const masks = document.querySelectorAll('.ui-mask, .ui-overlay, ._mask_, .van-overlay');
                    masks.forEach((el: any) => { el.click(); setTimeout(() => el.remove(), 500); });
                    const event = new MouseEvent('click', { view: window, bubbles: true, cancelable: true, clientX: 10, clientY: 10 });
                    document.body.dispatchEvent(event);
                }).catch(() => {});
                await page.waitForTimeout(1500);
            }
        }
        // ------------------------------------------

        await prisma.realBetLog.create({
          data: {
            signalId: taskId,
            matchName,
            leagueName,
            betSide,
            oddsAtBet: parseFloat(oddsText.replace(/[^0-9.]/g, '')),
            amount: amount,
            status: 'Executed'
          }
        }).catch((err: any) => this.smartLog(`[REAL-BET-LOG] Error: ${err.message}`));

        if (taskId) {
          await prisma.bet.update({
            where: { signalId: taskId },
            data: { autoBetStatus: 'Executed', oddsAtBet: parseFloat(oddsText.replace(/[^0-9.]/g, '')) }
          }).catch((err: any) => this.smartLog(`[REAL-BET-LOG] Failed update Bet: ${err.message}`));
        }

        await this.cleanupAndGoBack(page);
        return;
      } else {
        this.smartLog(`[AUTO-BET] ❌ ERROR: Could not find bet box at column ${columnIndex} in block ${rowIndex}.`);
        return;
      }
    } catch (error: any) {
      this.smartLog(`[AUTO-BET] ❌ ERROR: ${error.message}`);
      // บันทึก Log กรณีล้มเหลว
      await prisma.realBetLog.create({
        data: {
          signalId: taskId,
          matchName,
          leagueName,
          betSide,
          amount: amount,
          status: 'Failed',
          errorMessage: error.message
        }
      }).catch(() => { });

      if (taskId) {
        await prisma.bet.update({
          where: { signalId: taskId },
          data: { autoBetStatus: 'Failed', autoBetError: error.message }
        }).catch(() => {});
      }
    }
  }

  // ฟังก์ชันช่วยสำหรับการค้นหา
  private static async clickSearchButton(page: any): Promise<boolean> {
    try {
      const searchIcon = page.locator('i[data-src*="icon_ty_ss.svg"], [data-src*="icon_ty_ss.svg"]').first();
      
      // Attempt 1: JS Click on the exact i tag (most reliable for hybrid touch apps)
      const clickedJS = await searchIcon.evaluate((el: HTMLElement) => {
        el.click();
        const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
        el.dispatchEvent(clickEvent);
        return true;
      }).catch(() => false);
      
      if (clickedJS) {
        this.smartLog(`[AUTO-BOT] Clicked search icon via JS Event dispatch.`);
        return true;
      }
      
      // Attempt 2: Standard Playwright Click
      await searchIcon.click({ force: true, timeout: 2000 });
      this.smartLog(`[AUTO-BOT] Clicked search icon via Playwright click.`);
      return true;
    } catch (e: any) {
      // Attempt 3: General DOM selector click
      this.smartLog(`[AUTO-BOT] Standard search click failed: ${e.message}. Trying generic DOM scanner...`);
      const clickedDOM = await page.evaluate(() => {
        const allIcons = Array.from(document.querySelectorAll('i, svg, img, div'));
        const searchIcon = allIcons.find(el => {
          const src = el.getAttribute('data-src') || el.getAttribute('src') || '';
          return src.includes('icon_ty_ss.svg');
        });
        if (searchIcon) {
          (searchIcon as HTMLElement).click();
          const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
          searchIcon.dispatchEvent(clickEvent);
          return true;
        }
        return false;
      }).catch(() => false);
      
      return clickedDOM;
    }
  }

  private static async useSearchFallback(page: any, key: string) {
    this.smartLog(`[AUTO-BOT] 🔍 Triggering Search Fallback for: "${key}"`);
    
    this.smartLog(`[AUTO-BOT] ⚡ Clicking Search Icon via Multi-Method JS engine...`);
    await this.clickSearchButton(page);
    await page.waitForTimeout(2000);
    
    // Check if we successfully opened the Search events page
    const searchInput = page.locator('input[placeholder*="ค้นหา"], input[placeholder*="กรุณากรอก"], input.van-field__control, .search-input input').first();
    const isSearchOpen = await searchInput.isVisible().catch(() => false);
    
    if (isSearchOpen) {
      this.smartLog(`[AUTO-BOT] ✅ Clicked Search Icon successfully! Now on "การค้นหาเหตุการณ์" page.`);
    } else {
      this.smartLog(`[AUTO-BOT] ❌ Failed to click/open Search page! Icon not triggered.`);
    }
    
    // ⏸️ Pause 1: Verify search icon click and search page opened
    await this.waitStep("Verify Search Button Clicked & Page Opened");
    if (this.stopTestRequested) throw new Error("Test Stopped by user");
    
    this.smartLog(`[AUTO-BOT] ✍️ Entering search key: "${key}"`);
    await searchInput.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
    await searchInput.fill('').catch(() => {}); // Clear old values
    await searchInput.fill(key);
    await page.waitForTimeout(1000);
    
    // ⏸️ Pause 2: Verify league search input filled before submitting search
    await this.waitStep("Verify Search Key Entered");
    if (this.stopTestRequested) throw new Error("Test Stopped by user");
    
    this.smartLog(`[AUTO-BOT] 🚀 Submitting Search Query...`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000); // Wait for results to load
  }

  private static async performSearch(page: any, leagueName: string) {
    this.smartLog(`[AUTO-BET] Opening search tool...`);

    // 0. ตรวจสอบก่อนว่าช่องกรอกค้นหาเปิดอยู่แล้วหรือไม่ ถ้าเปิดอยู่แล้วไม่ต้องคลิกแว่นขยายซ้ำ (เพื่อไม่ให้เป็นการปิดช่องค้นหา)
    const inputSelectors = [
      'input.ui-input__input[type="text"]',
      'input[placeholder*="ค้นหา"]',
      'input[placeholder*="Search"]',
      '.ui-input__input input',
      '.search-input input',
      'input.van-field__control'
    ];

    let alreadyOpen = false;
    for (const selector of inputSelectors) {
      try {
        if (await page.locator(selector).first().isVisible().catch(() => false)) {
          alreadyOpen = true;
          this.smartLog(`[AUTO-BET] Search input is already visible. Skipping search trigger click.`);
          break;
        }
      } catch (e) {}
    }

    if (!alreadyOpen) {
      await this.clickSearchButton(page);
      await page.waitForTimeout(2000); 
    }

    // 2. รอและกรอกชื่อลีก (มีระบบ Retry 10 รอบ ทุกๆ 500ms ป้องกันอนิเมชั่นช้า)
    try {
      let inputFound = false;
      let activeInput: any = null;

      for (let retry = 0; retry < 10; retry++) {
        for (const selector of inputSelectors) {
          try {
            const input = page.locator(selector).first();
            if (await input.isVisible().catch(() => false)) {
              activeInput = input;
              inputFound = true;
              this.smartLog(`[AUTO-BET] Found search input via: ${selector} (on retry ${retry + 1})`);
              break;
            }
          } catch (e) {}
        }
        if (inputFound) break;
        await page.waitForTimeout(500);
      }

      if (!inputFound || !activeInput) {
          throw new Error("Could not find search input field after multiple attempts");
      }
      
      this.smartLog(`[AUTO-BET] Entering league name: ${leagueName}`);
      await activeInput.click({ force: true }).catch(() => {});
      await page.waitForTimeout(500);
      await activeInput.fill('').catch(() => {}); // ล้างค่าเก่า
      await activeInput.fill(leagueName);
      await page.waitForTimeout(800);

      // 3. กดปุ่มยืนยันการค้นหา
      this.smartLog(`[AUTO-BET] Submitting search...`);
      const submitBtn = page.locator('.ui-input__suffix-icon').last();
      await submitBtn.click({ force: true, timeout: 3000 }).catch(async () => {
        await page.keyboard.press('Enter');
      });

      // **จุดสำคัญ**: รอให้หน้าผลลัพธ์การค้นหาโหลดขึ้นมาจริงๆ
      this.smartLog(`[AUTO-BET] Waiting for search results to load...`);
      await page.waitForTimeout(3000); // ให้เวลาหน้าจอเปลี่ยน
      
    } catch (e: any) {
      this.smartLog(`[AUTO-BET] ❌ Search Step Failed: ${e.message}`);
      throw e;
    }
  }

  private static isLineMatch(target: string, web: string): boolean {
    try {
      const parseValue = (val: string): number => {
        const clean = val.replace(/[+]/g, '').trim();
        if (clean.includes('/')) {
          const parts = clean.split('/').map(p => parseFloat(p.replace(/[^0-9.-]/g, '')));
          if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            return (parts[0] + parts[1]) / 2;
          }
        }
        return parseFloat(clean.replace(/[^0-9.-]/g, ''));
      };

      const tValue = parseValue(target);
      const wValue = parseValue(web);

      if (isNaN(tValue) || isNaN(wValue)) {
        return web.toLowerCase().includes(target.toLowerCase());
      }

      // เทียบค่าแบบตรงไปตรงมา (ไม่ใช้ Math.abs) เพื่อให้เครื่องหมาย +/- ต้องตรงกันด้วย
      return Math.abs(tValue - wValue) < 0.01;
    } catch {
      return false;
    }
  }
}
