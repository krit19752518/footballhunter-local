
import os
import re

file_path = r'c:\FootballHunter2\backend\src\services\browser.service.ts'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Enhance cleanupAndGoBack to guarantee return to main page
safety_check = """
    // 3. เช็คความชัวร์ว่ากลับมาหน้าหลักแล้วจริงๆ (มองหาปุ่มค้นหาหรือสัญลักษณ์หน้าหลัก)
    const isMain = await page.locator('.icon-search, .search-icon, .fa-search, [class*="search"]').first().isVisible().catch(() => false);
    if (!isMain) {
        this.smartLog(`[AUTO-BOT] 🚨 Still not on main page after back. Force navigating...`);
        await page.goto('https://www.bet5688q.com/home/sport/soccer', { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(3000);
    }
"""

# Insert safety_check right before the end of cleanupAndGoBack
# Look for the end of cleanupAndGoBack function. It ends around line 680 with `this.smartLog(`[AUTO-BOT] 🏁 Navigation cleanup finished. Ready for next task.`);`
if '🚨 Still not on main page after back' not in content:
    content = content.replace('this.smartLog(`[AUTO-BOT] 🏁 Navigation cleanup finished. Ready for next task.`);', safety_check + '\n    this.smartLog(`[AUTO-BOT] 🏁 Navigation cleanup finished. Ready for next task.`);')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Enhanced cleanupAndGoBack safety")
