/*
 * Data access layer for ROCAM INTEL.
 * Supabase Auth protects access, while Row Level Security on rocam_items
 * limits every database operation to the signed-in user.
 */
let DB = { pessoas: [], veiculos: [], locais: [], ocorrencias: [] };

const DBKEY = 'rocam_intel_v2';
const SUPABASE_URL = 'https://pvfzrnwhyabteyhftkbp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2ZnpybndoeWFidGV5aGZ0a2JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3Mjg1NzksImV4cCI6MjA5NTMwNDU3OX0.XncSSGDXI1Cd-Xp1V8mFW1I08paY1RC0hg1scApbX1I';

let supabaseClient = null;
let currentSession = null;
let cloudSaveChain = Promise.resolve();
let cloudSaveTimer = null;
let backupStatusListener = null;
let lastBackupStatus = { connected: false, label: 'LOGIN', detail: 'Entre para carregar o banco na nuvem.' };

function normalizeDB(data) {
  const safe = data && typeof data === 'object' ? data : {};
  return {
    pessoas: Array.isArray(safe.pessoas) ? safe.pessoas : [],
    veiculos: Array.isArray(safe.veiculos) ? safe.veiculos : [],
    locais: Array.isArray(safe.locais) ? safe.locais : [],
    ocorrencias: Array.isArray(safe.ocorrencias) ? safe.ocorrencias : [],
    links: Array.isArray(safe.links) ? safe.links : [],
  };
}

function dbHasRecords(data = DB) {
  const safe = normalizeDB(data);
  return safe.pessoas.length > 0 || safe.veiculos.length > 0 || safe.locais.length > 0 || safe.ocorrencias.length > 0 || safe.links.length > 0;
}

function loadDB() {
  try {
    const raw = localStorage.getItem(DBKEY);
    if (raw) DB = normalizeDB(JSON.parse(raw));
  } catch(e) {
    DB = normalizeDB(DB);
  }
  DB = normalizeDB(DB);
}

function saveLocalDB() {
  DB = normalizeDB(DB);
  localStorage.setItem(DBKEY, JSON.stringify(DB));
}

function saveDB() {
  saveLocalDB();
  queueCloudWrite();
}

function uid() { return '_' + Date.now() + Math.random().toString(36).slice(2,7); }

function setBackupStatusListener(listener) {
  backupStatusListener = listener;
  if (backupStatusListener) backupStatusListener(lastBackupStatus);
}

function setBackupStatus(status) {
  lastBackupStatus = { ...lastBackupStatus, ...status };
  if (backupStatusListener) backupStatusListener(lastBackupStatus);
}

function initSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  if (!window.supabase || !window.supabase.createClient) {
    throw new Error('Biblioteca do Supabase nao carregou.');
  }
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return supabaseClient;
}

async function getAuthSession() {
  const client = initSupabaseClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  currentSession = data.session || null;
  return currentSession;
}

function getCurrentUserEmail() {
  return currentSession && currentSession.user ? currentSession.user.email : '';
}

async function signInWithPassword(email, password) {
  const client = initSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  currentSession = data.session || null;
  return currentSession;
}

async function signOutCloud() {
  const client = initSupabaseClient();
  await client.auth.signOut();
  currentSession = null;
  DB = normalizeDB({});
  saveLocalDB();
  setBackupStatus({ connected: false, label: 'LOGIN', detail: 'Sessao encerrada.' });
}

function flattenDB() {
  const rows = [];
  const updated_at = new Date().toISOString();
  const pushRow = (item, kind) => {
    if (!item.id) item.id = uid();
    rows.push({ id: item.id, kind, data: item, updated_at });
  };
  DB.pessoas.forEach(item => pushRow(item, 'pessoa'));
  DB.veiculos.forEach(item => pushRow(item, 'veiculo'));
  DB.locais.forEach(item => pushRow(item, 'local'));
  DB.ocorrencias.forEach(item => pushRow(item, 'ocorrencia'));
  return rows;
}

function rowsToDB(rows) {
  const next = { pessoas: [], veiculos: [], locais: [], ocorrencias: [], links: [] };
  (rows || []).forEach(row => {
    const item = { ...(row.data || {}), id: (row.data && row.data.id) || row.id };
    if (row.kind === 'pessoa') next.pessoas.push(item);
    if (row.kind === 'veiculo') next.veiculos.push(item);
    if (row.kind === 'local') next.locais.push(item);
    if (row.kind === 'ocorrencia') next.ocorrencias.push(item);
  });
  return normalizeDB(next);
}

async function loadCloudDB() {
  const client = initSupabaseClient();
  if (!currentSession) await getAuthSession();
  if (!currentSession) return null;

  setBackupStatus({ connected: true, label: 'CARREGANDO', detail: 'Carregando dados do Supabase...' });
  const { data, error } = await client
    .from('rocam_items')
    .select('id, kind, data, updated_at')
    .order('updated_at', { ascending: true });
  if (error) throw error;

  DB = rowsToDB(data);
  saveLocalDB();
  setBackupStatus({
    connected: true,
    label: 'NUVEM',
    detail: `Dados carregados do Supabase em ${new Date().toLocaleString('pt-BR')}.`,
  });
  return DB;
}

async function saveCloudDBNow() {
  const client = initSupabaseClient();
  if (!currentSession) return false;

  DB = normalizeDB(DB);
  const rows = flattenDB();
  const rowIds = rows.map(row => row.id);

  if (rows.length) {
    const { error } = await client
      .from('rocam_items')
      .upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }

  const { data: existing, error: listError } = await client
    .from('rocam_items')
    .select('id');
  if (listError) throw listError;

  const staleIds = (existing || [])
    .map(row => row.id)
    .filter(id => !rowIds.includes(id));

  if (staleIds.length) {
    const { error: deleteError } = await client
      .from('rocam_items')
      .delete()
      .in('id', staleIds);
    if (deleteError) throw deleteError;
  }

  setBackupStatus({
    connected: true,
    label: 'SALVO',
    detail: `Ultima sincronizacao em ${new Date().toLocaleString('pt-BR')}.`,
  });
  return true;
}

function queueCloudWrite() {
  if (!currentSession) return;
  window.clearTimeout(cloudSaveTimer);
  cloudSaveTimer = window.setTimeout(() => {
    setBackupStatus({ connected: true, label: 'SALVANDO', detail: 'Enviando alteracoes para o Supabase...' });
    cloudSaveChain = cloudSaveChain
      .catch(() => {})
      .then(saveCloudDBNow)
      .catch((error) => {
        console.error('Erro ao sincronizar Supabase:', error);
        setBackupStatus({
          connected: true,
          label: 'ERRO',
          detail: `Erro ao sincronizar: ${error && error.message ? error.message : 'confira a internet e tente novamente.'}`,
        });
      });
  }, 500);
}

async function saveToBackupFileNow() {
  saveLocalDB();
  return saveCloudDBNow();
}

async function importFromBackupFile() {
  return loadCloudDB();
}

async function restoreBackupFileConnection() {
  if (!currentSession) return false;
  await loadCloudDB();
  return true;
}

async function clearBackupHandle() {
  await signOutCloud();
}

async function connectBackupFile() {
  setBackupStatus({ connected: !!currentSession, label: currentSession ? 'NUVEM' : 'LOGIN', detail: 'O app agora usa Supabase, nao arquivo JSON sincronizado.' });
  return null;
}

function supportsBackupFile() {
  return false;
}
