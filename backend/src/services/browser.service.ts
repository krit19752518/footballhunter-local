import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { botLog, testBotLog, testLogFile } from '../lib/logger';
import fs from 'fs';
import prisma from '../lib/prisma';

export class BrowserService {
  private static browser: Browser | null = null;
  private static context: BrowserContext | null = null;
  private static page: Page | null = null;
  private static isReady: boolean = false;
  private static isProcessing: boolean = false;
  private static queue: any[] = []; // คิวงานที่รอประมวลผล
  private static queueInterval: NodeJS.Timeout | null = null;

  private static isTestRunning: boolean = false; // สำหรับเลือกไฟล์ Log
  private static nextStepResolver: (() => void) | null = null;
  private static stopTestRequested: boolean = false;

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

      // เช็คว่าเป็นหน้าหลัก (มีรายการบอล) หรือหน้าค้นหา (ที่มีปุ่มกากบาทปิด)
      const isMainPage = await page.locator('._right-icon_j2hkn_82').first().isVisible().catch(() => false);
      const isSearchPage = await page.locator('.ui-input__clear').first().isVisible().catch(() => false);
      
      if (!isMainPage && !isSearchPage) {
        this.smartLog(`[QUEUE] ⚠️ Not on a valid betting page. Re-queueing task...`);
        if (task) this.queue.unshift(task);
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

      let finalOdds = 0.0;

      try {
        logWithStep(`🚀 Starting ${this.isTestRunning ? 'TEST' : 'REAL'} process for: ${matchName}`);

        // // await this.waitStep(...); // Removed for Full-Auto // Removed for Full-Auto
        if (this.stopTestRequested) throw new Error("Test Stopped by user");

      // 1. เตรียมชื่อทีมสำหรับค้นหา
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

      // 2. ค้นหาด้วยชื่อลีกก่อน
      try {
        logWithStep(`🔍 Opening search tool for league: ${leagueName}`);
        await this.performSearch(page, leagueName);
        if (this.stopTestRequested) throw new Error("Test Stopped by user");
        await page.waitForTimeout(2000); // ให้เวลาผลลัพธ์โหลด
      } catch (e: any) {
        throw new Error(`League Search Failed: ${e.message}`);
      }

      // 3. ค้นหาคู่บอลในผลลัพธ์ที่ปรากฏ (รอสูงสุด 5 วินาที)
      logWithStep(`🔍 Scanning for match: ${homeKey} vs ${awayKey}`);
      let matchRow: any = null;
      let found = false;

      for (let retry = 0; retry < 10; retry++) { // 10 รอบ รอบละ 500ms = 5 วินาที
          const possibleRows = page.locator('div, li, a').filter({ hasText: homeKey }).filter({ hasText: awayKey });
          const count = await possibleRows.count();
          
          for (let i = 0; i < count; i++) {
            const candidate = possibleRows.nth(i);
            if (await candidate.isVisible()) {
              const box = await candidate.boundingBox();
              if (box && box.height > 30) { 
                matchRow = candidate;
                found = true;
                break;
              }
            }
          }
          
          if (found) break;
          await page.waitForTimeout(500);
      }

      if (matchRow) {
        logWithStep(`✅ Match found! Clicking to open odds page...`);
        // // await this.waitStep(...); // Removed for Full-Auto // Removed for Full-Auto
        if (this.stopTestRequested) throw new Error("Test Stopped by user");
        await matchRow.scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(2000); // หน่วงเวลา 2 วินาทีตามขอ

        // พยายามคลิกจุดกึ่งกลางของแถว หรือหาปุ่ม/ลิงก์ภายใน
        const clickTargets = matchRow.locator('div[class*="_center_"], .match-link, a, .team-name').first();
        if (await clickTargets.isVisible()) {
           await clickTargets.click({ force: true, timeout: 3000 }).catch(() => matchRow.click({ force: true }));
        } else {
           await matchRow.click({ force: true }).catch(() => {});
        }
        
        // รอเช็คว่าหน้าเปลี่ยนจริงไหม (เช็คคำที่เป็นเอกลักษณ์ของหน้าราคา)
        let arrived = false;
        for (let i = 0; i < 15; i++) { // เพิ่มเป็น ~10-12 วินาที
            await page.waitForTimeout(800);
            const isOddsPage = await page.locator('div, span').filter({ hasText: /แฮนดิแคป|สูง\/ต่ำ|Handicap|1x2|ไม่พบข้อมูลเป็นการชั่วคราว/ }).first().isVisible().catch(() => false);
            if (isOddsPage) {
                arrived = true;
                break;
            }
            await page.waitForTimeout(1000); // หน่วงเวลาเช็คหน้าเปลี่ยน
            // ถ้ายังไม่เปลี่ยนหน้า ลองใช้ JS Click ซ้ำที่ตัวแถว
            if (i % 5 === 0 && i > 0) { // ลอง JS Click ทุกๆ 5 รอบ
                logWithStep(`[AUTO-BOT] ⚠️ Not moved yet, trying different click points...`);
                // ลองคลิกหลายๆ จุด (ซ้าย, กลาง, ขวา)
                await matchRow.evaluate((el: HTMLElement) => {
                    el.click(); // คลิกปกติ
                    const box = el.getBoundingClientRect();
                    const event = new MouseEvent('click', { view: window, bubbles: true, cancelable: true, clientX: box.left + 20, clientY: box.top + 10 });
                    el.dispatchEvent(event);
                }).catch(() => {});
            }
            if (i === 12) { // ถ้ารอนานเกินไป (ประมาณ 15-20 วินาที) ให้ลอง Reload หน้าเว็บ
                logWithStep(`[AUTO-BOT] 🚨 STUCK DETECTED! Force reloading page...`);
                await page.reload().catch(() => {});
                await page.waitForTimeout(5000); // รอหน้าโหลดใหม่
                break; // ออกจาก Loop เพื่อให้งานนี้พังไป แล้วเริ่มงานใหม่จากหน้าหลัก
            }
        }

        if (arrived) {
            logWithStep(`🚩 Arrived at Odds Page. Waiting 3s for stabilization...`);
            await page.waitForTimeout(3000); // รอให้ราคาและหน้าจอรีเฟรชจนนิ่ง
            const formattedPrice = BrowserService.formatLine(targetLine || "0");
            logWithStep(`🔍 Searching for price: ${formattedPrice}`);
            
            // 1. ระบุชื่อหัวข้อ Section ที่ต้องการ
            const isFH = betSide.includes('ครึ่งแรก') || task.matchName.includes('ครึ่งแรก') || (targetLine && targetLine.includes('ครึ่งแรก'));
            const isOU = betSide.includes('สูง') || betSide.includes('ต่ำ');
            
            let sectionTitle = isOU ? 'สูง/ต่ำ' : 'แฮนดิแคป';
            if (isFH) sectionTitle += '-ครึ่งแรก';

            logWithStep(`🔍 Looking for Section: "${sectionTitle}"`);

            // 2. ค้นหา Section และคลิกเลือกราคา
            try {
                let targetSection: any = null;

                // ลองค้นหา Section ซ้ำเพื่อรอให้ข้อมูลโหลด
                for (let retry = 0; retry < 5; retry++) {
                    const sections = page.locator('.ui-collapse-item');
                    const count = await sections.count();
                    
                    for (let i = 0; i < count; i++) {
                        // ค้นหาข้อความ Title ภายใน Section (ไม่ยึดติดกับ Class Name)
                        const titleText = await sections.nth(i).innerText().catch(() => "");
                        if (titleText.split('\n')[0].includes(sectionTitle)) {
                            targetSection = sections.nth(i);
                            break;
                        }
                    }
                    
                    if (targetSection) break;
                    await page.waitForTimeout(1000); // รอ 1 วินาทีก่อนลองใหม่
                }

                if (targetSection) {
                    logWithStep(`✅ Found Section: ${sectionTitle}`);
                    const formattedPrice = BrowserService.formatLine(targetLine || "0");
                    // // await this.waitStep(...); // Removed for Full-Auto // Removed for Full-Auto
                    if (this.stopTestRequested) throw new Error("Test Stopped by user");
                    
                    const cleanTarget = (targetLine || "").replace(/[\[\]]/g, '').trim();
                    let targetBox: any = null;

                    // --- ระบบแยกฝั่ง (Home/Away Awareness) ---
                    const homeTeam = task.matchName.split(' vs ')[0];
                    const awayTeam = task.matchName.split(' vs ')[1];
                    const isAwayBet = betSide.includes(awayTeam) || betSide.includes('ทีมเยือน');
                    
                    logWithStep(`🎯 Targeting ${isAwayBet ? 'AWAY' : 'HOME'} side for price ${formattedPrice}`);

                    const allLabels = targetSection.locator('._bet-label_1ckm8_65, [class*="_bet-label_"]');
                    const labelCount = await allLabels.count();
                    
                    // ใน AH/OU มักจะมี 2 คอลัมน์ (0=Home, 1=Away) หรือ (0=Over, 1=Under)
                    // เราจะวนหาตัวที่ตรงทั้งราคาและ "ฝั่ง"
                    for (let j = 0; j < labelCount; j++) {
                        const labelText = await allLabels.nth(j).innerText().catch(() => "");
                        if (this.isLineMatch(cleanTarget, labelText)) {
                            // เช็คฝั่ง: AH มักมี 2 label ต่อแถว. j % 2 === 0 คือซ้าย (Home), j % 2 === 1 คือขวา (Away)
                            const currentIsAway = (j % 2 === 1);
                            
                            // ถ้าฝั่งตรงกับที่ต้องการ หรือถ้าหาไม่เจอจริงๆ (กรณีมีคอลัมน์เดียว) ให้เลือกตัวนี้
                            if (currentIsAway === isAwayBet || labelCount === 1) {
                                targetBox = allLabels.nth(j).locator('xpath=ancestor::div[contains(@class, "_bet-box_")]').first();
                                break;
                            }
                        }
                    }
                    
                    // Fallback: ถ้าหาแบบเช็คฝั่งไม่เจอ ให้เอาตัวที่ราคาตรงตัวแรก (กันเหนียว)
                    if (!targetBox) {
                        for (let j = 0; j < labelCount; j++) {
                            const labelText = await allLabels.nth(j).innerText().catch(() => "");
                            if (this.isLineMatch(cleanTarget, labelText)) {
                                targetBox = allLabels.nth(j).locator('xpath=ancestor::div[contains(@class, "_bet-box_")]').first();
                                break;
                            }
                        }
                    }

                    if (targetBox) {
                        const oddsText = await targetBox.locator('._odds_1qbu6_57, [class*="odds"]').innerText().catch(() => "N/A");
                        finalOdds = parseFloat(oddsText.replace(/[^0-9.]/g, '')) || 0.0;
                        logWithStep(`[AUTO-BOT] 🎯 Found matching price! Odds: ${oddsText} (${finalOdds}). Clicking...`);
                        
                        if (this.stopTestRequested) throw new Error("Test Stopped by user");
                        await targetBox.click({ force: true });
                        await page.waitForTimeout(2000); // หน่วงเวลา 2 วินาที

                        logWithStep(`[AUTO-BOT] 🛒 Checking if Bet Slip is already open...`);
                        const amountInput = page.locator('._option_wlp6f_80, ._stake-container_15log_45, ._container_15log_69, .ui-input__input').first();
                        
                        // ปรับปรุง Selector ตระกร้าให้ครอบคลุมขึ้น
                        const cartIcon = page.locator(`
                            [class*="sport-bet-cart-classname"], 
                            [class*="_bet-cart_"], 
                            [class*="bet-cart"],
                            i[data-src*="icon_ty_floatbtn.svg"],
                            .ui-badge__wrapper img[src*="cart"],
                            div[class*="cart"]
                        `).first();

                        // 1.5 ลบเลเยอร์บังหน้าก่อนคลิกตระกร้า
                        await page.evaluate(() => {
                            document.querySelectorAll('.ui-mask, .ui-overlay, ._mask_').forEach(el => el.remove());
                        }).catch(() => {});

                        // ถ้ายังไม่เห็นช่องใส่เงิน ให้ลองเปิดตระกร้า
                        if (!(await amountInput.isVisible())) {
                            logWithStep(`🔍 Waiting for cart icon to appear...`);
                            await cartIcon.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

                            if (await cartIcon.isVisible()) {
                                // // await this.waitStep(...); // Removed for Full-Auto // Removed for Full-Auto
                                if (this.stopTestRequested) throw new Error("Test Stopped by user");

                                logWithStep(`🖱️ Slip not open, clicking cart icon...`);
                                // ลองคลิกหลายๆ แบบเพื่อให้มั่นใจ
                                await cartIcon.click({ force: true }).catch(async () => {
                                    await cartIcon.evaluate((el: HTMLElement) => el.click()).catch(() => {});
                                });
                                
                                await page.waitForTimeout(1000);
                                
                                // ถ้ายังไม่เปิด ลองคลิกที่พิกัด (ตระกร้าสีเหลืองมักอยู่ขวาล่าง หรือข้างๆ ราคา)
                                if (!(await amountInput.isVisible())) {
                                    const box = await cartIcon.boundingBox();
                                    if (box) {
                                        logWithStep(`🖱️ Trying coordinate click on cart icon...`);
                                        await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
                                    }
                                }
                                await page.waitForTimeout(2000); 
                            } else {
                                logWithStep(`⚠️ Cart icon not found after waiting.`);
                            }
                        }


                        // รอให้ช่องใส่เงินปรากฏ (ขยาย Selector ให้ครอบคลุมมากขึ้น)
                        const slipInput = page.locator(`
                            ._option_wlp6f_80, 
                            ._stake-container_15log_45, 
                            ._container_15log_69, 
                            .ui-input__input,
                            [class*="stake-input"],
                            [class*="amount-input"],
                            div[role="textbox"]
                        `).first();

                        await slipInput.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

                        if (await slipInput.isVisible()) {
                            logWithStep(`[AUTO-BOT] ✅ Bet Slip opened. Starting amount entry...`);
                            await slipInput.click({ force: true });
                            await page.waitForTimeout(1500); 

                            // 2. กดเลข 1 และเลข 0 บน Keyboard/Keypad
                            logWithStep(`🔢 Typing "1" and "0" via keypad...`);
                            
                            // คลิกช่อง Input เพื่อความมั่นใจ
                            await slipInput.click({ force: true }).catch(() => {});
                            await page.waitForTimeout(800);

                            // หา Container ของคีย์บอร์ด (รองรับทั้ง keypad และ keyboard)
                            const keypad = page.locator('.van-keypad, .ui-keypad, [class*="keypad"], [class*="keyboard"]').first();
                            
                            const getKey = (num: string) => {
                                // พยายามหาปุ่มที่มีตัวเลขนั้นๆ (เน้นหาจาก ui-button__text หรือ text ตรงๆ)
                                return keypad.locator('.ui-button__text, .ui-button, span, div, button')
                                    .filter({ hasText: new RegExp(`^${num}$`) })
                                    .first();
                            };

                            try {
                                if (await keypad.isVisible({ timeout: 3000 })) {
                                    const btn1 = getKey("1");
                                    const btn0 = getKey("0");
                                    
                                    if (await btn1.isVisible()) {
                                        await btn1.click({ force: true });
                                        await page.waitForTimeout(500);
                                        if (await btn0.isVisible()) {
                                            await btn0.click({ force: true });
                                            await page.waitForTimeout(500);
                                        }
                                    } else {
                                        logWithStep(`⚠️ Buttons 1/0 not visible in keyboard, trying manual type...`);
                                        await page.keyboard.type("10", { delay: 100 });
                                    }
                                } else {
                                    logWithStep(`⚠️ Keyboard container not found, trying manual type...`);
                                    await page.keyboard.type("10", { delay: 100 });
                                }
                            } catch (e) {
                                logWithStep(`⚠️ Interaction failed, using keyboard fallback: ${e}`);
                                await page.keyboard.type("10", { delay: 100 });
                            }
                            
                            await page.waitForTimeout(1000); 

                            // ตรวจสอบว่าเงินเข้าไหม (ถ้าหา value ได้)
                            const currentVal = await slipInput.innerText().catch(() => "");
                            if (!currentVal.includes("10")) {
                                logWithStep(`⚠️ Amount not visible in UI, trying keyboard one last time...`);
                                await slipInput.click({ clickCount: 3 }); // Select all
                                await page.keyboard.press('Backspace');
                                await page.keyboard.type("10", { delay: 100 });
                            }
                            
                            // ==========================================
                            // 🛑 DEBUG PAUSE: หยุดหลังกรอกเลข 10
                            // ==========================================
                            if (this.isTestRunning) {
                                // await this.waitStep(...); // Removed for Full-Auto
                            } else {
                                await page.waitForTimeout(1000);
                            }
                            if (this.stopTestRequested) throw new Error("Test Stopped by user");
                            // ==========================================

                            await page.waitForTimeout(1500); 

                            // 3. คลิกปุ่ม "พนัน" (Confirm Bet)
                            let betBtn: any = null;
                            logWithStep(`🔍 Searching for "Bet" (พนัน) button...`);
                            
                            for (let r = 0; r < 20; r++) { // เพิ่มเป็น 20 รอบ (ประมาณ 10 วินาที)
                                 const btn = page.locator('button, div, span').filter({ hasText: /^พนัน/ }).first();
                                 if (await btn.isVisible()) {
                                     const isDisabled = await btn.getAttribute('disabled');
                                     if (isDisabled === null) {
                                         betBtn = btn;
                                         break;
                                     }
                                 }
                                 await page.waitForTimeout(500);
                             }

                            if (betBtn) {
                                logWithStep(`🚀 Clicking "Bet" (พนัน) button...`);
                                if (this.stopTestRequested) throw new Error("Test Stopped by user");
                                await betBtn.click({ force: true }).catch(async () => {
                                    await betBtn.evaluate((el: HTMLElement) => el.click());
                                });
                                
                                logWithStep(`⏳ Waiting for bet confirmation (Success Screen)...`);
                                await page.waitForTimeout(5000); 
                                logWithStep(`✅ Betting process completed!`);

                                // Save successful real bet to db
                                if (!isTest) {
                                    await prisma.realBetLog.create({
                                      data: {
                                        signalId: taskId,
                                        matchName,
                                        leagueName,
                                        betSide,
                                        oddsAtBet: finalOdds,
                                        amount: amount,
                                        status: 'Executed'
                                      }
                                    }).catch((err: any) => this.smartLog(`[REAL-BET-LOG] Error: ${err.message}`));
                                    if (taskId) {
                                        await prisma.bet.update({
                                            where: { signalId: taskId },
                                            data: { autoBetStatus: 'Executed', oddsAtBet: finalOdds }
                                        }).catch((err: any) => this.smartLog(`[REAL-BET-LOG] Failed update Bet: ${err.message}`));
                                    }
                                }

                                // --- ขั้นตอน Cleanup (ปิดหน้าต่างที่เบลอๆ) ---
                                logWithStep(`🧹 Cleaning up: Closing success dialog...`);
                                await page.evaluate(() => {
                                    const masks = document.querySelectorAll('.ui-mask, .ui-overlay, ._mask_, .van-overlay');
                                    masks.forEach((el: any) => { el.click(); setTimeout(() => el.remove(), 500); });
                                    const event = new MouseEvent('click', { view: window, bubbles: true, cancelable: true, clientX: 10, clientY: 10 });
                                    document.body.dispatchEvent(event);
                                }).catch(() => {});
                                await page.waitForTimeout(1500);
                            } else {
                                await cartIcon.evaluate((el: HTMLElement) => el.click()).catch(() => {});
                                throw new Error(`Bet button (พนัน) not found.`);
                            }
                        } else {
                            throw new Error(`Amount input field not found after waiting.`);
                        }

                        // 6. ทำความสะอาดและกลับหน้าหลัก
                        await this.cleanupAndGoBack(page);

                    } else {
                        throw new Error(`Price not found.`);
                    }
                } else {
                    throw new Error(`Section "${sectionTitle}" not found.`);
                }
            } catch (e: any) {
                throw e;
            }
        } else {
            // พยายามล้างช่องค้นหาเพื่อเริ่มใหม่
            const clearBtn = page.locator('.ui-input__clear').first();
            if (await clearBtn.isVisible()) await clearBtn.click({ force: true }).catch(() => {});
            throw new Error(`Navigation failed. Still on Search Page.`);
        }
      } else {
        throw new Error(`Could not find match row in search results for "${homeKey}" vs "${awayKey}" after 5s.`);
      }

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
          }).catch((err: any) => this.smartLog(`[REAL-BET-LOG] Failed write error: ${err.message}`));

          if (taskId) {
              await prisma.bet.update({
                  where: { signalId: taskId },
                  data: { autoBetStatus: 'Failed', autoBetError: error.message }
              }).catch((err: any) => this.smartLog(`[REAL-BET-LOG] Failed update Bet error: ${err.message}`));
          }
      }
      await this.cleanupAndGoBack(page).catch(() => {});
    } finally {
      this.isProcessing = false;
    }
  }

  // ฟังก์ชันช่วยย้อนกลับและปิด Popup (รองรับ Popup โบนัสและวงล้อ)
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
    
    await page.waitForTimeout(1000);

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
    await page.waitForTimeout(2500);

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
            await page.waitForTimeout(2000); 
        } catch (e) {
            // ลองเช็คปุ่ม X ทั่วไป
            const svgClose = page.locator('svg, i, div').filter({ hasText: /^x$/i }).first();
            if (await svgClose.isVisible()) {
                this.smartLog(`[AUTO-BOT] ✖️ Finding generic X button...`);
                await svgClose.click({ force: true }).catch(() => {});
                await page.waitForTimeout(2000);
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
        await page.waitForTimeout(3000);
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

      // 1. ไถหา "ตู้คอนเทนเนอร์ของลีก" (ui-collapse-item)
      this.smartLog(`[AUTO-BET] Step 1: Scanning for League: ${leagueName} `);
      let foundLeague = false;
      let leagueContainer: any = null;

      for (let i = 0; i < 20; i++) {
        // หา Element ที่ครอบทั้งลีก (ui-collapse-item ที่มีชื่อลีก)
        leagueContainer = page.locator('.ui-collapse-item').filter({ has: page.locator('.ui-cell__title').filter({ hasText: leagueName.substring(0, 15) }) }).first();

        if (await leagueContainer.isVisible()) {
          const header = leagueContainer.locator('.ui-cell--clickable').first();
          const isExpanded = await header.getAttribute('aria-expanded');

          this.smartLog(`[AUTO-BET] Found League Container! (Status: ${isExpanded === 'true' ? 'Expanded' : 'Collapsed'})`);

          if (isExpanded === 'false') {
            this.smartLog(`[AUTO-BET] Expanding League...`);
            const rightIcon = header.locator('.ui-cell__right-icon').first();
            await rightIcon.click({ force: true }).catch(() => header.click({ force: true }));
            await page.waitForTimeout(2000);
          }
          foundLeague = true;
          break;
        }
        await page.mouse.wheel(0, 500);
        await page.waitForTimeout(800);
      }

      if (!foundLeague) {
        this.smartLog(`[AUTO-BET] ⚠️ League not found. Using Search Fallback...`);
        await this.useSearchFallback(page, homeKey);
        // หลัง Search ลีกจะกางอัตโนมัติ ให้กำหนด Container ใหม่จากผลการค้นหา
        leagueContainer = page.locator('.ui-collapse-item').first();
      }

      // 2. ไถหา "คู่บอล" เฉพาะภายในลีกที่เลือกเท่านั้น (League Scoping)
      this.smartLog(`[AUTO-BET] Step 2: Scanning for Match Row inside ${leagueName}...`);
      let foundMatch = false;
      let matchRow: any = null;

      for (let i = 0; i < 10; i++) {
        // ค้นหาแถวคู่บอล โดยระบุว่าต้องอยู่ภายใต้ leagueContainer เท่านั้น!
        matchRow = leagueContainer.locator('.match-item, .match-row, .game-item, [class*="match-item"], [class*="game-item"]')
          .filter({ hasText: homeKey })
          .filter({ hasText: awayKey })
          .first();

        if (await matchRow.isVisible()) {
          this.smartLog(`[AUTO-BET] Success! Match Found within scoped league.`);
          await matchRow.scrollIntoViewIfNeeded().catch(() => { });
          await page.waitForTimeout(500);
          foundMatch = true;
          break;
        }

        // ถ้าเป็นลีกใหญ่ที่มีหลายคู่ อาจต้องไถภายในตัวมันเอง
        await page.mouse.wheel(0, 400);
        await page.waitForTimeout(800);
      }

      // แผนสำรองสุดท้าย: ถ้ายังไม่เจอให้ลองใช้ช่องค้นหา
      if (!foundMatch) {
        this.smartLog(`[AUTO-BET] ⚠️ Match not found after expanding. Using Search Fallback...`);
        await this.useSearchFallback(page, homeKey);

        // ลองหาอีกครั้งหลังค้นหา
        const matchRowSearch = page.locator('.match-item, .match-row, .game-item, [class*="match-item"], [class*="game-item"]')
          .filter({ hasText: homeKey })
          .filter({ hasText: awayKey })
          .first();

        if (await matchRowSearch.isVisible()) {
          this.smartLog(`[AUTO-BET] Success! Match Row Found after Search.`);
          foundMatch = true;
          matchRow = matchRowSearch;
        }
      }

      if (!foundMatch) {
        this.smartLog(`[AUTO-BET] ❌ ERROR: Could not find match row for ${homeKey} vs ${awayKey}`);
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
        const oddsText = await targetBtn.locator('._odds_1qbu6_57').innerText().catch(() => "N/A");
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
  private static async useSearchFallback(page: any, key: string) {
    await page.click('.icon-search, .search-icon, .fa-search').catch(() => { });
    await page.waitForTimeout(600);
    const searchInput = page.locator('input[placeholder*="ค้นหา"], .search-input').first();
    await searchInput.fill(key).catch(() => { });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
  }

  private static async performSearch(page: any, leagueName: string) {
    this.smartLog(`[AUTO-BET] Opening search tool...`);

    // 1. คลิกปุ่มค้นหา (แว่นขยาย) - พยายามหาจาก data-src เป็นหลักเพราะแน่นอนกว่า Class
    try {
        const iconFound = await page.evaluate(() => {
            const allIcons = Array.from(document.querySelectorAll('i, svg, img, div'));
            const searchIcon = allIcons.find(el => {
                const src = el.getAttribute('data-src') || el.getAttribute('src') || '';
                return src.includes('icon_ty_ss.svg') || (el.classList.contains('icon-search') || el.classList.contains('search-icon'));
            });

            if (searchIcon) {
                (searchIcon as HTMLElement).click();
                return true;
            }
            return false;
        });
        
        if (!iconFound) {
            this.smartLog(` - Warning: Search icon not found via JS evaluation. Trying fallback selectors...`);
            await page.click('.icon-search, .search-icon, .fa-search, [class*="search"]').catch(() => {});
        }
        
        this.smartLog(` - Search trigger attempted.`);
    } catch (e: any) {
        this.smartLog(` - Warning: Search trigger failed: ${e.message}`);
    }

    // รอให้หน้าต่างค้นหา (Modal) โผล่ขึ้นมา
    await page.waitForTimeout(4000); // เพิ่มเวลารอ Modal

    // 2. รอและกรอกชื่อลีก
    try {
      const inputSelectors = [
        'input.ui-input__input[type="text"]',
        'input[placeholder*="ค้นหา"]',
        'input[placeholder*="Search"]',
        '.ui-input__input input',
        '.search-input input',
        'input.van-field__control'
      ];
      
      let inputFound = false;
      for (const selector of inputSelectors) {
          try {
              const input = page.locator(selector).first();
              if (await input.isVisible({ timeout: 3000 })) {
                  this.smartLog(`[AUTO-BET] Found search input via: ${selector}`);
                  await input.fill(''); // ล้างค่าเก่า
                  await input.fill(leagueName);
                  inputFound = true;
                  break;
              }
          } catch (e) {}
      }

      if (!inputFound) {
          throw new Error("Could not find search input field after multiple attempts");
      }
      
      this.smartLog(`[AUTO-BET] Entering league name: ${leagueName}`);
      await page.waitForTimeout(800);

      // 3. กดปุ่มยืนยันการค้นหา
      this.smartLog(`[AUTO-BET] Submitting search...`);
      const submitBtn = page.locator('.ui-input__suffix-icon').last();
      await submitBtn.click({ force: true, timeout: 3000 }).catch(async () => {
        await page.keyboard.press('Enter');
      });

      // **จุดสำคัญ**: รอให้หน้าผลลัพธ์การค้นหาโหลดขึ้นมาจริงๆ (หา Element ที่เป็นผลลัพธ์)
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
