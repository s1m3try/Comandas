from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# --- Dados do Sistema (Em memória para este protótipo) ---

# Cardápio
CARDAPIO = {
    "1": {"nome": "Pizza Calabresa", "valor": 45.00},
    "2": {"nome": "Refrigerante Lata", "valor": 7.00},
    "3": {"nome": "Cerveja Long Neck", "valor": 12.00},
    "4": {"nome": "Água Mineral", "valor": 4.00},
    "5": {"nome": "Porção Batata Frita", "valor": 28.00},
}

# Controle de Mesas
MESAS = {
    "1": [],  # Lista de itens do pedido da Mesa 1
    "2": [],
    "3": [],
    "4": [],
}
# Cada item no pedido terá a estrutura:
# {"id": <timestamp>, "item_id": "1", "nome": "...", "valor_unitario": 45.00, "quantidade": 1}

# --- Rotas da API ---

@app.route('/')
def index():
    # Renderiza a página principal
    return render_template('index.html', mesas=MESAS.keys())

@app.route('/cardapio', methods=['GET'])
def get_cardapio():
    # Retorna o cardápio completo
    return jsonify(CARDAPIO)

@app.route('/mesa/<mesa_id>', methods=['GET'])
def get_mesa(mesa_id):
    # Retorna os itens de uma mesa específica
    if mesa_id in MESAS:
        return jsonify(MESAS[mesa_id])
    return jsonify({"error": "Mesa não encontrada"}), 404

@app.route('/adicionar_item', methods=['POST'])
def adicionar_item():
    data = request.json
    mesa_id = data.get('mesa_id')
    item_id = data.get('item_id')
    quantidade = int(data.get('quantidade', 1))

    if mesa_id not in MESAS or item_id not in CARDAPIO:
        return jsonify({"error": "Dados inválidos"}), 400

    item_cardapio = CARDAPIO[item_id]
    novo_item = {
        "id": request.json['id'], # ID gerado no frontend (timestamp)
        "item_id": item_id,
        "nome": item_cardapio["nome"],
        "valor_unitario": item_cardapio["valor"],
        "quantidade": quantidade
    }
    MESAS[mesa_id].append(novo_item)
    return jsonify({"success": True, "item": novo_item})

@app.route('/remover_item', methods=['POST'])
def remover_item():
    data = request.json
    mesa_id = data.get('mesa_id')
    item_pedido_id = data.get('item_pedido_id') # ID único do item na comanda (timestamp)

    if mesa_id not in MESAS:
        return jsonify({"error": "Mesa não encontrada"}), 404

    # Encontra e remove o item
    MESAS[mesa_id] = [item for item in MESAS[mesa_id] if item["id"] != item_pedido_id]

    return jsonify({"success": True})

@app.route('/editar_valor', methods=['POST'])
def editar_valor():
    data = request.json
    mesa_id = data.get('mesa_id')
    item_pedido_id = data.get('item_pedido_id')
    novo_valor = float(data.get('novo_valor'))

    if mesa_id not in MESAS:
        return jsonify({"error": "Mesa não encontrada"}), 404

    for item in MESAS[mesa_id]:
        if item["id"] == item_pedido_id:
            item["valor_unitario"] = novo_valor # Altera o valor
            return jsonify({"success": True, "item": item})

    return jsonify({"error": "Item não encontrado na mesa"}), 404

@app.route('/fechar_conta', methods=['POST'])
def fechar_conta():
    data = request.json
    mesa_id = data.get('mesa_id')
    desconto_tipo = data.get('desconto_tipo') # "R$" ou "%"
    desconto_valor = float(data.get('desconto_valor', 0))

    if mesa_id not in MESAS:
        return jsonify({"error": "Mesa não encontrada"}), 404

    itens = MESAS[mesa_id]
    subtotal = sum(item['valor_unitario'] * item['quantidade'] for item in itens)
    valor_desconto = 0

    if desconto_tipo == 'R$':
        valor_desconto = min(desconto_valor, subtotal) # Não deixa o desconto ser maior que o subtotal
    elif desconto_tipo == '%':
        valor_desconto = subtotal * (desconto_valor / 100)

    total_final = subtotal - valor_desconto

    # NOTA: Em um sistema real, aqui você registraria o fechamento no banco de dados.
    # Para este protótipo, vamos apenas limpar a mesa.
    MESAS[mesa_id] = [] # Limpa a mesa após o fechamento

    return jsonify({
        "success": True,
        "subtotal": subtotal,
        "valor_desconto": valor_desconto,
        "total_final": total_final,
        "itens_fechados": itens
    })


if __name__ == '__main__':
    # Define o host para 0.0.0.0 para que possa ser acessado de dispositivos na rede (como o celular)
    app.run(debug=True, host='0.0.0.0')