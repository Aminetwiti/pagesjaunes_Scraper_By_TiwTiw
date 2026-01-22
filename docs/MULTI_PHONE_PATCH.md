# 📝 Patch Manuel - Extraction Multiple de Téléphones

## Problème

Le code actuel n'extrait qu'**un seul** numéro de téléphone par fiche, même quand il y en a plusieurs (ex: fixe + mobile).

## Solution

Remplacer les lignes **288-325** dans `ext/popup.js` par le code suivant :

```javascript
      // Téléphone - Extraire TOUS les numéros (fixe + mobile + etc.)
      let phoneNumbers = [];
      
      // 1. Chercher dans TOUS les liens tel:
      const telLinks = card.querySelectorAll('a[href^="tel:"]');
      telLinks.forEach(link => {
        const phone = link.innerText?.trim() || link.href.replace('tel:', '');
        if (phone && !phoneNumbers.includes(phone)) phoneNumbers.push(phone);
      });
      
      // 2. Chercher dans TOUS les attributs data-phone
      const phoneAttrs = card.querySelectorAll('[data-phone], [data-tel], [data-telephone]');
      phoneAttrs.forEach(attr => {
        const phone = attr.getAttribute('data-phone') || attr.getAttribute('data-tel') || attr.getAttribute('data-telephone');
        if (phone && !phoneNumbers.includes(phone)) phoneNumbers.push(phone);
      });
      
      // 3. Chercher dans TOUS les éléments avec classes phone/tel
      const phoneEls = card.querySelectorAll('[class*="phone"], [class*="tel"], [class*="numero"]');
      phoneEls.forEach(el => {
        if (el.innerText) {
          const matches = el.innerText.matchAll(/(\+33|0)[1-9](?:[ .\-]?\d{2}){4}/g);
          for (const match of matches) {
            if (!phoneNumbers.includes(match[0])) phoneNumbers.push(match[0]);
          }
        }
      });
      
      // 4. Fallback: chercher dans tout le texte - TOUS les numéros
      if (phoneNumbers.length === 0) {
        const matches = card.innerText.matchAll(/(?:\+33|0)\s*[1-9](?:[\s.\-]?\d{2}){4}/g);
        for (const match of matches) {
          if (!phoneNumbers.includes(match[0])) phoneNumbers.push(match[0]);
        }
      }
      
      // Stocker les résultats
      r.telephone = phoneNumbers.join(' ; '); // Tous les numéros séparés par " ; "
      r.telephone_list = phoneNumbers; // Array pour usage programmatique
      r.telephone_raw = phoneNumbers.map(p => p.replace(/[\s.\-]/g, '')).join(';');
```

## Changements Clés

1. **`querySelectorAll`** au lieu de `querySelector` → Trouve TOUS les éléments
2. **`matchAll`** au lieu de `match` → Trouve TOUS les numéros dans un texte
3. **Array `phoneNumbers`** → Stocke tous les numéros trouvés
4. **Déduplication** → `!phoneNumbers.includes(phone)` évite les doublons
5. **Format de sortie** :
   - `telephone`: `"09 81 34 91 79 ; 06 51 76 29 01"` (lisible)
   - `telephone_list`: `["09 81 34 91 79", "06 51 76 29 01"]` (array)
   - `telephone_raw`: `"0981349179;0651762901"` (sans espaces)

## Résultat

**Avant** :
```json
{
  "denomination": "Restaurant ABC",
  "telephone": "09 81 34 91 79"
}
```

**Après** :
```json
{
  "denomination": "Restaurant ABC",
  "telephone": "09 81 34 91 79 ; 06 51 76 29 01",
  "telephone_list": ["09 81 34 91 79", "06 51 76 29 01"],
  "telephone_raw": "0981349179;0651762901"
}
```

## Application Manuelle

1. Ouvrir `ext/popup.js`
2. Aller à la ligne 288
3. Sélectionner jusqu'à la ligne 325
4. Remplacer par le code ci-dessus
5. Sauvegarder
6. Recharger l'extension
