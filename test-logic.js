const item = {
  "name": "배터리 방수 커버",
  "part_id": 1194,
  "custom_product_code": "8809249918952",
  "raw_custom_variant_code": "8809249918952",
  "product_code": "P0000KBG"
};
const cafe24_product_code = "P0000KBG"; // This is what the user probably mapped

const code = item.raw_custom_variant_code || item.raw_custom_product_code || item.custom_product_code || item.product_code;
console.log(code === cafe24_product_code); // false!

const match = [item.raw_custom_variant_code, item.raw_custom_product_code, item.custom_product_code, item.product_code].includes(cafe24_product_code);
console.log(match); // true!
