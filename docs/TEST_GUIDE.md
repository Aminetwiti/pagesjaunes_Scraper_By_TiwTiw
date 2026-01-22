# 🧪 Guide de Test - Extraction des Téléphones

## ⚠️ IMPORTANT : Recharger l'Extension

**Avant de tester, vous DEVEZ recharger l'extension !**

### Étapes pour Recharger

1. Ouvrir Chrome
2. Taper dans la barre d'adresse : `chrome://extensions/`
3. Trouver "PagesJaunes Scraper by TiwiTiw"
4. Cliquer sur le bouton **🔄 Recharger** (icône circulaire)
5. Vérifier qu'il n'y a pas d'erreur

![Recharger Extension](https://via.placeholder.com/600x200/4CAF50/FFFFFF?text=Cliquer+sur+le+bouton+RECHARGER)

---

## 📋 Test Étape par Étape

### 1. Aller sur PagesJaunes

```
https://www.pagesjaunes.fr/annuaire/paris-75000/restaurants
```

### 2. Ouvrir la Console du Navigateur

- Appuyer sur **F12**
- Aller dans l'onglet **Console**
- Garder la console ouverte pendant le test

### 3. Ouvrir l'Extension

- Cliquer sur l'icône de l'extension dans la barre d'outils
- La popup devrait s'ouvrir

### 4. Configurer les Options

✅ **Cocher** "Révéler les téléphones"  
✅ **Cocher** "Pagination automatique" (optionnel)  
📝 **Max pages** : 1 (pour test rapide)

### 5. Lancer l'Extraction

- Cliquer sur **"Extraire les données"**
- Observer la console

### 6. Vérifier les Logs dans la Console

Vous devriez voir :

```
Revealed 18 phone numbers
Waiting for DOM to update...
✅ Phone found for Restaurant ABC: 01 23 45 67 89 (source: full_text)
✅ Phone found for Restaurant XYZ: 01 98 76 54 32 (source: tel_link)
❌ No phone found for Restaurant ZZZ
   Card text sample: ...
```

### 7. Vérifier les Statistiques

Dans la popup, vous devriez voir :

```
18 Fiches
15-18 Téléphones  ✅ (pas 1 !)
0-2 Emails
```

---

## 🔍 Si Ça Ne Marche Toujours Pas

### Vérification 1 : Extension Rechargée ?

```bash
# Dans chrome://extensions/
# Vérifier la date/heure de "Dernière mise à jour"
# Doit être récente (il y a quelques secondes)
```

### Vérification 2 : Bonne Version du Fichier ?

Ouvrir `ext/popup.js` et chercher la ligne 276 :

```javascript
// Téléphone - Chercher dans plusieurs endroits
```

Si vous voyez ça, c'est bon ✅  
Si vous voyez l'ancien code, le fichier n'est pas à jour ❌

### Vérification 3 : Erreurs dans la Console ?

Chercher des erreurs en rouge dans la console :
- `Uncaught ...`
- `Error ...`
- `Failed to ...`

### Vérification 4 : Inspecter une Carte

1. Sur PagesJaunes, **clic droit** sur un restaurant
2. **Inspecter l'élément**
3. Chercher le numéro de téléphone dans le HTML
4. Noter où il se trouve (dans quel élément)

Exemples possibles :
```html
<!-- Cas 1 : Lien tel: -->
<a href="tel:0123456789">01 23 45 67 89</a>

<!-- Cas 2 : Span avec classe -->
<span class="phone-number">01 23 45 67 89</span>

<!-- Cas 3 : Div simple -->
<div>Tél : 01 23 45 67 89</div>

<!-- Cas 4 : Attribut data -->
<button data-phone="0123456789">Afficher le N°</button>
```

---

## 🐛 Debug Avancé

### Copier le HTML d'une Carte

1. Sur PagesJaunes, clic droit sur un restaurant
2. Inspecter
3. Trouver l'élément parent (probablement `<article>` ou `<li>`)
4. Clic droit → **Copy** → **Copy outerHTML**
5. M'envoyer le HTML pour analyse

### Tester le Regex Manuellement

Ouvrir la console et tester :

```javascript
// Test 1 : Votre numéro
const text = "Restaurant ABC\nTél : 01 23 45 67 89\nParis";
const match = text.match(/(?:\+33|0)\s*[1-9](?:[\s.\-]?\d{2}){4}/);
console.log(match); // Devrait afficher le numéro

// Test 2 : Différents formats
const formats = [
  "01 23 45 67 89",
  "01.23.45.67.89",
  "01-23-45-67-89",
  "0123456789",
  "+33 1 23 45 67 89",
  "+33123456789"
];

formats.forEach(f => {
  const m = f.match(/(?:\+33|0)\s*[1-9](?:[\s.\-]?\d{2}){4}/);
  console.log(f, "→", m ? "✅" : "❌");
});
```

---

## 📸 Captures d'Écran à Fournir

Si le problème persiste, envoyez-moi :

1. **Screenshot de la popup** avec les stats (18 Fiches, 1 Téléphones)
2. **Screenshot de la console** avec les logs
3. **Screenshot de chrome://extensions/** montrant l'extension
4. **HTML d'une carte** (Copy outerHTML)

---

## ✅ Résultat Attendu

**Avant le fix** :
```
18 Fiches
1 Téléphones  ❌
```

**Après le fix (et rechargement)** :
```
18 Fiches
15-18 Téléphones  ✅
```

**Console** :
```
Revealed 18 phone numbers
Waiting for DOM to update...
✅ Phone found for ...
✅ Phone found for ...
✅ Phone found for ...
```
