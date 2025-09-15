// scripts/ical2json.js
// npm install ical axios
const ical = require('ical');
const axios = require('axios');
const fs = require('fs');

async function run() {
	const icalUrl = process.env.BOOKING_ICAL_URL; // GitHub secret
	if (!icalUrl) throw new Error('ICAL_URL missing');

	const res = await axios.get(icalUrl, { responseType: 'text' });
	const data = ical.parseICS(res.data);

	const events = [];
	for (const k in data) {
		const ev = data[k];
		if (ev.type === 'VEVENT' || ev.type === undefined) {
			let price = null;
			if (ev.summary) {
				const m = ev.summary.match(/€\s*([\d,.]+)/);
				if (m) price = m[1];
			}
			events.push({
				uid: ev.uid || k,
				start: ev.start.toISOString().slice(0, 10),
				end: ev.end ? ev.end.toISOString().slice(0, 10) : ev.start.toISOString().slice(0, 10),
				summary: ev.summary || '',
				price,
			});
		}
	}

	fs.writeFileSync('data/availability.json', JSON.stringify({ generated_at: new Date().toISOString(), events }, null, 2));
	console.log('Wrote data/availability.json with', events.length, 'events');
}

run().catch(e => { console.error(e); process.exit(1); });
