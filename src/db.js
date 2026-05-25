/*
 * Data access layer for ROCAM INTEL.
 * The app still uses localStorage, with optional mirroring to a user-selected
 * JSON file. Put that file inside OneDrive/iCloud/Google Drive to sync it.
 */
let DB = { pessoas: [], veiculos: [], locais: [] };

const DBKEY = 'rocam_intel_v2';
const BACKUP_DB = 'rocam_intel_backup_file';
const BACKUP_STORE = 'handles';
const BACKUP_HANDLE_ID = 'main';

let backupFileHandle = null;
let backupWriteChain = Promise.resolve();
let backupStatusListener = null;
let lastBackupStatus = { connected: false, label: 'LOCAL', detail: 'Sem arquivo sincronizado.' };

function normalizeDB(data) {
  const safe = data && typeof data === 'object' ? data : {};
  return {
    pessoas: Array.isArray(safe.pessoas) ? safe.pessoas : [],
    veiculos: Array.isArray(safe.veiculos) ? safe.veiculos : [],
    locais: Array.isArray(safe.locais) ? safe.locais : [],
  };
}

function loadDB() {
  try {
    const r = localStorage.getItem(DBKEY);
    if (r) DB = normalizeDB(JSON.parse(r));
  } catch(e) {
    DB = normalizeDB(DB);
  }
  DB = normalizeDB(DB);
}

function saveDB() {
  DB = normalizeDB(DB);
  localStorage.setItem(DBKEY, JSON.stringify(DB));
  queueBackupWrite();
}

function uid() { return '_' + Date.now() + Math.random().toString(36).slice(2,7); }

function supportsBackupFile() {
  return !!(window.showOpenFilePicker && window.showSaveFilePicker && window.indexedDB);
}

function setBackupStatusListener(listener) {
  backupStatusListener = listener;
  if (backupStatusListener) backupStatusListener(lastBackupStatus);
}

function setBackupStatus(status) {
  lastBackupStatus = { ...lastBackupStatus, ...status };
  if (backupStatusListener) backupStatusListener(lastBackupStatus);
}

function openHandleDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BACKUP_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(BACKUP_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveBackupHandle(handle) {
  const db = await openHandleDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE, 'readwrite');
    tx.objectStore(BACKUP_STORE).put(handle, BACKUP_HANDLE_ID);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function loadBackupHandle() {
  const db = await openHandleDB();
  const handle = await new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE, 'readonly');
    const req = tx.objectStore(BACKUP_STORE).get(BACKUP_HANDLE_ID);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return handle;
}

async function clearBackupHandle() {
  backupFileHandle = null;
  const db = await openHandleDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE, 'readwrite');
    tx.objectStore(BACKUP_STORE).delete(BACKUP_HANDLE_ID);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  setBackupStatus({ connected: false, label: 'LOCAL', detail: 'Arquivo sincronizado desconectado.' });
}

async function ensureHandlePermission(handle, mode = 'readwrite') {
  const opts = { mode };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  return (await handle.requestPermission(opts)) === 'granted';
}

async function readBackupFile(handle) {
  const file = await handle.getFile();
  const text = await file.text();
  if (!text.trim()) return normalizeDB({});
  return normalizeDB(JSON.parse(text));
}

async function writeBackupFile() {
  if (!backupFileHandle) return;
  const writable = await backupFileHandle.createWritable();
  await writable.write(JSON.stringify(normalizeDB(DB), null, 2));
  await writable.close();
  setBackupStatus({
    connected: true,
    label: 'SINCRONIZADO',
    detail: `Último backup gravado em ${new Date().toLocaleString('pt-BR')}.`,
  });
}

function queueBackupWrite() {
  if (!backupFileHandle) return;
  backupWriteChain = backupWriteChain
    .catch(() => {})
    .then(writeBackupFile)
    .catch(() => {
      setBackupStatus({
        connected: true,
        label: 'ERRO',
        detail: 'Não foi possível gravar no arquivo sincronizado. Reconecte o arquivo.',
      });
    });
}

async function connectBackupFile(mode = 'open') {
  if (!supportsBackupFile()) {
    setBackupStatus({
      connected: false,
      label: 'INDISPONÍVEL',
      detail: 'Seu navegador não permite salvar direto em arquivo. Use Chrome ou Edge.',
    });
    return null;
  }

  const pickerOptions = {
    types: [{
      description: 'Backup ROCAM INTEL',
      accept: { 'application/json': ['.json'] },
    }],
    excludeAcceptAllOption: false,
  };

  const handle = mode === 'create'
    ? await window.showSaveFilePicker({ ...pickerOptions, suggestedName: 'rocam-intel-db.json' })
    : (await window.showOpenFilePicker({ ...pickerOptions, multiple: false }))[0];

  if (!(await ensureHandlePermission(handle))) {
    setBackupStatus({ connected: false, label: 'SEM PERMISSÃO', detail: 'Permissão de gravação negada.' });
    return null;
  }

  backupFileHandle = handle;
  await saveBackupHandle(handle);
  setBackupStatus({ connected: true, label: 'CONECTADO', detail: `Arquivo conectado: ${handle.name}` });
  return handle;
}

async function restoreBackupFileConnection() {
  if (!supportsBackupFile()) {
    setBackupStatus({ connected: false, label: 'LOCAL', detail: 'Sem arquivo sincronizado.' });
    return false;
  }

  try {
    const handle = await loadBackupHandle();
    if (!handle) return false;
    backupFileHandle = handle;
    const hasPermission = (await handle.queryPermission({ mode: 'readwrite' })) === 'granted';
    setBackupStatus({
      connected: hasPermission,
      label: hasPermission ? 'CONECTADO' : 'PERMISSÃO',
      detail: hasPermission ? `Arquivo conectado: ${handle.name}` : 'Reconecte o arquivo para voltar a sincronizar.',
    });
    return hasPermission;
  } catch(e) {
    setBackupStatus({ connected: false, label: 'LOCAL', detail: 'Sem arquivo sincronizado.' });
    return false;
  }
}

async function importFromBackupFile() {
  if (!backupFileHandle || !(await ensureHandlePermission(backupFileHandle))) return null;
  DB = await readBackupFile(backupFileHandle);
  localStorage.setItem(DBKEY, JSON.stringify(DB));
  setBackupStatus({ connected: true, label: 'CARREGADO', detail: `Dados carregados de ${backupFileHandle.name}.` });
  return DB;
}

async function saveToBackupFileNow() {
  if (!backupFileHandle || !(await ensureHandlePermission(backupFileHandle))) return false;
  await writeBackupFile();
  return true;
}
