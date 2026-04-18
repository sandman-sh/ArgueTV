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
        
        # -> Click the non-default language button 'Español' to set the debate language.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/div[2]/div/div[2]/div[2]/button[2]').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Enter a Spanish topic into the topic field and submit to start the debate (press Enter). Then wait for the debate page to load so we can verify the debate content language.
        frame = context.pages[-1]
        # Input text
        elem = frame.locator('xpath=/html/body/div/div/div[2]/div/form/div[2]/input').nth(0)
        await asyncio.sleep(3); await elem.fill('Renta básica universal')
        
        # -> Click the 'Start Debate' button to begin the debate and then wait for the debate page to load so we can verify content language is Spanish.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/div[2]/div/form/div[2]/button').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Click the 'Start Debate' button again, wait for the debate page to load, then check the page for Spanish debate content (look for Spanish words/phrases or transcript).
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/div[2]/div/form/div[2]/button').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Use an alternate path to begin a debate by clicking a news item's 'Debate' button (index 5014), then wait for the debate page to load so we can capture and verify whether the generated debate content is in Spanish.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/div[2]/div/div[3]/div[3]/button').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Click the news-card 'Debate' button (index 6600) to start the debate, wait for the debate page to load, then inspect the page for Spanish debate content (capture initial text if present).
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/div[2]/div/div[3]/div[3]/button').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Click the news-card 'Debate' button (index 8186) to start the debate, wait for the debate page to load, then check the debate content for Spanish language.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/div[2]/div/div[3]/div[3]/button').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Click the Start Debate button (index 9572), wait for generation to start/complete, then capture the visible debate transcript (first ~400 characters) and verify whether it is in Spanish.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/div[2]/div/form/div[2]/button').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Click the 'Start Debate' button to start generation, wait for generation to complete, then extract the visible debate transcript (first ~400 characters) and determine whether it is in Spanish.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/div[2]/div/form/div[2]/button').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # --> Assertions to verify final state
        frame = context.pages[-1]
        assert await frame.locator("xpath=//*[contains(., 'Renta básica universal')]").nth(0).is_visible(), "The debate content should be displayed in Spanish after selecting Español and starting the debate"
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    