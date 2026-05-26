let selPessoa = null, selVeiculo = null, selLocal = null, selOcorrencia = null;
let pessoaFilter = 'all';
let editingPessoaId = null, editingVeiculoId = null, editingLocalId = null, editingOcorrenciaId = null;
let eventoTargetId = null;
let confirmacaoTargetId = null;
let vinculoTargetId = null;
let mapMain = null, mapMarkers = null;
let ocorrenciaPickerMap = null, ocorrenciaPickerMarker = null;
let mapFilters = { abordagem: true, prisao: true, averiguacao: true, baixa: true, media: true, alta: true, residencia: true, local_poi: true };
/* ══════════════════════════════════════════════════════════════
   NAV / PAGES
══════════════════════════════════════════════════════════════ */
function goPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('mobile-detail-open'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  document.getElementById('ntab-' + id).classList.add('active');
  if (id === 'mapa') { setTimeout(() => { mapMain.invalidateSize(); renderMapMarkers(); }, 50); }
}

/* ══════════════════════════════════════════════════════════════
   PESSOAS — LIST
══════════════════════════════════════════════════════════════ */
function setSF(f) {
  pessoaFilter = f;
  document.querySelectorAll('.chip').forEach(c => {
    const v = c.dataset.sf;
    c.className = 'chip';
    if (v === f) c.classList.add('on-' + f);
  });
  renderPessoasList();
}

function renderPessoasList() {
  const q = document.getElementById('pessoas-search').value.toLowerCase().trim();
  let list = DB.pessoas.filter(p => {
    if (pessoaFilter !== 'all') {
      const statuses = Array.isArray(p.status) ? p.status : [p.status];
      if (!statuses.includes(pessoaFilter)) return false;
    }
    if (!q) return true;
    const hay = [p.nome, p.alcunha, p.cpf, p.rg, p.bairro, p.cidade, p.mae].join(' ').toLowerCase();
    return hay.includes(q);
  });

  document.getElementById('cnt-pessoas').textContent = DB.pessoas.length;
  const el = document.getElementById('pessoas-list');

  if (!list.length) {
    el.innerHTML = `<div class="empty-state">// NENHUM REGISTRO<br>cadastre uma pessoa para começar</div>`;
    return;
  }

  el.innerHTML = list.map(p => {
    const statuses = Array.isArray(p.status) ? p.status : [p.status];
    const badges = statuses.map(statusBadge).join('');
    const age = fmtAge(p.nascimento);
    const local = [p.cidade, p.bairro].filter(Boolean).join(' · ');
    const sub = [p.alcunha ? `"${p.alcunha}"` : null, local, age].filter(Boolean).join(' · ');
    const foto = p.foto
      ? `<img src="${p.foto}" onerror="this.parentElement.textContent='👤'">`
      : '👤';
    return `<div class="person-card${selPessoa===p.id?' sel':''}" onclick="selectPessoa('${p.id}')">
      <div class="avatar">${foto}</div>
      <div class="pc-info">
        <div class="pc-name">${p.nome}</div>
        <div class="pc-sub">${sub || '—'}</div>
        <div class="pc-badges">${badges}</div>
      </div>
    </div>`;
  }).join('');
}

/* ══════════════════════════════════════════════════════════════
   PESSOAS — DETAIL
══════════════════════════════════════════════════════════════ */
let dTab = 'dados';

function selectPessoa(id) {
  selPessoa = id;
  dTab = 'dados';
  if (isMobileLayout()) document.getElementById('page-pessoas').classList.add('mobile-detail-open');
  renderPessoasList();
  renderPessoaDetail();
  scrollDetailIntoView('pessoa-detail');
}

function voltarListaPessoas() {
  document.getElementById('page-pessoas').classList.remove('mobile-detail-open');
  requestAnimationFrame(() => {
    const list = document.getElementById('pessoas-list');
    if (list) list.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function getPessoaNome(id) {
  const p = DB.pessoas.find(x => x.id === id);
  return p ? p.nome : '';
}

function getVeiculosDaPessoa(pessoaId) {
  return DB.veiculos.filter(v => v.condutorId === pessoaId);
}

function ensureLinks() {
  if (!Array.isArray(DB.links)) DB.links = [];
}

function upsertLink(link) {
  ensureLinks();
  const same = DB.links.find(l =>
    l.fromType === link.fromType &&
    l.fromId === link.fromId &&
    l.toType === link.toType &&
    l.toId === link.toId &&
    l.relation === link.relation
  );
  if (same) {
    Object.assign(same, link, { count: (same.count || 1) + 1, updatedAt: new Date().toISOString() });
  } else {
    DB.links.push({ id: uid(), count: 1, createdAt: new Date().toISOString(), ...link });
  }
}

function removeLinksForEntity(type, id) {
  ensureLinks();
  DB.links = DB.links.filter(l => !(l.fromType === type && l.fromId === id) && !(l.toType === type && l.toId === id));
}

function renderPessoaVeiculosSection(p) {
  const veiculos = getVeiculosDaPessoa(p.id);
  if (!veiculos.length) return '';
  return `
    <div class="info-section">
      <div class="section-label">Veículos Vinculados (${veiculos.length})</div>
      ${veiculos.map(v => `
        <div class="veiculo-card" style="margin-bottom:6px" onclick="goPage('veiculos');selectVeiculo('${v.id}')">
          <div class="placa">${v.placa}</div>
          <div class="v-info">
            <div class="v-model">${[v.marca, v.modelo].filter(Boolean).join(' ') || 'Veículo'} ${v.cor?'· '+v.cor:''}</div>
            <div class="v-sub">${[v.ano, v.proprietario ? 'Prop.: ' + v.proprietario : null].filter(Boolean).join(' · ') || 'Clique para abrir o cadastro'}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderPessoaDetail() {
  const p = DB.pessoas.find(x => x.id === selPessoa);
  const el = document.getElementById('pessoa-detail');
  if (!p) { el.innerHTML = '<div class="blank-msg">// SELECIONE UM INDIVÍDUO</div>'; el.classList.add('blank'); return; }
  el.classList.remove('blank');

  const statuses = Array.isArray(p.status) ? p.status : [p.status];
  const badges = statuses.map(statusBadge).join('');
  const age = fmtAge(p.nascimento);
  const eventos = (p.eventos || []).length;
  const vinculos = (p.vinculos || []).length;

  const foto = p.foto
    ? `<img src="${p.foto}" onclick="event.stopPropagation();openPhotoViewer('${p.id}','pessoa')" title="Clique para ampliar" onerror="this.parentElement.textContent='👤'">`
    : '👤';

  el.innerHTML = `
      <div class="detail-mobile-nav">
        <button class="btn mobile-back" onclick="voltarListaPessoas()">VOLTAR A LISTA</button>
      </div>
      <div class="detail-head">
      <div class="avatar lg" style="${p.foto?'cursor:zoom-in':''}" ${p.foto?`onclick="openPhotoViewer('${p.id}','pessoa')"`:''}>${foto}</div>
      <div class="detail-head-info">
        <div class="detail-name">${p.nome}</div>
        ${p.alcunha ? `<div class="detail-alcunha">"${p.alcunha}"</div>` : ''}
        <div style="margin-top:5px">${badges}</div>
        <div class="detail-meta" style="margin-top:6px">${[age, p.bairro||p.cidade, `${eventos} ocorrência(s)`, `${vinculos} vínculo(s)`].filter(Boolean).join(' · ')}</div>
      </div>
      <div class="detail-head-actions">
        <button class="btn sm primary" onclick="openModal_confirmacao('${p.id}')">✓ CONFIRMAR</button>
        <button class="btn sm" onclick="openModal_pessoa('${p.id}')">✏ EDITAR</button>
        <button class="btn sm danger" onclick="deletePessoa('${p.id}')">✕</button>
      </div>
    </div>
    <div class="dtabs">
      <div class="dtab${dTab==='dados'?' active':''}" onclick="setDTab('dados')">DADOS</div>
      <div class="dtab${dTab==='timeline'?' active':''}" onclick="setDTab('timeline')">LINHA DO TEMPO ${eventos>0?'<span class="count">'+eventos+'</span>':''}</div>
      <div class="dtab${dTab==='vinculos'?' active':''}" onclick="setDTab('vinculos')">VÍNCULOS ${vinculos>0?'<span class="count">'+vinculos+'</span>':''}</div>
      <div class="dtab${dTab==='mapa'?' active':''}" onclick="setDTab('mapa')">MAPA</div>
    </div>
    <div class="detail-body" id="dbd"></div>
  `;
  renderDTab();
}

function setDTab(t) { dTab = t; renderPessoaDetail(); }

function renderDTab() {
  const p = DB.pessoas.find(x => x.id === selPessoa);
  const el = document.getElementById('dbd');
  if (!p || !el) return;

  if (dTab === 'dados') {
    const age = fmtAge(p.nascimento);
    el.innerHTML = `
      <div class="info-section">
        <div class="section-label">Identificação</div>
        <div class="info-grid">
          <div class="info-item span2"><div class="ilab">Nome Completo</div><div class="ival">${p.nome}</div></div>
          <div class="info-item"><div class="ilab">Alcunha</div><div class="ival ${!p.alcunha?'empty':''}">${p.alcunha||'—'}</div></div>
          <div class="info-item"><div class="ilab">Nascimento</div><div class="ival mono">${fmtDate(p.nascimento)}${age?' · '+age:''}</div></div>
          <div class="info-item"><div class="ilab">RG</div><div class="ival mono ${!p.rg?'empty':''}">${p.rg||'—'}</div></div>
          <div class="info-item"><div class="ilab">CPF</div><div class="ival mono ${!p.cpf?'empty':''}">${p.cpf||'—'}</div></div>
          <div class="info-item span2"><div class="ilab">Nome da Mãe</div><div class="ival ${!p.mae?'empty':''}">${p.mae||'—'}</div></div>
        </div>
      </div>
      <div class="info-section">
        <div class="section-label">Endereço / Localização</div>
        <div class="info-grid cols1">
          <div class="info-item"><div class="ilab">Endereço Informado</div><div class="ival ${!p.endereco?'empty':''}">${p.endereco||'—'}</div></div>
        </div>
        <div class="info-grid" style="margin-top:8px">
          <div class="info-item"><div class="ilab">Bairro</div><div class="ival ${!p.bairro?'empty':''}">${p.bairro||'—'}</div></div>
          <div class="info-item"><div class="ilab">Cidade</div><div class="ival ${!p.cidade?'empty':''}">${p.cidade||'—'}</div></div>
          <div class="info-item"><div class="ilab">Estado</div><div class="ival ${!p.estado?'empty':''}">${p.estado||'—'}</div></div>
        </div>
      </div>
      ${p.caracteristicas ? `<div class="info-section"><div class="section-label">Características Físicas</div><div class="ival" style="white-space:pre-wrap">${p.caracteristicas}</div></div>` : ''}
      ${renderPessoaVeiculosSection(p)}
      ${p.vinculosInfo ? `<div class="info-section"><div class="section-label">Vínculos / Associações</div><div class="ival" style="white-space:pre-wrap">${p.vinculosInfo}</div></div>` : ''}
      ${p.obs ? `<div class="info-section"><div class="section-label">Observações Operacionais</div><div class="ival" style="white-space:pre-wrap">${p.obs}</div></div>` : ''}
    `;
    return;
  }

  if (dTab === 'timeline') {
    const evs = (p.eventos || []).slice().sort((a,b) => {
      const da = (a.data||'') + (a.hora||'');
      const db2 = (b.data||'') + (b.hora||'');
      return db2.localeCompare(da);
    });
    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div class="section-label" style="margin-bottom:0;border:none">LINHA DO TEMPO — ${evs.length} registro(s)</div>
        <button class="btn primary sm" onclick="openModal_evento('${p.id}')">＋ REGISTRAR</button>
      </div>
      ${!evs.length ? '<div class="empty-state">// SEM REGISTROS NA LINHA DO TEMPO</div>' : `
      <div class="timeline-wrap">
        <div class="tl-line"></div>
        ${evs.map((ev,i) => `
        <div class="tl-entry">
          <div class="tl-node ${tipoClass(ev.tipo)}"></div>
          <div class="tl-header">
            <div class="tl-type ${tipoClass(ev.tipo)}">${tipoLabel(ev.tipo)}</div>
            <div class="tl-dt">${fmtDate(ev.data)}${ev.hora?' · '+ev.hora:''}</div>
          </div>
          <div class="tl-card">
            <div class="tl-local">📍 ${ev.local||'—'}</div>
            ${ev.historico ? `<div class="tl-desc">${ev.historico}</div>` : ''}
            <div class="tl-tags">
              ${ev.motivo?`<span class="tl-tag">Motivo: ${ev.motivo}</span>`:''}
              ${ev.resultado?`<span class="tl-tag">Resultado: ${ev.resultado}</span>`:''}
              ${getEventoGravidade(ev)?`<span class="tl-tag">Gravidade: ${getEventoMapStyle(ev).label}</span>`:''}
              ${ev.viatura?`<span class="tl-tag">🚓 ${ev.viatura}</span>`:''}
              ${ev.ba?`<span class="tl-tag">BA/BO: ${ev.ba}</span>`:''}
              ${ev.tipif?`<span class="tl-tag">⚖ ${ev.tipif}</span>`:''}
            </div>
            ${ev.objetos?`<div style="margin-top:8px;font-size:12px;color:var(--text2)">📦 ${ev.objetos}</div>`:''}
            <div class="tl-actions">
              <button class="btn sm danger" onclick="deleteEvento('${p.id}',${i})">✕ EXCLUIR</button>
            </div>
          </div>
        </div>`).join('')}
      </div>`}
    `;
    return;
  }

  if (dTab === 'vinculos') {
    const vks = (p.vinculos || []);
    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div class="section-label" style="margin-bottom:0;border:none">VÍNCULOS — ${vks.length} registro(s)</div>
        <button class="btn primary sm" onclick="openModal_vinculo('${p.id}')">＋ VÍNCULO</button>
      </div>
      ${!vks.length ? '<div class="empty-state">// SEM VÍNCULOS REGISTRADOS</div>' : `
      <div class="vinculos-grid">
        ${vks.map((vk,i) => {
          const outro = DB.pessoas.find(x => x.id === vk.pessoaId);
          const outroNome = outro ? outro.nome : (vk.pessoaId || '—');
          const fotoHtml = outro && outro.foto ? `<img src="${outro.foto}" onerror="this.parentElement.textContent='👤'">` : '👤';
          return `<div class="vinculo-card" onclick="${outro?'selectPessoa(\''+outro.id+'\')':'void(0)'}">
            <div class="avatar" style="width:34px;height:34px;font-size:14px">${fotoHtml}</div>
            <div class="vc-info">
              <div class="vc-rel">${vk.tipo}</div>
              <div class="vc-name">${outroNome}</div>
              ${vk.obs?`<div style="font-size:11px;color:var(--text3);margin-top:2px">${vk.obs}</div>`:''}
            </div>
            <button class="btn sm danger" onclick="event.stopPropagation();deleteVinculo('${p.id}',${i})">✕</button>
          </div>`;
        }).join('')}
      </div>`}
    `;
    return;
  }

  if (dTab === 'mapa') {
    el.innerHTML = `
      <div class="section-label">PONTOS REGISTRADOS</div>
      <div id="mini-map" style="height:220px;margin-bottom:14px"></div>
      <div class="info-section">
        <div style="font-size:12px;color:var(--text2);line-height:1.8">
          ${p.lat && p.lng ? `<div>🏠 <b>Residência:</b> ${p.endereco||p.bairro||'coordenadas registradas'}</div>` : ''}
          ${(p.eventos||[]).filter(e=>e.lat&&e.lng).map(e=>`<div>📍 <b>${tipoLabel(e.tipo)}:</b> ${e.local}</div>`).join('')}
        </div>
      </div>
    `;
    function buildMiniMap() {
      if (typeof window.L === 'undefined') { setTimeout(buildMiniMap, 200); return; }
      const mapEl = document.getElementById('mini-map');
      if (!mapEl) return;
      const center = (p.lat && p.lng) ? [p.lat, p.lng] :
                     (p.eventos||[]).find(e=>e.lat) ? [p.eventos.find(e=>e.lat).lat, p.eventos.find(e=>e.lat).lng] :
                     [-29.76, -51.15];
      const mm = window.L.map('mini-map', { zoomControl: false }).setView(center, 14);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mm);
      if (p.lat && p.lng) mkIcon('#40c068', mm, [p.lat, p.lng], 'Residência');
      (p.eventos||[]).forEach(ev => {
        if (!ev.lat || !ev.lng) return;
        const c = ev.tipo==='prisao'?'#e05050':ev.tipo==='abordagem'?'#4090e0':'#e8c840';
        mkIcon(c, mm, [ev.lat, ev.lng], tipoLabel(ev.tipo));
      });
    }
    setTimeout(buildMiniMap, 100);
    return;
  }
}

function mkIcon(color, map, pos, label) {
  if (typeof window.L === 'undefined') return null;
  const icon = window.L.divIcon({
    className: '',
    html: `<div style="width:10px;height:10px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,.35);box-shadow:0 0 5px ${color}80"></div>`,
    iconSize: [10,10], iconAnchor: [5,5]
  });
  return window.L.marker(pos, { icon }).bindTooltip(label, { direction:'top' }).addTo(map);
}

/* ── MODAL: PESSOA ── */
function openModal_pessoa(id) {
  editingPessoaId = id;
  const isNew = !id;
  document.getElementById('m-pessoa-title').textContent = isNew ? 'CADASTRAR PESSOA' : 'EDITAR CADASTRO';
  const fields = ['nome','alcunha','nasc','rg','cpf','mae','status','end','bairro','cidade','estado','lat','lng','foto','caract','vinculos','obs'];
  fields.forEach(f => {
    const el = document.getElementById('mp-' + f);
    if (el) el.value = '';
  });
  document.getElementById('mp-status').value = 'cadastrado';
  document.getElementById('m-pessoa-fotoprev').innerHTML = '👤';

  if (id) {
    const p = DB.pessoas.find(x => x.id === id);
    if (!p) return;
    document.getElementById('mp-nome').value = p.nome || '';
    document.getElementById('mp-alcunha').value = p.alcunha || '';
    document.getElementById('mp-nasc').value = p.nascimento || '';
    document.getElementById('mp-rg').value = p.rg || '';
    document.getElementById('mp-cpf').value = p.cpf || '';
    document.getElementById('mp-mae').value = p.mae || '';
    const statuses = Array.isArray(p.status) ? p.status[0] : p.status;
    document.getElementById('mp-status').value = statuses || 'cadastrado';
    document.getElementById('mp-end').value = p.endereco || '';
    document.getElementById('mp-bairro').value = p.bairro || '';
    document.getElementById('mp-cidade').value = p.cidade || '';
    document.getElementById('mp-estado').value = p.estado || '';
    document.getElementById('mp-lat').value = p.lat || '';
    document.getElementById('mp-lng').value = p.lng || '';
    document.getElementById('mp-foto').value = p.foto || '';
    document.getElementById('mp-caract').value = p.caracteristicas || '';
    document.getElementById('mp-vinculos').value = p.vinculosInfo || '';
    document.getElementById('mp-obs').value = p.obs || '';
    if (p.foto) {
      document.getElementById('m-pessoa-fotoprev').innerHTML = `<img src="${p.foto}" onclick="event.stopPropagation();openPhotoViewer('${p.id}','pessoa')" title="Clique para ampliar" onerror="this.parentElement.textContent='👤'">`;
    }
  }
  openOv('ov-pessoa');
}

function previewFotoUrl() {
  const url = document.getElementById('mp-foto').value.trim();
  const el = document.getElementById('m-pessoa-fotoprev');
  const overlay = `<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.55);font-size:9px;font-family:var(--font-mono);text-align:center;padding:2px;color:var(--accent);letter-spacing:1px">FOTO</div>`;
  el.innerHTML = url ? `<img src="${url}" onclick="event.stopPropagation();openPhotoViewerFromSrc(document.getElementById('mp-foto').value.trim(),'Foto do indivíduo')" title="Clique para ampliar" onerror="this.parentElement.innerHTML='👤'+overlay">${overlay}` : `👤${overlay}`;
}

function previewFotoFile(input) {
  if (!input.files || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('mp-foto').value = e.target.result;
    const overlay = `<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.55);font-size:9px;font-family:var(--font-mono);text-align:center;padding:2px;color:var(--accent);letter-spacing:1px">FOTO</div>`;
    document.getElementById('m-pessoa-fotoprev').innerHTML = `<img src="${e.target.result}" onclick="event.stopPropagation();openPhotoViewerFromSrc(document.getElementById('mp-foto').value.trim(),'Foto do indivíduo')" title="Clique para ampliar">${overlay}`;
  };
  reader.readAsDataURL(input.files[0]);
}

function vehicleFotoOverlay() {
  return `<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.55);font-size:9px;font-family:var(--font-mono);text-align:center;padding:2px;color:var(--accent);letter-spacing:1px">FOTO</div>`;
}

function setVeiculoFotoPreview(src) {
  const el = document.getElementById('m-veiculo-fotoprev');
  if (!el) return;
  const overlay = vehicleFotoOverlay();
  el.innerHTML = src
    ? `<img src="${src}" onclick="event.stopPropagation();openPhotoViewerFromSrc(document.getElementById('mv-foto').value.trim(),'Foto do veículo')" title="Clique para ampliar" onerror="this.parentElement.innerHTML='🚗'+vehicleFotoOverlay()">${overlay}`
    : `🚗${overlay}`;
}

function previewVeiculoFotoUrl() {
  const url = document.getElementById('mv-foto').value.trim();
  setVeiculoFotoPreview(url);
}

function previewVeiculoFotoFile(input) {
  if (!input.files || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('mv-foto').value = e.target.result;
    setVeiculoFotoPreview(e.target.result);
  };
  reader.readAsDataURL(input.files[0]);
}

async function buscarEnderecoCampos(addressId, latId, lngId, bairroId, cidadeId, estadoId, afterFound) {
  const addressEl = document.getElementById(addressId);
  const query = addressEl ? addressEl.value.trim() : '';
  if (!query) { toast('Digite o endereco ou referencia para buscar.', true); return null; }
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&accept-language=pt-BR&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' } });
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) {
      toast('Endereco nao encontrado. Tente incluir bairro e cidade.', true);
      return null;
    }
    const found = data[0];
    const lat = parseFloat(found.lat);
    const lng = parseFloat(found.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast('Endereco encontrado, mas sem coordenadas validas.', true);
      return null;
    }
    document.getElementById(latId).value = lat.toFixed(6);
    document.getElementById(lngId).value = lng.toFixed(6);

    const addr = found.address || {};
    const bairro = addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district || '';
    const cidade = addr.city || addr.town || addr.village || addr.municipality || '';
    const estado = addr.state || '';
    if (bairroId && bairro) document.getElementById(bairroId).value = bairro;
    if (cidadeId && cidade) document.getElementById(cidadeId).value = cidade;
    if (estadoId && estado) document.getElementById(estadoId).value = estado;

    const enderecoFinal = montarEnderecoComNumero(query, found);
    if (enderecoFinal && addressEl && confirm('Usar o endereco encontrado no campo?')) {
      addressEl.value = enderecoFinal;
    }
    if (typeof afterFound === 'function') afterFound({ lat, lng, found });
    toast('Endereco localizado e coordenadas preenchidas.');
    return { lat, lng, found };
  } catch(e) {
    toast('Nao foi possivel buscar o endereco agora.', true);
    return null;
  }
}

function extrairNumeroEndereco(texto) {
  const limpo = (texto || '').trim();
  const padroes = [
    /\b(?:n(?:\.|º|o|umero)?\s*)?(\d{1,6}[A-Za-z]?)\b/,
    /,\s*(\d{1,6}[A-Za-z]?)\b/,
  ];
  for (const p of padroes) {
    const match = limpo.match(p);
    if (match) return match[1];
  }
  return '';
}

function montarEnderecoComNumero(original, found) {
  const display = found.display_name || original;
  const addr = found.address || {};
  const numeroOriginal = extrairNumeroEndereco(original);
  if (!numeroOriginal || addr.house_number || display.includes(numeroOriginal)) return display;

  const rua = addr.road || addr.pedestrian || addr.path || addr.residential || '';
  if (rua && display.toLowerCase().includes(rua.toLowerCase())) {
    return display.replace(rua, `${rua}, ${numeroOriginal}`);
  }
  return `${numeroOriginal}, ${display}`;
}

function getGPS(latId, lngId, btnId, addressId) {
  if (!navigator.geolocation) { toast('GPS não disponível neste dispositivo.', true); return; }
  const btn = document.getElementById(btnId);
  const orig = btn.innerHTML;
  btn.innerHTML = '⏳ AGUARDANDO GPS…';
  btn.disabled = true;

  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      document.getElementById(latId).value = lat.toFixed(6);
      document.getElementById(lngId).value = lng.toFixed(6);
      if (latId === 'oc-lat' && lngId === 'oc-lng') setOcorrenciaCoords(lat, lng, true);

      if (addressId) {
        // Geocodificação reversa via Nominatim (OpenStreetMap) — gratuito, sem chave
        btn.innerHTML = '⏳ BUSCANDO ENDEREÇO…';
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=pt-BR`, {
          headers: { 'Accept-Language': 'pt-BR,pt;q=0.9' }
        })
        .then(r => r.json())
        .then(data => {
          const a = data.address || {};
          // Monta endereço no formato operacional: Rua, nº — Bairro, Cidade
          const partes = [];
          if (a.road || a.pedestrian || a.path) partes.push(a.road || a.pedestrian || a.path);
          if (a.house_number) partes[0] && (partes[0] += ', n.º ' + a.house_number);
          const bairro = a.suburb || a.neighbourhood || a.quarter || a.city_district || '';
          const cidade  = a.city || a.town || a.village || a.municipality || '';
          if (bairro) partes.push(bairro);
          if (cidade)  partes.push(cidade);
          const enderecoFinal = partes.join(' — ') || data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

          const addrEl = document.getElementById(addressId);
          if (addrEl && !addrEl.value.trim()) {
            addrEl.value = enderecoFinal;
          } else if (addrEl) {
            // campo já preenchido — oferece substituição
            if (confirm(`Substituir o endereço atual pelo capturado?\n\n"${enderecoFinal}"`)) {
              addrEl.value = enderecoFinal;
            }
          }
          finalizarGPS(btn, orig, lat, lng);
        })
        .catch(() => {
          // Nominatim falhou — preenche só coordenadas
          const addrEl = document.getElementById(addressId);
          if (addrEl && !addrEl.value.trim()) {
            addrEl.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          }
          finalizarGPS(btn, orig, lat, lng);
          toast('Endereço não encontrado — coordenadas preenchidas.', true);
        });
      } else {
        finalizarGPS(btn, orig, lat, lng);
      }
    },
    err => {
      btn.innerHTML = orig; btn.disabled = false;
      const msgs = { 1: 'Permissão de localização negada.', 2: 'Posição indisponível.', 3: 'Tempo esgotado.' };
      toast(msgs[err.code] || 'Erro ao obter GPS.', true);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );
}

function finalizarGPS(btn, orig, lat, lng) {
  btn.innerHTML = '✅ CAPTURADO';
  btn.style.color = 'var(--green3)';
  btn.style.borderColor = 'var(--green2)';
  toast(`📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
  setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; btn.style.color = ''; btn.style.borderColor = ''; }, 3500);
}

function savePessoa() {
  const nome = document.getElementById('mp-nome').value.trim();
  if (!nome) { toast('Informe o nome completo.', true); return; }
  const lat = parseFloat(document.getElementById('mp-lat').value);
  const lng = parseFloat(document.getElementById('mp-lng').value);
  const data = {
    nome,
    alcunha: document.getElementById('mp-alcunha').value.trim(),
    nascimento: document.getElementById('mp-nasc').value,
    rg: document.getElementById('mp-rg').value.trim(),
    cpf: document.getElementById('mp-cpf').value.trim(),
    mae: document.getElementById('mp-mae').value.trim(),
    status: document.getElementById('mp-status').value,
    endereco: document.getElementById('mp-end').value.trim(),
    bairro: document.getElementById('mp-bairro').value.trim(),
    cidade: document.getElementById('mp-cidade').value.trim(),
    estado: document.getElementById('mp-estado').value.trim(),
    lat: isNaN(lat) ? null : lat,
    lng: isNaN(lng) ? null : lng,
    foto: document.getElementById('mp-foto').value.trim(),
    caracteristicas: document.getElementById('mp-caract').value.trim(),
    vinculosInfo: document.getElementById('mp-vinculos').value.trim(),
    obs: document.getElementById('mp-obs').value.trim(),
  };
  if (editingPessoaId) {
    const idx = DB.pessoas.findIndex(x => x.id === editingPessoaId);
    if (idx >= 0) {
      DB.pessoas[idx] = { ...DB.pessoas[idx], ...data };
      selPessoa = editingPessoaId;
    }
  } else {
    data.id = uid();
    data.eventos = [{
      tipo: 'cadastro',
      data: new Date().toISOString().slice(0,10),
      hora: new Date().toTimeString().slice(0,5),
      local: 'Cadastro inicial',
      historico: 'Cadastro preliminar inserido no BDIntel.',
    }];
    data.vinculos = [];
    DB.pessoas.push(data);
    selPessoa = data.id;
  }
  saveDB();
  closeOv('ov-pessoa');
  renderPessoasList();
  renderPessoaDetail();
  renderMapMarkers();
  toast('Cadastro salvo.');
}

function deletePessoa(id) {
  if (!confirm('Excluir este cadastro permanentemente?')) return;
  DB.pessoas = DB.pessoas.filter(p => p.id !== id);
  (DB.ocorrencias || []).forEach(oc => {
    if (Array.isArray(oc.pessoasIds)) oc.pessoasIds = oc.pessoasIds.filter(pid => pid !== id);
  });
  removeLinksForEntity('pessoa', id);
  selPessoa = null;
  saveDB();
  renderPessoasList();
  const el = document.getElementById('pessoa-detail');
  el.innerHTML = '<div class="blank-msg">// SELECIONE UM INDIVÍDUO</div>';
  el.classList.add('blank');
  renderMapMarkers();
  toast('Cadastro excluído.');
}

/* ── MODAL: CONFIRMAR DADOS ── */
function openModal_confirmacao(pessoaId) {
  confirmacaoTargetId = pessoaId;
  document.getElementById('cf-data').value = new Date().toISOString().slice(0,10);
  document.getElementById('cf-hora').value = new Date().toTimeString().slice(0,5);
  document.getElementById('cf-local').value = '';
  document.getElementById('cf-viatura').value = '';
  document.getElementById('cf-ba').value = '';
  document.getElementById('cf-obs').value = '';
  document.getElementById('cf-abordado').checked = false;
  openOv('ov-confirmar');
}

function saveConfirmacaoDados() {
  const p = DB.pessoas.find(x => x.id === confirmacaoTargetId);
  if (!p) return;
  const obs = document.getElementById('cf-obs').value.trim();
  const local = document.getElementById('cf-local').value.trim() || 'Dados confirmados';
  const houveAbordagem = document.getElementById('cf-abordado').checked;
  const ev = {
    tipo: houveAbordagem ? 'abordagem' : 'confirmacao',
    data: document.getElementById('cf-data').value,
    hora: document.getElementById('cf-hora').value,
    local,
    viatura: document.getElementById('cf-viatura').value.trim(),
    ba: document.getElementById('cf-ba').value.trim(),
    historico: obs || (houveAbordagem ? 'Dados confirmados durante abordagem.' : 'Dados cadastrais confirmados.'),
    resultado: houveAbordagem ? 'Dados confirmados' : 'Confirmação cadastral',
  };
  if (!p.eventos) p.eventos = [];
  p.eventos.push(ev);
  p.status = houveAbordagem ? 'abordado' : 'confirmado';
  saveDB();
  closeOv('ov-confirmar');
  renderPessoasList();
  renderPessoaDetail();
  renderMapMarkers();
  toast('Dados confirmados na linha do tempo.');
}

/* ── MODAL: EVENTO ── */
function openModal_evento(pessoaId) {
  eventoTargetId = pessoaId;
  document.getElementById('ev-tipo').value = 'abordagem';
  document.getElementById('ev-data').value = new Date().toISOString().slice(0,10);
  document.getElementById('ev-hora').value = '';
  document.getElementById('ev-local').value = '';
  document.getElementById('ev-lat').value = '';
  document.getElementById('ev-lng').value = '';
  document.getElementById('ev-gravidade').value = '';
  document.getElementById('ev-motivo').value = '';
  document.getElementById('ev-resultado').value = '';
  document.getElementById('ev-viatura').value = '';
  document.getElementById('ev-ba').value = '';
  document.getElementById('ev-objetos').value = '';
  document.getElementById('ev-tipif').value = '';
  document.getElementById('ev-historico').value = '';
  document.getElementById('ev-veiculo-placa').value = '';
  document.getElementById('ev-outros').value = '';
  openOv('ov-evento');
}

function saveEvento() {
  const historico = document.getElementById('ev-historico').value.trim();
  const local = document.getElementById('ev-local').value.trim();
  if (!historico || !local) { toast('Informe o local e o histórico.', true); return; }
  const lat = parseFloat(document.getElementById('ev-lat').value);
  const lng = parseFloat(document.getElementById('ev-lng').value);
  const tipo = document.getElementById('ev-tipo').value;
  const ev = {
    tipo,
    data: document.getElementById('ev-data').value,
    hora: document.getElementById('ev-hora').value,
    local,
    lat: isNaN(lat) ? null : lat,
    lng: isNaN(lng) ? null : lng,
    motivo: document.getElementById('ev-motivo').value,
    resultado: document.getElementById('ev-resultado').value,
    gravidade: document.getElementById('ev-gravidade').value,
    viatura: document.getElementById('ev-viatura').value.trim(),
    ba: document.getElementById('ev-ba').value.trim(),
    objetos: document.getElementById('ev-objetos').value.trim(),
    tipif: document.getElementById('ev-tipif').value.trim(),
    historico,
    veiculoPlaca: document.getElementById('ev-veiculo-placa').value.trim(),
  };

  const p = DB.pessoas.find(x => x.id === eventoTargetId);
  if (!p) return;
  if (!p.eventos) p.eventos = [];
  p.eventos.push(ev);

  // auto-promover status
  if (tipo === 'prisao') {
    p.status = 'preso';
  } else if (tipo === 'abordagem') {
    p.status = 'abordado';
  } else if (tipo === 'averiguacao' && (p.status === 'cadastrado' || p.status === 'confirmado')) {
    p.status = 'averiguado';
  } else if (tipo === 'conducao' && p.status === 'averiguado') {
    p.status = 'conduzido';
  }

  if (ev.veiculoPlaca) {
    const veiculo = DB.veiculos.find(v => v.placa && v.placa.toUpperCase() === ev.veiculoPlaca.toUpperCase());
    if (veiculo) {
      upsertLink({
        fromType: 'pessoa',
        fromId: p.id,
        toType: 'veiculo',
        toId: veiculo.id,
        relation: 'abordagem',
        status: 'confirmado',
        source: tipo,
        date: ev.data,
        obs: local,
      });
    }
  }

  saveDB();
  closeOv('ov-evento');
  renderPessoasList();
  renderPessoaDetail();
  renderMapMarkers();
  toast('Ocorrência registrada.');
}

function deleteEvento(pessoaId, idx) {
  if (!confirm('Excluir este registro?')) return;
  const p = DB.pessoas.find(x => x.id === pessoaId);
  if (!p) return;
  p.eventos.splice(idx, 1);
  saveDB();
  renderPessoaDetail();
  renderMapMarkers();
  toast('Registro excluído.');
}

/* ── MODAL: VÍNCULO ── */
function getOcorrenciaTitulo(oc) {
  return oc.local || oc.ba || 'Ocorrencia sem local';
}

function getOcorrenciaPessoas(oc) {
  const ids = Array.isArray(oc.pessoasIds) ? oc.pessoasIds : [];
  return DB.pessoas.filter(p => ids.includes(p.id));
}

function renderOcorrenciasList() {
  const search = document.getElementById('ocorrencias-search');
  const q = search ? search.value.toLowerCase().trim() : '';
  const list = (DB.ocorrencias || []).filter(oc => {
    if (!q) return true;
    const nomes = getOcorrenciaPessoas(oc).map(p => p.nome).join(' ');
    return [oc.local, oc.historico, oc.ba, oc.veiculos, nomes, tipoLabel(oc.tipo || 'ocorrencia')].join(' ').toLowerCase().includes(q);
  }).sort((a,b) => ((b.data||'') + (b.hora||'')).localeCompare((a.data||'') + (a.hora||'')));

  const cnt = document.getElementById('cnt-ocorrencias');
  if (cnt) cnt.textContent = (DB.ocorrencias || []).length;
  const el = document.getElementById('ocorrencias-list');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = `<div class="empty-state">// NENHUMA OCORRENCIA CADASTRADA</div>`;
    return;
  }
  el.innerHTML = list.map(oc => {
    const style = getEventoMapStyle(oc);
    const pessoas = getOcorrenciaPessoas(oc);
    return `<div class="ocorrencia-card${selOcorrencia===oc.id?' sel':''}" onclick="selectOcorrencia('${oc.id}')">
      <div class="oc-title">${tipoLabel(oc.tipo || 'ocorrencia')} - ${style.label}</div>
      <div class="oc-sub">${fmtDate(oc.data)}${oc.hora?' - '+oc.hora:''} - ${getOcorrenciaTitulo(oc)}</div>
      <div class="oc-sub">${pessoas.length ? pessoas.map(p => p.nome).join(', ') : 'Sem pessoa vinculada'}${oc.veiculos ? ' - ' + oc.veiculos : ''}</div>
    </div>`;
  }).join('');
}

function selectOcorrencia(id) {
  selOcorrencia = id;
  renderOcorrenciasList();
  renderOcorrenciaDetail();
  scrollDetailIntoView('ocorrencia-detail');
}

function renderOcorrenciaDetail() {
  const oc = (DB.ocorrencias || []).find(x => x.id === selOcorrencia);
  const el = document.getElementById('ocorrencia-detail');
  if (!el) return;
  if (!oc) { el.innerHTML = '<div class="blank-msg">// SELECIONE UMA OCORRENCIA</div>'; el.classList.add('blank'); return; }
  el.classList.remove('blank');
  const pessoas = getOcorrenciaPessoas(oc);
  const style = getEventoMapStyle(oc);
  el.innerHTML = `
    <div class="detail-head">
      <div class="detail-head-info">
        <div class="detail-name">${tipoLabel(oc.tipo || 'ocorrencia')}</div>
        <div class="detail-meta">${style.label} - ${fmtDate(oc.data)}${oc.hora?' - '+oc.hora:''}</div>
        <div class="detail-meta">${oc.local || 'Sem local informado'}</div>
      </div>
      <div class="detail-head-actions">
        <button class="btn sm" onclick="openModal_ocorrencia('${oc.id}')">EDITAR</button>
        <button class="btn sm danger" onclick="deleteOcorrencia('${oc.id}')">EXCLUIR</button>
      </div>
    </div>
    <div class="detail-body">
      <div class="info-section">
        <div class="section-label">Historico</div>
        <div class="ival" style="white-space:pre-wrap">${oc.historico || '-'}</div>
      </div>
      <div class="info-section">
        <div class="section-label">Dados Operacionais</div>
        <div class="info-grid">
          <div class="info-item"><div class="ilab">BA / BO / RP</div><div class="ival ${!oc.ba?'empty':''}">${oc.ba || '-'}</div></div>
          <div class="info-item"><div class="ilab">Veiculos</div><div class="ival ${!oc.veiculos?'empty':''}">${oc.veiculos || '-'}</div></div>
          <div class="info-item"><div class="ilab">Latitude</div><div class="ival mono ${!oc.lat?'empty':''}">${oc.lat || '-'}</div></div>
          <div class="info-item"><div class="ilab">Longitude</div><div class="ival mono ${!oc.lng?'empty':''}">${oc.lng || '-'}</div></div>
        </div>
      </div>
      <div class="info-section">
        <div class="section-label">Pessoas Vinculadas (${pessoas.length})</div>
        ${pessoas.length ? pessoas.map(p => `
          <div class="person-card" style="padding:8px 10px;margin-bottom:4px;border:1px solid var(--border)" onclick="goPage('pessoas');selectPessoa('${p.id}')">
            <div class="avatar" style="width:32px;height:32px;font-size:14px">${p.foto?`<img src="${p.foto}" onerror="this.parentElement.textContent='P'">`:'P'}</div>
            <div class="pc-info"><div class="pc-name" style="font-size:13px">${p.nome}</div><div class="pc-sub">${p.bairro||p.cidade||'-'}</div></div>
          </div>`).join('') : '<div class="empty-state">// NENHUMA PESSOA VINCULADA</div>'}
      </div>
    </div>
  `;
}

function fillOcorrenciaPessoasOptions(selectedIds = []) {
  const sel = document.getElementById('oc-pessoas');
  if (!sel) return;
  const ids = new Set(selectedIds);
  sel.innerHTML = DB.pessoas
    .slice()
    .sort((a,b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'))
    .map(p => `<option value="${p.id}"${ids.has(p.id) ? ' selected' : ''}>${p.nome || 'Sem nome'}${p.alcunha ? ' - ' + p.alcunha : ''}</option>`)
    .join('');
}

function setOcorrenciaCoords(lat, lng, moveMap = true) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  document.getElementById('oc-lat').value = lat.toFixed(6);
  document.getElementById('oc-lng').value = lng.toFixed(6);
  if (!ocorrenciaPickerMap || typeof window.L === 'undefined') return;
  const pos = [lat, lng];
  if (!ocorrenciaPickerMarker) {
    ocorrenciaPickerMarker = window.L.marker(pos, { draggable: true }).addTo(ocorrenciaPickerMap);
    ocorrenciaPickerMarker.on('dragend', () => {
      const p = ocorrenciaPickerMarker.getLatLng();
      setOcorrenciaCoords(p.lat, p.lng, false);
    });
  } else {
    ocorrenciaPickerMarker.setLatLng(pos);
  }
  if (moveMap) ocorrenciaPickerMap.setView(pos, Math.max(ocorrenciaPickerMap.getZoom(), 16));
}

function initOcorrenciaMapPicker() {
  if (typeof window.L === 'undefined') return;
  const el = document.getElementById('oc-map-picker');
  if (!el) return;
  if (ocorrenciaPickerMap) {
    ocorrenciaPickerMap.remove();
    ocorrenciaPickerMap = null;
    ocorrenciaPickerMarker = null;
  }
  const lat = parseFloat(document.getElementById('oc-lat').value);
  const lng = parseFloat(document.getElementById('oc-lng').value);
  const center = (!isNaN(lat) && !isNaN(lng)) ? [lat, lng] : [-29.76, -51.15];
  ocorrenciaPickerMap = window.L.map('oc-map-picker', { zoomControl: true }).setView(center, (!isNaN(lat) && !isNaN(lng)) ? 16 : 13);
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(ocorrenciaPickerMap);
  ocorrenciaPickerMap.on('click', e => setOcorrenciaCoords(e.latlng.lat, e.latlng.lng, false));
  if (!isNaN(lat) && !isNaN(lng)) setOcorrenciaCoords(lat, lng, false);
  setTimeout(() => ocorrenciaPickerMap && ocorrenciaPickerMap.invalidateSize(), 120);
}

function centralizarMapaOcorrencia() {
  if (!ocorrenciaPickerMap) initOcorrenciaMapPicker();
  const lat = parseFloat(document.getElementById('oc-lat').value);
  const lng = parseFloat(document.getElementById('oc-lng').value);
  if (!isNaN(lat) && !isNaN(lng)) {
    setOcorrenciaCoords(lat, lng, true);
  } else {
    buscarOcorrenciaNoMapa();
  }
}

async function buscarOcorrenciaNoMapa() {
  if (!ocorrenciaPickerMap) initOcorrenciaMapPicker();
  const result = await buscarEnderecoCampos('oc-local', 'oc-lat', 'oc-lng', null, null, null, ({ lat, lng }) => {
    setOcorrenciaCoords(lat, lng, true);
  });
  if (result) toast('Ponto localizado. Arraste para ajustar se precisar.');
}

function openModal_ocorrencia(id) {
  editingOcorrenciaId = id;
  document.getElementById('m-ocorrencia-title').textContent = id ? 'EDITAR OCORRENCIA' : 'CADASTRAR OCORRENCIA';
  document.getElementById('oc-tipo').value = 'ocorrencia';
  document.getElementById('oc-gravidade').value = 'media';
  document.getElementById('oc-data').value = new Date().toISOString().slice(0,10);
  document.getElementById('oc-hora').value = new Date().toTimeString().slice(0,5);
  ['local','lat','lng','ba','veiculos','historico'].forEach(f => document.getElementById('oc-' + f).value = '');
  fillOcorrenciaPessoasOptions([]);
  if (id) {
    const oc = (DB.ocorrencias || []).find(x => x.id === id);
    if (!oc) return;
    document.getElementById('oc-tipo').value = oc.tipo || 'ocorrencia';
    document.getElementById('oc-gravidade').value = oc.gravidade || 'media';
    document.getElementById('oc-data').value = oc.data || '';
    document.getElementById('oc-hora').value = oc.hora || '';
    document.getElementById('oc-local').value = oc.local || '';
    document.getElementById('oc-lat').value = oc.lat || '';
    document.getElementById('oc-lng').value = oc.lng || '';
    document.getElementById('oc-ba').value = oc.ba || '';
    document.getElementById('oc-veiculos').value = oc.veiculos || '';
    document.getElementById('oc-historico').value = oc.historico || '';
    fillOcorrenciaPessoasOptions(oc.pessoasIds || []);
  }
  openOv('ov-ocorrencia');
  setTimeout(initOcorrenciaMapPicker, 100);
}

function syncOcorrenciaComPessoas(oc) {
  DB.pessoas.forEach(p => {
    if (!Array.isArray(p.eventos)) p.eventos = [];
    p.eventos = p.eventos.filter(ev => ev.ocorrenciaId !== oc.id);
    if ((oc.pessoasIds || []).includes(p.id)) {
      p.eventos.push({
        tipo: oc.tipo || 'ocorrencia',
        data: oc.data,
        hora: oc.hora,
        local: oc.local,
        lat: oc.lat,
        lng: oc.lng,
        gravidade: oc.gravidade,
        ba: oc.ba,
        historico: oc.historico,
        resultado: 'Vinculado a ocorrencia',
        veiculoPlaca: oc.veiculos,
        ocorrenciaId: oc.id,
      });
    }
  });
}

function saveOcorrencia() {
  const local = document.getElementById('oc-local').value.trim();
  const historico = document.getElementById('oc-historico').value.trim();
  if (!local || !historico) { toast('Informe o local e o historico.', true); return; }
  const lat = parseFloat(document.getElementById('oc-lat').value);
  const lng = parseFloat(document.getElementById('oc-lng').value);
  const pessoasIds = Array.from(document.getElementById('oc-pessoas').selectedOptions).map(opt => opt.value);
  const data = {
    tipo: document.getElementById('oc-tipo').value,
    gravidade: document.getElementById('oc-gravidade').value,
    data: document.getElementById('oc-data').value,
    hora: document.getElementById('oc-hora').value,
    local,
    lat: isNaN(lat) ? null : lat,
    lng: isNaN(lng) ? null : lng,
    ba: document.getElementById('oc-ba').value.trim(),
    veiculos: document.getElementById('oc-veiculos').value.trim(),
    pessoasIds,
    historico,
  };
  if (!Array.isArray(DB.ocorrencias)) DB.ocorrencias = [];
  if (editingOcorrenciaId) {
    const idx = DB.ocorrencias.findIndex(x => x.id === editingOcorrenciaId);
    if (idx >= 0) DB.ocorrencias[idx] = { ...DB.ocorrencias[idx], ...data };
    data.id = editingOcorrenciaId;
  } else {
    data.id = uid();
    DB.ocorrencias.push(data);
  }
  syncOcorrenciaComPessoas(data);
  selOcorrencia = data.id;
  saveDB();
  closeOv('ov-ocorrencia');
  renderAll();
  renderOcorrenciaDetail();
  renderPessoaDetail();
  toast(data.lat && data.lng ? 'Ocorrencia salva e enviada ao mapa.' : 'Ocorrencia salva. Sem coordenadas, ela nao aparece no mapa.');
}

function deleteOcorrencia(id) {
  if (!confirm('Excluir esta ocorrencia?')) return;
  DB.ocorrencias = (DB.ocorrencias || []).filter(oc => oc.id !== id);
  DB.pessoas.forEach(p => {
    if (Array.isArray(p.eventos)) p.eventos = p.eventos.filter(ev => ev.ocorrenciaId !== id);
  });
  selOcorrencia = null;
  saveDB();
  renderAll();
  renderOcorrenciaDetail();
  toast('Ocorrencia excluida.');
}

function openModal_vinculo(pessoaId) {
  vinculoTargetId = pessoaId;
  const sel = document.getElementById('vk-pessoa');
  sel.innerHTML = DB.pessoas.filter(p => p.id !== pessoaId)
    .map(p => `<option value="${p.id}">${p.nome}${p.alcunha?' ("'+p.alcunha+'")':''}</option>`)
    .join('');
  document.getElementById('vk-tipo').selectedIndex = 0;
  document.getElementById('vk-obs').value = '';
  openOv('ov-vinculo');
}

function saveVinculo() {
  const pessoaId = document.getElementById('vk-pessoa').value;
  const tipo = document.getElementById('vk-tipo').value;
  const obs = document.getElementById('vk-obs').value.trim();
  const p = DB.pessoas.find(x => x.id === vinculoTargetId);
  if (!p) return;
  if (!p.vinculos) p.vinculos = [];
  p.vinculos.push({ pessoaId, tipo, obs });
  saveDB();
  closeOv('ov-vinculo');
  renderPessoaDetail();
  toast('Vínculo adicionado.');
}

function deleteVinculo(pessoaId, idx) {
  const p = DB.pessoas.find(x => x.id === pessoaId);
  if (!p) return;
  p.vinculos.splice(idx, 1);
  saveDB();
  renderPessoaDetail();
  toast('Vínculo excluído.');
}

/* ══════════════════════════════════════════════════════════════
   MAPA
══════════════════════════════════════════════════════════════ */
function initMap() {
  if (typeof window.L === 'undefined') { setTimeout(initMap, 200); return; }
  mapMain = window.L.map('map-main', { zoomControl: false }).setView([-29.76, -51.15], 13);
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mapMain);
  window.L.control.zoom({ position: 'bottomleft' }).addTo(mapMain);
  mapMarkers = window.L.layerGroup().addTo(mapMain);
}

function toggleMF(key) {
  mapFilters[key] = !mapFilters[key];
  const el = document.querySelector(`[data-mf="${key}"]`);
  if (el) el.classList.toggle('on', mapFilters[key]);
  renderMapMarkers();
}
function clearMapDates() {
  document.getElementById('mf-from').value = '';
  document.getElementById('mf-to').value = '';
  renderMapMarkers();
}

function inDateRange(d) {
  const from = document.getElementById('mf-from').value;
  const to   = document.getElementById('mf-to').value;
  if (!d) return true;
  if (from && d < from) return false;
  if (to   && d > to)   return false;
  return true;
}

function getEventoGravidade(ev) {
  if (ev.gravidade) return ev.gravidade;
  if (ev.tipo === 'prisao') return 'alta';
  if (ev.tipo === 'conducao' || ev.tipo === 'ocorrencia') return 'media';
  if (ev.tipo === 'averiguacao') return 'baixa';
  return '';
}

function getEventoMapStyle(ev) {
  if (ev.tipo === 'abordagem' && !ev.gravidade) {
    return { key: 'abordagem', color: 'var(--pin-abord)', label: 'ABORDAGEM' };
  }
  if (ev.tipo === 'prisao' && !ev.gravidade) {
    return { key: 'prisao', color: 'var(--pin-preso)', label: 'PRISÃO' };
  }
  if (ev.tipo === 'averiguacao' && !ev.gravidade) {
    return { key: 'averiguacao', color: 'var(--pin-averi)', label: 'AVERIGUAÇÃO' };
  }
  const gravidade = getEventoGravidade(ev);
  const styles = {
    baixa: { key: 'baixa', color: 'var(--pin-baixa)', label: 'BAIXA GRAVIDADE' },
    media: { key: 'media', color: 'var(--pin-media)', label: 'MÉDIA GRAVIDADE' },
    alta: { key: 'alta', color: 'var(--pin-alta)', label: 'ALTA GRAVIDADE' },
  };
  return styles[gravidade] || { key: 'abordagem', color: 'var(--pin-abord)', label: 'ABORDAGEM' };
}

function renderMapMarkers() {
  if (!mapMarkers || typeof window.L === 'undefined') return;
  mapMarkers.clearLayers();

  DB.pessoas.forEach(p => {
    // residência
    if (mapFilters.residencia && p.lat && p.lng) {
      const icon = window.L.divIcon({ className:'', html:`<div style="width:10px;height:10px;border-radius:50%;background:var(--pin-res);border:2px solid rgba(255,255,255,.3);box-shadow:0 0 6px var(--pin-res)"></div>`, iconSize:[10,10], iconAnchor:[5,5] });
      window.L.marker([p.lat, p.lng], { icon })
        .bindTooltip(`<b>${p.nome}</b><br>🏠 Residência: ${p.endereco||p.bairro||'—'}`, { direction:'top' })
        .on('click', () => { goPage('pessoas'); selectPessoa(p.id); })
        .addTo(mapMarkers);
    }
    // eventos
    (p.eventos || []).forEach(ev => {
      if (ev.ocorrenciaId) return;
      if (!ev.lat || !ev.lng) return;
      if (!inDateRange(ev.data)) return;
      const style = getEventoMapStyle(ev);
      const color = style.color;
      if (!mapFilters[style.key]) return;
      const icon = window.L.divIcon({ className:'', html:`<div style="width:10px;height:10px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,.3);box-shadow:0 0 5px ${color}80"></div>`, iconSize:[10,10], iconAnchor:[5,5] });
      window.L.marker([ev.lat, ev.lng], { icon })
        .bindTooltip(`<b>${p.nome}</b><br>${tipoLabel(ev.tipo)} · ${style.label} · ${fmtDate(ev.data)}<br>📍 ${ev.local}`, { direction:'top' })
        .on('click', () => { goPage('pessoas'); selectPessoa(p.id); setDTab('timeline'); })
        .addTo(mapMarkers);
    });
  });

  (DB.ocorrencias || []).forEach(oc => {
    if (!oc.lat || !oc.lng) return;
    if (!inDateRange(oc.data)) return;
    const style = getEventoMapStyle(oc);
    if (!mapFilters[style.key]) return;
    const color = style.color;
    const pessoas = getOcorrenciaPessoas(oc);
    const icon = window.L.divIcon({ className:'', html:`<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,.55);box-shadow:0 0 7px ${color}80"></div>`, iconSize:[12,12], iconAnchor:[6,6] });
    window.L.marker([oc.lat, oc.lng], { icon })
      .bindTooltip(`<b>${tipoLabel(oc.tipo || 'ocorrencia')}</b><br>${style.label} · ${fmtDate(oc.data)}<br>${pessoas.length ? pessoas.map(p => p.nome).join(', ') : 'Sem pessoa vinculada'}<br>📍 ${oc.local}`, { direction:'top' })
      .on('click', () => { goPage('ocorrencias'); selectOcorrencia(oc.id); })
      .addTo(mapMarkers);
  });

  // locais de interesse
  if (mapFilters.local_poi) {
    DB.locais.forEach(loc => {
      if (!loc.lat || !loc.lng) return;
      const isRecorrente = loc.tipo === 'recorrente';
      const c = isRecorrente ? 'var(--pin-recorr)' : 'var(--pin-poi)';
      const icon = window.L.divIcon({ className:'', html:`<div style="width:10px;height:10px;border-radius:50%;background:${c};border:2px solid rgba(255,255,255,.3)"></div>`, iconSize:[10,10], iconAnchor:[5,5] });
      window.L.marker([loc.lat, loc.lng], { icon })
        .bindTooltip(`<b>${loc.nome}</b><br>📍 ${loc.endereco||'—'}`, { direction:'top' })
        .addTo(mapMarkers);
    });
  }
}

/* ══════════════════════════════════════════════════════════════
   VEÍCULOS
══════════════════════════════════════════════════════════════ */
function openModal_veiculo(id) {
  editingVeiculoId = id;
  document.getElementById('m-veiculo-title').textContent = id ? 'EDITAR VEÍCULO' : 'CADASTRAR VEÍCULO';
  ['placa','modelo','marca','cor','ano','prop','cond','foto','obs','status'].forEach(f => {
    const el = document.getElementById('mv-' + f);
    if (el) el.value = '';
  });
  document.getElementById('mv-status').value = 'cadastrado';
  renderCondutorOptions('');
  setVeiculoFotoPreview('');
  if (id) {
    const v = DB.veiculos.find(x => x.id === id);
    if (!v) return;
    document.getElementById('mv-placa').value = v.placa||'';
    document.getElementById('mv-status').value = v.status||'cadastrado';
    document.getElementById('mv-modelo').value = v.modelo||'';
    document.getElementById('mv-marca').value = v.marca||'';
    document.getElementById('mv-cor').value = v.cor||'';
    document.getElementById('mv-ano').value = v.ano||'';
    document.getElementById('mv-prop').value = v.proprietario||'';
    document.getElementById('mv-cond').value = v.condutor||'';
    renderCondutorOptions(v.condutorId || '');
    document.getElementById('mv-foto').value = v.foto||'';
    document.getElementById('mv-obs').value = v.obs||'';
    setVeiculoFotoPreview(v.foto || '');
  }
  openOv('ov-veiculo');
}

function renderCondutorOptions(selectedId = '') {
  const select = document.getElementById('mv-condutor-id');
  if (!select) return;
  const pessoas = [...DB.pessoas].sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
  select.innerHTML = [
    '<option value="">-- sem vínculo --</option>',
    ...pessoas.map(p => `<option value="${p.id}"${p.id === selectedId ? ' selected' : ''}>${p.nome || 'Sem nome'}${p.alcunha ? ' - ' + p.alcunha : ''}</option>`),
  ].join('');
}

function saveVeiculo() {
  const placa = document.getElementById('mv-placa').value.trim().toUpperCase();
  if (!placa) { toast('Informe a placa.', true); return; }
  const data = {
    placa,
    status: document.getElementById('mv-status').value,
    modelo: document.getElementById('mv-modelo').value.trim(),
    marca: document.getElementById('mv-marca').value.trim(),
    cor: document.getElementById('mv-cor').value.trim(),
    ano: document.getElementById('mv-ano').value.trim(),
    proprietario: document.getElementById('mv-prop').value.trim(),
    condutor: document.getElementById('mv-cond').value.trim(),
    condutorId: document.getElementById('mv-condutor-id').value,
    foto: document.getElementById('mv-foto').value.trim(),
    obs: document.getElementById('mv-obs').value.trim(),
  };
  if (editingVeiculoId) {
    const idx = DB.veiculos.findIndex(x => x.id === editingVeiculoId);
    if (idx >= 0) { DB.veiculos[idx] = { ...DB.veiculos[idx], ...data }; selVeiculo = editingVeiculoId; }
  } else {
    data.id = uid();
    DB.veiculos.push(data);
    selVeiculo = data.id;
  }
  removeLinksForEntity('veiculo', editingVeiculoId || data.id);
  if (data.condutorId) {
    upsertLink({
      fromType: 'pessoa',
      fromId: data.condutorId,
      toType: 'veiculo',
      toId: editingVeiculoId || data.id,
      relation: 'condutor',
      status: data.status === 'cadastrado' ? 'nao_confirmado' : 'confirmado',
      source: 'cadastro_veiculo',
      date: new Date().toISOString().slice(0,10),
      obs: data.placa,
    });
  }
  saveDB();
  closeOv('ov-veiculo');
  renderVeiculosList();
  renderVeiculoDetail();
  toast('Veículo salvo.');
}

function renderVeiculosList() {
  const q = document.getElementById('veiculos-search').value.toLowerCase().trim();
  let list = DB.veiculos.filter(v => {
    if (!q) return true;
    return [v.placa, v.modelo, v.marca, v.cor, v.proprietario, v.condutor, getPessoaNome(v.condutorId)].join(' ').toLowerCase().includes(q);
  });
  document.getElementById('cnt-veiculos').textContent = DB.veiculos.length;
  const el = document.getElementById('veiculos-list');
  if (!list.length) {
    el.innerHTML = `<div class="empty-state">// NENHUM VEÍCULO CADASTRADO</div>`;
    return;
  }
  el.innerHTML = list.map(v => `
    <div class="veiculo-card${selVeiculo===v.id?' sel':''}" onclick="selectVeiculo('${v.id}')">
      <div class="placa">${v.placa}</div>
      <div class="v-info">
        <div class="v-model">${statusBadge(v.status || 'cadastrado')} ${[v.marca, v.modelo].filter(Boolean).join(' ') || '—'} ${v.cor?'· '+v.cor:''}</div>
        <div class="v-sub">${[v.ano, v.proprietario ? 'Prop.: ' + v.proprietario : null, getPessoaNome(v.condutorId) ? 'Cond.: ' + getPessoaNome(v.condutorId) : null].filter(Boolean).join(' · ') || '—'}</div>
      </div>
    </div>`).join('');
}

function selectVeiculo(id) {
  selVeiculo = id;
  renderVeiculosList();
  renderVeiculoDetail();
  scrollDetailIntoView('veiculo-detail');
}

function renderVeiculoDetail() {
  const v = DB.veiculos.find(x => x.id === selVeiculo);
  const el = document.getElementById('veiculo-detail');
  if (!v) { el.innerHTML = '<div class="blank-msg">// SELECIONE UM VEÍCULO</div>'; el.classList.add('blank'); return; }
  el.classList.remove('blank');

  // Find related people
  const relacionados = DB.pessoas.filter(p =>
    v.condutorId === p.id ||
    (p.eventos||[]).some(ev => ev.veiculoPlaca && ev.veiculoPlaca.toUpperCase() === v.placa)
  );
  const condutorVinculado = DB.pessoas.find(p => p.id === v.condutorId);

  el.innerHTML = `
    <div class="detail-head" style="align-items:center">
      <div>
        <div class="placa" style="font-size:22px;padding:8px 16px;letter-spacing:4px">${v.placa}</div>
      </div>
      <div class="detail-head-info" style="margin-left:16px">
        <div class="detail-name">${[v.marca, v.modelo].filter(Boolean).join(' ') || 'Veículo'}</div>
        <div class="detail-meta">${statusBadge(v.status || 'cadastrado')} ${[v.cor, v.ano].filter(Boolean).join(' · ')}</div>
      </div>
      <div class="detail-head-actions">
        <button class="btn sm" onclick="openModal_veiculo('${v.id}')">✏ EDITAR</button>
        <button class="btn sm danger" onclick="deleteVeiculo('${v.id}')">✕</button>
      </div>
    </div>
    <div class="detail-body">
      <div class="info-section">
        <div class="section-label">Identificação</div>
        <div class="info-grid cols2">
          <div class="info-item"><div class="ilab">Proprietário Informado</div><div class="ival ${!v.proprietario?'empty':''}">${v.proprietario||'—'}</div></div>
          <div class="info-item"><div class="ilab">Condutor Abordado</div><div class="ival ${!v.condutor?'empty':''}">${v.condutor||'—'}</div></div>
          <div class="info-item span2"><div class="ilab">Condutor Vinculado</div><div class="ival ${!condutorVinculado?'empty':''}">${condutorVinculado ? `<span style="cursor:pointer;color:var(--accent)" onclick="goPage('pessoas');selectPessoa('${condutorVinculado.id}')">${condutorVinculado.nome}</span>` : '—'}</div></div>
        </div>
      </div>
      ${v.foto ? `<div class="info-section"><div class="section-label">Foto</div><img src="${v.foto}" onclick="openPhotoViewer('${v.id}','veiculo')" title="Clique para ampliar" style="max-height:160px;border:1px solid var(--border);object-fit:cover;cursor:zoom-in" onerror="this.style.display='none'"></div>` : ''}
      ${v.obs ? `<div class="info-section"><div class="section-label">Observações</div><div class="ival" style="white-space:pre-wrap">${v.obs}</div></div>` : ''}
      ${relacionados.length ? `
        <div class="info-section">
          <div class="section-label">Pessoas Vinculadas (${relacionados.length})</div>
          ${relacionados.map(p => `
            <div class="person-card" style="padding:8px 10px;margin-bottom:4px;border:1px solid var(--border)" onclick="goPage('pessoas');selectPessoa('${p.id}')">
              <div class="avatar" style="width:32px;height:32px;font-size:14px">${p.foto?`<img src="${p.foto}" onerror="this.parentElement.textContent='👤'">`:'👤'}</div>
              <div class="pc-info"><div class="pc-name" style="font-size:13px">${p.nome}</div><div class="pc-sub">${p.bairro||p.cidade||'—'}</div></div>
            </div>`).join('')}
        </div>` : ''}
    </div>
  `;
}

function deleteVeiculo(id) {
  if (!confirm('Excluir este veículo?')) return;
  DB.veiculos = DB.veiculos.filter(v => v.id !== id);
  removeLinksForEntity('veiculo', id);
  selVeiculo = null;
  saveDB();
  renderVeiculosList();
  document.getElementById('veiculo-detail').innerHTML = '<div class="blank-msg">// SELECIONE UM VEÍCULO</div>';
  document.getElementById('veiculo-detail').classList.add('blank');
  toast('Veículo excluído.');
}

/* ══════════════════════════════════════════════════════════════
   LOCAIS
══════════════════════════════════════════════════════════════ */

function openModal_local(id) {
  editingLocalId = id;
  document.getElementById('m-local-title').textContent = id ? 'EDITAR LOCAL' : 'CADASTRAR LOCAL';
  ['nome','end','lat','lng','obs'].forEach(f => { const el = document.getElementById('ml-' + f); if (el) el.value = ''; });
  document.getElementById('ml-tipo').value = 'poi';
  if (id) {
    const l = DB.locais.find(x => x.id === id);
    if (!l) return;
    document.getElementById('ml-nome').value = l.nome||'';
    document.getElementById('ml-tipo').value = l.tipo||'poi';
    document.getElementById('ml-end').value = l.endereco||'';
    document.getElementById('ml-lat').value = l.lat||'';
    document.getElementById('ml-lng').value = l.lng||'';
    document.getElementById('ml-obs').value = l.obs||'';
  }
  openOv('ov-local');
}

function saveLocal() {
  const nome = document.getElementById('ml-nome').value.trim();
  if (!nome) { toast('Informe o nome do local.', true); return; }
  const lat = parseFloat(document.getElementById('ml-lat').value);
  const lng = parseFloat(document.getElementById('ml-lng').value);
  const data = {
    nome,
    tipo: document.getElementById('ml-tipo').value,
    endereco: document.getElementById('ml-end').value.trim(),
    lat: isNaN(lat) ? null : lat,
    lng: isNaN(lng) ? null : lng,
    obs: document.getElementById('ml-obs').value.trim(),
  };
  if (editingLocalId) {
    const idx = DB.locais.findIndex(x => x.id === editingLocalId);
    if (idx >= 0) { DB.locais[idx] = { ...DB.locais[idx], ...data }; selLocal = editingLocalId; }
  } else {
    data.id = uid();
    DB.locais.push(data);
    selLocal = data.id;
  }
  saveDB();
  closeOv('ov-local');
  renderLocaisList();
  renderLocalDetail();
  renderMapMarkers();
  document.getElementById('cnt-locais').textContent = DB.locais.length;
  toast('Local salvo.');
}

function renderLocaisList() {
  const q = document.getElementById('locais-search').value.toLowerCase().trim();
  let list = DB.locais.filter(l => {
    if (!q) return true;
    return [l.nome, l.tipo, l.endereco].join(' ').toLowerCase().includes(q);
  });
  document.getElementById('cnt-locais').textContent = DB.locais.length;
  const el = document.getElementById('locais-list');
  if (!list.length) {
    el.innerHTML = `<div class="empty-state">// NENHUM LOCAL CADASTRADO</div>`;
    return;
  }
  el.innerHTML = list.map(l => `
    <div class="local-card${selLocal===l.id?' sel':''}" onclick="selectLocal('${l.id}')">
      <div class="local-icon">${localEmojis[l.tipo]||'📌'}</div>
      <div class="l-info">
        <div class="l-name">${l.nome}</div>
        <div class="l-sub">${l.endereco||'—'}</div>
      </div>
    </div>`).join('');
}

function selectLocal(id) {
  selLocal = id;
  renderLocaisList();
  renderLocalDetail();
  scrollDetailIntoView('local-detail');
}

function renderLocalDetail() {
  const l = DB.locais.find(x => x.id === selLocal);
  const el = document.getElementById('local-detail');
  if (!l) { el.innerHTML = '<div class="blank-msg">// SELECIONE UM LOCAL</div>'; el.classList.add('blank'); return; }
  el.classList.remove('blank');

  el.innerHTML = `
    <div class="detail-head">
      <div style="font-size:36px">${localEmojis[l.tipo]||'📌'}</div>
      <div class="detail-head-info">
        <div class="detail-name">${l.nome}</div>
        <div class="detail-alcunha">${l.tipo.toUpperCase()}</div>
        <div class="detail-meta">${l.endereco||'—'}</div>
      </div>
      <div class="detail-head-actions">
        <button class="btn sm" onclick="openModal_local('${l.id}')">✏ EDITAR</button>
        <button class="btn sm danger" onclick="deleteLocal('${l.id}')">✕</button>
      </div>
    </div>
    <div class="detail-body">
      ${l.obs ? `<div class="info-section"><div class="section-label">Observações Operacionais</div><div class="ival" style="white-space:pre-wrap">${l.obs}</div></div>` : ''}
      ${l.lat && l.lng ? `
        <div class="info-section">
          <div class="section-label">Localização</div>
          <div id="local-minimap" style="height:200px;border:1px solid var(--border)"></div>
        </div>` : ''}
    </div>
  `;

  if (l.lat && l.lng) {
    setTimeout(() => {
      if (typeof window.L === 'undefined') return;
      const mapEl = document.getElementById('local-minimap');
      if (!mapEl) return;
      const mm = window.L.map('local-minimap', { zoomControl: false }).setView([l.lat, l.lng], 15);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mm);
      mkIcon('#a060f0', mm, [l.lat, l.lng], l.nome);
    }, 100);
  }
}

function deleteLocal(id) {
  if (!confirm('Excluir este local?')) return;
  DB.locais = DB.locais.filter(l => l.id !== id);
  selLocal = null;
  saveDB();
  renderLocaisList();
  renderMapMarkers();
  document.getElementById('local-detail').innerHTML = '<div class="blank-msg">// SELECIONE UM LOCAL</div>';
  document.getElementById('local-detail').classList.add('blank');
  document.getElementById('cnt-locais').textContent = DB.locais.length;
  toast('Local excluído.');
}

/* ══════════════════════════════════════════════════════════════
   CLOUD-SYNCED JSON FILE
══════════════════════════════════════════════════════════════ */
function renderCloudStatus(status) {
  const badge = document.getElementById('cloud-sync-status');
  const detail = document.getElementById('cloud-detail');
  if (badge) {
    badge.textContent = status.label || 'LOCAL';
    badge.className = 'sync-status';
    if (status.connected) badge.classList.add('on');
    if (status.label === 'ERRO' || status.label === 'INDISPONÍVEL' || status.label === 'SEM PERMISSÃO') {
      badge.classList.add('err');
    }
  }
  if (detail) detail.textContent = status.detail || 'Aguardando conexão com a nuvem.';
}

function setAuthUi(session) {
  const overlay = document.getElementById('ov-auth');
  const status = document.getElementById('auth-user-status');
  const email = session && session.user ? session.user.email : '';
  document.body.classList.toggle('auth-locked', !session);
  if (overlay) overlay.classList.toggle('open', !session);
  if (status) {
    status.textContent = email || 'OFFLINE';
    status.className = 'sync-status' + (email ? ' user' : '');
  }
}

function setAuthError(message) {
  const el = document.getElementById('auth-error');
  if (el) el.textContent = message || '';
}

async function handleAuthLogin(event) {
  event.preventDefault();
  const btn = document.getElementById('auth-submit');
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  setAuthError('');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'ENTRANDO...';
  }
  try {
    const session = await signInWithPassword(email, password);
    setAuthUi(session);
    await loadCloudFileData();
    toast('Login realizado.');
  } catch(e) {
    setAuthUi(null);
    setAuthError('E-mail ou senha inválidos, ou conexão indisponível.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'ENTRAR';
    }
  }
}

async function handleAuthLogout() {
  if (!confirm('Sair deste dispositivo?')) return;
  try {
    await signOutCloud();
    setAuthUi(null);
    renderAll();
    toast('Sessão encerrada.');
  } catch(e) {
    toast('Não foi possível sair agora.', true);
  }
}

function openCloudModal() {
  openOv('ov-cloud');
}

async function createCloudFile() {
  try {
    await saveToBackupFileNow();
    toast('Nuvem sincronizada.');
  } catch(e) {
    toast('Não foi possível sincronizar a nuvem.', true);
  }
}

async function openExistingCloudFile() {
  try {
    await loadCloudFileData();
  } catch(e) {
    toast('Não foi possível carregar a nuvem.', true);
  }
}

async function loadCloudFileData() {
  try {
    const data = await importFromBackupFile();
    if (!data) { toast('Faça login primeiro.', true); return; }
    selPessoa = selVeiculo = selLocal = null;
    renderAll();
    renderPessoaDetail();
    renderOcorrenciaDetail();
    renderVeiculoDetail();
    renderLocalDetail();
    toast('Dados carregados da nuvem.');
  } catch(e) {
    toast('Erro ao carregar dados da nuvem.', true);
  }
}

async function syncCloudNow() {
  try {
    const ok = await saveToBackupFileNow();
    if (!ok) { toast('Faça login primeiro.', true); return; }
    toast('Nuvem sincronizada.');
  } catch(e) {
    toast('Erro ao sincronizar a nuvem.', true);
  }
}

async function disconnectCloudFile() {
  try {
    await clearBackupHandle();
    setAuthUi(null);
    toast('Sessão encerrada.');
  } catch(e) {
    toast('Erro ao encerrar sessão.', true);
  }
}

/* ══════════════════════════════════════════════════════════════
   EXPORT / IMPORT
══════════════════════════════════════════════════════════════ */
function exportDB() {
  const json = JSON.stringify(DB, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'rocam_intel_backup_' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('Backup exportado.');
}

function triggerImport() {
  document.getElementById('file-import').click();
}

function loadImportFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('import-json').value = e.target.result;
    openOv('ov-import');
  };
  reader.readAsText(file);
  input.value = '';
}

function doImport() {
  try {
    const parsed = JSON.parse(document.getElementById('import-json').value.trim());
    if (!parsed.pessoas) throw new Error('Formato inválido');
    if (!confirm(`Importar ${parsed.pessoas.length} pessoas, ${(parsed.veiculos||[]).length} veículos e ${(parsed.locais||[]).length} locais?\nOs dados atuais serão substituídos.`)) return;
    DB = normalizeDB({ pessoas: parsed.pessoas||[], veiculos: parsed.veiculos||[], locais: parsed.locais||[], ocorrencias: parsed.ocorrencias||[], links: parsed.links||[] });
    saveDB();
    closeOv('ov-import');
    selPessoa = selVeiculo = selLocal = selOcorrencia = null;
    renderAll();
    toast('Dados importados com sucesso.');
  } catch(e) {
    toast('Erro: JSON inválido.', true);
  }
}

/* ══════════════════════════════════════════════════════════════
   MODAL HELPERS
══════════════════════════════════════════════════════════════ */
function openOv(id) { document.getElementById(id).classList.add('open'); }
function closeOv(id) { document.getElementById(id).classList.remove('open'); }

function isMobileLayout() {
  return window.matchMedia && window.matchMedia('(max-width: 720px)').matches;
}

function scrollDetailIntoView(id) {
  if (!isMobileLayout()) return;
  requestAnimationFrame(() => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function openPhotoViewer(id, type = 'pessoa') {
  const item = type === 'pessoa'
    ? DB.pessoas.find(x => x.id === id)
    : DB.veiculos.find(x => x.id === id);
  if (!item || !item.foto) return;
  openPhotoViewerFromSrc(item.foto, item.nome || item.placa || 'Foto');
}

function openPhotoViewerFromSrc(src, title = 'Foto') {
  if (!src) return;
  document.getElementById('photo-title').textContent = title;
  document.getElementById('photo-view-img').src = src;
  openOv('ov-photo');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.overlay.open').forEach(o => o.classList.remove('open'));
  }
});
document.querySelectorAll('.overlay').forEach(o => {
  o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
});

/* ══════════════════════════════════════════════════════════════
   TOAST
══════════════════════════════════════════════════════════════ */
function toast(msg, err = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (err ? ' err' : '');
  void el.offsetWidth;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}

/* ══════════════════════════════════════════════════════════════
   RENDER ALL
══════════════════════════════════════════════════════════════ */
function renderAll() {
  renderPessoasList();
  renderOcorrenciasList();
  renderVeiculosList();
  renderLocaisList();
  document.getElementById('cnt-pessoas').textContent = DB.pessoas.length;
  document.getElementById('cnt-ocorrencias').textContent = (DB.ocorrencias || []).length;
  document.getElementById('cnt-veiculos').textContent = DB.veiculos.length;
  document.getElementById('cnt-locais').textContent = DB.locais.length;
  if (mapMarkers) renderMapMarkers();
}

/* ══════════════════════════════════════════════════════════════
   BOOT
══════════════════════════════════════════════════════════════ */
async function bootApp() {
  setBackupStatusListener(renderCloudStatus);
  loadDB();
  renderAll();
  initMap();

  try {
    const localSnapshot = normalizeDB(DB);
    const session = await getAuthSession();
    setAuthUi(session);
    if (!session) {
      setBackupStatus({ connected: false, label: 'LOGIN', detail: 'Entre para carregar o banco na nuvem.' });
      return;
    }

    await loadCloudDB();
    if (!dbHasRecords(DB) && dbHasRecords(localSnapshot)) {
      DB = localSnapshot;
      saveLocalDB();
      if (confirm('Encontrei dados salvos neste navegador. Enviar esses dados para a nuvem agora?')) {
        await saveCloudDBNow();
      }
    }
    renderAll();
    renderPessoaDetail();
    renderVeiculoDetail();
    renderLocalDetail();
  } catch(e) {
    setAuthUi(null);
    setBackupStatus({ connected: false, label: 'ERRO', detail: 'Nao foi possivel conectar ao Supabase.' });
    setAuthError('Não foi possível conectar ao Supabase. Confira a internet e tente novamente.');
  }
}

bootApp();
