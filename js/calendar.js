(async function () {

	// Debug: verifichiamo se tutte le librerie sono disponibili
	console.log('=== CONTROLLO LIBRERIE ALL\'AVVIO ===');
	console.log('calendar.js: FullCalendar disponibile?', typeof FullCalendar);
	console.log('calendar.js: EmailJS disponibile?', typeof emailjs);
	console.log('calendar.js: Elemento calendar presente?', document.getElementById('calendar'));
	console.log('=====================================');
	
	if (typeof FullCalendar === 'undefined') {
		console.error('FullCalendar non è disponibile!');
		return;
	}

	// Carico disponibilità da JSON
	async function loadAvailability() {
		try {
			const res = await fetch('./data/availability.json', { cache: 'no-store' });
			if (!res.ok) {
				console.warn('File availability.json non trovato, uso dati vuoti');
				return [];
			}
			const json = await res.json();
			return json.events || [];
		} catch (error) {
			console.warn('Errore nel caricamento availability.json:', error);
			return [];
		}
	}

	function dateRangeToDates(startISO, endISO) {
		const start = new Date(startISO);
		const end = new Date(endISO);
		const dates = [];
		for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
			dates.push(new Date(d).toISOString().slice(0, 10));
		}
		return dates;
	}

	const events = await loadAvailability();

	// Variabili per la selezione a due click
	let selectionStartDate = null;
	let isSelectingRange = false;
	let isDragging = false;
	let dragStartTime = null;
	
	// Variabili per gestire click vs drag
	let pendingDateClick = null;
	let clickTimer = null;
	let hasMouseMoved = false;

	// Costruisco un set di giorni prenotati per facilitare la ricerca
	const bookedDates = new Set();
	events.forEach(e => {
		const days = dateRangeToDates(e.start, e.end);
		days.forEach(day => bookedDates.add(day));
	});

	// Funzione per controllare se una data è nel passato
	function isDateInPast(dateStr) {
		const today = new Date();
		today.setHours(0, 0, 0, 0); // Reset ore per confronto solo date
		const checkDate = new Date(dateStr);
		return checkDate < today;
	}

	// Funzione per controllare se una data è disponibile (non prenotata e non nel passato)
	function isDateAvailable(dateStr) {
		return !bookedDates.has(dateStr) && !isDateInPast(dateStr);
	}

	// Funzione per controllare se un range di date è tutto libero
	function isRangeAvailable(startDate, endDate) {
		const start = new Date(startDate);
		const end = new Date(endDate);
		
		for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
			const dateStr = d.toISOString().slice(0, 10);
			if (!isDateAvailable(dateStr)) {
				return false;
			}
		}
		return true;
	}

	// Funzione per calcolare i giorni tra due date
	function getDaysBetween(startDate, endDate) {
		const start = new Date(startDate);
		const end = new Date(endDate);
		const timeDiff = end.getTime() - start.getTime();
		return Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 per includere il giorno di partenza
	}

	// Funzione per formattare la data per la visualizzazione
	function formatDateForDisplay(dateStr) {
		const date = new Date(dateStr);
		const options = { 
			day: 'numeric', 
			month: 'long', 
			year: 'numeric',
			timeZone: 'Europe/Rome'
		};
		return date.toLocaleDateString('it-IT', options);
	}

	// Funzione per gestire il click singolo (separata dal drag)
	function handleSingleClick(dateStr) {
		console.log('Gestisco click singolo su:', dateStr);
		
		// Se la data non è disponibile, non fare nulla
		if (!isDateAvailable(dateStr)) {
			if (isDateInPast(dateStr)) {
				console.log('Data nel passato non selezionabile');
				alert('Non è possibile selezionare date nel passato');
			} else {
				console.log('Data non disponibile');
				alert('Data non disponibile');
			}
			return;
		}

		// Se non abbiamo ancora una data di inizio, impostala
		if (!selectionStartDate) {
			selectionStartDate = dateStr;
			isSelectingRange = true;
			console.log('Data di inizio selezionata:', selectionStartDate);
			
			// Evidenzia visivamente la data di inizio
			calendar.addEvent({
				start: selectionStartDate,
				display: 'background',
				backgroundColor: '#007bff',
				classNames: ['temp-selection-start']
			});
			
			return;
		}

		// Se abbiamo già una data di inizio, questa è la data di fine
		const endDate = dateStr;
		console.log('Data di fine selezionata:', endDate);
		
		// Determina l'ordine corretto delle date
		const startDate = selectionStartDate <= endDate ? selectionStartDate : endDate;
		const finalEndDate = selectionStartDate <= endDate ? endDate : selectionStartDate;
		
		// Verifica che ci siano almeno 2 giorni
		const dayCount = getDaysBetween(startDate, finalEndDate);
		if (dayCount < 2) {
			alert('Sono richieste prenotazioni di almeno 2 giorni consecutivi. Seleziona un periodo più lungo.');
			// Reset della selezione
			selectionStartDate = null;
			isSelectingRange = false;
			calendar.getEvents().forEach(event => {
				if (event.classNames.includes('temp-selection-start')) {
					event.remove();
				}
			});
			return;
		}
		
		// Verifica se il range è disponibile
		const nextDay = new Date(finalEndDate);
		nextDay.setDate(nextDay.getDate() + 1);
		const endForCheck = nextDay.toISOString().slice(0, 10);
		
		if (isRangeAvailable(startDate, endForCheck)) {
			console.log('Range valido da', startDate, 'a', finalEndDate);
			
			// Rimuovi gli eventi temporanei
			calendar.getEvents().forEach(event => {
				if (event.classNames.includes('temp-selection-start')) {
					event.remove();
				}
			});
			
			// Seleziona il range
			calendar.select(startDate, endForCheck);
			
			// Aggiorna il bottone
			const btn = document.getElementById('bookEmailBtn');
			btn.disabled = false;
			btn.dataset.start = startDate;
			btn.dataset.end = finalEndDate;
			
		} else {
			console.log('Range non disponibile');
			alert('Il periodo selezionato contiene giorni non disponibili. Seleziona un altro periodo.');
		}
		
		// Reset della selezione
		selectionStartDate = null;
		isSelectingRange = false;
		
		// Rimuovi eventuali eventi temporanei rimasti
		calendar.getEvents().forEach(event => {
			if (event.classNames.includes('temp-selection-start')) {
				event.remove();
			}
		});
	}

	// Costruisco gli eventi giorno-per-giorno
	const fcEvents = [];
	
	// Aggiungo eventi per le date prenotate
	events.forEach(e => {
		const days = dateRangeToDates(e.start, e.end);
		days.forEach(day => {
			fcEvents.push({
				title: e.price ? `€${e.price}` : '',
				start: day,
				allDay: true,
				extendedProps: { booked: true }
			});
		});
	});

	// Aggiungo eventi per le date nel passato
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const startOfMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1); // Mese precedente
	const endOfToday = new Date(today);
	
	for (let d = new Date(startOfMonth); d < endOfToday; d.setDate(d.getDate() + 1)) {
		const dateStr = d.toISOString().slice(0, 10);
		// Aggiungi solo se non è già un evento prenotato
		if (!bookedDates.has(dateStr)) {
			fcEvents.push({
				start: dateStr,
				allDay: true,
				display: 'background',
				backgroundColor: '#f8f9fa',
				extendedProps: { past: true }
			});
		}
	}

	// Aggiungo eventi per le date libere (con prezzo)
	const endOfCalendar = new Date(today.getFullYear(), today.getMonth() + 3, 0); // 3 mesi nel futuro
	for (let d = new Date(today); d <= endOfCalendar; d.setDate(d.getDate() + 1)) {
		const dateStr = d.toISOString().slice(0, 10);
		// Aggiungi solo se non è prenotato e non è nel passato
		if (!bookedDates.has(dateStr) && !isDateInPast(dateStr)) {
			fcEvents.push({
				title: '€180',
				start: dateStr,
				allDay: true,
				backgroundColor: '#d4edda',
				borderColor: '#c3e6cb',
				textColor: '#155724',
				extendedProps: { available: true, price: 180 }
			});
		}
	}

	// Istanzio il calendario
	const calendarEl = document.getElementById('calendar');
	const calendar = new FullCalendar.Calendar(calendarEl, {
		initialView: 'dayGridMonth',
		height: 'auto',
		contentHeight: 'auto',
		expandRows: true,
		selectable: true,
		selectMirror: true,
		unselectAuto: false,
		selectLongPressDelay: 300,
		selectMinDistance: 5,
		events: fcEvents,
		eventDidMount: function (info) {
			if (info.event.extendedProps.booked) {
				info.el.classList.add('fc-booked-day');
			} else if (info.event.extendedProps.past) {
				info.el.classList.add('fc-past-day');
			} else if (info.event.extendedProps.available) {
				info.el.classList.add('fc-available-day');
			}
		},
		eventClick: function(info) {
			// Se è un evento disponibile (prezzo), simula il click sulla data
			if (info.event.extendedProps.available) {
				const dateStr = info.event.startStr;
				console.log('Click su evento disponibile:', dateStr);
				handleSingleClick(dateStr, calendar);
				return false; // Previene il comportamento di default
			}
			// Per altri eventi (prenotati, passati), non fare nulla
			return false;
		},
		selectAllow: function(selectInfo) {
			console.log('selectAllow chiamato:', selectInfo.startStr, 'al', selectInfo.endStr);
			// Permetti selezione solo se tutto il range è libero
			const isAvailable = isRangeAvailable(selectInfo.startStr, selectInfo.endStr);
			console.log('Range disponibile?', isAvailable);
			return isAvailable;
		},
		selectStart: function(selectInfo) {
			console.log('Inizio selezione drag');
			isDragging = true;
			dragStartTime = Date.now();
		},
		select: function (selectionInfo) {
			const start = selectionInfo.startStr;
			const end = selectionInfo.endStr;
			
			console.log('SELECT callback - Raw dates:', start, 'to', end);
			console.log('Era dragging?', isDragging);
			
			// Reset della selezione a due click se stavamo usando il drag
			if (isDragging) {
				selectionStartDate = null;
				isSelectingRange = false;
				// Rimuovi eventi temporanei
				calendar.getEvents().forEach(event => {
					if (event.classNames.includes('temp-selection-start')) {
						event.remove();
					}
				});
			}
			
			// Calcola la data di fine per la visualizzazione (un giorno prima)
			const endDisplay = new Date(end);
			endDisplay.setDate(endDisplay.getDate() - 1);
			const endDisplayStr = endDisplay.toISOString().slice(0, 10);
			
			console.log('SELECT callback - Display dates:', start, 'to', endDisplayStr);
			
			// Verifica che ci siano almeno 2 giorni
			const dayCount = getDaysBetween(start, endDisplayStr);
			if (dayCount < 2) {
				alert('Sono richieste prenotazioni di almeno 2 giorni consecutivi. Seleziona un periodo più lungo.');
				calendar.unselect();
				return;
			}
			
			// Calcola il prezzo totale
			const pricePerDay = 180;
			const totalPrice = dayCount * pricePerDay;
			
			// Formatta le date per la visualizzazione
			const startFormatted = formatDateForDisplay(start);
			const endFormatted = formatDateForDisplay(endDisplayStr);
			
			// Aggiorna la label con periodo e prezzo
			const selectionInfoElement = document.getElementById('selectionInfo');
			const selectedPeriod = document.getElementById('selectedPeriod');
			const selectedPrice = document.getElementById('selectedPrice');
			
			// Controlli di sicurezza per verificare che gli elementi esistano
			if (selectedPeriod && selectedPrice && selectionInfoElement) {
				selectedPeriod.textContent = `Dal ${startFormatted} al ${endFormatted} (${dayCount} ${dayCount === 1 ? 'giorno' : 'giorni'})`;
				selectedPrice.textContent = `Prezzo totale: €${totalPrice}`;
				selectionInfoElement.style.display = 'block';
			} else {
				console.warn('Elementi di selezione non trovati nell\'HTML');
			}
			
			const btn = document.getElementById('bookEmailBtn');
			btn.disabled = false;
			btn.dataset.start = start;
			btn.dataset.end = endDisplayStr;
			btn.dataset.days = dayCount;
			btn.dataset.price = totalPrice;
			
			console.log('Selezione valida dal', start, 'al', endDisplayStr, '- Giorni:', dayCount, '- Prezzo:', totalPrice);
		},
		unselect: function() {
			console.log('Selezione rimossa');
			// Reset di tutte le variabili di stato
			isDragging = false;
			hasMouseMoved = false;
			selectionStartDate = null;
			isSelectingRange = false;
			
			// Nasconde la label di selezione
			const selectionInfoElement = document.getElementById('selectionInfo');
			if (selectionInfoElement) {
				selectionInfoElement.style.display = 'none';
			}
			
			// Cancella click pendenti
			if (clickTimer) {
				clearTimeout(clickTimer);
				clickTimer = null;
				pendingDateClick = null;
			}
			
			// Rimuovi eventi temporanei
			calendar.getEvents().forEach(event => {
				if (event.classNames.includes('temp-selection-start')) {
					event.remove();
				}
			});
			
			// Disabilita il bottone quando non c'è selezione
			const btn = document.getElementById('bookEmailBtn');
			btn.disabled = true;
			btn.dataset.start = '';
			btn.dataset.end = '';
		},
		dateClick: function(info) {
			console.log('Click su data:', info.dateStr);
			console.log('Data prenotata?', bookedDates.has(info.dateStr));
			console.log('Data nel passato?', isDateInPast(info.dateStr));
			console.log('Era in dragging?', isDragging);
			console.log('Mouse si è mosso?', hasMouseMoved);
			
			// Se abbiamo appena finito un drag, non processare il click
			if (isDragging || hasMouseMoved) {
				console.log('Click ignorato perché era drag o mouse si è mosso');
				isDragging = false;
				hasMouseMoved = false;
				return;
			}
			
			// Cancella eventuali click pendenti
			if (clickTimer) {
				clearTimeout(clickTimer);
				clickTimer = null;
			}
			
			// Imposta un click pendente con un breve delay
			pendingDateClick = info.dateStr;
			clickTimer = setTimeout(() => {
				if (pendingDateClick && !isDragging && !hasMouseMoved) {
					console.log('Eseguo click singolo dopo delay');
					handleSingleClick(pendingDateClick);
				}
				pendingDateClick = null;
				clickTimer = null;
				hasMouseMoved = false;
			}, 150); // 150ms di delay per distinguere da drag
		}
	});

	calendar.render();

	// Forza il ridimensionamento del calendario dopo il render
	setTimeout(() => {
		calendar.updateSize();
	}, 100);

	// Gestisce il ridimensionamento della finestra
	window.addEventListener('resize', () => {
		calendar.updateSize();
	});

	// Aggiungiamo gestori del mouse per distinguere click da drag
	let mouseDownTime = null;
	let mouseDownPos = null;
	
	calendarEl.addEventListener('mousedown', function(e) {
		mouseDownTime = Date.now();
		mouseDownPos = { x: e.clientX, y: e.clientY };
		isDragging = false;
		hasMouseMoved = false;
		console.log('Mouse down registrato');
	});
	
	calendarEl.addEventListener('mousemove', function(e) {
		if (mouseDownTime && mouseDownPos) {
			const timeDiff = Date.now() - mouseDownTime;
			const distance = Math.sqrt(
				Math.pow(e.clientX - mouseDownPos.x, 2) + 
				Math.pow(e.clientY - mouseDownPos.y, 2)
			);
			
			// Se si muove il mouse per più di 3px o per più di 50ms, è un movimento
			if (distance > 3 || timeDiff > 50) {
				hasMouseMoved = true;
				
				// Se il movimento è significativo, è un drag
				if (distance > 8 || timeDiff > 100) {
					if (!isDragging) {
						console.log('Rilevato inizio drag - cancello click pendente');
						// Cancella il click pendente se stiamo iniziando un drag
						if (clickTimer) {
							clearTimeout(clickTimer);
							clickTimer = null;
							pendingDateClick = null;
						}
					}
					isDragging = true;
					console.log('Rilevato drag');
				}
			}
		}
	});
	
	calendarEl.addEventListener('mouseup', function(e) {
		setTimeout(() => {
			console.log('Mouse up - isDragging:', isDragging, 'hasMouseMoved:', hasMouseMoved);
			if (!isDragging && !hasMouseMoved) {
				console.log('Era un click singolo pulito');
			}
			mouseDownTime = null;
			mouseDownPos = null;
			// Reset dopo un breve delay per permettere al dateClick di processare
			setTimeout(() => {
				isDragging = false;
				hasMouseMoved = false;
			}, 200);
		}, 10);
	});


	// Stile per giorni prenotati e passati
	const style = document.createElement('style');
	style.innerHTML = `
		.fc-booked-day { 
			background: repeating-linear-gradient(45deg, rgba(0,0,0,0.06), rgba(0,0,0,0.06) 6px, rgba(255,0,0,0.04) 6px, rgba(255,0,0,0.04) 12px); 
		}
		.fc-past-day {
			opacity: 0.5;
			pointer-events: none;
			background-color: #f8f9fa !important;
		}
		.fc-day-past {
			background-color: #f8f9fa !important;
			color: #6c757d !important;
			cursor: not-allowed !important;
		}
	`;
	document.head.appendChild(style);

	// Bottone prenotazione
	document.getElementById('bookEmailBtn').addEventListener('click', function () {
		const start = this.dataset.start;
		const end = this.dataset.end;
		const days = parseInt(this.dataset.days);
		const price = parseInt(this.dataset.price);
		
		if (start && end) {
			// Verifica ancora una volta che siano almeno 2 giorni
			const dayCount = getDaysBetween(start, end);
			if (dayCount < 2) {
				alert('Errore: Sono richieste prenotazioni di almeno 2 giorni consecutivi.');
				return;
			}
			
			// Formatta le date per la modale
			const startFormatted = formatDateForDisplay(start);
			const endFormatted = formatDateForDisplay(end);
			
			// Mostra la modale per raccogliere i dati del cliente
			showBookingForm(start, end, startFormatted, endFormatted, dayCount, price);
			
		} else {
			alert('Seleziona prima un periodo di almeno 2 giorni nel calendario');
		}
	});

	// Funzione helper per mostrare toast
	function showToast(toastId, delay = 500) {
		setTimeout(() => {
			const toastElement = document.getElementById(toastId);
			if (toastElement) {
				const toast = new bootstrap.Toast(toastElement);
				toast.show();
			}
		}, delay);
	}

	// Funzione per mostrare il form di prenotazione
	function showBookingForm(start, end, startFormatted, endFormatted, dayCount, totalPrice) {
		// Aggiorna le informazioni nella modale
		const modalSelectedPeriod = document.getElementById('modalSelectedPeriod');
		const modalSelectedPrice = document.getElementById('modalSelectedPrice');
		
		// Controlli di sicurezza per verificare che gli elementi esistano
		if (modalSelectedPeriod && modalSelectedPrice) {
			modalSelectedPeriod.textContent = `Dal ${startFormatted} al ${endFormatted} (${dayCount} ${dayCount === 1 ? 'giorno' : 'giorni'})`;
			modalSelectedPrice.textContent = `Prezzo totale: €${totalPrice}`;
		} else {
			console.warn('Elementi modali non trovati nell\'HTML');
		}
		
		// Pulisce il form
		const bookingForm = document.getElementById('bookingForm');
		if (bookingForm) {
			bookingForm.reset();
		}
		
		// Mostra la modale
		const bookingModal = document.getElementById('bookingModal');
		if (bookingModal) {
			const modal = new bootstrap.Modal(bookingModal);
			modal.show();
		} else {
			console.warn('Modale di prenotazione non trovata nell\'HTML');
		}
		
		// Gestisce il click sul bottone di conferma
		const confirmBtn = document.getElementById('confirmBooking');
		if (confirmBtn) {
			confirmBtn.onclick = function() {
				sendBookingEmail(start, end, startFormatted, endFormatted, dayCount, totalPrice);
			};
		} else {
			console.warn('Pulsante di conferma non trovato nell\'HTML');
		}
	}

	// Funzione per inviare l'email tramite EmailJS
	async function sendBookingEmail(start, end, startFormatted, endFormatted, dayCount, totalPrice) {
		// Raccogli i dati dal form con controlli di sicurezza
		const nameElement = document.getElementById('guestName');
		const emailElement = document.getElementById('guestEmail');
		const phoneElement = document.getElementById('guestPhone');
		const guestCountElement = document.getElementById('guestCount');
		const notesElement = document.getElementById('guestMessage');
		const termsElement = document.getElementById('acceptTerms');
		
		if (!nameElement || !emailElement || !phoneElement || !guestCountElement || !notesElement || !termsElement) {
			console.error('Alcuni elementi del form non sono stati trovati');
			alert('Errore nel caricamento del form. Ricarica la pagina e riprova.');
			return;
		}
		
		const name = nameElement.value.trim();
		const email = emailElement.value.trim();
		const phone = phoneElement.value.trim();
		const guestCount = guestCountElement.value;
		const notes = notesElement.value.trim();
		const acceptedTerms = termsElement.checked;
		
		// Validazione
		if (!name || !email || !guestCount || !acceptedTerms) {
			alert('Compila tutti i campi obbligatori e accetta le regole della struttura');
			return;
		}
		
		// Mostra spinner
		const confirmBtn = document.getElementById('confirmBooking');
		if (confirmBtn) {
			confirmBtn.disabled = true;
			confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Invio in corso...';
		}
		
		// Controlla se EmailJS è disponibile
		console.log('=== DEBUG EMAILJS ===');
		console.log('typeof emailjs:', typeof emailjs);
		console.log('window.emailjs:', window.emailjs);
		console.log('EmailJS disponibile?', typeof emailjs !== 'undefined');
		console.log('=====================');
		
		if (typeof emailjs === 'undefined') {
			console.log('Invio email tramite client predefinito');
			
			// Crea email tramite mailto
			const subject = encodeURIComponent('Booking Request - Avesella House / Richiesta Prenotazione');
			const body = encodeURIComponent(
				'=== ENGLISH VERSION ===\n\n' +
				'New booking request for Avesella House\n\n' +
				'Guest Details:\n' +
				'- Name: ' + name + '\n' +
				'- Email: ' + email + '\n' +
				'- Phone: ' + phone + '\n' +
				'- Number of guests: ' + guestCount + '\n\n' +
				'Stay Details:\n' +
				'- Check-in: ' + startFormatted + '\n' +
				'- Check-out: ' + endFormatted + '\n' +
				'- Duration: ' + dayCount + ' days\n' +
				'- Total price: €' + totalPrice + '\n\n' +
				'Additional notes:\n' + (notes || 'No additional notes') + '\n\n' +
				'========================================\n\n' +
				'=== VERSIONE ITALIANA ===\n\n' +
				'Nuova richiesta di prenotazione per Avesella House\n\n' +
				'Dettagli cliente:\n' +
				'- Nome: ' + name + '\n' +
				'- Email: ' + email + '\n' +
				'- Telefono: ' + phone + '\n' +
				'- Numero ospiti: ' + guestCount + '\n\n' +
				'Dettagli soggiorno:\n' +
				'- Check-in: ' + startFormatted + '\n' +
				'- Check-out: ' + endFormatted + '\n' +
				'- Durata: ' + dayCount + ' giorni\n' +
				'- Prezzo totale: €' + totalPrice + '\n\n' +
				'Note aggiuntive:\n' + (notes || 'Nessuna nota particolare')
			);
			
			const mailtoLink = `mailto:emanuelesinagra@gmail.com,enzosinagra@gmail.com,${email}?subject=${subject}&body=${body}`;
			window.open(mailtoLink, '_blank');
			
			// Ripristina il pulsante
			if (confirmBtn) {
				confirmBtn.disabled = false;
				confirmBtn.innerHTML = 'Conferma Prenotazione';
			}
			
			// Mostra toast informativo per mailto
			showToast('errorToast', 100);
			
			return;
		}
		
		try {
			// Inizializza EmailJS (dovrai sostituire questi ID con i tuoi)
			emailjs.init("PJ9Xm7lJ-770vJ1CV"); // Sostituisci con la tua chiave pubblica
			
			// Parametri per l'email
			const templateParams = {
				to_email: 'emanuelesinagra@gmail.com;enzosinagra@gmail.com;info@staybologna.it;'+email,
				//to_email_2: 'enzosinagra@gmail.com',
				//to_email_guest: email, // Email dell'ospite
				from_name: name,
				from_email: email,
				phone: phone,
				guest_count: guestCount,
				check_in: startFormatted,
				check_out: endFormatted,
				duration: dayCount,
				total_price: totalPrice,
				notes: notes || 'No additional notes / Nessuna nota particolare',
				booking_dates: startFormatted + ' - ' + endFormatted,
				message: '=== ENGLISH VERSION ===\n\n' +
					'New booking request for Avesella House\n\n' +
					'Guest Details:\n' +
					'- Name: ' + name + '\n' +
					'- Email: ' + email + '\n' +
					'- Phone: ' + phone + '\n' +
					'- Number of guests: ' + guestCount + '\n\n' +
					'Stay Details:\n' +
					'- Check-in: ' + startFormatted + '\n' +
					'- Check-out: ' + endFormatted + '\n' +
					'- Duration: ' + dayCount + ' days\n' +
					'- Total price: €' + totalPrice + '\n\n' +
					'Additional notes: ' + (notes || 'No additional notes') + '\n\n' +
					'========================================\n\n' +
					'=== VERSIONE ITALIANA ===\n\n' +
					'Nuova richiesta di prenotazione per Avesella House\n\n' +
					'Dettagli cliente:\n' +
					'- Nome: ' + name + '\n' +
					'- Email: ' + email + '\n' +
					'- Telefono: ' + phone + '\n' +
					'- Numero ospiti: ' + guestCount + '\n\n' +
					'Dettagli soggiorno:\n' +
					'- Check-in: ' + startFormatted + '\n' +
					'- Check-out: ' + endFormatted + '\n' +
					'- Durata: ' + dayCount + ' giorni\n' +
					'- Prezzo totale: €' + totalPrice + '\n\n' +
					'Note: ' + (notes || 'Nessuna nota particolare')
			};
			
			// Invia l'email
			const response = await emailjs.send(
				'service_beb', // Sostituisci con il tuo Service ID
				'template_xqemt0n', // Sostituisci con il tuo Template ID
				templateParams
			);
			
			console.log('Email inviata con successo:', response);
			
			// Chiudi la modale
			const modal = bootstrap.Modal.getInstance(document.getElementById('bookingModal'));
			modal.hide();
			
			// Reset del calendario
			calendar.unselect();
			
			// Mostra toast di successo
			showToast('successToast', 500); // Delay per permettere alla modale di chiudersi
			
		} catch (error) {
			console.error('Errore invio email:', error);
			
			// Fallback: apri il client email tradizionale
			const subject = encodeURIComponent('Booking Request - Avesella House / Richiesta Prenotazione - ' + startFormatted + ' - ' + endFormatted + ' (' + dayCount + ' days/giorni)');
			const body = encodeURIComponent(
				'=== ENGLISH VERSION ===\n\n' +
				'Good morning,\n\nI would like to book Avesella House for the following period:\n\n' +
				'• Check-in: ' + startFormatted + '\n' +
				'• Check-out: ' + endFormatted + '\n' +
				'• Duration: ' + dayCount + ' days\n' +
				'• Total price: €' + totalPrice + '\n\n' +
				'Booking details:\n' +
				'• Name: ' + name + '\n' +
				'• Email: ' + email + '\n' +
				'• Phone: ' + phone + '\n' +
				'• Number of guests: ' + guestCount + '\n' +
				'• Notes: ' + (notes || 'None') + '\n\n' +
				'Thank you for your availability.\n\n' +
				'Best regards\n\n' +
				'========================================\n\n' +
				'=== VERSIONE ITALIANA ===\n\n' +
				'Buongiorno,\n\nVorrei prenotare Avesella House per il seguente periodo:\n\n' +
				'• Check-in: ' + startFormatted + '\n' +
				'• Check-out: ' + endFormatted + '\n' +
				'• Durata: ' + dayCount + ' giorni\n' +
				'• Prezzo totale: €' + totalPrice + '\n\n' +
				'Dettagli prenotazione:\n' +
				'• Nome: ' + name + '\n' +
				'• Email: ' + email + '\n' +
				'• Telefono: ' + phone + '\n' +
				'• Numero di ospiti: ' + guestCount + '\n' +
				'• Note: ' + (notes || 'Nessuna') + '\n\n' +
				'Grazie per la disponibilità.\n\n' +
				'Cordiali saluti'
			);
			
			window.location.href = 'mailto:emanuelesinagra@gmail.com,enzosinagra@gmail.com,' + encodeURIComponent(email) + '?subject=' + subject + '&body=' + body;
			const bookingModalElement = document.getElementById('bookingModal');
			if (bookingModalElement) {
				const modal = bootstrap.Modal.getInstance(bookingModalElement);
				if (modal) {
					modal.hide();
				}
			}
		} finally {
			// Reset del bottone
			if (confirmBtn) {
				confirmBtn.disabled = false;
				confirmBtn.innerHTML = 'Invia Richiesta';
			}
		}
	}
})();
