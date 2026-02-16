const { connect } = require('puppeteer-real-browser');

async function scrapeSPOJ(username) {
    // This library handles the stealth and turnstile bypass logic automatically
    const { browser, page } = await connect({
        headless: false, // Set to false first to see it work
        args: [],
        turnstile: true, // Automatically attempts to solve Turnstile
    });

    try {
        console.log(`🔍 Navigating to SPOJ for: ${username}...`);
        await page.goto(`https://www.spoj.com/status/${username}/`, {
            waitUntil: 'networkidle2',
        });

        // Wait for Cloudflare to clear (up to 30 seconds)
        await page.waitForFunction(() => {
            return !document.body.innerText.includes("Verify you are human") &&
                document.querySelector('table.problems');
        }, { timeout: 30000 });

        const rows = await page.$$eval('table.problems tbody tr', rows => {
            return rows.map(row => {
                const columns = row.querySelectorAll('td');
                if (columns.length < 4) return null;
                const status = columns[3].textContent.trim().toLowerCase();
                if (status.includes('accepted') || status === 'ac') {
                    return {
                        date: columns[1].textContent.trim().split(' ')[0],
                        problem: columns[2].textContent.trim()
                    };
                }
                return null;
            }).filter(row => row !== null);
        });

        console.log('✅ Success:', rows);
        await browser.close();
    } catch (err) {
        console.error('❌ Error:', err.message);
        await browser.close();
    }
}

scrapeSPOJ("akash__9963");