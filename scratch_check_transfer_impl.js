const fs = require('fs');
let code = fs.readFileSync('src/utils/cafe24Api.js', 'utf8');
const match = code.match(/export async function transferCafe24Orders([\s\S]*?)return/);
if (match) console.log(match[0].substring(0, 1000));
