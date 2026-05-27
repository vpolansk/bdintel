/* Format helpers */
function fmtDate(d) {
  if (!d) return '-';
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
    vitima:     ['b-vitima',    'VITIMA'],
    averiguado: ['b-averiguado','AVERIGUADO'],
    furtado:    ['b-procurado', 'FURTADO'],
    roubado:    ['b-procurado', 'ROUBADO'],
    recuperado: ['b-abordado',  'RECUPERADO'],
    suspeito:   ['b-conduzido', 'SUSPEITO'],
    clone:      ['b-clone',     'SUSPEITA DE CLONE'],
    condutor_procurado: ['b-procurado', 'CONDUTOR PROCURADO/FORAGIDO'],
    apreendido: ['b-preso',     'APREENDIDO'],
    vinculado:  ['b-confirmado','VINCULADO'],
  };
  const [cls, label] = map[s] || ['b-averiguado', s.toUpperCase()];
  return `<span class="badge ${cls}">${label}</span>`;
}
function tipoLabel(t) {
  return { cadastro:'CADASTRO INICIAL', confirmacao:'CONFIRMACAO DE DADOS', abordagem:'ABORDAGEM', prisao:'PRISAO EM FLAGRANTE', conducao:'CONDUCAO', averiguacao:'AVERIGUACAO', ocorrencia:'OCORRENCIA', roubo:'ROUBO', furto:'FURTO', furto_qualificado:'FURTO QUALIFICADO', homicidio:'HOMICIDIO', estupro:'ESTUPRO', estelionato:'ESTELIONATO', roubo_residencia:'ROUBO A RESIDENCIA', roubo_comercio:'ROUBO A COMERCIO', roubo_pedestre:'ROUBO A PEDESTRE', furto_residencia:'FURTO EM RESIDENCIA', furto_comercio:'FURTO EM COMERCIO', furto_arrombamento:'FURTO/ARROMBAMENTO', trafico:'TRAFICO', receptacao:'RECEPTACAO', porte_arma:'PORTE/POSSE DE ARMA', mandado:'CUMPRIMENTO DE MANDADO', furto_veiculo:'FURTO DE VEICULO', roubo_veiculo:'ROUBO DE VEICULO', recuperacao_veiculo:'RECUPERACAO DE VEICULO', clone_veiculo:'SUSPEITA DE CLONE', condutor_procurado_veiculo:'CONDUTOR PROCURADO/FORAGIDO' }[t] || t.toUpperCase();
}
function tipoClass(t) {
  if (t === 'cadastro' || t === 'confirmacao') return 'confirmacao';
  return { prisao:'prisao', conducao:'conducao' }[t] || (t==='ocorrencia'?'abordagem':t);
}

/* Local presentation constants */
const localEmojis = { poi:'POI', recorrente:'REC', trafico:'TRF', fuga:'FUG', esconderijo:'ESC', reuniao:'REU' };
