# 🤖 FuteboliA: Guia de Integração para IAs

Este documento descreve como uma Inteligência Artificial deve interagir com o servidor do FuteboliA para perceber o estado do jogo e executar ações.

## 📡 Visão Geral da Comunicação

A comunicação é feita via requisições **HTTP REST**. A IA deve operar em um loop de:
1. **Percepção**: Obter o estado atual (`GET /state`).
2. **Raciocínio**: Analisar posições de jogadores e bola.
3. **Ação**: Enviar um comando de movimento ou chute (`POST /action`).

---

## 🔍 1. Percepção (Obter Estado)

A IA deve consultar o endpoint abaixo para entender o que está acontecendo no campo.

**Endpoint:** `GET /state?roomId=1v1` (ou `play`/`train`)

### Formato da Resposta (JSON):
```json
{
  "fieldSize": { "width": 200, "height": 300 },
  "ball": { "x": 10, "y": 3, "z": -40, "isMoving": false },
  "posse_de_bola": false,
  "players": [
    {
      "id": 1,
      "team": "A",
      "x": 0,
      "z": 140,
      "facingX": 0,
      "facingZ": -1,
      "pos_xadrez": "E14"
    },
    ...
  ],
  "score": { "A": 0, "B": 2 },
  "gameTime": 240,
  "isGoal": false
}
```

### Elementos Chave para a IA:
- **Coordenadas**: O campo vai de **X: -100 a 100** e **Z: -150 a 150**.
- **Equipes**: 
    - **Time A (Brasil)**: Defende o lado `Z=150` e ataca para `Z=-150`.
    - **Time B (Argentina)**: Defende o lado `Z=-150` e ataca para `Z=150`.
- **Eixo Y**: Altura da bola. Se `y > 20`, a bola está no ar (difícil de interceptar).
- **Coordenadas de Xadrez**: Para facilitar a percepção espacial, o servidor também envia posições mapeadas em um grid de **A-J** (largura) e **1-15** (comprimento).
- **Posse de Bola**: O campo `posse_de_bola` indica se o jogador atual está perto o suficiente para chutar ou puxar.

---

## 🎮 2. Execução de Ações

Para atuar, a IA deve enviar um objeto JSON.

**Endpoint:** `POST /action`

### Exemplo de Movimento (Simplificado):
```json
{
  "roomId": "1v1",
  "playerId": 2,
  "type": "move",
  "target": "F8",
  "thinking": "Indo interceptar!",
  "isManual": true
}
```
- `target`: O quadrado de xadrez para onde você quer dar o próximo passo (ex: `A1`, `J15`). O sistema calculará automaticamente o melhor passo (incluindo diagonais).
- `thinking`: **Opcional**. O texto enviado aqui aparecerá em um balão de fala sobre o jogador.
- `isManual`: **Obrigatório** para assumir o controle e desativar a IA interna temporariamente.

### Exemplo de Chute:
```json
{
  "roomId": "1v1",
  "playerId": 2,
  "type": "kick",
  "power": 2
}
```
- `power`: 
    - `1`: Curto/Rasteiro (80 unidades).
    - `2`: Médio/Médio (160 unidades).
    - `3`: Longo/Alto (260 unidades).
- **Nota**: O chute é disparado na direção que o jogador está olhando (`facingX`/`facingZ`).

### Exemplo de Puxada:
```json
{
  "roomId": "1v1",
  "playerId": 2,
  "type": "pull"
}
```
- **Nota**: A ação `pull` (puxar) faz a bola passar por "baixo" das pernas do jogador, indo para a posição oposta à atual em relação a ele. Útil para buscar a bola quando você passou dela ou para driblar o adversário. Só funciona se o jogador estiver adjacente à bola.

---

## 🧠 3. Dicas Técnicas para a IA

1. **Loop de Controle**: O servidor processa a física a cada **50ms (20 FPS)**. Não adianta enviar comandos mais rápido que isso; um intervalo de 100ms a 200ms por ação é o ideal.
2. **Condução de Bola**: Se você se mover para a mesma casa que a bola, você a "empurrará".
3. **Mapeamento 1v1**: No modo Mano a Mano:
    - `playerId: 1` controla o Brasil (Time A).
    - `playerId: 2` (via API) controla a Argentina (Time B / ID Interno 6).
4. **Balões de Fala Multilinha**: O servidor agora quebra o texto do campo `thinking` (ou `text`) automaticamente se for muito longo, permitindo que a IA expresse raciocínios mais complexos sem poluir visualmente o campo.
5. **Cálculo de Distância**: Use a distância de Manhattan ou Euclidiana para decidir se deve correr para a bola ou voltar para a defesa.

---

## 🛠️ Exemplo em Python (Snippet)

```python
import requests
import time

URL = "http://localhost:3000"

def play_loop():
    while True:
        # 1. Ver
        state = requests.get(f"{URL}/state?roomId=1v1").json()
        ball = state['ball']
        me = next(p for p in state['players'] if p['id'] == 1)
        
        # 2. Pensar (Lógica simples: perseguir a bola)
        dx = 1 if ball['x'] > me['x'] else -1 if ball['x'] < me['x'] else 0
        dz = 1 if ball['z'] > me['z'] else -1 if ball['z'] < me['z'] else 0
        
        # 3. Agir
        requests.post(f"{URL}/action", json={
            "roomId": "1v1",
            "playerId": 1,
            "type": "move",
            "dx": dx, "dz": dz,
            "isManual": True
        })
        
        time.sleep(0.1) # Aguarda 100ms
```

---

## ⚠️ 4. Problemas Comuns (Pitfalls)

1. **Hallucinação de Comandos**: A IA **NUNCA** deve enviar comandos como `kick(1)` ou `move(1, 0)`. Toda comunicação deve ser um **JSON válido**.
   - **Errado**: `{"action": "kick(2)"}`
   - **Certo**: `{"type": "kick", "power": 2}`
2. **Campos Extras**: Não invente campos no JSON. Siga estritamente o esquema esperado (`type`, `dx`, `dz`, `power`, `thinking`).
3. **Ponto Flutuante**: Para `dx` e `dz`, use apenas `-1`, `0` ou `1`. O servidor não processa frações nessas ações discretas.
