import asyncio
from playwright.async_api import async_playwright

async def get_console_errors():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        
        errors = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
        page.on("pageerror", lambda err: errors.append(err.message))
        
        try:
            # First need to simulate login by setting localStorage or API cookies, but wait - the crash happens immediately on render of AdminOffers, which suggests it fails before auth OR during auth.
            # But the user is logged in. Let's just go directly to the page. If it redirects, it means we hit auth block.
            await page.goto("http://localhost:8080/admin/offers-new")
            await page.wait_for_timeout(3000)
            print("Errors captured:")
            for e in errors:
                print("E:", e)
        except Exception as e:
            print("Err:", e)
        
        await browser.close()

asyncio.run(get_console_errors())
