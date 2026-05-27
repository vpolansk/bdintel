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
    cadastrado: ['b-cadastrado','CADASTRADO'],
    confirmado: ['b-confirmado','CONFIRMADO'],
    liberdade:  ['b-liberdade', 'EM LIBERDADE'],
    abordado:   ['b-abordado',  'ABORDADO'],
    preso:      ['b-preso',     'PRESO'],
    procurado:  ['b-procurado', 'PROCURADO'],
    foragido:   ['b-foragido',  'FORAGIDO'],
    conduzido:  ['b-conduzido', 'CONDUZIDO'],
    testemunha: ['b-testemunha','TESTEMUNHA'],
    vitima:     ['b-vitima',    'VÍTIMA'],
    averiguado: ['b-averiguado','AVERIGUADO'],
    furtado:    ['b-procurado', 'FURTADO'],
    roubado:    ['b-procurado', 'ROUBADO'],
    recuperado: ['b-abordado',  'RECUPERADO'],
    suspeito:   ['b-conduzido', 'SUSPEITO'],
    clone:      ['b-clone',     'SUSPEITA DE CLONE'],
    apreendido: ['b-preso',     'APREENDIDO'],
    vinculado:  ['b-confirmado','VINCULADO'],
  };
  const [cls, label] = map[s] || ['b-averiguado', s.toUpperCase()];
  return `<span class="badge ${cls}">${label}</span>`;
}
function tipoLabel(t) {
  return { cadastro:'CADASTRO INICIAL', confirmacao:'CONFIRMAÇÃO DE DADOS', abordagem:'ABORDAGEM', prisao:'PRISÃO EM FLAGRANTE', conducao:'CONDUÇÃO', averiguacao:'AVERIGUAÇÃO', ocorrencia:'OCORRÊNCIA', furto_veiculo:'FURTO DE VEICULO', roubo_veiculo:'ROUBO DE VEICULO', recuperacao_veiculo:'RECUPERACAO DE VEICULO', clone_veiculo:'SUSPEITA DE CLONE' }[t] || t.toUpperCase();
}
function tipoClass(t) {
  if (t === 'cadastro' || t === 'confirmacao') return 'confirmacao';
  return { prisao:'prisao', conducao:'conducao' }[t] || (t==='ocorrencia'?'abordagem':t);
}

/* Local presentation constants */
const localEmojis = { poi:'📌', recorrente:'🔁', trafico:'💊', fuga:'🏃', esconderijo:'🏚', reuniao:'👥' };
