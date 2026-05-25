/* ── FORMAT HELPERS ── */
function fmtDate(d) {
  if (!d) return '—';
  const [y,m,dd] = d.split('-');
  return `${dd}/${m}/${y}`;
}
function fmtAge(nasc) {
  if (!nasc) return null;
  const age = Math.floor((Date.now() - new Date(nasc)) / 31557600000);
  return isNaN(age) ? null : age + ' anos';
}
function statusBadge(s) {
  const map = {
    abordado:   ['b-abordado',  'ABORDADO'],
    preso:      ['b-preso',     'PRESO'],
    conduzido:  ['b-conduzido', 'CONDUZIDO'],
    testemunha: ['b-testemunha','TESTEMUNHA'],
    vitima:     ['b-vitima',    'VÍTIMA'],
    averiguado: ['b-averiguado','AVERIGUADO'],
  };
  const [cls, label] = map[s] || ['b-averiguado', s.toUpperCase()];
  return `<span class="badge ${cls}">${label}</span>`;
}
function tipoLabel(t) {
  return { abordagem:'ABORDAGEM', prisao:'PRISÃO EM FLAGRANTE', conducao:'CONDUÇÃO', averiguacao:'AVERIGUAÇÃO', ocorrencia:'OCORRÊNCIA' }[t] || t.toUpperCase();
}
function tipoClass(t) {
  return { prisao:'prisao', conducao:'conducao' }[t] || (t==='ocorrencia'?'abordagem':t);
}

/* Local presentation constants */
const localEmojis = { poi:'📌', recorrente:'🔁', trafico:'💊', fuga:'🏃', esconderijo:'🏚', reuniao:'👥' };
