const actualPriceInDB = 1081818; // 단가
const isLegacyEcount = true;

let actualPrice = actualPriceInDB;
let actualTotalPrice = 1190000;
let quantity = 1;

if (isLegacyEcount) {
  actualPrice = Math.round(actualPrice * 1.1);
  actualTotalPrice = actualPrice * quantity;
}

console.log("UI Display - Unit Price:", actualPrice);
console.log("UI Display - Total Price:", actualTotalPrice);
