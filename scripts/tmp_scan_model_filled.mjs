import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { matchAllKnownAirframeModels } from '../src/utils/airframeModelNormalize.js';

const envText = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const supabase = createClient(env.REACT_APP_SUPABASE_URL, env.REACT_APP_SUPABASE_ANON_KEY);

let all = [];
let from = 0;
while (true) {
  const { data, error } = await supabase.from('parts').select('id, name, model').range(from, from + 999);
  if (error) throw error;
  all = all.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}

const withModel = all.filter(p => p.model && String(p.model).trim());
console.log(`전체 ${all.length}건 중 기종(model) 채워진 항목: ${withModel.length}건`);

const ok = [];
const missingSuffix = [];
const duplicated = []; // 접미사가 2번 이상 반복
const mismatch = []; // suffix는 있는데 model 토큰과 안 맞음

for (const p of withModel) {
  const modelTokens = String(p.model).split('/').map(s => s.trim()).filter(Boolean);
  const name = p.name || '';
  const expectedSuffix = ` - ${modelTokens.join('/')}`;

  if (name.endsWith(expectedSuffix)) {
    // 접미사가 중복으로 더 붙어있는지 (예: "... - X200GT - X200GT")
    const before = name.slice(0, -expectedSuffix.length);
    if (before.endsWith(expectedSuffix) || / - [A-Za-z0-9가-힣/]+$/.test(before)) {
      duplicated.push({ id: p.id, name, model: p.model });
    } else {
      ok.push(p);
    }
    continue;
  }

  // dash 형태로 뭔가 suffix는 있는데 토큰이 다름
  const dashIdx = name.lastIndexOf(' - ');
  if (dashIdx >= 0) {
    const tail = name.slice(dashIdx + 3);
    const matched = matchAllKnownAirframeModels(tail);
    if (matched.length > 0) {
      mismatch.push({ id: p.id, name, model: p.model, tail });
      continue;
    }
  }

  missingSuffix.push({ id: p.id, name, model: p.model });
}

console.log(`\n정상 (이름에 기종 접미사 정확히 포함): ${ok.length}건`);
console.log(`접미사 중복 의심: ${duplicated.length}건`);
console.log(`접미사 있지만 model 필드와 불일치: ${mismatch.length}건`);
console.log(`접미사 아예 없음 (model만 채워짐): ${missingSuffix.length}건`);

console.log('\n--- 중복 의심 샘플 ---');
duplicated.slice(0, 30).forEach(p => console.log(`[${p.id}] "${p.name}" (model: ${p.model})`));

console.log('\n--- 불일치 샘플 ---');
mismatch.slice(0, 30).forEach(p => console.log(`[${p.id}] "${p.name}" tail="${p.tail}" (model: ${p.model})`));

console.log('\n--- 접미사 없음 샘플 ---');
missingSuffix.slice(0, 30).forEach(p => console.log(`[${p.id}] "${p.name}" (model: ${p.model})`));
