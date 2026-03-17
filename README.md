# ⚽ FuteboliA - Jogo de Futebol com IA

Simulador de futebol minimalista em 3D usando **Node.js**, **Express**, **Socket.io** e **Three.js**. O jogo permite controle manual dos jogadores via API REST ou WebSockets, com suporte a comportamentos de IA para os jogadores não controlados.

## 🚀 Como Iniciar

1.  Instale as dependências:
    ```bash
    npm install
    ```
2.  Inicie o servidor:
    ```bash
    npm run start
    ```
3.  Acesse o simulador: `http://localhost:3000`

## 🕹️ Painel de Teste da API

Existe um dashboard dedicado para testar os comandos e visualizar o estado do jogo via API:
- URL: `http://localhost:3000/api-test.html`

## 🔌 API de Integração

### 📊 Obter Estado do Jogo (GET)
Retorna o estado completo da partida, incluindo posição da bola, jogadores e placar.
- **Endpoint**: `/state`
- **Exemplo**: `curl http://localhost:3000/state`

### 🎮 Enviar Ação (POST)
Envia comandos para um jogador específico.
- **Endpoint**: `/action`
- **Content-Type**: `application/json`
- **Body**:
  ```json
  {
    "playerId": 1,
    "type": "move",
    "dx": 1,
    "dz": 0,
    "isManual": true
  }
  ```

#### Tipos de Ação:
- `move`: Movimenta o jogador (`dx`, `dz`).
- `kick`: Realiza um chute (`power`: 1-Curto, 2-Médio, 3-Longo).
- `speak`: Exibe um balão de fala (`text`).
- `config`: Altera nome ou número do jogador (`name`, `number`).

## ⚙️ Regras e Limites Atuais

- **Nomes de Jogadores**: Máximo de 50 caracteres (Front-end renderiza dinamicamente).
- **Balões de Fala**: Máximo de 100 caracteres.
- **Refresh Rate**: O servidor processa a física a 20 ticks por segundo.

## 📁 Estrutura do Projeto

- `/public`: Arquivos estáticos (HTML, CSS, JS do front-end).
- `/src`: Lógica central do simulador (`game-engine.js`).
- `server.js`: Configuração do servidor Express e Socket.io.

## 🔒 Segurança

- O projeto não contém chaves de API ou segredos.
- O `.gitignore` está configurado para evitar o commit de `node_modules` e arquivos temporários.
