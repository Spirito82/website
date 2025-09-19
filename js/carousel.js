// Gestione click sulle immagini del carosello per aprire la modale e chiusura menu mobile
document.addEventListener('DOMContentLoaded', function () {
	const clickableImages = document.querySelectorAll('.clickable-image');
	const imageModal = new bootstrap.Modal(document.getElementById('imageModal'));
	const modalElement = document.getElementById('imageModal');
	const modalImage = document.getElementById('modalImage');
	const modalTitle = document.getElementById('modalImageTitle');
	const modalDescription = document.getElementById('modalImageDescription');

	clickableImages.forEach(function (img) {
		img.addEventListener('click', function (e) {
			// Previeni che il click passi al carosello
			e.stopPropagation();

			// Aggiorna la modale con i dati dell'immagine
			modalImage.src = this.src;
			modalImage.alt = this.alt;
			modalTitle.textContent = this.dataset.title;
			modalDescription.textContent = this.dataset.description;

			// Mostra la modale
			imageModal.show();
		});
	});

	// Listener per la pulizia completa della modale quando viene chiusa
	modalElement.addEventListener('hidden.bs.modal', function () {
		// Assicurati che l'overlay sia completamente rimosso
		const backdropElements = document.querySelectorAll('.modal-backdrop');
		backdropElements.forEach(backdrop => backdrop.remove());
        
		// Ripristina lo scroll del body se necessario
		document.body.classList.remove('modal-open');
		document.body.style.overflow = '';
		document.body.style.paddingRight = '';
	});

	// Chiusura automatica del menu mobile quando si clicca su una voce
	const navbarToggler = document.querySelector('.navbar-toggler');
	const navbarCollapse = document.querySelector('#navbarNav');
	const navLinks = document.querySelectorAll('.navbar-nav .nav-link');

	navLinks.forEach(function (link) {
		link.addEventListener('click', function (e) {
			// Sempre previeni il comportamento di default per controllare lo scroll
			e.preventDefault();
            
			const href = link.getAttribute('href');
			if (href && href.startsWith('#')) {
				const targetId = href.substring(1);
				const targetElement = document.getElementById(targetId);
                
				if (targetElement) {
					// Verifica se il menu è aperto (visibile)
					if (navbarCollapse.classList.contains('show')) {
						// Chiudi il menu
						const bsCollapse = new bootstrap.Collapse(navbarCollapse, {
							toggle: false
						});
						bsCollapse.hide();
                        
						// Aspetta che il menu si chiuda
						setTimeout(() => {
							// Forza lo scroll alla posizione corretta
							targetElement.scrollIntoView({ behavior: 'smooth' });
							// Aggiorna anche l'URL
							window.history.replaceState(null, null, href);
						}, 100);
					} else {
						// Menu già chiuso, scroll immediato
						targetElement.scrollIntoView({ behavior: 'smooth' });
						// Aggiorna l'URL
						window.history.replaceState(null, null, href);
					}
				}
			}
		});
	});
});
