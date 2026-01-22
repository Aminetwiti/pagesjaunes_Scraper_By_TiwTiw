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

  // === CONFIGURATION ===
  const options = {
    autoPaginate: document.getElementById('auto-paginate').checked,
    revealPhones: document.getElementById('reveal-phones').checked,
    maxPages: parseInt(document.getElementById('max-pages').value),
    pageDelay: parseInt(document.getElementById('page-delay').value),
    // PRIX CONFIGURABLES:
    nextSelector: document.getElementById('selector-next').value,
    cardSelector: document.getElementById('selector-card').value
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
      const newData = results && results[0] && results[0].result ? results[0].result : [];

      // Mode Cumul (Append) vs Remplacement
      const appendMode = document.getElementById('append-mode').checked;

      if (appendMode && lastData.length > 0) {
        // Fusionner avec dédoublonnage (basé sur URL)
        const existingUrls = new Set(lastData.map(d => d.url));
        let addeCount = 0;
        for (const item of newData) {
          if (!existingUrls.has(item.url)) {
            lastData.push(item);
            existingUrls.add(item.url);
            addeCount++;
          }
        }
        showStatus(`✅ Terminée ! ${newData.length} trouvés, ${addeCount} ajoutés.`, 'success');
      } else {
        // Mode Remplacement standard
        lastData = newData;
        showStatus(`✅ ${lastData.length} fiches extraites avec succès !`, 'success');
      }

      updateStats(lastData);
      updatePreview(lastData);

      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ lastExtraction: lastData, timestamp: Date.now() });
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


document.getElementById('deep-scrap').onclick = async () => {
  if (!lastData.length) return showStatus('Aucune donnée à enrichir (lancez une extraction d\'abord)', 'error');
  if (isExtracting) return;

  isExtracting = true;
  const btn = document.getElementById('deep-scrap');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span class="loader"></span>Enrichissement...';
  btn.disabled = true;

  showStatus('🚀 Deep Scrap: Ouverture des onglets + Scroll...', 'info');
  setProgress(0);

  let processed = 0;
  const total = lastData.length;

  for (let i = 0; i < total; i++) {
    const item = lastData[i];
    if (item.url && item.url.includes('/pros/')) {
      try {
        const tab = await chrome.tabs.create({ url: item.url, active: false });
        await new Promise(r => setTimeout(r, 2000));
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => { window.scrollTo(0, document.body.scrollHeight); }
        });
        await new Promise(r => setTimeout(r, 1500));

        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const r = {};
            const pageText = document.body.innerText;

            const siretMatch = pageText.match(/SIRET\s*[\:\.]?\s*(\d[\d\s]{13,})/i) ||
              pageText.match(/\b\d{3}\s\d{3}\s\d{3}\s\d{5}\b/);
            if (siretMatch) {
              r.siret = siretMatch[0].replace(/\D/g, '');
              r.siren = r.siret.substring(0, 9);
            }
            const nafMatch = pageText.match(/Code NAF\s*[\:\.]?\s*([\w\d]+)/i) ||
              pageText.match(/\b\d{4}[A-Z]\b/);
            if (nafMatch) r.code_naf = nafMatch[1] || nafMatch[0];

            const legalBlock = document.querySelector('#bloc-infos-legales, .legal-info, .infos-juridiques, .bi-bloc-infos');
            const textToSearch = (legalBlock ? legalBlock.innerText : '') + '\n' + pageText;

            const capMatch = textToSearch.match(/Capital\s*[\:\.]?\s*([\d\s\.]+€?)/i);
            if (capMatch) r.capital = capMatch[1].trim();

            const dirMatch = textToSearch.match(/(?:Gérant|Président|Directeur|Dirigeant)[^\:]*[\:\.]\s*([^\n]+)/i);
            if (dirMatch) r.dirigeant = dirMatch[1].trim();

            const dateMatch = textToSearch.match(/Date de création\s*[\:\.]?\s*([\d\/]+)/i);
            if (dateMatch) r.date_creation = dateMatch[1];

            const effMatch = textToSearch.match(/Effectif\s*[\:\.]?\s*([^\n]+)/i);
            if (effMatch) r.effectif = effMatch[1].trim();

            const allLinks = Array.from(document.querySelectorAll('a[href]'));
            r.facebook = allLinks.find(a => a.href.includes('facebook.com') && !a.href.includes('share'))?.href || '';
            r.instagram = allLinks.find(a => a.href.includes('instagram.com') && !a.href.includes('share'))?.href || '';
            r.twitter = allLinks.find(a => (a.href.includes('twitter.com') || a.href.includes('x.com')) && !a.href.includes('share'))?.href || '';
            r.linkedin = allLinks.find(a => a.href.includes('linkedin.com') && !a.href.includes('share'))?.href || '';

            try {
              const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
              for (const s of scripts) {
                if (s.textContent.includes('FAQPage')) {
                  const faq = JSON.parse(s.textContent);
                  const items = faq.mainEntity || faq;
                  if (Array.isArray(items)) {
                    const q = items.find(x => x.name && x.name.match(/prestations|services/i));
                    if (q && q.acceptedAnswer) {
                      r.services = q.acceptedAnswer.text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                      break;
                    }
                  }
                }
              }
            } catch (e) { }

            return r;
          }
        });

        chrome.tabs.remove(tab.id);

        if (results && results[0] && results[0].result) {
          const detailed = results[0].result;
          // On fusionne si non vide
          if (detailed.siret) item.siret = detailed.siret;
          if (detailed.siren) item.siren = detailed.siren;
          if (detailed.code_naf) item.code_naf = detailed.code_naf;
          if (detailed.capital) item.capital = detailed.capital;
          if (detailed.dirigeant) item.dirigeant = detailed.dirigeant;
          if (detailed.date_creation) item.date_creation = detailed.date_creation;
          if (detailed.effectif) item.effectif = detailed.effectif;
          if (detailed.services) item.services = detailed.services;
          if (detailed.facebook) item.facebook = detailed.facebook;
          if (detailed.instagram) item.instagram = detailed.instagram;
          if (detailed.twitter) item.twitter = detailed.twitter;
          if (detailed.linkedin) item.linkedin = detailed.linkedin;

          console.log(`✅ Enrichi (Tab) [${i + 1}/${total}]: ${item.denomination}`);
        }

      } catch (error) {
        console.error(`Erreur enrichissement ${item.url}:`, error);
      }

      processed++;
      setProgress((processed / total) * 100);
      updatePreview(lastData);
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  btn.innerHTML = originalText;
  btn.disabled = false;
  isExtracting = false;

  updateStats(lastData);
  showStatus(`✅ Enrichissement terminé ! (${processed} fiches)`, 'success');

  try {
    chrome.storage.local.set({ lastExtraction: lastData, timestamp: Date.now() });
  } catch (e) { }
};

try {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['lastExtraction'], result => {
      if (result && result.lastExtraction) {
        lastData = result.lastExtraction;
        updateStats(lastData);
        updatePreview(lastData);
      }
    });
  }
} catch (error) { }

// === FONCTION D'EXTRACTION PRO ===
async function extractPJDataPro(options) {
  const allResults = [];
  let currentPage = 1;
  const nextSelector = options.nextSelector || 'a[rel="next"], #pagination-next';
  const cardSelector = options.cardSelector || '.bi-list li, article[itemtype*="LocalBusiness"]';

  // Reveal phones
  if (options.revealPhones) {
    const btns = document.querySelectorAll('button, a, [class*="phone"], [class*="tel"]');
    for (const btn of btns) {
      const text = (btn.innerText || btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase();
      if (/afficher.*n°|afficher.*num[ée]ro|voir.*num[ée]ro|afficher.*tel|show.*phone/i.test(text)) {
        try {
          const card = btn.closest('li') || btn.closest('article') || btn.parentElement;
          if (card && /(?:\+33|0)[1-9](?:[\s.\-]?\d{2}){4}/.test(card.innerText)) continue;
          btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await new Promise(r => setTimeout(r, 150));
          btn.click();
          await new Promise(r => setTimeout(r, 400));
        } catch (e) { }
      }
    }
  }

  function extractPage() {
    const allPotentialCards = document.querySelectorAll(cardSelector);
    const cards = Array.from(allPotentialCards).filter(card => {
      const hasProLink = card.querySelector('a[href*="/pros/"]');
      const hasContent = card.innerText && card.innerText.length > 50;
      return hasProLink && hasContent;
    });

    const results = [];
    cards.forEach(card => {
      const r = {};
      const nameLink = card.querySelector('a[href*="/pros/"], h2 a, h3 a, [class*="denom"]');
      r.denomination = nameLink?.innerText?.trim() || '';
      const pjLink = card.querySelector('a[href*="/pros/"]');
      r.url = pjLink?.href || '';

      if (!r.denomination || !r.url || /^\d+\s+photos?$/i.test(r.denomination)) return;

      r.email = (card.innerHTML.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/) || [])[0] || '';

      let phoneNumbers = [];
      const telLinks = card.querySelectorAll('a[href^="tel:"]');
      telLinks.forEach(link => {
        const phone = link.innerText?.trim() || link.href.replace('tel:', '');
        if (phone && !phoneNumbers.includes(phone)) phoneNumbers.push(phone);
      });
      const phoneAttrs = card.querySelectorAll('[data-phone], [data-tel], [data-telephone]');
      phoneAttrs.forEach(attr => {
        const phone = attr.getAttribute('data-phone') || attr.getAttribute('data-tel');
        if (phone && !phoneNumbers.includes(phone)) phoneNumbers.push(phone);
      });
      if (phoneNumbers.length === 0) {
        const matches = [...card.innerText.matchAll(/(?:\+33|0)\s*[1-9](?:[\s.\-]?\d{2}){4}/g)];
        matches.forEach(m => { if (!phoneNumbers.includes(m[0])) phoneNumbers.push(m[0]); });
      }

      r.telephone = phoneNumbers.join(' ; ');
      r.telephone_raw = phoneNumbers.map(p => p.replace(/[\s.\-]/g, '')).join(';');

      const addrEl = card.querySelector('[itemprop="streetAddress"], [class*="adresse"], [class*="address"]');
      r.adresse_full_long = (addrEl?.innerText?.trim() || '').replace(/Voir le plan/gi, '').replace(/\s+/g, ' ').trim();
      const m = r.adresse_full_long.match(/(\d{5})\s+([A-Za-zÀ-ÿ\s\-]+)$/);
      r.codePostal = m ? m[1] : '';
      r.ville = m ? m[2].trim() : '';
      r.adresse = r.adresse_full_long.replace(/\d{5}\s+[A-Za-zÀ-ÿ\s\-]+$/, '').trim();

      // Basic init
      r.siret = ''; r.siren = ''; r.services = ''; r.facebook = ''; r.instagram = '';

      results.push(r);
    });
    return results;
  }

  allResults.push(...extractPage());

  // Pagination configurable
  if (options.autoPaginate && currentPage < options.maxPages) {
    while (currentPage < options.maxPages) {
      let next = document.querySelector(nextSelector);

      // Fallback si selecteur custom échoue
      if (!next) next = document.querySelector('a[rel="next"], #pagination-next, [aria-label*="age suivant"]');

      if (!next || next.classList.contains('disabled')) break;

      try {
        next.scrollIntoView({ behavior: 'smooth' });
        await new Promise(r => setTimeout(r, 500));
        next.click();
        await new Promise(r => setTimeout(r, options.pageDelay));

        if (options.revealPhones) {
          const btns = document.querySelectorAll('button, a, [class*="phone"], [class*="tel"]');
          btns.forEach(btn => {
            if (/afficher.*n°|afficher.*num[ée]ro/i.test(btn.innerText)) {
              try { btn.click(); } catch (e) { }
            }
          });
          await new Promise(r => setTimeout(r, 1000));
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
