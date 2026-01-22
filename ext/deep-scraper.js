#!/usr/bin/env node

/**
 * PagesJaunes Deep Scraper - Niveau 2
 * 
 * Lit un JSON existant et visite chaque page /pros/XXXXX en arrière-plan
 * pour extraire les données détaillées (SIRET, GPS, horaires, etc.)
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// === CONFIGURATION ===
const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('Usage: node deep-scraper.js <input.json> [options]');
    console.error('Options:');
    console.error('  --delay <MS>         Délai entre requêtes en ms (default: 2000)');
    console.error('  --max-items <N>      Nombre max d\'items à scraper (default: tous)');
    console.error('  --output <FILE>      Fichier de sortie (default: input_enriched.json)');
    console.error('  --headless           Mode headless (default: true)');
    console.error('\\nExemple:');
    console.error('  node deep-scraper.js pagesjaunes_2026-01-22.json --delay 3000 --max-items 10');
    process.exit(1);
}

const inputFile = args[0];
const options = {
    delay: parseInt(args[args.indexOf('--delay') + 1] || '2000'),
    maxItems: parseInt(args[args.indexOf('--max-items') + 1] || '999999'),
    outputFile: args[args.indexOf('--output') + 1] || inputFile.replace('.json', '_enriched.json'),
    headless: !args.includes('--no-headless')
};

console.log('🚀 PagesJaunes Deep Scraper - Niveau 2');
console.log('📁 Input:', inputFile);
console.log('⚙️  Options:', JSON.stringify(options, null, 2));

// === MAIN ===
(async () => {
    let browser;
    try {
        // Charger le JSON existant
        if (!fs.existsSync(inputFile)) {
            throw new Error(`Fichier non trouvé: ${inputFile}`);
        }

        const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
        console.log(`📊 ${data.length} entrées trouvées`);

        // Limiter le nombre d'items
        const itemsToProcess = data.slice(0, options.maxItems);
        console.log(`🎯 Traitement de ${itemsToProcess.length} entrées`);

        // Lancer le navigateur
        browser = await puppeteer.launch({
            headless: options.headless ? 'new' : false,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // Scraper chaque page
        let processed = 0;
        let enriched = 0;

        for (const item of itemsToProcess) {
            processed++;
            const url = item.url;

            // Vérifier si l'URL est valide
            if (!url || !url.includes('/pros/')) {
                console.log(`⏭️  [${processed}/${itemsToProcess.length}] Skipping: ${item.denomination} (pas d'URL)`);
                continue;
            }

            console.log(`\\n🔍 [${processed}/${itemsToProcess.length}] ${item.denomination}`);
            console.log(`   URL: ${url}`);

            try {
                // Naviguer vers la page
                await page.goto(url, {
                    waitUntil: 'networkidle2',
                    timeout: 30000
                });

                // Extraire les données détaillées
                const detailedData = await page.evaluate(() => {
                    const data = {};

                    // === SIRET / SIREN ===
                    const siretText = document.body.innerText;
                    const siretMatch = siretText.match(/SIRET\\s*:?\\s*(\\d{14})/i) ||
                        siretText.match(/\\b(\\d{14})\\b/);
                    if (siretMatch) {
                        data.siret = siretMatch[1];
                        data.siren = siretMatch[1].substring(0, 9);
                    }

                    // === GPS / COORDONNÉES ===
                    // Chercher dans les liens Google Maps
                    const mapLinks = document.querySelectorAll('a[href*="maps.google"], a[href*="google.com/maps"]');
                    for (const link of mapLinks) {
                        const coords = link.href.match(/@(-?\\d+\\.\\d+),(-?\\d+\\.\\d+)/);
                        if (coords) {
                            data.latitude = coords[1];
                            data.longitude = coords[2];
                            break;
                        }
                    }

                    // Chercher dans les attributs data
                    const mapEl = document.querySelector('[data-lat], [data-latitude]');
                    if (mapEl && !data.latitude) {
                        data.latitude = mapEl.getAttribute('data-lat') || mapEl.getAttribute('data-latitude');
                        data.longitude = mapEl.getAttribute('data-lng') || mapEl.getAttribute('data-longitude');
                    }

                    // Chercher dans les scripts JSON-LD
                    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                    for (const script of scripts) {
                        try {
                            const json = JSON.parse(script.textContent);
                            if (json.geo && json.geo.latitude) {
                                data.latitude = json.geo.latitude.toString();
                                data.longitude = json.geo.longitude.toString();
                            }
                        } catch (e) { }
                    }

                    // === HORAIRES D'OUVERTURE ===
                    const hoursEl = document.querySelector(
                        '[itemprop="openingHours"], ' +
                        '.opening-hours, ' +
                        '[class*="horaire"], ' +
                        '[class*="hours"]'
                    );
                    if (hoursEl) {
                        data.horaires_ouverture = hoursEl.innerText.trim();
                    }

                    // Chercher les horaires dans le texte
                    const hoursPattern = /(Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche)[^\\n]{0,100}(\\d{1,2}h\\d{2}|\\d{1,2}:\\d{2})/gi;
                    const hoursMatches = siretText.match(hoursPattern);
                    if (hoursMatches && !data.horaires_ouverture) {
                        data.horaires_ouverture = hoursMatches.slice(0, 7).join(' | ');
                    }

                    // === TÉLÉPHONE (si manquant) ===
                    if (!data.telephone) {
                        const telLink = document.querySelector('a[href^="tel:"]');
                        if (telLink) {
                            data.telephone = telLink.innerText.trim();
                            data.telephone_raw = data.telephone.replace(/\\s/g, '');
                        }
                    }

                    // === EMAIL (si manquant) ===
                    if (!data.email) {
                        const emailMatch = document.body.innerHTML.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/);
                        if (emailMatch) {
                            data.email = emailMatch[0];
                        }
                    }

                    // === CODE NAF ===
                    const nafMatch = siretText.match(/NAF\\s*:?\\s*(\\d{4}[A-Z])/i) ||
                        siretText.match(/\\b(\\d{4}[A-Z])\\b/);
                    if (nafMatch) {
                        data.code_naf = nafMatch[1];
                    }

                    // === INFORMATIONS LÉGALES ===
                    const capitalMatch = siretText.match(/Capital\\s*:?\\s*([\\d\\s]+)\\s*€/i);
                    if (capitalMatch) {
                        data.capital = capitalMatch[1].replace(/\\s/g, '');
                    }

                    const formeMatch = siretText.match(/Forme\\s*juridique\\s*:?\\s*([A-Z]{2,})/i);
                    if (formeMatch) {
                        data.forme_juridique = formeMatch[1];
                    }

                    return data;
                });

                // Fusionner les données
                let hasNewData = false;
                for (const [key, value] of Object.entries(detailedData)) {
                    if (value && (!item[key] || item[key] === '')) {
                        item[key] = value;
                        hasNewData = true;
                    }
                }

                if (hasNewData) {
                    enriched++;
                    console.log(`   ✅ Enrichi:`, Object.keys(detailedData).filter(k => detailedData[k]).join(', '));
                } else {
                    console.log(`   ⚠️  Aucune donnée nouvelle`);
                }

                // Délai entre requêtes
                if (processed < itemsToProcess.length) {
                    await new Promise(r => setTimeout(r, options.delay));
                }

            } catch (error) {
                console.log(`   ❌ Erreur: ${error.message}`);
            }
        }

        // Sauvegarder le résultat
        fs.writeFileSync(options.outputFile, JSON.stringify(data, null, 2));
        console.log(`\\n💾 Fichier enrichi sauvegardé: ${options.outputFile}`);

        // Statistiques
        console.log('\\n📈 Statistiques:');
        console.log(`   Entrées traitées: ${processed}`);
        console.log(`   Entrées enrichies: ${enriched}`);
        console.log(`   Avec SIRET: ${data.filter(r => r.siret).length}`);
        console.log(`   Avec GPS: ${data.filter(r => r.latitude && r.longitude).length}`);
        console.log(`   Avec horaires: ${data.filter(r => r.horaires_ouverture).length}`);

    } catch (error) {
        console.error('❌ Erreur:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
})();
