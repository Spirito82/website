let pricesData = { default_price: 180, custom_prices: {} };
let calendar;

// Password semplice (in produzione usare autenticazione più sicura)
const ADMIN_PASSWORD = "avesella2025";

function login() {
	const password = document.getElementById('adminPassword').value;
	if (password === ADMIN_PASSWORD) {
		document.getElementById('loginSection').style.display = 'none';
		document.getElementById('adminSection').style.display = 'block';
		loadPrices();
		initCalendar();
	} else {
		alert('Password non corretta!');
	}
}

async function loadPrices() {
	try {
		const response = await fetch('data/prices.json');
		pricesData = await response.json();
		document.getElementById('defaultPrice').value = pricesData.default_price;
		updateCustomPricesList();
	} catch (error) {
		console.log('File prezzi non trovato, uso valori di default');
		pricesData = { default_price: 180, custom_prices: {} };
	}
}

function saveDefaultPrice() {
	const newPrice = parseInt(document.getElementById('defaultPrice').value);
	if (newPrice >= 50 && newPrice <= 1000) {
		pricesData.default_price = newPrice;
		savePricesToFile();
		calendar.refetchEvents();
	}
}

function addCustomPrice() {
	const date = document.getElementById('customDate').value;
	const price = parseInt(document.getElementById('customPrice').value);

	if (date && price >= 50 && price <= 1000) {
		pricesData.custom_prices[date] = price;
		updateCustomPricesList();
		document.getElementById('customDate').value = '';
		document.getElementById('customPrice').value = '';
	}
}

function removeCustomPrice(date) {
	delete pricesData.custom_prices[date];
	updateCustomPricesList();
}

function updateCustomPricesList() {
	const container = document.getElementById('customPricesList');
	container.innerHTML = '';

	Object.entries(pricesData.custom_prices).forEach(([date, price]) => {
		const div = document.createElement('div');
		div.className = 'alert alert-info d-flex justify-content-between align-items-center';
		div.innerHTML = `
            <span><strong>${date}</strong>: €${price}</span>
            <button onclick="removeCustomPrice('${date}')" class="btn btn-sm btn-outline-danger">Rimuovi</button>
        `;
		container.appendChild(div);
	});
}

function saveCustomPrices() {
	savePricesToFile();
	calendar.refetchEvents();
}

async function savePricesToFile() {
	console.log('Salvando prezzi:', pricesData);

	// Configurazione GitHub (devi compilare questi valori)
	const GITHUB_TOKEN = ''; // LASCIA VUOTO per sicurezza - Il token deve essere inserito manualmente
	const REPO_OWNER = 'Spirito82'; // Il tuo username GitHub
	const REPO_NAME = 'website'; // Nome del repository
	const FILE_PATH = 'data/prices.json';

	if (!GITHUB_TOKEN) {
		// Fallback: download del file se non hai configurato GitHub API
		const content = JSON.stringify(pricesData, null, 2);
		const blob = new Blob([content], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'prices.json';
		a.click();
		URL.revokeObjectURL(url);
		alert('File prices.json scaricato! Caricalo manualmente nella cartella data/ del sito.');
		return;
	}

	try {
		console.log('🔍 Tentativo di recupero file esistente...');
		// 1. Ottieni il file corrente per avere il SHA (se esiste)
		const getResponse = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
			headers: {
				'Authorization': `token ${GITHUB_TOKEN}`,
				'Accept': 'application/vnd.github.v3+json'
			}
		});

		console.log('📊 Risposta GET:', getResponse.status, getResponse.statusText);

		let sha = null;
		let isNewFile = false;

		if (getResponse.ok) {
			const fileData = await getResponse.json();
			sha = fileData.sha;
			console.log('✅ File esistente, SHA ottenuto:', sha);
		} else if (getResponse.status === 404) {
			console.log('📝 File non esistente, sarà creato nuovo');
			isNewFile = true;
		} else {
			const errorText = await getResponse.text();
			console.error('❌ Errore GET response:', errorText);
			throw new Error(`Errore nel recupero del file: ${getResponse.status} - ${errorText}`);
		}

		// 2. Crea o aggiorna il file
		console.log('🚀 Tentativo di', isNewFile ? 'creazione' : 'aggiornamento', 'file...');
		const newContent = btoa(JSON.stringify(pricesData, null, 2)); // Codifica in base64

		const requestBody = {
			message: isNewFile ? 'Create prices.json via admin panel' : 'Update prices.json via admin panel',
			content: newContent
		};

		// Aggiungi SHA solo se il file esiste già
		if (!isNewFile && sha) {
			requestBody.sha = sha;
		}

		const updateResponse = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
			method: 'PUT',
			headers: {
				'Authorization': `token ${GITHUB_TOKEN}`,
				'Accept': 'application/vnd.github.v3+json',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(requestBody)
		});

		console.log('📊 Risposta PUT:', updateResponse.status, updateResponse.statusText);

		if (updateResponse.ok) {
			console.log('✅', isNewFile ? 'Creazione' : 'Aggiornamento', 'completato!');
			alert(`✅ Prezzi ${isNewFile ? 'creati' : 'salvati'} con successo su GitHub!`);
		} else {
			const errorText = await updateResponse.text();
			console.error('❌ Errore PUT response:', errorText);
			throw new Error(`Errore nell'${isNewFile ? 'creazione' : 'aggiornamento'} del file: ${updateResponse.status} - ${errorText}`);
		}

	} catch (error) {
		console.error('❌ Errore nel salvataggio:', error);

		// Fallback: download manuale
		const content = JSON.stringify(pricesData, null, 2);
		const blob = new Blob([content], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'prices.json';
		a.click();
		URL.revokeObjectURL(url);

		alert('❌ Errore nel salvataggio automatico. File scaricato per caricamento manuale.');
	}
}

function initCalendar() {
	const calendarEl = document.getElementById('adminCalendar');
	calendar = new FullCalendar.Calendar(calendarEl, {
		initialView: 'dayGridMonth',
		height: 'auto',
		events: function (fetchInfo, successCallback) {
			const events = [];
			const start = new Date(fetchInfo.start);
			const end = new Date(fetchInfo.end);

			for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
				const dateStr = d.toISOString().split('T')[0];
				const price = pricesData.custom_prices[dateStr] || pricesData.default_price;

				events.push({
					title: `€${price}`,
					start: dateStr,
					backgroundColor: pricesData.custom_prices[dateStr] ? '#ff6b6b' : '#51cf66',
					borderColor: 'transparent'
				});
			}

			successCallback(events);
		}
	});
	calendar.render();
}