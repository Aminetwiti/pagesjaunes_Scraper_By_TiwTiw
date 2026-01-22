#!/usr/bin/env node

/**
 * PagesJaunes Deep Scraper - Niveau 2 (AMÉLIORÉ)
 * 
 * Lit un JSON existant et visite chaque page /pros/XXXXX en arrière-plan
 * pour extraire les données détaillées depuis le JSON-LD Schema.org
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// === CLI ARGUMENTS ===
const args = process.argv.slice(2);
if (args.length === 0) {
    console.error('Usage: node deep-scraper-v2.js <input.json> [options]');
    console.error('Options:');
    console.error('  --delay <MS>         Délai entre requêtes en ms (default: 2000)');
    console.error('  --max-items <N>      Nombre max d\'items à scraper (default: tous)');
    console.error('  --output <FILE>      Fichier de sortie (default: input_enriched.json)');
    console.error('  --headless           Mode headless (default: true)');
    console.error('\\nExemple:');
    console.error('  node deep-scraper-v2.js pagesjaunes_2026-01-22.json --delay 3000 --max-items 10');
    process.exit(1);
}

const inputFile = args[0];
const options = {
    delay: parseInt(args[args.indexOf('--delay') + 1] || '2000'),
    maxItems: parseInt(args[args.indexOf('--max-items') + 1] || '999999'),
    outputFile: args[args.indexOf('--output') + 1] || inputFile.replace('.json', '_enriched.json'),
    headless: !args.includes('--no-headless')
};

console.log('🚀 PagesJaunes Deep Scraper V2 - JSON-LD Edition');
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

                // Extraire les données détaillées depuis JSON-LD
                const detailedData = await page.evaluate(() => {
                    const data = {};

                    // === PRIORITÉ 1: JSON-LD (Schema.org) ===
                    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                    for (const script of scripts) {
                        try {
                            const jsonData = JSON.parse(script.textContent);
                            const items = Array.isArray(jsonData) ? jsonData : [jsonData];

                            for (const json of items) {
                                if (json['@type'] === 'Restaurant' || json['@type'] === 'LocalBusiness') {
                                    // Téléphone
                                    if (json.telephone && !data.telephone) {
                                        data.telephone = json.telephone;
                                        data.telephone_raw = json.telephone.replace(/\\s/g, '');
                                    }

                                    // Horaires
                                    if (json.openingHours && !data.horaires_ouverture) {
                                        data.horaires_ouverture = json.openingHours;
                                    }

                                    // Adresse
                                    if (json.address && typeof json.address === 'object') {
                                        if (json.address.streetAddress) data.adresse = json.address.streetAddress;
                                        if (json.address.postalCode) data.codePostal = json.address.postalCode;
                                        if (json.address.addressLocality) data.ville = json.address.addressLocality;
                                    }

                                    // GPS
                                    if (json.geo) {
                                        data.latitude = json.geo.latitude?.toString();
                                        data.longitude = json.geo.longitude?.toString();
                                    }

                                    // Note et avis
                                    if (json.aggregateRating) {
                                        data.basicInfo_place_rating = json.aggregateRating.ratingValue?.toString();
                                        data.basicInfo_place_nb_review = json.aggregateRating.reviewCount?.toString();
                                    }

                                    // Prix
                                    if (json.priceRange) data.prix_moyen = json.priceRange;
                                }
                            }
                        } catch (e) { }
                    }

                    // === PRIORITÉ 2: Extraction classique (fallback) ===
                    const bodyText = document.body.innerText;

                    // SIRET
                    if (!data.siret) {
                        const siretMatch = bodyText.match(/SIRET\\s*:?\\s*(\\d{14})/i) || bodyText.match(/\\b(\\d{14})\\b/);
                        if (siretMatch) {
                            data.siret = siretMatch[1];
                            data.siren = siretMatch[1].substring(0, 9);
                        }
                    }

                    // GPS fallback
                    if (!data.latitude) {
                        const mapLinks = document.querySelectorAll('a[href*="maps"]');
                        for (const link of mapLinks) {
                            const coords = link.href.match(/@(-?\\d+\\.\\d+),(-?\\d+\\.\\d+)/);
                            if (coords) {
                                data.latitude = coords[1];
                                data.longitude = coords[2];
                                break;
                            }
                        }
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
                    const newFields = Object.keys(detailedData).filter(k => detailedData[k]);
                    console.log(`   ✅ Enrichi: ${newFields.join(', ')}`);
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
        console.log(`   Avec téléphone: ${data.filter(r => r.telephone).length}`);
        console.log(`   Avec GPS: ${data.filter(r => r.latitude && r.longitude).length}`);
        console.log(`   Avec horaires: ${data.filter(r => r.horaires_ouverture).length}`);
        console.log(`   Avec SIRET: ${data.filter(r => r.siret).length}`);

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
