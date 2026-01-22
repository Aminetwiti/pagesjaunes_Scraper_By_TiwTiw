#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// === CLI ARGUMENTS ===
const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('Usage: node scraper.js <URL> [options]');
    console.error('Options:');
    console.error('  --max-pages <N>      Maximum pages to scrape (default: 1)');
    console.error('  --page-delay <MS>    Delay between pages in ms (default: 2000)');
    console.error('  --reveal-phones      Click to reveal phone numbers');
    console.error('  --output <DIR>       Output directory (default: ./output)');
    console.error('\nExample:');
    console.error('  node scraper.js "https://www.pagesjaunes.fr/annuaire/paris-75000/restaurants" --max-pages 3 --reveal-phones');
    process.exit(1);
}

const targetUrl = args[0];
const options = {
    autoPaginate: args.includes('--max-pages'),
    revealPhones: args.includes('--reveal-phones'),
    maxPages: parseInt(args[args.indexOf('--max-pages') + 1] || '1'),
    pageDelay: parseInt(args[args.indexOf('--page-delay') + 1] || '2000'),
    outputDir: args[args.indexOf('--output') + 1] || './output'
};

console.log('🚀 PagesJaunes Scraper Starting...');
console.log('📍 Target URL:', targetUrl);
console.log('⚙️  Options:', JSON.stringify(options, null, 2));

// === MAIN SCRAPER ===
(async () => {
    let browser;
    try {
        // Launch browser
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        console.log('🌐 Navigating to page...');
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        console.log('📊 Extracting data...');

        // Inject and execute the extraction function
        const results = await page.evaluate(async (opts) => {
            // === EXTRACTION FUNCTION (PORTED FROM popup.js) ===
            const allResults = [];
            let currentPage = 1;

            // Reveal phones - IMPROVED
            if (opts.revealPhones) {
                const phoneButtons = document.querySelectorAll(
                    'button[class*="phone"], button[class*="tel"], ' +
                    'a[class*="phone"], [data-phone], [onclick*="phone"], ' +
                    'button, a'
                );
                for (const btn of phoneButtons) {
                    const text = btn.innerText || btn.getAttribute('aria-label') || '';
                    if (/afficher|voir.*num[ée]ro|t[ée]l[ée]phone/i.test(text)) {
                        try {
                            btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            await new Promise(r => setTimeout(r, 200));
                            btn.click();
                            await new Promise(r => setTimeout(r, 500)); // Increased delay
                        } catch (e) {
                            console.log('Failed to reveal phone:', e.message);
                        }
                    }
                }
            }

            function extractPage() {
                const cards = document.querySelectorAll('article, li[class*="item"], section[class*="result"], div[class*="bi-"]');
                const results = [];

                cards.forEach(card => {
                    const r = {};

                    // === BASE ===
                    const nameLink = card.querySelector('a[href*="/pros/"], h2 a, h3 a, [class*="denom"]');
                    r.denomination = nameLink?.innerText?.trim() || '';
                    const pjLink = card.querySelector('a[href*="/pros/"]');
                    r.url = pjLink?.href || '';
                    // Filter out photo gallery entries and invalid data
                    if (!r.denomination || !r.url || /^\d+\s+photos?$/i.test(r.denomination)) return;

                    // === CONTACT ===
                    r.email = (card.innerHTML.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/) || [])[0] || '';
                    const telLink = card.querySelector('a[href^="tel:"]');
                    r.telephone = telLink?.innerText?.trim() || ((card.innerText.match(/(\\+33|0)[1-9](?:[ .\\-]?\\d{2}){4}/) || [])[0]) || '';
                    r.telephone_raw = r.telephone.replace(/\\s/g, '');
                    r.site_web = '';
                    card.querySelectorAll('a[href]').forEach(a => {
                        const h = a.getAttribute('href') || '';
                        if (/^https?:\/\//.test(h) && !/pagesjaunes\.fr/.test(h) && !r.site_web) r.site_web = h;
                    });

                    // === ADRESSE - IMPROVED ===
                    const addrEl = card.querySelector('[itemprop="streetAddress"], [class*="adresse"], [class*="address"]');
                    r.adresse_full_long = (addrEl?.innerText?.trim() || '')
                        .replace(/Voir le plan/gi, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                    const m = r.adresse_full_long.match(/(\\d{5})\\s+([A-Za-zÀ-ÿ\\s\\-]+)$/);
                    r.codePostal = m ? m[1] : '';
                    r.ville = m ? m[2].trim().replace(/Voir le plan/gi, '').trim() : '';
                    r.adresse = r.adresse_full_long.replace(/\\d{5}\\s+[A-Za-zÀ-ÿ\\s\\-]+$/, '').trim();

                    // Extract GPS from Google Maps links
                    r.latitude = card.getAttribute('data-lat') || '';
                    r.longitude = card.getAttribute('data-lng') || '';
                    if (!r.latitude || !r.longitude) {
                        const mapLink = card.querySelector('a[href*="maps.google"], a[href*="maps"], a[href*="plan"]');
                        if (mapLink) {
                            const coords = mapLink.href.match(/@(-?\\d+\\.\\d+),(-?\\d+\\.\\d+)/);
                            if (coords) {
                                r.latitude = coords[1];
                                r.longitude = coords[2];
                            }
                        }
                    }

                    // === BUSINESS ===
                    const siretM = card.innerText.match(/\\b(\\d{14})\\b/);
                    r.siret = siretM ? siretM[1] : '';
                    r.siren = r.siret ? r.siret.substring(0, 9) : '';
                    const catEl = card.querySelector('[class*="categorie"], [class*="rubrique"]');
                    r.activite = catEl?.innerText?.trim() || '';
                    r.categorie = r.activite;
                    r.code_naf = (card.innerText.match(/\\b(\\d{4}[A-Z])\\b/) || [])[1] || '';

                    // === RATINGS ===
                    const ratingEl = card.querySelector('[itemprop="ratingValue"], [class*="note"]');
                    r.basicInfo_place_rating = ratingEl?.innerText?.trim() || ratingEl?.getAttribute('content') || '';
                    const reviewEl = card.querySelector('[itemprop="reviewCount"], [class*="nb-avis"]');
                    r.basicInfo_place_nb_review = reviewEl?.innerText?.trim() || reviewEl?.getAttribute('content') || '';

                    // === HORAIRES - IMPROVED ===
                    const hoursEl = card.querySelector(
                        '[itemprop="openingHours"], ' +
                        '[class*="horaire"], ' +
                        '[class*="hours"], ' +
                        '[data-hours], ' +
                        '.opening-hours'
                    );
                    r.horaires_ouverture = hoursEl?.innerText?.trim() || '';

                    // === DESCRIPTION ===
                    const descEl = card.querySelector('[class*="description"], [itemprop="description"]');
                    r.description = descEl?.innerText?.trim() || '';

                    // === SOCIAL ===
                    r.facebook = ''; r.twitter = ''; r.linkedin = ''; r.instagram = '';
                    card.querySelectorAll('a[href]').forEach(a => {
                        const h = a.getAttribute('href') || '';
                        if (/facebook\\.com/i.test(h)) r.facebook = h;
                        if (/twitter\\.com|x\\.com/i.test(h)) r.twitter = h;
                        if (/linkedin\\.com/i.test(h)) r.linkedin = h;
                        if (/instagram\\.com/i.test(h)) r.instagram = h;
                    });

                    // === PHOTOS - IMPROVED ===
                    r.logo = card.querySelector('img[class*="logo"]')?.src || '';
                    r.photos = Array.from(card.querySelectorAll('img'))
                        .filter(i => {
                            if (!i.src || !i.src.startsWith('http')) return false;
                            if (i.src.includes('logo')) return false;
                            // Filter out placeholder and asset images
                            if (i.src.includes('/assets/')) return false;
                            if (i.src.includes('placeholder')) return false;
                            if (i.src.includes('Ajouter-')) return false;
                            if (i.src.includes('Referencer-')) return false;
                            // Filter out small icons (if naturalWidth is available)
                            const width = i.naturalWidth || i.width || 200;
                            if (width < 100) return false;
                            return true;
                        })
                        .map(i => i.src)
                        .slice(0, 10)
                        .join(', ');

                    // === SERVICES ===
                    r.services = Array.from(card.querySelectorAll('[class*="service"], [class*="prestation"]')).map(e => e.innerText?.trim()).join(', ');
                    r.equipements = '';

                    // === PAYMENT ===
                    r.moyens_paiement = card.querySelector('[class*="paiement"]')?.innerText?.trim() || '';

                    // === BRANDS ===
                    r.marques = card.querySelector('[class*="marque"]')?.innerText?.trim() || '';

                    // === LANGUES ===
                    r.langues = card.querySelector('[class*="langue"]')?.innerText?.trim() || '';

                    // === CERTIFICATIONS - IMPROVED ===
                    const certText = card.querySelector('[class*="certification"], [class*="label"]')?.innerText?.trim() || '';
                    r.certifications = /voir le plan/i.test(certText) ? '' : certText;

                    // === PRIX ===
                    const priceEl = card.querySelector('[class*="tarif"], [class*="prix"]');
                    r.tarifs = priceEl?.innerText?.trim() || '';
                    r.prix_moyen = (r.tarifs.match(/(\\d+)\\s*€/) || [])[1] || '';

                    // === STAFF / FINANCIAL ===
                    r.dirigeant = ''; r.nombre_employes = ''; r.chiffre_affaires = ''; r.capital = '';
                    r.date_creation = ''; r.forme_juridique = ''; r.effectif = '';

                    results.push(r);
                });

                return results;
            }

            allResults.push(...extractPage());

            // Pagination
            if (opts.autoPaginate && currentPage < opts.maxPages) {
                while (currentPage < opts.maxPages) {
                    let next = null;
                    ['a[rel="next"]', 'a[aria-label*="suivant"]'].forEach(s => {
                        try {
                            const el = document.querySelector(s);
                            if (el && !el.classList.contains('disabled')) next = el;
                        } catch (e) { }
                    });
                    if (!next) break;
                    try {
                        next.scrollIntoView({ behavior: 'smooth' });
                        await new Promise(r => setTimeout(r, 500));
                        next.click();
                        await new Promise(r => setTimeout(r, opts.pageDelay));
                        if (opts.revealPhones) {
                            document.querySelectorAll('button, a').forEach(btn => {
                                if (/afficher.*num[ée]ro/i.test(btn.innerText || '')) {
                                    try { btn.click(); } catch (e) { }
                                }
                            });
                            await new Promise(r => setTimeout(r, 500));
                        }
                        allResults.push(...extractPage());
                        currentPage++;
                    } catch (e) { break; }
                }
            }

            const seen = new Set();
            return allResults.filter(r => {
                const k = r.url + r.denomination;
                if (seen.has(k)) return false;
                seen.add(k);
                return true;
            });
        }, options);

        console.log(`✅ Extracted ${results.length} records`);

        // Create output directory
        if (!fs.existsSync(options.outputDir)) {
            fs.mkdirSync(options.outputDir, { recursive: true });
        }

        // Save JSON
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const jsonPath = path.join(options.outputDir, `pagesjaunes_${timestamp}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
        console.log(`💾 JSON saved: ${jsonPath}`);

        // Save CSV
        if (results.length > 0) {
            const keys = Object.keys(results[0]);
            const esc = v => '"' + String(v || '').replace(/"/g, '""') + '"';
            const csv = [keys.join(','), ...results.map(r => keys.map(k => esc(r[k])).join(','))].join('\n');
            const csvPath = path.join(options.outputDir, `pagesjaunes_${timestamp}.csv`);
            fs.writeFileSync(csvPath, csv);
            console.log(`💾 CSV saved: ${csvPath}`);
        }

        // Print stats
        console.log('\n📈 Statistics:');
        console.log(`   Total records: ${results.length}`);
        console.log(`   With phones: ${results.filter(r => r.telephone).length}`);
        console.log(`   With emails: ${results.filter(r => r.email).length}`);
        console.log(`   With websites: ${results.filter(r => r.site_web).length}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
})();
