// 🔍 DIAGNOSTIC RÉSEAUX SOCIAUX
// À lancer dans la console sur une page PRO

console.log('🔍 Analyse Section "Sites et réseaux sociaux"');

// 1. Chercher le titre de section
const titles = Array.from(document.querySelectorAll('h2, h3, .bloc-info-titre'));
const socialTitle = titles.find(t => t.innerText && t.innerText.toLowerCase().includes('réseaux'));

if (socialTitle) {
    console.log('✅ Titre trouvé:', socialTitle);
    console.log('   Conteneur parent:', socialTitle.parentElement);

    // Lister les liens dans ce conteneur
    const container = socialTitle.closest('div, section');
    if (container) {
        const links = container.querySelectorAll('a');
        console.log(`   Liens trouvés dans le bloc (${links.length}):`);
        links.forEach(l => console.log('   -', l.href, '(', l.innerText, ')'));
    }
} else {
    console.log('❌ Titre "Réseaux sociaux" non trouvé');
}

// 2. Chercher tous les liens sociaux de la page
console.log('\n🌐 Tous les liens sociaux de la page :');
const networks = ['facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'pinterest'];
networks.forEach(net => {
    const links = document.querySelectorAll(`a[href*="${net}.com"]`);
    if (links.length > 0) {
        console.log(`   ${net} (${links.length}):`);
        links.forEach(l => {
            // Vérifier si c'est un lien de partage (souvent contient 'share', 'sharer' ou est dans un bouton de partage)
            const isShare = l.href.includes('share') || l.closest('.share-btn') || l.closest('[class*="partage"]');
            console.log(`     - ${l.href} ${isShare ? '⚠️ Probable PARTAGE' : '✅ Probable PROFIL'}`);
        });
    }
});
