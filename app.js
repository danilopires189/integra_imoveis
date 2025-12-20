
// DOM Elements
const $ = (s) => document.querySelector(s);
const ui = {
    screen: $('#screen-ui'),
    print: $('#print-area'),
    form: $('#form-search'),
    barcodeInput: $('#input-barcode'),
    copiesInput: $('#input-copies'),
    btnGenerate: $('#btn-generate'),
    status: $('#status-msg'),
    loading: $('#loading-overlay'),
    loadingText: $('#loading-text'),
    matriculaInput: $('#input-matricula'),
    widthInput: $('#input-width'),
    heightInput: $('#input-height'),
    preview: $('#screen-preview'),
    // Modal Copies
    copiesModal: $('#copies-modal'),
    modalInputCopies: $('#modal-input-copies'),
    btnConfirmCopies: $('#confirm-copies'),
    btnCancelCopies: $('#cancel-copies'),
    // Validity Modal
    validityModal: $('#validity-modal'),
    modalInputValidity: $('#modal-input-validity'),
    btnConfirmValidity: $('#confirm-validity'),
    btnCancelValidity: $('#cancel-validity'),
    checkValidade: $('#check-validade')
};

let pendingData = null;
let pendingCopies = 1;

// Data Store
const Data = {
    products: new Map(), // BARRAS -> Product Object
    addresses: new Map(), // CODDV -> Array of Address Objects
    isReady: false
};

// History Store
let historyData = JSON.parse(localStorage.getItem('mercadoria-history') || '[]');

// Shared Utils
function curDateTime() {
    const now = new Date();
    const d = now.toLocaleDateString('pt-BR');
    const t = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${d} ${t}`;
}

// Initialization
async function init() {
    try {
        ui.loading.style.display = 'flex';
        ui.loadingText.textContent = 'Carregando banco de produtos...';

        // Load CADASTRO
        // Using explicit relative path to avoid 404s on some hostings
        // Load CADASTRO (Fetch JSON directly)
        const resCad = await fetch('BASE_CADASTRO.json');
        if (!resCad.ok) throw new Error(`Falha ao carregar BASE_CADASTRO.json: ${resCad.status}`);
        const jsonCad = await resCad.json();

        ui.loadingText.textContent = 'Indexando produtos...';
        if (jsonCad.BASE_CADASTRO) {
            for (const item of jsonCad.BASE_CADASTRO) {
                // Ensure we handle leading zeros or strict matching? 
                // Using exact string match for now.
                Data.products.set(item.BARRAS, item);
                // Also map by CODDV just in case? No, flow is scan Barcode.
            }
        }

        ui.loadingText.textContent = 'Carregando banco de endereços...';
        // Load END (Fetch JSON directly)
        const resEnd = await fetch('BASE_END.json');
        if (!resEnd.ok) throw new Error(`Falha ao carregar BASE_END.json: ${resEnd.status}`);
        const jsonEnd = await resEnd.json();

        ui.loadingText.textContent = 'Indexando endereços...';
        if (jsonEnd.BASE_END) {
            for (const item of jsonEnd.BASE_END) {
                // Only care about PULMÃO type as per requirement
                if (item.CODDV) {
                    if (!Data.addresses.has(item.CODDV)) {
                        Data.addresses.set(item.CODDV, []);
                    }
                    Data.addresses.get(item.CODDV).push(item);
                }
            }
        }

        Data.isReady = true;
        ui.loading.style.display = 'none';
        ui.barcodeInput.focus();
        showStatus('Sistema pronto. Bipe o produto.', 'success');

    } catch (err) {
        console.error(err);
        ui.loadingText.textContent = 'Erro ao carregar dados: ' + err.message;
        ui.loadingText.style.color = 'red';
    }
}

// Logic
function formatCODDV(coddv) {
    if (!coddv || coddv.length < 2) return coddv;
    // Format "621412" -> "62141-2"
    return coddv.slice(0, -1) + '-' + coddv.slice(-1);
}

function getLargeSuffix(address) {
    // Address format: PG06.001.019.934
    // We want "934"
    const parts = address.split('.');
    return parts[parts.length - 1];
}

const getPadraoLargeNum = (address) => {
    // Address format: PG06.001.019.934 -> "934"
    const parts = address.split('.');
    return parts[parts.length - 1];
};

const getSeparacaoLargeNum = (address) => {
    // Address format: M205.001... -> "M205" -> "205"
    // m70... -> "m70" -> "070"
    const parts = address.split('.');
    const firstPart = parts[0];
    const match = firstPart.match(/\d+/);
    if (!match) return '000';
    return match[0].padStart(3, '0');
};

function generateLabel(product, addressItem, inputBarcode, copies = 1, validityDate = null) {
    const matricula = ui.matriculaInput.value.trim() || '---';
    const dateStr = curDateTime(); // e.g. 01/12/25 00:00
    const codFormatted = formatCODDV(product.CODDV);


    // Address formatting is now handled outside
    const { largeNum, shortAddr } = addressItem.formatted;

    // Create label HTML
    const labelDiv = document.createElement('div');
    labelDiv.className = 'label-page';

    // Validity Label (Optional, first)
    if (validityDate) {
        const item = document.createElement('div');
        item.className = 'label-badge';
        item.innerHTML = `
            <div class="label-row-top">
                <div class="label-desc">${product.DESC}</div>
                <div class="label-meta-top">
                    <div>${dateStr}</div>
                </div>
            </div>
            
            <div class="label-row-middle" style="display: flex; align-items: center; justify-content: flex-start; overflow: hidden;">
                <!-- Maximized Validity Date, No Barcode -->
                <div class="label-big-num" style="font-size: 87pt; width: 100%; text-align: left; line-height: 0.8; letter-spacing: -3px; font-family: 'Arial Black', sans-serif;">${validityDate}</div>
            </div>
            
            <div class="label-row-bottom">
                <div class="label-addr">
                    ${shortAddr}
                    <span style="font-size: 8pt; font-weight: 600; font-family: sans-serif; margin-left: 6px;">${inputBarcode}</span>
                </div>
                <div class="label-info-right" style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
                    <div class="label-txt">COD: ${codFormatted}</div>
                    <div class="label-txt">MAT: ${matricula}</div>
                </div>
            </div>
        `;
        labelDiv.appendChild(item);
    }

    for (let i = 0; i < copies; i++) {
        const item = document.createElement('div');
        item.className = 'label-badge';
        item.innerHTML = `
            <div class="label-row-top">
                <div class="label-desc">${product.DESC}</div>
                <div class="label-meta-top">
                    <div>${dateStr}</div>
                </div>
            </div>
            
            <div class="label-row-middle">
                <div class="label-big-num">${largeNum}</div>
                <div class="label-barcode-section">
                    <div class="label-barcode-container">
                        <svg class="barcode-svg" preserveAspectRatio="none"></svg>
                    </div>
                    <div class="label-barcode-cod">COD: ${codFormatted}</div>
                </div>
            </div>
            
            <div class="label-row-bottom">
                <div class="label-addr">
                    ${shortAddr}
                    <span style="font-size: 8pt; font-weight: 600; font-family: sans-serif; margin-left: 6px;">${inputBarcode}</span>
                </div>
                <div class="label-info-right">
                    <div class="label-txt">MAT: ${matricula}</div>
                </div>
            </div>
        `;

        // Render Barcode
        const svg = item.querySelector('.barcode-svg');
        try {
            // Using JsBarcode with CODE128 to allow odd-length barcodes without padding
            // displayValue: false as requested (no legend in image)
            JsBarcode(svg, product.CODDV, {
                format: "CODE128",
                displayValue: false,
                fontSize: 10,
                margin: 3,
                height: 25,
                width: 1.2
            });
        } catch (e) {
            console.warn('Erro ao gerar barcode', e);
        }

        labelDiv.appendChild(item);
    }

    return labelDiv;
}

// Popup Helper
function mostrarPopupSucesso(titulo, subtitulo) {
    const popup = document.createElement('div');
    popup.id = 'popup-sucesso';
    popup.innerHTML = `
        <div class="popup-content">
            <div class="popup-icon">✅</div>
            <div class="popup-text">
                <div class="popup-titulo">${titulo}</div>
                <div class="popup-subtitulo">${subtitulo}</div>
            </div>
        </div>
    `;
    document.body.appendChild(popup);
    setTimeout(() => popup.classList.add('show'), 100);
    setTimeout(() => {
        popup.classList.remove('show');
        setTimeout(() => popup.remove(), 300);
    }, 2000);
}

async function handleSearch(e) {
    e.preventDefault();
    const barcode = ui.barcodeInput.value.trim();
    const matricula = ui.matriculaInput.value.trim();

    // 1. Validate Matricula
    if (!matricula) {
        showStatus('⚠️ Informe a matrícula antes de continuar!', 'warning');
        // Flash effect or sound could be added
        ui.matriculaInput.focus();
        ui.matriculaInput.style.borderColor = 'red';
        setTimeout(() => ui.matriculaInput.style.borderColor = '', 2000);
        return;
    }

    if (!barcode) {
        showStatus('Informe o código de barras!', 'warning');
        ui.barcodeInput.focus();
        return;
    }

    // 2. Lookup Product
    const product = Data.products.get(barcode);
    if (!product) {
        showStatus('Produto não encontrado (BARRAS: ' + barcode + ')', 'error');
        ui.barcodeInput.select();
        return;
    }

    // 3. Lookup Address
    const addressList = Data.addresses.get(product.CODDV);
    if (!addressList || addressList.length === 0) {
        showStatus(`Produto encontrado (${product.DESC}), mas SEM endereço de PULMÃO.`, 'warning');
        ui.barcodeInput.select();
        return;
    }

    // 4. Resolve Target Address
    const destinoType = document.querySelector('input[name="destino"]:checked').value;
    let filteredList = [], targetAddress = null;
    let largeNumVal = '', shortAddrVal = '';

    if (destinoType === 'pulmao') {
        filteredList = addressList.filter(a => a.TIPO === 'PULMÃO');
        if (filteredList.length === 0) {
            showStatus(`Produto encontrado, mas SEM endereço de PULMÃO.`, 'warning');
            return;
        }
        targetAddress = filteredList[filteredList.length - 1];
        largeNumVal = getLargeSuffix(targetAddress.ENDERECO);
        const p = targetAddress.ENDERECO.split('.');
        p.pop();
        shortAddrVal = p.join('.');
    } else {
        filteredList = addressList.filter(a => a.TIPO === 'SEPARACAO');
        if (filteredList.length === 0) {
            showStatus(`Produto encontrado, mas SEM endereço de SEPARAÇÃO.`, 'warning');
            return;
        }
        targetAddress = filteredList[0];
        largeNumVal = getPadraoLargeNum(targetAddress.ENDERECO);
        const p = targetAddress.ENDERECO.split('.');
        if (p.length > 1) p.pop();
        shortAddrVal = p.join('.');
    }

    targetAddress.formatted = {
        largeNum: largeNumVal,
        shortAddr: shortAddrVal
    };

    // 5. Store Data & Open Modal
    pendingData = {
        product,
        targetAddress,
        barcode,
        matricula,
        destinoType
    };

    openCopiesModal();
}

function openCopiesModal() {
    ui.copiesModal.style.display = 'flex';
    ui.modalInputCopies.value = '1';
    // Timeout needed to ensure element is visible before selection matches
    setTimeout(() => {
        ui.modalInputCopies.focus();
        ui.modalInputCopies.select();
    }, 100);
}

function closeCopiesModal() {
    ui.copiesModal.style.display = 'none';
}

function openValidityModal() {
    ui.validityModal.style.display = 'flex';
    ui.modalInputValidity.value = '';
    setTimeout(() => {
        ui.modalInputValidity.focus();
    }, 100);
}

function closeValidityModal() {
    ui.validityModal.style.display = 'none';
    ui.barcodeInput.focus();
}

async function executePrint(copies, validityDate = null) {
    if (!pendingData) return;
    const { product, targetAddress, barcode, matricula, destinoType } = pendingData;

    // Clear pending
    pendingData = null;

    showStatus(`Gerando etiquetas para: ${product.DESC} (${destinoType.toUpperCase()})`, 'success');

    // Generate Label
    const labelEl = generateLabel(product, targetAddress, barcode, copies, validityDate);

    // Apply Dimensions (Ensure they are set)
    const w = ui.widthInput.value || '90';
    const h = ui.heightInput.value || '42';
    document.documentElement.style.setProperty('--label-width', w + 'mm');
    document.documentElement.style.setProperty('--label-height', h + 'mm');

    // Render
    ui.print.innerHTML = '';
    ui.print.appendChild(labelEl);

    ui.preview.innerHTML = '';
    ui.preview.appendChild(labelEl.cloneNode(true));

    // History
    saveHistory({
        desc: product.DESC,
        coddv: product.CODDV,
        barcode: barcode,
        matricula: matricula,
        address: targetAddress.ENDERECO,
        type: destinoType,
        validity: validityDate,
        timestamp: new Date().toISOString()
    });

    // Print then Counter
    // Use setTimeout to ensure rendering before print, and make callback async to handle await
    setTimeout(async () => {
        window.print(); // Blocks execution until dialog closes

        // Counter Logic (Runs after dialog closes)
        try {
            if (window.contadorGlobal) {
                console.log(`📊 Incrementando contador: +${copies + (validityDate ? 1 : 0)}`);
                const novoValor = await window.contadorGlobal.incrementarContador(copies + (validityDate ? 1 : 0), 'mercadoria');
                mostrarPopupSucesso('Etiquetas geradas com sucesso!', `+${copies} etiquetas | Total: ${novoValor.toLocaleString('pt-BR')}`);
            }
        } catch (err) {
            console.error('Erro ao incrementar contador:', err);
        }

        ui.barcodeInput.value = ''; // Clear after print
        ui.barcodeInput.focus();
    }, 100);
}

function showStatus(msg, type) {
    ui.status.textContent = msg;
    ui.status.className = 'status-msg ' + type;
}

// Live Dimension Updates (Optional UX improvement)
function updateDimensions() {
    const w = ui.widthInput.value || '90';
    const h = ui.heightInput.value || '42';
    document.documentElement.style.setProperty('--label-width', w + 'mm');
    document.documentElement.style.setProperty('--label-height', h + 'mm');
}

// Events
ui.form.addEventListener('submit', handleSearch);
ui.widthInput.addEventListener('input', updateDimensions);
ui.heightInput.addEventListener('input', updateDimensions);

// Modal Events
ui.btnConfirmCopies.addEventListener('click', () => {
    const copies = parseInt(ui.modalInputCopies.value) || 1;
    pendingCopies = copies;

    if (ui.checkValidade.checked) {
        closeCopiesModal();
        openValidityModal();
    } else {
        executePrint(copies);
        closeCopiesModal();
    }
});

ui.btnCancelCopies.addEventListener('click', () => {
    closeCopiesModal();
    ui.barcodeInput.focus();
});

ui.modalInputCopies.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const copies = parseInt(ui.modalInputCopies.value) || 1;
        pendingCopies = copies;

        if (ui.checkValidade.checked) {
            closeCopiesModal();
            openValidityModal();
        } else {
            executePrint(copies);
            closeCopiesModal();
        }
    }
    if (e.key === 'Escape') closeCopiesModal();
});

// Validity Modal Events
function validateValidityInput(val) {
    if (val.length !== 4) {
        return { valid: false, msg: 'A validade deve ter 4 dígitos (MMAA). Ex: 0126' };
    }
    const month = parseInt(val.slice(0, 2));
    const yearPart = parseInt(val.slice(2));

    if (month < 1 || month > 12) {
        return { valid: false, msg: 'Mês inválido! Digite um mês entre 01 e 12.' };
    }

    const year = 2000 + yearPart;
    const now = new Date();

    // Calculate month difference
    // We compare (Year * 12 + MonthIndex)
    const inputTotalMonths = year * 12 + (month - 1);
    const currentTotalMonths = now.getFullYear() * 12 + now.getMonth();
    const diff = inputTotalMonths - currentTotalMonths;

    if (diff < 5) {
        return { valid: false, msg: 'A validade deve ser de pelo menos 5 meses a partir de hoje.' };
    }
    if (diff > 60) {
        return { valid: false, msg: 'A validade não pode ultrapassar 5 anos.' };
    }

    return { valid: true };
}

ui.btnConfirmValidity.addEventListener('click', () => {
    const val = ui.modalInputValidity.value.replace(/\D/g, '');
    const validation = validateValidityInput(val);

    if (!validation.valid) {
        alert(validation.msg);
        ui.modalInputValidity.select();
        return;
    }

    const formatted = val.slice(0, 2) + '/' + val.slice(2);
    executePrint(pendingCopies, formatted);
    closeValidityModal();
});

ui.btnCancelValidity.addEventListener('click', () => {
    closeValidityModal();
    // Do we go back to copies or cancel everything?
    // "Cancelar" usually means cancel everything.
    ui.barcodeInput.focus();
});

ui.modalInputValidity.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const val = ui.modalInputValidity.value.replace(/\D/g, '');
        const validation = validateValidityInput(val);

        if (!validation.valid) {
            alert(validation.msg);
            ui.modalInputValidity.select();
            return;
        }

        const formatted = val.slice(0, 2) + '/' + val.slice(2);
        executePrint(pendingCopies, formatted);
        closeValidityModal();
    }
    if (e.key === 'Escape') closeValidityModal();
});

// Global Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (ui.copiesModal.style.display === 'flex') closeCopiesModal();
        if (ui.validityModal.style.display === 'flex') closeValidityModal();
    }
});

// History UI Events
$('#historico-btn')?.addEventListener('click', showHistory);
$('#historico-close')?.addEventListener('click', hideHistory);
$('#historico-modal')?.addEventListener('click', (e) => {
    if (e.target === $('#historico-modal')) hideHistory();
});
$('#toggle-search')?.addEventListener('click', () => {
    const s = $('#search-section');
    s.style.display = s.style.display === 'none' ? 'block' : 'none';
    if (s.style.display === 'block') $('#search-input').focus();
});
$('#search-input')?.addEventListener('input', filterHistory);
$('#clear-search')?.addEventListener('click', () => {
    $('#search-input').value = '';
    filterHistory();
});
document.querySelectorAll('input[name="searchType"]').forEach(r => {
    r.addEventListener('change', filterHistory);
});

// History Logic
function saveHistory(item) {
    // Add ID
    item.id = Date.now();

    // Unshift to beginning
    historyData.unshift(item);

    // Limit to 60 days
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - 60);

    // Filter keep only newer than limitDate
    historyData = historyData.filter(h => new Date(h.timestamp) > limitDate);

    localStorage.setItem('mercadoria-history', JSON.stringify(historyData));
}

function showHistory() {
    $('#historico-modal').style.display = 'flex';
    renderHistory(historyData);
    $('#search-section').style.display = 'none';
    $('#search-input').value = '';
}

function hideHistory() {
    $('#historico-modal').style.display = 'none';
}

function renderHistory(list) {
    const container = $('#historico-list');
    container.innerHTML = '';

    if (list.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 2rem; color: #999;">Nenhum registro encontrado.</div>';
        return;
    }

    list.forEach(item => {
        const date = new Date(item.timestamp).toLocaleString('pt-BR');
        const div = document.createElement('div');
        div.className = 'historico-item';
        div.innerHTML = `
            <div class="historico-info">
                <div class="historico-primary">${item.desc}</div>
                <div class="historico-secondary">
                    <span>CODDV: ${item.coddv}</span> • 
                    <span>EAN: ${item.barcode || '---'}</span> • 
                    <span>Matrícula: ${item.matricula}</span>
                </div>
                <div class="historico-secondary" style="margin-top: 2px; color: #4b5563;">
                    <span>📍 ${item.address || '---'}</span> • 
                    <span>${(item.type || '').toUpperCase()}</span>
                    ${item.validity ? ` • <span>📅 Val: ${item.validity}</span>` : ''}
                </div>
                <div class="historico-meta">${date}</div>
            </div>
        `;
        container.appendChild(div);
    });
}

function filterHistory() {
    const term = $('#search-input').value.toLowerCase();
    const type = document.querySelector('input[name="searchType"]:checked').value;

    const filtered = historyData.filter(item => {
        if (!term) return true;

        const dateStr = new Date(item.timestamp).toLocaleString('pt-BR').toLowerCase();

        if (type === 'all') {
            return (item.desc || '').toLowerCase().includes(term) ||
                (item.coddv || '').toLowerCase().includes(term) ||
                (item.matricula || '').toLowerCase().includes(term) ||
                dateStr.includes(term);
        } else if (type === 'matricula') {
            return (item.matricula || '').toLowerCase().includes(term);
        } else if (type === 'coddv') {
            return (item.coddv || '').toLowerCase().includes(term);
        } else if (type === 'descricao') {
            return (item.desc || '').toLowerCase().includes(term);
        } else if (type === 'data') {
            return dateStr.includes(term);
        }
        return true;
    });

    renderHistory(filtered);
}



// Dynamic Instructions
function updateInstructions() {
    const type = document.querySelector('input[name="destino"]:checked').value;
    const target = $('#instruction-target');
    if (target) {
        target.textContent = `O sistema buscará automaticamente o endereço de ${type.toUpperCase()}.`;
    }
}
document.querySelectorAll('input[name="destino"]').forEach(r => {
    r.addEventListener('change', updateInstructions);
});

// Boot
init();
