const http = require('http');
http.get('http://localhost:4000/api/instruments?segment=fo_futures', (r) => {
  let d = '';
  r.on('data', c => d += c);
  r.on('end', () => {
    const j = JSON.parse(d);
    j.instruments.forEach(i => console.log(i.symbol));
    console.log('Total:', j.instruments.length);
  });
});
