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
        
        # -> Start a debate on a live story to run a round and wait for the fact-check overlay to appear, then verify it contains a verdict badge and an explanation text block.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/div[2]/div/div[3]/div[3]/button').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Open the fact-check overlay by clicking the Fact Check button, wait for the overlay to appear, and extract the overlay content to verify a visible verdict badge and an explanation text block.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/header/div[2]/button[2]').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Click the Fact Check button to open the overlay, wait for the UI to render, and then inspect the overlay for a visible verdict badge and an explanation text block.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/header/div[2]/button[2]').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Click the Fact Check button to open the overlay, wait for the UI to render, and extract the overlay content to verify a visible verdict badge and an explanation text block.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/header/div[2]/button[2]').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Click the Fact Check button to open the overlay, wait for the UI to render, and extract the overlay content to check for a visible verdict badge and an explanation text block.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/header/div[2]/button[2]').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Click the Fact Check button, wait for the overlay to render, and extract the overlay content to check for a visible verdict badge and an explanation text block.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/header/div[2]/button[2]').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # --> Assertions to verify final state
        frame = context.pages[-1]
        assert (await frame.locator("xpath=//*[contains(., 'False')]").nth(0).is_visible()) and (await frame.locator("xpath=//*[contains(., 'Explanation')]").nth(0).is_visible()), "The fact-check overlay should display a verdict badge 'False' and an explanation text block after a round completes"
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    