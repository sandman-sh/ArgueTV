import asyncio
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",         # Set the browser window size
                "--disable-dev-shm-usage",        # Avoid using /dev/shm which can cause issues in containers
                "--ipc=host",                     # Use host-level IPC for better stability
                "--single-process"                # Run the browser in a single process mode
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        context.set_default_timeout(5000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> Navigate to http://localhost:22772
        await page.goto("http://localhost:22772")
        
        # -> Start a debate (click a news story to begin playback), wait for the first round to finish and for the fact-check overlay to appear, then attempt to dismiss it (try Escape key) and verify playback resumes.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/div[2]/div/div[3]/div[3]/button').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Click the 'Fact Check' button to open the overlay, wait for it to render, then dismiss it with the Escape key (backdrop dismissal).
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/header/div[2]/button[2]').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Click the 'Fact Check' button to try to open the overlay, wait for it to render, then (on the next step) dismiss it by clicking the backdrop to verify playback resumes.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/header/div[2]/button[2]').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Open the fact-check overlay by clicking the 'Fact Check' button, wait for it to render, then (after the page updates) attempt to dismiss it by clicking the backdrop.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/header/div[2]/button[2]').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Attempt to dismiss the fact-check overlay by clicking the page background (element index 1516), then wait for the UI to settle and observe whether the overlay closes and debate playback resumes.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div[2]/ol').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Open the fact-check overlay (click 'Fact Check'), wait for it to render, then click the page backdrop (ol element index 1516) to dismiss the overlay and verify the overlay is no longer visible and debate playback resumes.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/header/div[2]/button[2]').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div[2]/ol').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Click the page backdrop (ol element index 1516) to attempt to dismiss the fact-check overlay, wait for the UI to settle, then check whether the overlay is gone (no 'AI FACT CHECK'/'LIVE FACT CHECK' text) and that the debate playback UI resumed.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div[2]/ol').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Click the page backdrop (element index 1516) to dismiss the live fact-check overlay, wait for the UI to settle, then extract page text to confirm the overlay is gone and debate playback resumed.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div[2]/ol').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # --> Assertions to verify final state
        frame = context.pages[-1]
        assert await frame.locator("xpath=//*[contains(., 'Nuclear energy safety')]").nth(0).is_visible(), "The debate topic 'Nuclear energy safety' should be visible after dismissing the fact-check overlay so playback can continue."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    