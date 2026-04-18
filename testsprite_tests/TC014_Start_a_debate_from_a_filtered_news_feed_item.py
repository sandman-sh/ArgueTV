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
        
        # -> Open the country filter dropdown so the country options become visible (click element [8]).
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/div[2]/div/div[3]/div/div[2]/div/select').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Click a visible news card (one of the live news links) to start a debate and wait for the debate arena to load.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/div[3]/div[3]/div[3]/a[9]').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Click the 'Debate' action on a visible news card (index 1714) to open the debate arena, then wait for the debate arena to load and display generated content for two agents.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/div[2]/div/div[3]/div[3]/button').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Click the 'Debate' action on a visible news card (index 2097) and wait for the debate arena to load and display generated content for two agents.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/div[2]/div/div[3]/div[3]/button').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Click the 'Debate' action on a visible news card (start a debate from a live news card) and wait for the debate arena to load and display generated content for two agents.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/div[2]/div/div[3]/div[3]/button').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Click the Debate action on the visible news card (index 5269) and wait for the debate arena to load and display generated content for two agents.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/div[2]/div/div[3]/div[3]/button').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Click the 'Debate' action on the visible news card (index 6859) and wait for the debate arena to load and display generated content for two agents.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/div[2]/div/div[3]/div[3]/button').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # --> Assertions to verify final state
        frame = context.pages[-1]
        assert await frame.locator("xpath=//*[contains(., 'Agent 1')]").nth(0).is_visible(), "The debate arena should display generated content for two agents after starting a debate from a news card"
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    