const tabs = document.querySelectorAll('.tabs button');
const sections = document.querySelectorAll('.tab');
let convSelectedFile = null;
let convOutputDir = null;

tabs.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabs.forEach((b) => b.classList.remove('active'));
    sections.forEach((s) => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    
    if (btn.dataset.tab === 'settings') {
      loadHistory();
    }
  });
});

window.addEventListener('DOMContentLoaded', async () => {
  const settings = await window.electronAPI.getSettings();
  
  const cfgStartup = document.getElementById('cfg-startup');
  if (cfgStartup) cfgStartup.checked = settings.startOnBoot;
  
  const cfgTray = document.getElementById('cfg-tray');
  if (cfgTray) cfgTray.checked = settings.keepInTray;
  
  const cfgVersion = document.getElementById('cfg-version');
  if (cfgVersion) cfgVersion.textContent = settings.version;

  const videoOutputEl = document.getElementById('video-output');
  if (videoOutputEl) videoOutputEl.value = 'Vídeos padrão do sistema';
  
  const audioOutputEl = document.getElementById('audio-output');
  if (audioOutputEl) audioOutputEl.value = 'Músicas padrão do sistema';

  // Verificar plugins
  const plugins = await window.electronAPI.checkPlugins();
  const warning = document.getElementById('plugin-warning');
  if (warning) {
    if (!plugins.yt || !plugins.ff) {
      warning.innerHTML = `⚠️ Plugins faltando! yt-dlp e ffmpeg! <button id="btn-open-plugins">Abrir pasta</button>`;
      warning.classList.remove('hidden');
    }
  }

  // Verifica se o botão foi criado no HTML acima antes de adicionar o evento
  const btnOpenPlugins = document.getElementById('btn-open-plugins');
  if (btnOpenPlugins) {
    btnOpenPlugins.addEventListener('click', () => {
      window.electronAPI.openPluginsFolder();
    });
  }

  const btnGetPlugins = document.getElementById('btn-get-plugins');
  if (btnGetPlugins) {
    btnGetPlugins.addEventListener('click', () => {
      window.electronAPI.openExternal('https://github.com/yt-dlp/yt-dlp/releases');
    });
  }
});

// VÍDEO
const videoUrl = document.getElementById('video-url');
const videoPlatform = document.getElementById('video-platform');
const videoQuality = document.getElementById('video-quality');
const videoCodec = document.getElementById('video-codec');
const videoOutput = document.getElementById('video-output');
const videoChoose = document.getElementById('video-choose');
const videoDownload = document.getElementById('video-download');
const videoStatus = document.getElementById('video-status');
const videoFileNameInput = document.getElementById('video-filename');

if (videoUrl) {
  videoUrl.addEventListener('blur', async () => {
    if (videoUrl.value.trim().length > 0) {
      const p = await window.electronAPI.detectPlatform(videoUrl.value.trim());
      if (p && p !== 'desconhecido') {
        videoPlatform.value = p;
      }
    }
  });
}

if (videoChoose) {
  videoChoose.addEventListener('click', async () => {
    const folder = await window.electronAPI.chooseFolder();
    if (folder) {
      videoOutput.value = folder;
    }
  });
}

if (videoDownload) {
  videoDownload.addEventListener('click', async () => {
    videoStatus.innerHTML = `<p class="statusNeutro"><i class="ri-loader-2-fill spin"></i> Iniciando download...</p>`;
    const payload = {
      type: 'video',
      url: videoUrl.value.trim(),
      platform: videoPlatform.value,
      quality: videoQuality.value,
      codec: videoCodec.value,
      fileType: document.getElementById('video-filetype')?.value || '',
      fileName: videoFileNameInput?.value.trim() || '',
      outputDir: videoOutput.value.includes('padrão') ? '' : videoOutput.value
    };

    const res = await window.electronAPI.startDownload(payload);
    if (res.ok) {
      videoStatus.innerHTML = `<p class="statusConcluido"><i class="ri-checkbox-circle-fill"></i> Download concluído.</p>`;
      await window.electronAPI.addDownloadLog({
        name: payload.fileName || (res.file ? res.file.split('\\').pop() : 'Vídeo'),
        path: res.file || '',
        platform: payload.platform || 'auto',
        type: 'video',
        quality: payload.quality || 'best',
        status: 'ok'
      });
      if (typeof loadHistory === 'function') loadHistory();
    } else {
      videoStatus.innerHTML = `<p class="statusErro"><i class="ri-alert-fill"></i> Erro ao continuar.</p>`;
      showErrorModal('Erro ao baixar vídeo', res.error, res.error.includes('ffmpeg.exe'));
      await window.electronAPI.addDownloadLog({
        name: payload.fileName || 'Vídeo (falhou)',
        path: '',
        platform: payload.platform || 'auto',
        type: 'video',
        quality: payload.quality || 'best',
        status: 'erro',
        error: res.error
      });
      if (typeof loadHistory === 'function') loadHistory();
    }
  });
}

// ÁUDIO
const audioUrl = document.getElementById('audio-url');
const audioPlatform = document.getElementById('audio-platform');
const spotifyEngineContainer = document.getElementById('spotify-engine-container');
const audioSpotifyEngine = document.getElementById('audio-spotify-engine');
const audioQuality = document.getElementById('audio-quality');
const audioOutput = document.getElementById('audio-output');
const audioChoose = document.getElementById('audio-choose');
const audioDownload = document.getElementById('audio-download');
const audioStatus = document.getElementById('audio-status');
const audioFileNameInput = document.getElementById('audio-filename');

function toggleSpotifyEngine() {
  if (!spotifyEngineContainer || !audioPlatform) return;
  
  if (audioPlatform.value === 'spotify') {
    spotifyEngineContainer.classList.remove('hidden');
  } else {
    spotifyEngineContainer.classList.add('hidden');
  }
}

if (audioPlatform) {
  audioPlatform.addEventListener('change', toggleSpotifyEngine);
}

if (audioUrl) {
  audioUrl.addEventListener('blur', async () => {
    if (audioUrl.value.trim().length > 0) {
      const p = await window.electronAPI.detectPlatform(audioUrl.value.trim());
      if (p && p !== 'desconhecido') {
        audioPlatform.value = p;
        toggleSpotifyEngine();
      }
    }
  });
}

if (audioChoose) {
  audioChoose.addEventListener('click', async () => {
    const folder = await window.electronAPI.chooseFolder();
    if (folder) {
      audioOutput.value = folder;
    }
  });
}

if (audioDownload) {
  audioDownload.addEventListener('click', async () => {
    audioStatus.innerHTML = `<p class="statusNeutro"><i class="ri-loader-2-fill spin"></i> Iniciando download...</p>`;
    const payload = {
      type: 'audio',
      url: audioUrl.value.trim(),
      platform: audioPlatform.value,
      spotifyEngine: audioSpotifyEngine?.value || '',
      quality: audioQuality.value,
      codec: '',
      fileType: document.getElementById('audio-filetype')?.value || '',
      fileName: audioFileNameInput?.value.trim() || '',
      outputDir: audioOutput.value.includes('padrão') ? '' : audioOutput.value
    };

    const res = await window.electronAPI.startDownload(payload);
    if (res.ok) {
      audioStatus.innerHTML = `<p class="statusConcluido"><i class="ri-checkbox-circle-fill"></i> Download concluído.</p>`;
      await window.electronAPI.addDownloadLog({
        name: payload.fileName || (res.file ? res.file.split('\\').pop() : 'Áudio'),
        path: res.file || '',
        platform: payload.platform || 'auto',
        type: 'audio',
        quality: payload.quality || 'best',
        status: 'ok'
      });
      if (typeof loadHistory === 'function') loadHistory();
    } else {
      audioStatus.innerHTML = `<p class="statusErro"><i class="ri-alert-fill"></i> Erro ao continuar.</p>`;
      showErrorModal('Erro ao baixar áudio', res.error, res.error.includes('ffmpeg.exe'));
      await window.electronAPI.addDownloadLog({
        name: payload.fileName || 'Áudio (falhou)',
        path: '',
        platform: payload.platform || 'auto',
        type: 'audio',
        quality: payload.quality || 'best',
        status: 'erro',
        error: res.error
      });
      if (typeof loadHistory === 'function') loadHistory();
    }
  });
}

if (window.electronAPI && window.electronAPI.onDownloadProgress) {
  window.electronAPI.onDownloadProgress((data) => {
    const { url, percent, engine } = data;
    // vídeo
    const vUrl = document.getElementById('video-url');
    if (vUrl && vUrl.value.trim() === url) {
      document.getElementById('video-status').innerHTML =
        `<p class="statusBaixando"><i class="ri-loader-2-fill spin"></i> Baixando... ${percent.toFixed(1)}% (${engine})</p>`;
    }
    // áudio
    const aUrl = document.getElementById('audio-url');
    if (aUrl && aUrl.value.trim() === url) {
      document.getElementById('audio-status').innerHTML =
        `<p class="statusBaixando"><i class="ri-loader-2-fill spin"></i> Baixando... ${percent.toFixed(1)}% (${engine})</p>`;
    }
  });
}

// CONFIGURAÇÕES
const cfgStartupEl = document.getElementById('cfg-startup');
if (cfgStartupEl) {
  cfgStartupEl.addEventListener('change', async (e) => {
    await window.electronAPI.setSettings({ startOnBoot: e.target.checked });
  });
}

const cfgTrayEl = document.getElementById('cfg-tray');
if (cfgTrayEl) {
  cfgTrayEl.addEventListener('change', async (e) => {
    await window.electronAPI.setSettings({ keepInTray: e.target.checked });
  });
}

const btnOpenPluginsConfig = document.getElementById('open-plugins');
if (btnOpenPluginsConfig) {
  btnOpenPluginsConfig.addEventListener('click', async () => {
    const res = await window.electronAPI.openPluginsFolder();
    if (!res.ok) {
      alert('Não foi possível abrir a pasta de plugins: ' + (res.error || 'desconhecido'));
    }
  });
}

const btnOpenCookies = document.getElementById('open-cookies');
if (btnOpenCookies) {
  btnOpenCookies.addEventListener('click', async () => {
    const res = await window.electronAPI.openCookiesFolder();
    if (!res.ok) {
      alert('Não foi possível abrir a pasta de cookies: ' + (res.error || 'desconhecido'));
    }
  });
}

// Serviços externos (PLUGLINS BUILT-IN)
const btnSpotify = document.getElementById('btn-audio-spotify');
const btnDeezer = document.getElementById('btn-audio-deezer');
const btnKickVodDownload = document.getElementById('btn-kick-voddownload');
const btnDonate = document.getElementById('btn-donate');
const btnTiktokDownloader = document.getElementById('btn-ssstik');

if (btnSpotify) {
  btnSpotify.addEventListener('click', () => {
    window.electronAPI.openWebPopup('https://spotidownloader.com/pt6');
  });
}
if (btnDeezer) {
  btnDeezer.addEventListener('click', () => {
    window.electronAPI.openWebPopup('https://deezmate.com/en');
  });
}
if (btnKickVodDownload) {
  btnKickVodDownload.addEventListener('click', () => {
    window.electronAPI.openWebPopup('https://kick-video.download');
  });
}
if (btnTiktokDownloader) {
  btnTiktokDownloader.addEventListener('click', () => {
    window.electronAPI.openWebPopup('https://ssstik.io');
  });
}
if (btnDonate) {
  btnDonate.addEventListener('click', () => {
    window.electronAPI.openWebPopup('https://livepix.gg/jhordan');
  });
}

// Erros
function getClearErrorMessage(errorText) {
  const err = errorText.toLowerCase();
  
  if (err.includes('sign in to confirm you’re not a bot') || err.includes('requires authentication')) {
    return 'O site exigiu login. Vá nas Configurações, abra a pasta de Cookies e adicione um arquivo "cookies.txt" válido do seu navegador.';
  }
  if (err.includes('video unavailable') || err.includes('is not available')) {
    return 'Este vídeo não está disponível, foi excluído ou está privado.';
  }
  if (err.includes('ffmpeg') || err.includes('ffprobe')) {
    return 'Falta o plugin FFmpeg. Ele é obrigatório para juntar áudio e vídeo em alta qualidade ou fazer conversões. Baixe e coloque na pasta de plugins.';
  }
  if (err.includes('unsupported url') || err.includes('no video formats')) {
    return 'O link fornecido não é suportado pelo Filekit ou não contém um vídeo válido.';
  }
  if (err.includes('saiu com o código') || err.includes('exit code 1')) {
    return `O plugin de download encontrou um erro inesperado e falhou.\nDetalhe técnico: ${errorText}`;
  }
  if (err.includes('maxbuffer') || err.includes('buffer')) {
    return 'O arquivo é muito grande e excedeu o limite de memória do aplicativo. (Erro de MaxBuffer).';
  }
  if (err.includes('timeout')) {
    return 'O download demorou muito e o tempo limite foi atingido. Tente novamente com uma internet mais estável.';
  }

  return errorText;
}

// ERRO (MODAL)
function showErrorModal(title, message, showPluginsButton = false) {
  const modal = document.getElementById('error-modal');
  const titleEl = document.getElementById('error-title');
  const msgEl = document.getElementById('error-message');
  const btnPlugins = document.getElementById('btn-open-plugins-err');

  if (!modal) return;

  const clearMessage = getClearErrorMessage(message);

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = clearMessage;

  if (btnPlugins) {
    if (showPluginsButton || clearMessage.includes('FFmpeg')) {
        btnPlugins.classList.remove('hidden');
    } else {
        btnPlugins.classList.add('hidden');
    }
  }

  modal.classList.remove('hidden');
}

const btnCloseError = document.getElementById('btn-close-error');
if (btnCloseError) {
  btnCloseError.addEventListener('click', () => {
    const modal = document.getElementById('error-modal');
    if (modal) modal.classList.add('hidden');
  });
}

const btnOpenPluginsErr = document.getElementById('btn-open-plugins-err');
if (btnOpenPluginsErr) {
  btnOpenPluginsErr.addEventListener('click', () => {
    window.electronAPI.openPluginsFolder();
    const modal = document.getElementById('error-modal');
    if (modal) modal.classList.add('hidden');
  });
}

// HISTÓRICO
async function loadHistory() {
  const container = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');
  if (!container) return;

  const logs = await window.electronAPI.getDownloadLogs();
  container.innerHTML = '';

  if (!logs || logs.length === 0) {
    if (empty) empty.classList.remove('hidden');
    return;
  }

  if (empty) empty.classList.add('hidden');
  logs.slice(0, 15).forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'history-card';

    const left = document.createElement('div');
    left.className = 'history-left';

    const icon = document.createElement('div');
    icon.className = 'history-icon';

    const platform = (item.platform || 'auto').toLowerCase();
    if (platform.includes('youtube')) icon.style.background = '#FF0000';
    else if (platform.includes('tiktok')) icon.style.background = '#000000';
    else if (platform.includes('instagram')) icon.style.background = 'linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7)';
    else if (platform.includes('twitch')) icon.style.background = '#9146FF';
    else if (platform.includes('kick')) icon.style.background = '#53fc18';
    else if (platform.includes('facebook')) icon.style.background = '#043affff';
    else if (platform.includes('twitter')) icon.style.background = '#000000';
    else icon.style.background = '#444';

    icon.innerHTML = item.type === 'audio'
      ? '<i class="ri-file-music-fill"></i>'
      : '<i class="ri-file-video-fill"></i>';

    const meta = document.createElement('div');
    meta.className = 'history-meta';

    const title = document.createElement('div');
    title.className = 'history-title';
    title.textContent = item.name || '(sem nome)';
    title.style.color = `#fff`;

    const sub = document.createElement('div');
    sub.className = 'history-sub';

    const d = item.date ? new Date(item.date) : null;
    const dateStr = d ? d.toLocaleString() : '';
    sub.textContent = `${item.platform || 'auto'} • ${item.type || ''} • ${dateStr}`;

    meta.appendChild(title);
    meta.appendChild(sub);

    left.appendChild(icon);
    left.appendChild(meta);

    const right = document.createElement('div');
    right.className = 'history-right';

    const badge = document.createElement('span');
    if (item.status === 'ok') {
      badge.className = 'badge-ok';
      badge.textContent = 'OK';
    } else {
      badge.className = 'badge-err';
      badge.textContent = 'Erro';
    }

    right.appendChild(badge);

    const btn = document.createElement('button');
    btn.className = 'history-btn';
    btn.innerHTML = '<i class="ri-folder-3-fill"></i> Abrir';
    btn.disabled = !item.path;
    btn.addEventListener('click', () => {
      if (item.path) {
        window.electronAPI.openFileLocation(item.path);
      }
    });

    right.appendChild(btn);

    card.appendChild(left);
    card.appendChild(right);

    container.appendChild(card);
  });
}

// CONVERSOR DE ARQUIVOS (NEW: NOVOS FORMATOS DE ARQUIVOS!)
const convFormats = {
  video: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', 'm4v', 'ts', '3gp', 'mpeg', 'vob'],
  audio: ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a', 'wma', 'opus', 'alac', 'aiff', 'amr'],
  image: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic', 'avif', 'apng', 'bmp', 'tiff', 'ico', 'tga'],
  doc: ['pdf', 'docx', 'pptx', 'xlsx', 'xls', 'txt', 'rtf', 'csv', 'odt']
};
// !! "doc" PRECISA DO LIBREOFFICE INSTALADO!

function fillConvFormats(type) {
  const sel = document.getElementById('conv-output-format');
  if (!sel) return;
  sel.innerHTML = '';
  convFormats[type].forEach(ext => {
    const opt = document.createElement('option');
    opt.value = ext;
    opt.textContent = '.' + ext;
    sel.appendChild(opt);
  });
  updateConvertButtonLabel();
}

function updateConvertButtonLabel() {
  const btn = document.getElementById('conv-start');
  const sel = document.getElementById('conv-output-format');
  if (!btn || !sel) return;
  const ext = sel.value || '...';
  btn.innerHTML = `<i class="ri-refresh-fill"></i> Converter para .${ext}`;
}

const convCat = document.getElementById('conv-category');
if (convCat) {
  fillConvFormats(convCat.value);
  convCat.addEventListener('change', () => {
    fillConvFormats(convCat.value);
  });
}

const convOutputFormatEl = document.getElementById('conv-output-format');
if (convOutputFormatEl) {
  convOutputFormatEl.addEventListener('change', updateConvertButtonLabel);
}

const convStatus = document.getElementById('conv-status');
const convFileLabel = document.getElementById('conv-selected-file');
const convOutInput = document.getElementById('conv-output-path');
const convStartBtn = document.getElementById('conv-start');

const convSelectFileBtn = document.getElementById('conv-select-file');
if (convSelectFileBtn) {
  convSelectFileBtn.addEventListener('click', async () => {
    const file = await window.electronAPI.pickFile();
    if (!file) return;
    convSelectedFile = file;
    if (convFileLabel) convFileLabel.textContent = file;
    if (convStartBtn) convStartBtn.disabled = false;
  });
}

const convChooseOutputBtn = document.getElementById('conv-choose-output');
if (convChooseOutputBtn) {
  convChooseOutputBtn.addEventListener('click', async () => {
    const folder = await window.electronAPI.chooseFolder();
    if (!folder) return;
    convOutputDir = folder;
    if (convOutInput) convOutInput.value = folder;
  });
}

if (convStartBtn) {
  convStartBtn.addEventListener('click', async () => {
    if (!convSelectedFile) return;

    const type = convCat ? convCat.value : '';
    const format = convOutputFormatEl ? convOutputFormatEl.value : '';

    if (convStatus) convStatus.innerHTML = `<p class="statusNeutro"><i class="ri-loader-2-fill spin"></i> Iniciando conversão...</p>`;
    convStartBtn.disabled = true;

    const res = await window.electronAPI.convertFile({
      type,
      input: convSelectedFile,
      outputDir: convOutputDir,
      format
    });

    if (res.ok) {
      if (convStatus) convStatus.innerHTML = `<p class="statusConcluido"><i class="ri-checkbox-circle-fill"></i> Conversão concluída! (<span class="hint">${res.output}</span>)</p>`;
    } else {
      if (convStatus) convStatus.innerHTML = `<p class="statusErro"><i class="ri-error-warning-fill"></i> Erro ao converter: ${res.error}</p>`;
    }

    convStartBtn.disabled = false;
  });
}

if (window.electronAPI && window.electronAPI.onConvertProgress) {
  window.electronAPI.onConvertProgress((_e, { input, percent }) => {
    if (!convSelectedFile || input !== convSelectedFile) return;
    const p = Math.round(percent);
    if (convStatus) {
      convStatus.innerHTML = `<p class="statusBaixando"><i class="ri-loop-right-fill spin"></i> Convertendo arquivo... (${p}%)</p>`;
    }
  });
}