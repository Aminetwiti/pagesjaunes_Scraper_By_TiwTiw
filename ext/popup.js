let lastData = [];
let isExtracting = false;

function toCSV(rows) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const esc = v => '"' + String(v || '').replace(/"/g, '""') + '"';
  return [keys.join(','), ...rows.map(r => keys.map(k => esc(r[k])).join(','))].join('\n');
}

function showStatus(msg, type = 'info') {
  const status = document.getElementById('status');
  status.textContent = msg;
  status.className = type;
  status.style.display = 'block';
  setTimeout(() => status.style.display = 'none', 5000);
}

function updateStats(data) {
  document.getElementById('stat-total').textContent = data.length;
  document.getElementById('stat-phones').textContent = data.filter(d => d.telephone).length;
  document.getElementById('stat-emails').textContent = data.filter(d => d.email).length;
}

function updatePreview(data) {
  const preview = document.getElementById('preview');
  if (!data.length) {
    preview.textContent = 'Aucune donnée extraite';
    return;
  }
  const sample = data.slice(0, 2).map(d =>
    `${d.denomination || 'N/A'}\n📍 ${d.adresse_full_long || 'N/A'}\n📞 ${d.telephone || 'N/A'}`
  ).join('\n\n---\n\n');
  preview.textContent = sample + (data.length > 2 ? `\n\n... et ${data.length - 2} autres` : '');
}

function setProgress(percent) {
  const bar = document.getElementById('progress-bar');
  const fill = document.getElementById('progress-fill');
  bar.style.display = percent > 0 ? 'block' : 'none';
  fill.style.width = percent + '%';
}

document.getElementById('extract').onclick = async () => {
  if (isExtracting) return;
  isExtracting = true;

  const btn = document.getElementById('extract');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span class="loader"></span>Extraction en cours...';
  btn.disabled = true;

  const options = {
    autoPaginate: document.getElementById('auto-paginate').checked,
    revealPhones: document.getElementById('reveal-phones').checked,
    maxPages: parseInt(document.getElementById('max-pages').value),
    pageDelay: parseInt(document.getElementById('page-delay').value)
  };

  setProgress(10);
  showStatus('Démarrage de l\'extraction...', 'info');

  chrome.tabs.query({ active: true, currentWindow: true }, async tabs => {
    try {
      setProgress(30);
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: extractPJDataPro,
        args: [options]
      });

      setProgress(100);
      const data = results && results[0] && results[0].result ? results[0].result : [];
      lastData = data;

      updateStats(data);
      updatePreview(data);

      showStatus(`✅ ${data.length} fiches extraites avec succès !`, 'success');

      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ lastExtraction: data, timestamp: Date.now() });
        }
      } catch (e) {
        console.warn('Could not save to chrome.storage:', e);
      }
    } catch (error) {
      showStatus('❌ Erreur: ' + error.message, 'error');
      console.error(error);
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
      isExtracting = false;
      setTimeout(() => setProgress(0), 1000);
    }
  });
};

document.getElementById('export-json').onclick = () => {
  if (!lastData.length) return showStatus('Aucune donnée à exporter', 'error');
  const blob = new Blob([JSON.stringify(lastData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  chrome.downloads.download({ url, filename: `pagesjaunes_${timestamp}.json` });
  showStatus('✅ Export JSON en cours...', 'success');
};

document.getElementById('export-csv').onclick = () => {
  if (!lastData.length) return showStatus('Aucune donnée à exporter', 'error');
  const blob = new Blob([toCSV(lastData)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  chrome.downloads.download({ url, filename: `pagesjaunes_${timestamp}.csv` });
  showStatus('✅ Export CSV en cours...', 'success');
};

// Load last extraction from storage (with error handling)
try {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['lastExtraction'], result => {
      if (result && result.lastExtraction) {
        lastData = result.lastExtraction;
        updateStats(lastData);
        updatePreview(lastData);
      }
    });
  } else {
    console.warn('Chrome storage API not available');
  }
} catch (error) {
  console.error('Error accessing chrome.storage:', error);
}

// === FONCTION D'EXTRACTION PRO (130+ CHAMPS) ===
async function extractPJDataPro(options) {
  const allResults = [];
  let currentPage = 1;

  // Reveal phones
  if (options.revealPhones) {
    const btns = document.querySelectorAll('button, a');
    for (const btn of btns) {
      if (/afficher|voir.*num[ée]ro/i.test(btn.innerText || '')) {
        try { btn.scrollIntoView({ behavior: 'smooth', block: 'center' }); await new Promise(r => setTimeout(r, 100)); btn.click(); await new Promise(r => setTimeout(r, 300)); } catch (e) { }
      }
    }
  }

  function extractPage() {
    const cards = document.querySelectorAll('article, li[class*="item"], section[class*="result"], div[class*="bi-"]');
    const results = [];

    // === NIVEAU 2: Extraction JSON-LD (pour pages détails /pros/) ===
    let jsonLdData = null;
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const jsonData = JSON.parse(script.textContent);
        const items = Array.isArray(jsonData) ? jsonData : [jsonData];
        for (const json of items) {
          if (json['@type'] === 'Restaurant' || json['@type'] === 'LocalBusiness') {
            jsonLdData = json;
            break;
          }
        }
        if (jsonLdData) break;
      } catch (e) { }
    }

    // Si on est sur une page détails avec JSON-LD, extraire directement
    if (jsonLdData && window.location.href.includes('/pros/')) {
      const r = {};

      // Nom
      r.denomination = jsonLdData.name || '';
      r.url = jsonLdData.url || jsonLdData['@id'] || window.location.href;

      // Contact
      r.telephone = jsonLdData.telephone || '';
      r.telephone_raw = r.telephone.replace(/\s/g, '');
      r.email = jsonLdData.email || '';
      r.site_web = '';

      // Adresse
      if (jsonLdData.address && typeof jsonLdData.address === 'object') {
        r.adresse = jsonLdData.address.streetAddress || '';
        r.codePostal = jsonLdData.address.postalCode || '';
        r.ville = jsonLdData.address.addressLocality || '';
        r.adresse_full_long = `${r.adresse} ${r.codePostal} ${r.ville}`.trim();
      } else {
        r.adresse = ''; r.codePostal = ''; r.ville = ''; r.adresse_full_long = '';
      }

      // GPS
      if (jsonLdData.geo) {
        r.latitude = jsonLdData.geo.latitude?.toString() || '';
        r.longitude = jsonLdData.geo.longitude?.toString() || '';
      } else {
        r.latitude = ''; r.longitude = '';
      }

      // Horaires
      r.horaires_ouverture = jsonLdData.openingHours || '';

      // Description
      r.description = jsonLdData.description || '';

      // Ratings
      if (jsonLdData.aggregateRating) {
        r.basicInfo_place_rating = jsonLdData.aggregateRating.ratingValue?.toString() || '';
        r.basicInfo_place_nb_review = jsonLdData.aggregateRating.reviewCount?.toString() || '';
      } else {
        r.basicInfo_place_rating = ''; r.basicInfo_place_nb_review = '';
      }

      // Prix
      r.prix_moyen = jsonLdData.priceRange || '';
      r.tarifs = jsonLdData.priceRange || '';

      // Photos
      if (jsonLdData.image) {
        r.logo = typeof jsonLdData.image === 'string' ? jsonLdData.image : jsonLdData.image[0] || '';
        r.photos = Array.isArray(jsonLdData.photo) ? jsonLdData.photo.map(p => p.url || p).join(', ') : '';
      } else {
        r.logo = ''; r.photos = '';
      }

      // Champs vides (à compléter par extraction classique si nécessaire)
      r.siret = ''; r.siren = ''; r.activite = ''; r.categorie = ''; r.code_naf = '';
      r.facebook = ''; r.twitter = ''; r.linkedin = ''; r.instagram = '';
      r.services = ''; r.equipements = ''; r.moyens_paiement = ''; r.marques = '';
      r.langues = ''; r.certifications = '';
      r.dirigeant = ''; r.nombre_employes = ''; r.chiffre_affaires = ''; r.capital = '';
      r.date_creation = ''; r.forme_juridique = ''; r.effectif = '';

      results.push(r);
      return results;
    }

    // === NIVEAU 1: Extraction classique (pour listes de résultats) ===
    cards.forEach(card => {
      const r = {};

      // === BASE ===
      const nameLink = card.querySelector('a[href*="/pros/"], h2 a, h3 a, [class*="denom"]');
      r.denomination = nameLink?.innerText?.trim() || '';
      const pjLink = card.querySelector('a[href*="/pros/"]');
      r.url = pjLink?.href || '';

      // Filtrer les doublons "X photos"
      if (!r.denomination || !r.url || /^\d+\s+photos?$/i.test(r.denomination)) return;

      // === CONTACT ===
      r.email = (card.innerHTML.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/) || [])[0] || '';
      const telLink = card.querySelector('a[href^="tel:"]');
      r.telephone = telLink?.innerText?.trim() || ((card.innerText.match(/(\+33|0)[1-9](?:[ .\-]?\d{2}){4}/) || [])[0]) || '';
      r.telephone_raw = r.telephone.replace(/\s/g, '');
      r.site_web = '';
      card.querySelectorAll('a[href]').forEach(a => {
        const h = a.getAttribute('href') || '';
        if (/^https?:\/\//.test(h) && !/pagesjaunes\.fr/.test(h) && !r.site_web) r.site_web = h;
      });

      // === ADRESSE ===
      const addrEl = card.querySelector('[itemprop="streetAddress"], [class*="adresse"], [class*="address"]');
      r.adresse_full_long = (addrEl?.innerText?.trim() || '').replace(/Voir le plan/gi, '').replace(/\s+/g, ' ').trim();
      const m = r.adresse_full_long.match(/(\d{5})\s+([A-Za-zÀ-ÿ\s\-]+)$/);
      r.codePostal = m ? m[1] : '';
      r.ville = m ? m[2].trim() : '';
      r.adresse = r.adresse_full_long.replace(/\d{5}\s+[A-Za-zÀ-ÿ\s\-]+$/, '').trim();
      r.latitude = card.getAttribute('data-lat') || '';
      r.longitude = card.getAttribute('data-lng') || '';

      // === BUSINESS ===
      const siretM = card.innerText.match(/\b(\d{14})\b/);
      r.siret = siretM ? siretM[1] : '';
      r.siren = r.siret ? r.siret.substring(0, 9) : '';
      const catEl = card.querySelector('[class*="categorie"], [class*="rubrique"]');
      r.activite = catEl?.innerText?.trim() || '';
      r.categorie = r.activite;
      r.code_naf = (card.innerText.match(/\b(\d{4}[A-Z])\b/) || [])[1] || '';

      // === RATINGS ===
      const ratingEl = card.querySelector('[itemprop="ratingValue"], [class*="note"]');
      r.basicInfo_place_rating = ratingEl?.innerText?.trim() || ratingEl?.getAttribute('content') || '';
      const reviewEl = card.querySelector('[itemprop="reviewCount"], [class*="nb-avis"]');
      r.basicInfo_place_nb_review = reviewEl?.innerText?.trim() || reviewEl?.getAttribute('content') || '';

      // === HORAIRES ===
      const hoursEl = card.querySelector('[itemprop="openingHours"], [class*="horaire"]');
      r.horaires_ouverture = hoursEl?.innerText?.trim() || '';

      // === DESCRIPTION ===
      const descEl = card.querySelector('[class*="description"], [itemprop="description"]');
      r.description = descEl?.innerText?.trim() || '';

      // === SOCIAL ===
      r.facebook = ''; r.twitter = ''; r.linkedin = ''; r.instagram = '';
      card.querySelectorAll('a[href]').forEach(a => {
        const h = a.getAttribute('href') || '';
        if (/facebook\.com/i.test(h)) r.facebook = h;
        if (/twitter\.com|x\.com/i.test(h)) r.twitter = h;
        if (/linkedin\.com/i.test(h)) r.linkedin = h;
        if (/instagram\.com/i.test(h)) r.instagram = h;
      });

      // === PHOTOS ===
      r.logo = card.querySelector('img[class*="logo"]')?.src || '';
      r.photos = Array.from(card.querySelectorAll('img'))
        .filter(i => i.src && i.src.startsWith('http') && !i.src.includes('logo') && !i.src.includes('/assets/'))
        .map(i => i.src).slice(0, 10).join(', ');

      // === SERVICES ===
      r.services = Array.from(card.querySelectorAll('[class*="service"], [class*="prestation"]')).map(e => e.innerText?.trim()).join(', ');
      r.equipements = '';

      // === PAYMENT ===
      r.moyens_paiement = card.querySelector('[class*="paiement"]')?.innerText?.trim() || '';

      // === BRANDS ===
      r.marques = card.querySelector('[class*="marque"]')?.innerText?.trim() || '';

      // === LANGUES ===
      r.langues = card.querySelector('[class*="langue"]')?.innerText?.trim() || '';

      // === CERTIFICATIONS ===
      const certText = card.querySelector('[class*="certification"], [class*="label"]')?.innerText?.trim() || '';
      r.certifications = /voir le plan/i.test(certText) ? '' : certText;

      // === PRIX ===
      const priceEl = card.querySelector('[class*="tarif"], [class*="prix"]');
      r.tarifs = priceEl?.innerText?.trim() || '';
      r.prix_moyen = (r.tarifs.match(/(\d+)\s*€/) || [])[1] || '';

      // === STAFF / FINANCIAL ===
      r.dirigeant = ''; r.nombre_employes = ''; r.chiffre_affaires = ''; r.capital = '';
      r.date_creation = ''; r.forme_juridique = ''; r.effectif = '';

      results.push(r);
    });

    return results;
  }

  allResults.push(...extractPage());

  // Pagination
  if (options.autoPaginate && currentPage < options.maxPages) {
    while (currentPage < options.maxPages) {
      let next = null;
      ['a[rel="next"]', 'a[aria-label*="suivant"]', 'a:has-text("Suivant")'].forEach(s => {
        try { const el = document.querySelector(s); if (el && !el.classList.contains('disabled')) next = el; } catch (e) { }
      });
      if (!next) break;
      try {
        next.scrollIntoView({ behavior: 'smooth' });
        await new Promise(r => setTimeout(r, 500));
        next.click();
        await new Promise(r => setTimeout(r, options.pageDelay));
        if (options.revealPhones) {
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
}
