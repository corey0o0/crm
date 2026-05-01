const newItem = {
  name: "미니 점보 상단케이스(디자인) 5컬러 - X200맥스",
  part_id: null
};
const eItem = {
  name: "미니 점보 상단케이스(디자인) 5컬러 - X200맥스",
  part_id: 747,
  _warehouse_id: "W001"
};

const mergedItem = { ...newItem };
if (eItem._warehouse_id) mergedItem._warehouse_id = eItem._warehouse_id;

const isTransferred = true;
if (isTransferred && eItem.part_id) {
  mergedItem.part_id = eItem.part_id;
}

console.log(mergedItem);
