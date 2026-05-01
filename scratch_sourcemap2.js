const fs = require('fs');
const { SourceMapConsumer } = require('source-map');
const https = require('https');

https.get('https://crmapp8893.netlify.app/static/js/main.3acc9b35.js.map', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', async () => {
    const rawSourceMap = JSON.parse(data);
    const consumer = await new SourceMapConsumer(rawSourceMap);
    const positions = [
      { line: 2, column: 3359944 },
      { line: 2, column: 431262 },
      { line: 2, column: 3346896 },
      { line: 2, column: 3350051 }
    ];
    positions.forEach(pos => {
      const original = consumer.originalPositionFor(pos);
      console.log(`Line ${pos.line}:${pos.column} -> ${original.source}:${original.line}:${original.column} (${original.name})`);
    });
  });
});
