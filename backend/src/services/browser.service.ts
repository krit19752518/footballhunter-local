import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { botLog } from '../lib/logger';
import prisma from '../lib/prisma';

export class BrowserService {
  private static browser: Browser | null = null;
  private static context: BrowserContext | null = null;
  private static page: Page | null = null;
  private static isReady: boolean = false;
  private static isProcessing: boolean = false;
  private static queue: any[] = []; // คิวงานที่รอประมวลผล
  private static queueInterval: NodeJS.Timeout | null = null;

  static async init() {
    if (this.browser) return;

    botLog('[BROWSER] Launching Chromium...');
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
      botLog(`[BROWSER] Initial load failed: ${e.message}. Please enter the URL manually in the browser.`);
    }

    botLog('[BROWSER] Browser is open. Please login and prepare the betting page.');
  }

  static async getPage() {
    if (!this.page) await this.init();
    return this.page!;
  }

  static setReady(status: boolean) {
    this.isReady = status;
    botLog(`[BROWSER] System is ${status ? 'READY' : 'PAUSED'}`);

    if (status) {
      this.startQueueProcessor();
    }
  }

  static getStatus(): boolean {
    return this.isReady;
  }

  private static async startQueueProcessor() {
    if (this.queueInterval) return; // ป้องกันการสร้าง Interval ซ้อนกัน

    this.queueInterval = setInterval(async () => {
      if (!this.isReady || this.isProcessing || this.queue.length === 0) return;

      const page = this.page;
      if (!page) return;

      // เช็คว่าเป็นหน้าหลัก (มีรายการบอล) หรือหน้าค้นหา (ที่มีปุ่มกากบาทปิด)
      const isMainPage = await page.locator('._right-icon_j2hkn_82').first().isVisible().catch(() => false);
      const isSearchPage = await page.locator('.ui-input__clear').first().isVisible().catch(() => false);
      
      if (!isMainPage && !isSearchPage) return;

      const task = this.queue.shift();
      if (task) {
        await this.executeTask(task);
      }
    }, 5000);
  }

  private static async executeTask(task: any) {
    const { leagueName, matchName, betSide, amount, targetLine } = task;
    const page: any = this.page;

    this.isProcessing = true;
    try {
      botLog(`[AUTO-BOT] 🚀 Starting process for: ${matchName}`);

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
        await this.performSearch(page, leagueName);
        await page.waitForTimeout(2000); // ให้เวลาผลลัพธ์โหลด
      } catch (e: any) {
        botLog(`[AUTO-BOT] ❌ League Search Failed: ${e.message}`);
        return;
      }

      // 3. ค้นหาคู่บอลในผลลัพธ์ที่ปรากฏ (รอสูงสุด 5 วินาที)
      botLog(`[AUTO-BOT] 🔍 Scanning for match: ${homeKey} vs ${awayKey}`);
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
        botLog(`[AUTO-BOT] ✅ Match found! Clicking to open odds page...`);
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
        for (let i = 0; i < 10; i++) { // เพิ่มเป็น 5 วินาที (10 * 500ms)
            await page.waitForTimeout(500);
            const isOddsPage = await page.locator('div, span').filter({ hasText: /^แฮนดิแคป & สูง\/ต่ำ$/ }).first().isVisible().catch(() => false);
            if (isOddsPage) {
                arrived = true;
                break;
            }
            await page.waitForTimeout(1000); // หน่วงเวลาเช็คหน้าเปลี่ยน
            // ถ้ายังไม่เปลี่ยนหน้า ลองใช้ JS Click ซ้ำที่ตัวแถว
            if (i === 5) {
                botLog(`[AUTO-BOT] ⚠️ Not moved yet, trying JS click fallback...`);
                await matchRow.evaluate((el: HTMLElement) => el.click()).catch(() => {});
            }
        }

        if (arrived) {
            botLog(`[AUTO-BOT] 🚩 Arrived at Odds Page. Waiting 3s for stabilization...`);
            await page.waitForTimeout(3000); // รอให้ราคาและหน้าจอรีเฟรชจนนิ่ง
            botLog(`[AUTO-BOT] 🔍 Searching for price: ${targetLine}`);
            
            // 1. ระบุชื่อหัวข้อ Section ที่ต้องการ
            const isFH = betSide.includes('ครึ่งแรก') || task.matchName.includes('ครึ่งแรก') || (targetLine && targetLine.includes('ครึ่งแรก'));
            const isOU = betSide.includes('สูง') || betSide.includes('ต่ำ');
            
            let sectionTitle = isOU ? 'สูง/ต่ำ' : 'แฮนดิแคป';
            if (isFH) sectionTitle += '-ครึ่งแรก';

            botLog(`[AUTO-BOT] 🔍 Looking for Section: "${sectionTitle}"`);

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
                    botLog(`[AUTO-BOT] ✅ Found Section: ${sectionTitle}`);
                    
                    const cleanTarget = (targetLine || "").replace(/[\[\]]/g, '').trim();
                    let targetBox: any = null;

                    // 1. ค้นหาจาก Label โดยตรง (เร็วกว่าการสแกนทุก Element)
                    const allLabels = targetSection.locator('._bet-label_1ckm8_65, [class*="_bet-label_"]');
                    const labelCount = await allLabels.count();
                    
                    for (let j = 0; j < labelCount; j++) {
                        const labelText = await allLabels.nth(j).innerText().catch(() => "");
                        if (this.isLineMatch(cleanTarget, labelText)) {
                            // เมื่อเจอ Label ที่ใช่ ให้หา Bet Box ที่ครอบมันอยู่
                            targetBox = allLabels.nth(j).locator('xpath=ancestor::div[contains(@class, "_bet-box_")]').first();
                            break;
                        }
                    }

                    if (targetBox) {
                        botLog(`[AUTO-BOT] 🎯 Found matching price! Clicking...`);
                        await targetBox.click({ force: true });
                        await page.waitForTimeout(2000); // หน่วงเวลา 2 วินาที

                        botLog(`[AUTO-BOT] 🛒 Checking if Bet Slip is already open...`);
                        const amountInput = page.locator('._option_wlp6f_80, ._stake-container_15log_45, ._container_15log_69, .ui-input__input').first();
                        const cartIcon = page.locator('[class*="sport-bet-cart-classname"], [class*="_bet-cart_"], i[data-src*="icon_ty_floatbtn.svg"]').first();

                        // 1.5 ลบเลเยอร์บังหน้าก่อนคลิกตระกร้า
                        await page.evaluate(() => {
                            document.querySelectorAll('.ui-mask, .ui-overlay, ._mask_').forEach(el => el.remove());
                        }).catch(() => {});

                        // ถ้ายังไม่เห็นช่องใส่เงิน ให้ลองเปิดตระกร้า
                        if (!(await amountInput.isVisible())) {
                            if (await cartIcon.isVisible()) {
                                botLog(`[AUTO-BOT] 🖱️ Slip not open, clicking cart icon...`);
                                // ลองคลิก 2 วิธี: Selector และ พิกัด (เผื่อโดนบัง)
                                await cartIcon.evaluate((el: HTMLElement) => el.click()).catch(() => {});
                                await page.waitForTimeout(500);
                                
                                // ถ้ายังไม่เปิด ลองคลิกที่พิกัด (ตระกร้าสีเหลืองมักอยู่ขวาล่าง)
                                const box = await cartIcon.boundingBox();
                                if (box) {
                                    await page.mouse.click(box.x + box.width/2, box.y + box.height/2);
                                }
                                await page.waitForTimeout(2000); 
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
                            botLog(`[AUTO-BOT] ✅ Bet Slip opened. Starting amount entry...`);
                            await slipInput.click({ force: true });
                            await page.waitForTimeout(1500); 

                            // 2. กดเลข 1 และเลข 0 บน Keypad
                            botLog(`[AUTO-BOT] 🔢 Typing "1" and "0" via keypad...`);
                            const key1 = page.locator('button, div, span').filter({ hasText: /^1$/ }).first();
                            const key0 = page.locator('button, div, span').filter({ hasText: /^0$/ }).first();

                            if (await key1.isVisible()) {
                                await key1.click({ force: true });
                                await page.waitForTimeout(800);
                                if (await key0.isVisible()) {
                                    await key0.click({ force: true });
                                    await page.waitForTimeout(1000);
                                }
                            } else {
                                botLog(`[AUTO-BOT] ⚠️ Keypad not found, trying manual type...`);
                                await page.keyboard.type("10");
                                await page.waitForTimeout(1000);
                            }
                            
                            await page.waitForTimeout(1500); 

                            // 3. คลิกปุ่ม "พนัน" (Confirm Bet)
                            let betBtn: any = null;
                            botLog(`[AUTO-BOT] 🔍 Searching for "Bet" (พนัน) button...`);
                            
                            for (let r = 0; r < 10; r++) {
                                const btn = page.locator('button, div, span').filter({ hasText: /^พนัน/ }).first();
                                if (await btn.isVisible()) {
                                    betBtn = btn;
                                    break;
                                }
                                await page.waitForTimeout(500);
                            }

                            if (betBtn) {
                                botLog(`[AUTO-BOT] 🚀 Clicking "Bet" (พนัน) button...`);
                                await betBtn.click({ force: true }).catch(async () => {
                                    await betBtn.evaluate((el: HTMLElement) => el.click());
                                });
                                
                                botLog(`[AUTO-BOT] ⏳ Waiting for bet confirmation...`);
                                await page.waitForTimeout(4000); 
                                botLog(`[AUTO-BOT] ✅ Betting process completed!`);
                            } else {
                                botLog(`[AUTO-BOT] ⚠️ Bet button (พนัน) not found. Closing cart...`);
                                await cartIcon.evaluate((el: HTMLElement) => el.click()).catch(() => {});
                            }
                        } else {
                            botLog(`[AUTO-BOT] ⚠️ Amount input field not found after waiting.`);
                        }

                        // 6. ทำความสะอาดและกลับหน้าหลัก
                        await this.cleanupAndGoBack(page);

                    } else {
                        botLog(`[AUTO-BOT] ❌ Price not found. Cleaning up...`);
                        await this.cleanupAndGoBack(page);
                    }
                } else {
                    botLog(`[AUTO-BOT] ❌ Section "${sectionTitle}" not found. Cleaning up...`);
                    await this.cleanupAndGoBack(page);
                }
            } catch (e: any) {
                botLog(`[AUTO-BOT] ⚠️ Error during price/cart selection: ${e.message}`);
                await this.cleanupAndGoBack(page);
            }

            // สั่ง Pause ตัวเองเสมอหลังจากทำภารกิจเสร็จ (ถูกปิดใช้งานตามคำขอ)
            // this.setReady(false);
        } else {
            botLog(`[AUTO-BOT] ❌ Navigation failed. Still on Search Page.`);
            // พยายามล้างช่องค้นหาเพื่อเริ่มใหม่
            const clearBtn = page.locator('.ui-input__clear').first();
            if (await clearBtn.isVisible()) await clearBtn.click({ force: true }).catch(() => {});
            // this.setReady(false);
        }
      } else {
        botLog(`[AUTO-BOT] ❌ Could not find match row in search results for "${homeKey}" vs "${awayKey}" after 5s.`);
        await this.cleanupAndGoBack(page);
        // this.setReady(false); // หยุด Auto-bot
      }

    } catch (error: any) {
      botLog(`[AUTO-BOT] ❌ Process Error: ${error.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  // ฟังก์ชันช่วยย้อนกลับและปิด Popup (รองรับ Popup โบนัสและวงล้อ)
  private static async cleanupAndGoBack(page: Page) {
    botLog(`[AUTO-BOT] 🔙 Returning to search results/main page...`);
    
    // 0. ลบเลเยอร์ที่บังปุ่มออก (ถ้ามี)
    await page.evaluate(() => {
        document.querySelectorAll('.ui-mask, .ui-overlay, ._mask_').forEach(el => el.remove());
    }).catch(() => {});

    // 1. คลิกลูกศรมุมบนซ้าย (Back Button) - ลองหลายวิธี
    // ใช้รหัสสัญลักษณ์ #ui-arrow-418a3a ที่พบใน HTML
    const backBtn = page.locator('.lobby-base-header__back, .ui-arrow--left, [xlink\\:href="#ui-arrow-418a3a"]').first();
    
    try {
        if (await backBtn.isVisible()) {
            botLog(`[AUTO-BOT] 🖱️ Clicking Back button...`);
            await backBtn.click({ force: true, timeout: 2000 }).catch(async () => {
                // ถ้าคลิกธรรมดาไม่ติด ให้คลิกด้วยพิกัด (Fallback)
                await page.mouse.click(25, 20);
            });
        } else {
            botLog(`[AUTO-BOT] ⚠️ Back button not visible, using Coordinate Click & Browser Back...`);
            await page.mouse.click(25, 20).catch(() => {});
            await page.evaluate(() => window.history.back()).catch(() => {});
        }
    } catch (e) {
        await page.evaluate(() => window.history.back()).catch(() => {});
    }
    
    // รอให้หน้าจอเปลี่ยนและ Popup เริ่มโหลด
    await page.waitForTimeout(2500);

    // 2. ปิด Popup ถ้ามี (ทำ 2 รอบ)
    botLog(`[AUTO-BOT] ✖️ Checking for popups (2 rounds)...`);
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
            botLog(`[AUTO-BOT] ✖️ Popup detected. Closing round ${i+1}...`);
            await closeBtn.click({ force: true }).catch(() => {});
            await page.waitForTimeout(2000); 
        } catch (e) {
            // ลองเช็คปุ่ม X ทั่วไป
            const svgClose = page.locator('svg, i, div').filter({ hasText: /^x$/i }).first();
            if (await svgClose.isVisible()) {
                botLog(`[AUTO-BOT] ✖️ Finding generic X button...`);
                await svgClose.click({ force: true }).catch(() => {});
                await page.waitForTimeout(2000);
            } else {
                botLog(`[AUTO-BOT] 💤 No popup detected in round ${i+1}.`);
            }
        }
    }
    
    botLog(`[AUTO-BOT] 🏁 Navigation cleanup finished. Ready for next task.`);
  }

  static async findAndBet(leagueName: string, matchName: string, betSide: string, amount: number, targetLine?: string) {
    if (!this.isReady) return;

    // เพิ่มงานเข้าคิวแทนการรันทันที
    botLog(`[QUEUE] Added signal to queue: ${matchName} (${this.queue.length + 1} in queue)`);
    this.queue.push({ leagueName, matchName, betSide, amount, targetLine });
  }

  private static async executeFullBetFlow(page: any, task: any) {
    const { leagueName, matchName, betSide, amount, targetLine } = task;

    try {
      // 0. ตรวจสอบว่าอยู่หน้า "ฟุตบอล" หรือยัง (ป้องกันการหลงไปหน้าบาสเกตบอล)
      botLog(`[AUTO-BET] Step 0: Ensuring "Football" category is selected...`);
      const footballTab = page.locator('div, span, a, li').filter({ hasText: /^ฟุตบอล$/ }).first();
      const isFootballActive = await footballTab.evaluate((el: any) => {
        // เช็คว่ามี class หรือ style ที่บอกว่า active หรือเปล่า (มักจะเป็นสีส้มหรือมีขีดล่าง)
        return el.classList.contains('active') || el.style.color !== '';
      }).catch(() => false);

      if (!isFootballActive) {
        botLog(`[AUTO-BET] Switching to Football tab...`);
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
      botLog(`[AUTO-BET] Step 1: Scanning for League: ${leagueName} `);
      let foundLeague = false;
      let leagueContainer: any = null;

      for (let i = 0; i < 20; i++) {
        // หา Element ที่ครอบทั้งลีก (ui-collapse-item ที่มีชื่อลีก)
        leagueContainer = page.locator('.ui-collapse-item').filter({ has: page.locator('.ui-cell__title').filter({ hasText: leagueName.substring(0, 15) }) }).first();

        if (await leagueContainer.isVisible()) {
          const header = leagueContainer.locator('.ui-cell--clickable').first();
          const isExpanded = await header.getAttribute('aria-expanded');

          botLog(`[AUTO-BET] Found League Container! (Status: ${isExpanded === 'true' ? 'Expanded' : 'Collapsed'})`);

          if (isExpanded === 'false') {
            botLog(`[AUTO-BET] Expanding League...`);
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
        botLog(`[AUTO-BET] ⚠️ League not found. Using Search Fallback...`);
        await this.useSearchFallback(page, homeKey);
        // หลัง Search ลีกจะกางอัตโนมัติ ให้กำหนด Container ใหม่จากผลการค้นหา
        leagueContainer = page.locator('.ui-collapse-item').first();
      }

      // 2. ไถหา "คู่บอล" เฉพาะภายในลีกที่เลือกเท่านั้น (League Scoping)
      botLog(`[AUTO-BET] Step 2: Scanning for Match Row inside ${leagueName}...`);
      let foundMatch = false;
      let matchRow: any = null;

      for (let i = 0; i < 10; i++) {
        // ค้นหาแถวคู่บอล โดยระบุว่าต้องอยู่ภายใต้ leagueContainer เท่านั้น!
        matchRow = leagueContainer.locator('.match-item, .match-row, .game-item, [class*="match-item"], [class*="game-item"]')
          .filter({ hasText: homeKey })
          .filter({ hasText: awayKey })
          .first();

        if (await matchRow.isVisible()) {
          botLog(`[AUTO-BET] Success! Match Found within scoped league.`);
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
        botLog(`[AUTO-BET] ⚠️ Match not found after expanding. Using Search Fallback...`);
        await this.useSearchFallback(page, homeKey);

        // ลองหาอีกครั้งหลังค้นหา
        const matchRowSearch = page.locator('.match-item, .match-row, .game-item, [class*="match-item"], [class*="game-item"]')
          .filter({ hasText: homeKey })
          .filter({ hasText: awayKey })
          .first();

        if (await matchRowSearch.isVisible()) {
          botLog(`[AUTO-BET] Success! Match Row Found after Search.`);
          foundMatch = true;
          matchRow = matchRowSearch;
        }
      }

      if (!foundMatch) {
        botLog(`[AUTO-BET] ❌ ERROR: Could not find match row for ${homeKey} vs ${awayKey}`);
        return;
      }

      botLog(`[AUTO-BET] Step 3: Finding match "${matchName}" details...`);

      let columnIndex = 0;
      let rowIndex = 0;

      // เช็คฝั่งแบบละเอียด
      const hasUnderdogText = betSide.includes('รอง') || betSide.includes('Underdog');
      const hasAwayName = betSideClean.includes(awayClean) || awayClean.includes(betSideClean);
      const isOver = betSide.includes('สูง') || betSide.includes('Over');
      const isUnder = betSide.includes('ต่ำ') || betSide.includes('Under');

      botLog(` - Flags: hasUnderdogText = ${hasUnderdogText}, hasAwayName = ${hasAwayName}, isOver = ${isOver}, isUnder = ${isUnder}`);

      if (isOver) {
        columnIndex = 1; rowIndex = 0;
      } else if (isUnder) {
        columnIndex = 1; rowIndex = 1;
      } else if (hasUnderdogText || hasAwayName) {
        columnIndex = 0; rowIndex = 1;
      } else {
        columnIndex = 0; rowIndex = 0;
      }

      botLog(`[AUTO-BET] FINAL DECISION -> Col:${columnIndex}, Row:${rowIndex}`);

      // 1. ระบุบล็อกของทีม (Home/Away)
      const blocks = await matchRow.locator('._main_15ywe_157').all();
      botLog(`[AUTO-BET] Found ${blocks.length} data blocks in match row.`);

      if (blocks.length < 2) {
        botLog(`[AUTO-BET] ❌ ERROR: Match row structure unexpected (Blocks < 2).`);
        return;
      }

      // 2. เลือกบล็อกตาม rowIndex
      const targetBlock = blocks[rowIndex];
      const teamNameInBlock = await targetBlock.locator('._team-name_15ywe_182').innerText().catch(() => "N/A");
      botLog(`[AUTO-BET] Targeting Block ${rowIndex + 1}: ${teamNameInBlock}`);

      // 3. ระบุปุ่มราคาในบล็อกนั้น
      const betBoxes = await targetBlock.locator('._bet-box_1ckm8_45').all();
      botLog(`[AUTO-BET] Found ${betBoxes.length} bet boxes in this block.`);

      if (betBoxes.length > columnIndex) {
        const targetBtn = betBoxes[columnIndex];
        const oddsText = await targetBtn.locator('._odds_1qbu6_57').innerText().catch(() => "N/A");
        const labelText = await targetBtn.locator('._bet-label_1ckm8_65').innerText().catch(() => "N/A");

        // --- Line Verification ---
        const tLine = targetLine || "";
        if (tLine && labelText !== "N/A") {
          const cleanTarget = tLine.replace(/[\[\]]/g, '').trim();
          botLog(`[AUTO-BET] Verifying line: Target ${cleanTarget} vs Web ${labelText}`);

          if (!this.isLineMatch(cleanTarget, labelText)) {
            throw new Error(`Line mismatch: Requested ${cleanTarget} but found ${labelText}`);
          }
          botLog(`[AUTO-BET] Line verified!`);
        }

        botLog(` - Final Action: Clicking "${labelText}" with Odds "${oddsText}"...`);
        await targetBtn.scrollIntoViewIfNeeded().catch(() => { });
        await targetBtn.click({ force: true });

        await page.waitForTimeout(1000);
        botLog(`[AUTO-BET] ✅ Success! "${betSide}" (${oddsText}) added to cart.`);

        // บันทึก Log การแทงจริงลงฐานข้อมูล
        await prisma.realBetLog.create({
          data: {
            matchName,
            leagueName,
            betSide,
            oddsAtBet: parseFloat(oddsText.replace(/[^0-9.]/g, '')),
            amount: amount,
            status: 'Executed'
          }
        }).catch((err: any) => botLog(`[REAL-BET-LOG] Error: ${err.message}`));

        return;
      } else {
        botLog(`[AUTO-BET] ❌ ERROR: Could not find bet box at column ${columnIndex} in block ${rowIndex}.`);
        return;
      }
    } catch (error: any) {
      botLog(`[AUTO-BET] ❌ ERROR: ${error.message}`);
      // บันทึก Log กรณีล้มเหลว
      await prisma.realBetLog.create({
        data: {
          matchName,
          leagueName,
          betSide,
          amount: amount,
          status: 'Failed',
          errorMessage: error.message
        }
      }).catch(() => { });
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
    botLog(`[AUTO-BET] Opening search tool...`);

    // 1. คลิกปุ่มค้นหา (ใช้ Javascript Click เพื่อความแน่นอนสูงสุด)
    try {
        await page.evaluate(() => {
            // หาไอคอนแว่นขยายจาก data-src ที่ระบุว่าเป็น SS (แว่นขยาย)
            const icons = Array.from(document.querySelectorAll('i._right-icon_j2hkn_82'));
            const searchIcon = icons.find(el => el.getAttribute('data-src')?.includes('icon_ty_ss.svg'));
            if (searchIcon) {
                (searchIcon as HTMLElement).click();
                return true;
            }
            // ถ้าหาจาก data-src ไม่เจอ ให้ลองคลิกตัวที่ 2 ในกลุ่ม
            if (icons[1]) {
                (icons[1] as HTMLElement).click();
                return true;
            }
            return false;
        });
        
        botLog(` - JS Click triggered.`);
    } catch (e: any) {
        botLog(` - Warning: JS Click failed: ${e.message}`);
    }

    // รอให้หน้าต่างค้นหา (Modal) โผล่ขึ้นมาก่อน
    await page.waitForTimeout(1500);

    // 2. รอและกรอกชื่อลีก
    try {
      // เจาะจงเฉพาะช่อง Input ที่เป็น Text และอยู่ใน Modal ค้นหา
      const inputSelector = 'input.ui-input__input[type="text"], input[placeholder*="ค้นหา"], .ui-input__input input';
      await page.waitForSelector(inputSelector, { state: 'visible', timeout: 8000 });
      
      botLog(`[AUTO-BET] Entering league name: ${leagueName}`);
      const input = page.locator(inputSelector).first();
      await input.fill(''); // ล้างค่าเก่า
      await input.fill(leagueName);
      await page.waitForTimeout(800);

      // 3. กดปุ่มยืนยันการค้นหา
      botLog(`[AUTO-BET] Submitting search...`);
      const submitBtn = page.locator('.ui-input__suffix-icon').last();
      await submitBtn.click({ force: true, timeout: 3000 }).catch(async () => {
        await page.keyboard.press('Enter');
      });

      // **จุดสำคัญ**: รอให้หน้าผลลัพธ์การค้นหาโหลดขึ้นมาจริงๆ (หา Element ที่เป็นผลลัพธ์)
      botLog(`[AUTO-BET] Waiting for search results to load...`);
      await page.waitForTimeout(3000); // ให้เวลาหน้าจอเปลี่ยน
      
    } catch (e: any) {
      botLog(`[AUTO-BET] ❌ Search Step Failed: ${e.message}`);
      throw e;
    }
  }

  private static isLineMatch(target: string, web: string): boolean {
    try {
      const t = parseFloat(target);
      if (isNaN(t)) return web.toLowerCase().includes(target.toLowerCase());

      // Normalize web (e.g. "0.5/1" -> 0.75, "1.5/2" -> 1.75)
      let wValue = 0;
      if (web.includes('/')) {
        const parts = web.split('/').map(p => parseFloat(p.replace(/[^0-9.-]/g, '')));
        wValue = (parts[0] + parts[1]) / 2;
      } else {
        wValue = parseFloat(web.replace(/[^0-9.-]/g, ''));
      }

      // Check absolute value match (signs can be tricky on web UI blocks)
      return Math.abs(Math.abs(t) - Math.abs(wValue)) < 0.01;
    } catch {
      return false;
    }
  }
}
