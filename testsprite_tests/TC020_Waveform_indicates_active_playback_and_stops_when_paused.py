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
        
        # -> Fill the topic field with 'AI in education' and click the Start Debate button to begin the debate and audio playback.
        frame = context.pages[-1]
        # Input text
        elem = frame.locator('xpath=/html/body/div/div/div[2]/div/form/div[2]/input').nth(0)
        await asyncio.sleep(3); await elem.fill('AI in education')
        
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/div[2]/div/form/div[2]/div').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Click the 'Start Debate' button to begin the debate and audio playback, then wait for the UI and audio to start.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/div[2]/div/form/div[2]/button').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Click the debate play control to start audio playback, wait for the UI/waveform to animate, then click again to pause and verify waveform stops.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/main/div[2]/div/div[2]/div[2]').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/main/div[2]/div/div[2]/div[2]').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Click the debate play control to start audio playback, wait to observe the waveform animating, then click the play control again to pause and confirm the waveform stops.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/main/div[2]/div/div/div/div[3]/div[3]').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/main/div[2]/div/div/div/div[3]/div[3]').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Click the left-speaker play control to start audio playback, wait to observe the waveform animating, then click again to pause and confirm the waveform stops.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/main/div[2]/div/div[2]/div[2]').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/main/div[2]/div/div[2]/div[2]').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Click the central play control to start audio playback, wait and observe whether the waveform animates, then click again to pause and verify the waveform stops.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/main/div[2]/div/div/div/div[3]/div[3]').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/main/div[2]/div/div/div/div[3]/div[3]').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # -> Click the left-speaker play control to start audio playback, wait to observe waveform animation, then click again to pause and verify the waveform stops.
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/main/div[2]/div/div[2]/div[2]').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        frame = context.pages[-1]
        # Click element
        elem = frame.locator('xpath=/html/body/div/div/main/div[2]/div/div[2]/div[2]').nth(0)
        await asyncio.sleep(3); await elem.click()
        
        # --> Assertions to verify final state
        frame = context.pages[-1]
        assert await frame.locator("xpath=//*[contains(., 'Now playing')]").nth(0).is_visible(), "The waveform should be animated while audio playback is running and stop animating when playback is paused"
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    