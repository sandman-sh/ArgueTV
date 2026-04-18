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
        
        # -> Enter the first custom debate topic into the topic input and submit to start the first debate session (submit by sending Enter).
        frame = context.pages[-1]
        # Input text
        elem = frame.locator('xpath=/html/body/div/div/div[2]/div/form/div[2]/input').nth(0)
        await asyncio.sleep(3); await elem.fill('Should AI be regulated to prevent misinformation?')
        
        # -> Navigate to the app root (landing/home) so the topic input is available for the second debate.
        await page.goto("http://localhost:22772/")
        
        # -> Enter the second custom debate topic into the topic field and submit (press Enter) to start the second debate, then wait for the arena to load.
        frame = context.pages[-1]
        # Input text
        elem = frame.locator('xpath=/html/body/div/div/div[2]/div/form/div[2]/input').nth(0)
        await asyncio.sleep(3); await elem.fill('Should governments require AI watermarking to prevent misinformation?')
        
        # -> Click the 'Start Debate' button to submit the second topic and wait for the debate arena to load so we can verify the UI shows a single active debate session.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/div[2]/div/form/div[2]/button').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Click the 'Start Debate' button to submit the second topic and wait for the debate arena to load so we can verify the UI shows a single active debate session (not mixed states).
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/div[2]/div/form/div[2]/button').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Start a second debate using a live news 'Debate' button (click element 8174) and wait for the arena to load so we can verify the UI shows a single active debate session (not mixed states).
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/div[2]/div/div[3]/div[3]/button').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Click a different live news 'Debate' button (the Technology story) and wait for the debate arena to load so we can verify whether a second debate session starts and the UI shows a single active session state.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/div[2]/div/div[3]/div[3]/button[2]').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Click a different live-news 'Debate' button (Business / oil prices card) and wait for the debate arena to load so we can verify whether a second debate session starts and the UI shows a single active debate session.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/div[2]/div/div[3]/div[3]/button[3]').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # --> Assertions to verify final state
        frame = context.pages[-1]
        assert await frame.locator("xpath=//*[contains(., 'Should governments require AI watermarking to prevent misinformation?')]").nth(0).is_visible(), "The debate arena should display the latest debate topic after starting the second debate."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    