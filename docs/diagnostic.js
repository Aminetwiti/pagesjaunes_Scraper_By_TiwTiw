// 🔍 SCRIPT DE DIAGNOSTIC - À exécuter dans la console Chrome sur PagesJaunes
// Copier-coller tout ce code dans la console (F12) sur une page de résultats PagesJaunes

console.log('🔍 === DIAGNOSTIC PAGESJAUNES SCRAPER ===\n');

// 1. Vérifier les sélecteurs de cartes
console.log('1️⃣ SÉLECTEURS DE CARTES');
const selectors = [
    'article',
    'li[class*="item"]',
    'section[class*="result"]',
    'div[class*="bi-"]',
    '[data-pj]',
    '[data-listing]',
    '.bi-list li',
    '.bi-list article'
];

selectors.forEach(sel => {
    const count = document.querySelectorAll(sel).length;
    console.log(`  ${sel}: ${count} éléments`);
});

// 2. Trouver le bon sélecteur
console.log('\n2️⃣ ANALYSE DU DOM');
const allCards = document.querySelectorAll('article, li[class*="item"], section[class*="result"], div[class*="bi-"]');
console.log(`  Cartes trouvées: ${allCards.length}`);

if (allCards.length > 0) {
    const firstCard = allCards[0];
    console.log(`  Première carte:`, firstCard);
    console.log(`  Classes:`, firstCard.className);
    console.log(`  ID:`, firstCard.id);
}

// 3. Chercher les boutons "Afficher le N°"
console.log('\n3️⃣ BOUTONS "AFFICHER LE N°"');
const allButtons = document.querySelectorAll('button, a, [class*="phone"], [class*="tel"]');
let phoneButtons = [];

allButtons.forEach(btn => {
    const text = (btn.innerText || btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase();
    if (/afficher.*n°|afficher.*num[ée]ro|voir.*num[ée]ro|afficher.*tel|show.*phone/i.test(text)) {
        phoneButtons.push(btn);
    }
});

console.log(`  Boutons trouvés: ${phoneButtons.length}`);
if (phoneButtons.length > 0) {
    console.log(`  Premier bouton:`, phoneButtons[0]);
    console.log(`  Texte:`, phoneButtons[0].innerText);
}

// 4. Chercher les téléphones dans les cartes
console.log('\n4️⃣ TÉLÉPHONES DANS LES CARTES');
let phonesFound = 0;

allCards.forEach((card, index) => {
    // Chercher tel: link
    const telLink = card.querySelector('a[href^="tel:"]');
    if (telLink) {
        console.log(`  Carte ${index}: ✅ tel: link → ${telLink.innerText}`);
        phonesFound++;
        return;
    }

    // Chercher data attributes
    const phoneAttr = card.querySelector('[data-phone], [data-tel], [data-telephone]');
    if (phoneAttr) {
        const phone = phoneAttr.getAttribute('data-phone') || phoneAttr.getAttribute('data-tel') || phoneAttr.getAttribute('data-telephone');
        console.log(`  Carte ${index}: ✅ data attribute → ${phone}`);
        phonesFound++;
        return;
    }

    // Chercher classes phone/tel
    const phoneEl = card.querySelector('[class*="phone"], [class*="tel"], [class*="numero"]');
    if (phoneEl && phoneEl.innerText) {
        const phoneMatch = phoneEl.innerText.match(/(\+33|0)[1-9](?:[ .\-]?\d{2}){4}/);
        if (phoneMatch) {
            console.log(`  Carte ${index}: ✅ phone class → ${phoneMatch[0]}`);
            phonesFound++;
            return;
        }
    }

    // Chercher dans le texte
    const phoneMatch = card.innerText.match(/(?:\+33|0)\s*[1-9](?:[\s.\-]?\d{2}){4}/);
    if (phoneMatch) {
        console.log(`  Carte ${index}: ✅ full text → ${phoneMatch[0]}`);
        phonesFound++;
    } else {
        console.log(`  Carte ${index}: ❌ Pas de téléphone trouvé`);
        // Afficher un échantillon du texte
        console.log(`    Texte: ${card.innerText.substring(0, 150)}...`);
    }
});

console.log(`\n  Total téléphones trouvés: ${phonesFound}/${allCards.length}`);

// 5. Tester le regex
console.log('\n5️⃣ TEST DU REGEX');
const testNumbers = [
    '01 23 45 67 89',
    '01.23.45.67.89',
    '01-23-45-67-89',
    '0123456789',
    '+33 1 23 45 67 89',
    '+33123456789',
    'Tél : 01 23 45 67 89',
    'Téléphone: 0123456789'
];

testNumbers.forEach(test => {
    const match = test.match(/(?:\+33|0)\s*[1-9](?:[\s.\-]?\d{2}){4}/);
    console.log(`  "${test}" → ${match ? '✅ ' + match[0] : '❌'}`);
});

// 6. Résumé
console.log('\n📊 === RÉSUMÉ ===');
console.log(`  Cartes détectées: ${allCards.length}`);
console.log(`  Boutons "Afficher": ${phoneButtons.length}`);
console.log(`  Téléphones trouvés: ${phonesFound}`);
console.log(`  Taux de succès: ${Math.round(phonesFound / allCards.length * 100)}%`);

// 7. Recommandations
console.log('\n💡 === RECOMMANDATIONS ===');
if (allCards.length === 0) {
    console.log('  ⚠️ Aucune carte détectée ! Le sélecteur est incorrect.');
    console.log('  → Inspecter le HTML et trouver le bon sélecteur');
} else if (phoneButtons.length === 0) {
    console.log('  ⚠️ Aucun bouton "Afficher le N°" détecté !');
    console.log('  → Vérifier que vous êtes sur une page de résultats');
} else if (phonesFound < allCards.length / 2) {
    console.log('  ⚠️ Moins de 50% des téléphones trouvés !');
    console.log('  → Cliquer sur les boutons "Afficher le N°" avant d\'extraire');
    console.log('  → Ou améliorer la logique d\'extraction');
} else {
    console.log('  ✅ Tout semble OK !');
    console.log('  → Vérifier que l\'extension est bien rechargée');
}

console.log('\n✅ Diagnostic terminé !\n');
