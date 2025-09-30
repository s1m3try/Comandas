let currentMesaId = null;
let cardapio = {};
let comandaAtual = [];

// Variáveis para o fechamento de conta
let subtotal = 0;
let descontoAplicado = 0;
let totalFinal = 0;
let itemParaEdicao = null; // Guarda o item selecionado para editar/remover

// --- Funções de Ajuda ---

// Formata um número para o formato monetário BRL
const formatarMoeda = (valor) => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// --- Funções de Interface ---

// Atualiza o título e exibe a seção da comanda
const showComanda = (mesaId) => {
    currentMesaId = mesaId;
    document.getElementById('comanda-mesa-titulo').textContent = `Comanda da Mesa ${mesaId}`;
    document.getElementById('comanda-section').classList.remove('hidden');
    document.querySelectorAll('.mesa-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.mesaId === mesaId) {
            btn.classList.add('active');
        }
    });
};

// Preenche o Select do Cardápio
const preencherCardapio = (data) => {
    cardapio = data;
    const select = document.getElementById('select-cardapio');
    select.innerHTML = '';
    for (const id in cardapio) {
        const item = cardapio[id];
        const option = document.createElement('option');
        option.value = id;
        option.textContent = `${item.nome} (${formatarMoeda(item.valor)})`;
        select.appendChild(option);
    }
};

// Desenha a lista de itens da comanda e calcula os totais
const renderComanda = () => {
    const lista = document.getElementById('itens-lancados-lista');
    lista.innerHTML = '';
    subtotal = 0;

    if (comandaAtual.length === 0) {
        lista.innerHTML = '<li>Nenhum item lançado.</li>';
        document.getElementById('subtotal').textContent = formatarMoeda(0);
        document.getElementById('total-final').textContent = formatarMoeda(0);
        return;
    }

    comandaAtual.forEach(item => {
        const li = document.createElement('li');
        const valorTotalItem = item.valor_unitario * item.quantidade;
        subtotal += valorTotalItem;

        li.innerHTML = `
            <span class="item-info">${item.quantidade}x ${item.nome} (${formatarMoeda(item.valor_unitario)})</span>
            <span class="item-valor">${formatarMoeda(valorTotalItem)}</span>
        `;
        li.dataset.itemId = item.id; // Guarda o ID único do item na comanda
        li.addEventListener('click', () => openModal(item));
        lista.appendChild(li);
    });

    // Re-aplica o desconto (se houver) e atualiza os totais
    aplicarDesconto(document.getElementById('input-desconto').value, document.getElementById('select-desconto-tipo').value, false);
};

// Atualiza apenas os valores de resumo (Subtotal, Desconto, Total)
const updateResumo = () => {
    document.getElementById('subtotal').textContent = formatarMoeda(subtotal);
    document.getElementById('valor-desconto-aplicado').textContent = formatarMoeda(descontoAplicado);
    document.getElementById('total-final').textContent = formatarMoeda(totalFinal);
};

// --- Funções da API ---

// Carrega os dados da mesa selecionada
const loadMesa = async (mesaId) => {
    try {
        const response = await fetch(`/mesa/${mesaId}`);
        if (!response.ok) throw new Error('Falha ao carregar mesa');
        comandaAtual = await response.json();
        renderComanda();
    } catch (error) {
        console.error('Erro ao carregar mesa:', error);
        comandaAtual = [];
        renderComanda();
    }
};

// Adiciona um item via API
const addItem = async () => {
    const itemCardapioId = document.getElementById('select-cardapio').value;
    const quantidade = parseInt(document.getElementById('input-quantidade').value);

    if (!currentMesaId || !itemCardapioId || quantidade < 1) return;

    // Gera um ID único simples (timestamp) para o item no pedido
    const itemPedidoId = Date.now(); 

    try {
        const response = await fetch('/adicionar_item', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mesa_id: currentMesaId,
                item_id: itemCardapioId,
                quantidade: quantidade,
                id: itemPedidoId
            })
        });

        if (response.ok) {
            const result = await response.json();
            comandaAtual.push(result.item);
            renderComanda();
            document.getElementById('input-quantidade').value = 1; // Reseta a quantidade
        } else {
            alert('Erro ao adicionar item.');
        }
    } catch (error) {
        console.error('Erro de rede ao adicionar item:', error);
    }
};

// Remove um item via API
const removeItem = async (itemPedidoId) => {
    if (!currentMesaId || !itemPedidoId) return;

    try {
        const response = await fetch('/remover_item', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mesa_id: currentMesaId,
                item_pedido_id: itemPedidoId
            })
        });

        if (response.ok) {
            comandaAtual = comandaAtual.filter(item => item.id !== itemPedidoId);
            renderComanda();
            closeModal();
        } else {
            alert('Erro ao remover item.');
        }
    } catch (error) {
        console.error('Erro de rede ao remover item:', error);
    }
};

// Edita o valor de um item via API
const editItemValue = async (itemPedidoId, novoValor) => {
    if (!currentMesaId || !itemPedidoId || novoValor <= 0) return;

    try {
        const response = await fetch('/editar_valor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mesa_id: currentMesaId,
                item_pedido_id: itemPedidoId,
                novo_valor: parseFloat(novoValor)
            })
        });

        if (response.ok) {
            const result = await response.json();
            // Atualiza o item localmente
            const index = comandaAtual.findIndex(item => item.id === itemPedidoId);
            if (index !== -1) {
                comandaAtual[index].valor_unitario = result.item.valor_unitario;
            }
            renderComanda();
            closeModal();
        } else {
            alert('Erro ao editar valor.');
        }
    } catch (error) {
        console.error('Erro de rede ao editar valor:', error);
    }
};


// Aplica o desconto e recalcula os totais (não salva no backend, apenas calcula)
const aplicarDesconto = (valorDesconto, tipo, showMessage = true) => {
    let valor = parseFloat(valorDesconto);
    if (isNaN(valor) || valor < 0) valor = 0;
    
    totalFinal = subtotal;
    descontoAplicado = 0;

    if (tipo === 'R$') {
        descontoAplicado = Math.min(valor, subtotal); // Desconto máximo é o subtotal
    } else if (tipo === '%') {
        descontoAplicado = subtotal * (valor / 100);
    }

    totalFinal = subtotal - descontoAplicado;

    if (totalFinal < 0) totalFinal = 0; // Garantir que não fique negativo

    updateResumo();
    if (showMessage) {
        alert(`Desconto de ${formatarMoeda(descontoAplicado)} aplicado. Total: ${formatarMoeda(totalFinal)}`);
    }
};

// Fecha a conta via API
const fecharConta = async () => {
    if (!currentMesaId || comandaAtual.length === 0) {
        alert("A comanda está vazia ou nenhuma mesa selecionada.");
        return;
    }

    if (!confirm(`Confirmar o fechamento da Mesa ${currentMesaId} com Total de ${formatarMoeda(totalFinal)}?`)) return;

    const descontoInput = document.getElementById('input-desconto');
    const descontoTipo = document.getElementById('select-desconto-tipo').value;

    try {
        const response = await fetch('/fechar_conta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mesa_id: currentMesaId,
                desconto_tipo: descontoTipo,
                desconto_valor: parseFloat(descontoInput.value || 0)
            })
        });

        if (response.ok) {
            const result = await response.json();
            alert(`Conta da Mesa ${currentMesaId} fechada! Subtotal: ${formatarMoeda(result.subtotal)}, Desconto: ${formatarMoeda(result.valor_desconto)}, Total Final: ${formatarMoeda(result.total_final)}.`);
            
            // Limpa a interface
            comandaAtual = [];
            renderComanda();
            descontoInput.value = '';
            document.getElementById('select-desconto-tipo').value = 'R$';
            document.getElementById('comanda-section').classList.add('hidden');
            currentMesaId = null;
            document.querySelectorAll('.mesa-btn').forEach(btn => btn.classList.remove('active'));
        } else {
            alert('Erro ao fechar conta.');
        }
    } catch (error) {
        console.error('Erro de rede ao fechar conta:', error);
        alert('Erro de comunicação com o servidor ao fechar conta.');
    }
};


// --- Funções do Modal ---

// Abre o modal de edição/remoção
const openModal = (item) => {
    itemParaEdicao = item;
    document.getElementById('modal-item-nome').textContent = `${item.nome} (${formatarMoeda(item.valor_unitario)})`;
    document.getElementById('modal-novo-valor').value = item.valor_unitario.toFixed(2);
    document.getElementById('modal-edicao').classList.remove('hidden');
};

// Fecha o modal
const closeModal = () => {
    document.getElementById('modal-edicao').classList.add('hidden');
    itemParaEdicao = null;
};


// --- Inicialização e Event Listeners ---

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Carregar Cardápio
    try {
        const response = await fetch('/cardapio');
        if (response.ok) {
            const data = await response.json();
            preencherCardapio(data);
        }
    } catch (error) {
        console.error('Erro ao carregar cardápio:', error);
        alert('Não foi possível carregar o cardápio.');
    }

    // 2. Listeners para as Mesas
    document.querySelectorAll('.mesa-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mesaId = e.target.dataset.mesaId;
            showComanda(mesaId);
            loadMesa(mesaId);
        });
    });

    // 3. Listeners para Comanda
    document.getElementById('btn-adicionar-item').addEventListener('click', addItem);
    
    document.getElementById('btn-aplicar-desconto').addEventListener('click', () => {
        const valor = document.getElementById('input-desconto').value;
        const tipo = document.getElementById('select-desconto-tipo').value;
        aplicarDesconto(valor, tipo);
    });
    
    document.getElementById('btn-fechar-conta').addEventListener('click', fecharConta);

    // 4. Listeners para o Modal
    document.getElementById('btn-fechar-modal').addEventListener('click', closeModal);
    
    document.getElementById('btn-remover-item').addEventListener('click', () => {
        if (itemParaEdicao && confirm(`Deseja realmente remover 1x ${itemParaEdicao.nome}?`)) {
            removeItem(itemParaEdicao.id);
        }
    });

    document.getElementById('btn-salvar-edicao').addEventListener('click', () => {
        const novoValor = document.getElementById('modal-novo-valor').value;
        if (itemParaEdicao && parseFloat(novoValor) > 0) {
            editItemValue(itemParaEdicao.id, novoValor);
        } else {
            alert('O valor deve ser maior que zero.');
        }
    });
});