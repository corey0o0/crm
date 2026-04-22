const ecountTag = encodeURIComponent('과거 이카운트 이관');
const b2bTag1 = encodeURIComponent('[B2B수기]');
const b2bTag2 = encodeURIComponent('[B2B수기판매]');
const excelTag = encodeURIComponent('[엑셀일괄등록]');
const manualTag = encodeURIComponent('[수기판매]');
const ecountNoteTag = encodeURIComponent('이카운트');
const salesChannelFilter = `or(sales_channel.is.null,and(sales_channel.neq.${ecountTag},sales_channel.neq.${b2bTag1}))`;
const noteFilter = `or(note.is.null,and(note.not.ilike.*${b2bTag2}*,note.not.ilike.*${excelTag}*,note.not.ilike.*${manualTag}*,note.not.ilike.*${ecountNoteTag}*))`;

console.log(`and(${salesChannelFilter},${noteFilter})`);
