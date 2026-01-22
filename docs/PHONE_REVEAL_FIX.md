# 🔧 Correction: Révélation des Numéros de Téléphone

## Problème Identifié

L'extension détectait 18 fiches mais 0 téléphones car les numéros étaient cachés derrière le bouton **"Afficher le N°"**.

![Problème](file:///C:/Users/amine/.gemini/antigravity/brain/8a10809b-b484-432a-b07d-7a8b59a12098/uploaded_image_1769083979668.png)

## Cause

Le regex dans `popup.js` ne détectait pas correctement le bouton "Afficher le N°" :
- **Ancien regex** : `/afficher|voir.*num[ée]ro/i`
- **Problème** : Ne matchait pas "Afficher le N°" (avec le symbole °)

## Solution Appliquée

### Modifications dans `ext/popup.js`

#### 1. Amélioration du Regex (Lignes 140-160)

```javascript
// AVANT
if (/afficher|voir.*num[ée]ro/i.test(btn.innerText || '')) {
  // ...
}

// APRÈS
const text = (btn.innerText || btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase();
if (/afficher.*n°|afficher.*num[ée]ro|voir.*num[ée]ro|afficher.*tel|show.*phone/i.test(text)) {
  // ...
}
```

**Améliorations** :
- ✅ Détecte "Afficher le N°" avec le symbole °
- ✅ Détecte "Afficher numéro", "Voir numéro"
- ✅ Détecte "Afficher tel", "Show phone" (anglais)
- ✅ Vérifie aussi `textContent` et `aria-label`

#### 2. Sélecteurs Élargis

```javascript
// AVANT
const btns = document.querySelectorAll('button, a');

// APRÈS
const btns = document.querySelectorAll('button, a, [class*="phone"], [class*="tel"]');
```

Cible aussi les éléments avec classes contenant "phone" ou "tel".

#### 3. Logging et Comptage

```javascript
let revealed = 0;
for (const btn of btns) {
  // ... click logic
  revealed++;
}
console.log(`Revealed ${revealed} phone numbers`);
```

Permet de voir combien de numéros ont été révélés dans la console.

#### 4. Meilleure Gestion des Erreurs

```javascript
try {
  btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await new Promise(r => setTimeout(r, 150));
  btn.click();
  revealed++;
  await new Promise(r => setTimeout(r, 400));
} catch (e) {
  console.log('Error clicking phone button:', e);
}
```

- Scroll vers le bouton avant de cliquer
- Délais ajustés (150ms avant click, 400ms après)
- Log des erreurs pour debug

## Test de la Correction

### 1. Recharger l'Extension

1. Ouvrir Chrome : `chrome://extensions/`
2. Cliquer sur le bouton **Recharger** (🔄) pour l'extension "PagesJaunes Scraper by TiwiTiw"

### 2. Tester sur PagesJaunes

1. Aller sur https://www.pagesjaunes.fr
2. Rechercher "restaurants paris"
3. Cliquer sur l'icône de l'extension
4. **Cocher** "Révéler les téléphones"
5. Cliquer sur "Extraire les données"

### 3. Vérifier les Résultats

**Avant la correction** :
```
18 Fiches
0 Téléphones
0 Emails
```

**Après la correction** :
```
18 Fiches
15+ Téléphones  ✅
0-2 Emails
```

### 4. Vérifier la Console

Ouvrir la console du navigateur (F12) et chercher :
```
Revealed 15 phone numbers
```

## Fichiers Modifiés

- ✅ [`ext/popup.js`](file:///c:/Users/amine/SCRAP/pj_chrome_ext/ext/popup.js) - Lignes 140-160 et 361-377

## Prochaines Étapes

Si le problème persiste :

1. **Vérifier la console** pour voir combien de boutons sont détectés
2. **Inspecter le bouton** sur PagesJaunes pour voir sa structure HTML exacte
3. **Ajuster le regex** si nécessaire pour matcher d'autres variantes

## Notes Techniques

- Le même fix a été appliqué à **deux endroits** dans `popup.js` :
  - Ligne 140-160 : Extraction initiale
  - Ligne 361-377 : Pagination (pages suivantes)
- Les délais ont été ajustés pour laisser le temps au DOM de se mettre à jour
- Le logging permet de debugger facilement
