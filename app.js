const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.static('public')); // Para servir arquivos estáticos

// Middleware para definir a política de segurança de conteúdo
app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", "default-src 'self'; connect-src 'self'; script-src 'self' 'unsafe-inline';");
    next();
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});

// Rota para a página de login
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/login.html');
});

// Rota para login
app.post('/login', (req, res) => {
    const { username, senha } = req.body;

    fs.readFile('data/players.json', 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ message: 'Erro ao ler os dados.' });
        }

        const players = JSON.parse(data).jogadores;
        const player = players.find(p => p.username === username && p.senha === senha);

        if (player) {
            if (player.username === 'Mestre') {
                return res.status(200).json({ message: 'Login bem-sucedido!', saldo: player.saldo, isMestre: true, redirect: '/dashboard-mestre' });
            }
            return res.status(200).json({ message: 'Login bem-sucedido!', saldo: player.saldo });
        } else {
            return res.status(401).json({ message: 'Usuário ou senha incorretos.' });
        }
    });
});

// Rota para transferir dinheiro
app.post('/transfer', (req, res) => {
    const { destinatario, valor, username } = req.body;

    fs.readFile('data/players.json', 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ message: 'Erro ao ler os dados.' });
        }

        const players = JSON.parse(data).jogadores;
        const jogadorOrigem = players.find(p => p.username === username);
        const jogadorDestino = players.find(p => p.username === destinatario);

        if (!jogadorOrigem || !jogadorDestino) {
            return res.status(404).json({ message: 'Jogador origem ou destinatário não encontrado.' });
        }

        const valorNumerico = Number(valor);
        if (isNaN(valorNumerico) || valorNumerico <= 0) {
            return res.status(400).json({ message: 'Valor inválido.' });
        }

        // Verifica se o jogador está tentando transferir para si mesmo
        if (jogadorOrigem.username === jogadorDestino.username) {
            return res.status(400).json({ message: 'Você não pode transferir dinheiro para si mesmo.' });
        }

        // Verifica se o saldo do jogador de origem é suficiente
        if (jogadorOrigem.saldo < valorNumerico) {
            return res.status(400).json({ message: 'Saldo insuficiente para a transferência.' });
        }

        // Realizar a transferência
        jogadorOrigem.saldo -= valorNumerico;
        jogadorDestino.saldo += valorNumerico;

        // Atualizar o arquivo JSON
        fs.writeFile('data/players.json', JSON.stringify({ jogadores: players }), (err) => {
            if (err) {
                return res.status(500).json({ message: 'Erro ao atualizar os dados.' });
            }

            // Registrar a transação após a atualização
            registrarTransacao(jogadorOrigem.username, jogadorDestino.username, valorNumerico, res);
        });
    });
});

// Função para registrar transações
function registrarTransacao(remetente, destinatario, valor, res) {
    fs.readFile('data/transacoes.json', 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ message: 'Erro ao ler os dados das transações.' });
        }

        const transacoes = JSON.parse(data || '{"transacoes": []}').transacoes;
        transacoes.push({ remetente, destinatario, valor: Number(valor), data: new Date().toISOString() });

        fs.writeFile('data/transacoes.json', JSON.stringify({ transacoes }), (err) => {
            if (err) {
                return res.status(500).json({ message: 'Erro ao atualizar os dados das transações.' });
            }

            return res.status(200).json({ message: 'Transferência e transação registradas com sucesso!' });
        });
    });
}

// Rota para visualizar todos os jogadores e seus saldos
app.get('/saldo-jogadores', (req, res) => {
    fs.readFile('data/players.json', 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ message: 'Erro ao ler os dados.' });
        }

        const players = JSON.parse(data).jogadores;
        return res.status(200).json(players);
    });
});

// Rota para o dashboard do mestre
app.get('/dashboard-mestre', (req, res) => {
    res.sendFile(__dirname + '/public/mestre.html');
});

// Rota para modificar o saldo
app.post('/modificar-saldo', (req, res) => {
    const { jogador, valor, acao } = req.body;  // Mudança aqui para capturar 'acao'

    fs.readFile('data/players.json', 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ message: 'Erro ao ler os dados.' });
        }

        const players = JSON.parse(data).jogadores;
        const jogadorEncontrado = players.find(p => p.username === jogador);

        if (!jogadorEncontrado) {
            return res.status(404).json({ message: 'Jogador não encontrado.' });
        }

        const valorNumerico = Number(valor);
        if (isNaN(valorNumerico)) {
            return res.status(400).json({ message: 'Valor inválido.' });
        }

        // Verifica a ação (aumentar ou diminuir) e modifica o saldo
        if (acao === 'aumentar') {
            jogadorEncontrado.saldo += valorNumerico;
        } else if (acao === 'diminuir') {
            // Permite que o saldo fique negativo
            jogadorEncontrado.saldo -= valorNumerico;
        } else {
            return res.status(400).json({ message: 'Ação inválida.' });
        }

        // Atualizar o arquivo JSON com o novo saldo
        fs.writeFile('data/players.json', JSON.stringify({ jogadores: players }), (err) => {
            if (err) {
                return res.status(500).json({ message: 'Erro ao atualizar os dados.' });
            }

            return res.status(200).json({ message: 'Saldo modificado com sucesso!', saldo: jogadorEncontrado.saldo });
        });
    });
});

// Rota para obter transações
app.get('/transacoes', (req, res) => {
    fs.readFile('data/transacoes.json', 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ message: 'Erro ao ler os dados das transações.' });
        }

        const transacoes = JSON.parse(data || '{"transacoes": []}').transacoes;
        return res.status(200).json(transacoes);
    });
});

// Rota para obter o saldo de um jogador específico
app.get('/saldo/:username', (req, res) => {
    const username = req.params.username;

    fs.readFile('data/players.json', 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ message: 'Erro ao ler os dados.' });
        }

        const players = JSON.parse(data).jogadores;
        const player = players.find(p => p.username === username);

        if (player) {
            return res.status(200).json({ success: true, saldo: player.saldo });
        } else {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }
    });
});

// Rota para apostas do Jokenpo
app.post('/apostar', (req, res) => {
    const { username, valorAposta, jogada, jogadaComputador, resultado, ganho } = req.body;

    fs.readFile('data/players.json', 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ message: 'Erro ao ler os dados.' });
        }

        const players = JSON.parse(data).jogadores;
        const player = players.find(p => p.username === username);

        if (!player) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }

        const valorApostaNumerico = Number(valorAposta);
        const ganhoNumerico = Number(ganho);

        if (isNaN(valorApostaNumerico) || isNaN(ganhoNumerico)) {
            return res.status(400).json({ message: 'Valor da aposta ou ganho inválido.' });
        }

        // Atualizar saldo de acordo com o ganho ou perda
        player.saldo += ganhoNumerico;

        // Atualizar o arquivo JSON com o novo saldo
        fs.writeFile('data/players.json', JSON.stringify({ jogadores: players }), (err) => {
            if (err) {
                return res.status(500).json({ message: 'Erro ao atualizar os dados.' });
            }

            // Registrar a aposta como uma transação
            registrarTransacao(username, 'Jokenpo', ganhoNumerico, res);
        });
    });
});


/// DESAFIAR JOGADORES

const express = require('express');
const app = express();

let partidas = {}; // Armazena partidas em andamento { id: { jogador1, jogador2, jogada1, jogada2, resultado }}

app.use(express.json());

// Iniciar uma nova partida
app.post('/iniciar-partida', (req, res) => {
    const { jogador1, jogador2 } = req.body;
    const partidaId = Math.random().toString(36).substr(2, 9); // Gerar ID único
    partidas[partidaId] = { jogador1, jogador2, jogada1: null, jogada2: null, resultado: null };
    res.json({ partidaId });
});

// Jogador faz sua jogada
app.post('/jogar/:partidaId', (req, res) => {
    const { partidaId } = req.params;
    const { jogador, jogada } = req.body;

    const partida = partidas[partidaId];
    if (!partida) return res.status(404).json({ error: 'Partida não encontrada' });

    if (partida.jogador1 === jogador) {
        partida.jogada1 = jogada;
    } else if (partida.jogador2 === jogador) {
        partida.jogada2 = jogada;
    }

    // Verificar se ambos jogaram
    if (partida.jogada1 && partida.jogada2) {
        const resultado = calcularResultado(partida.jogada1, partida.jogada2);
        partida.resultado = resultado;
        res.json({ resultado });
    } else {
        res.json({ message: 'Esperando o outro jogador...' });
    }
});

function calcularResultado(jogada1, jogada2) {
    const jogadas = { pedra: 'tesoura', papel: 'pedra', tesoura: 'papel' };
    if (jogada1 === jogada2) return 'empate';
    if (jogadas[jogada1] === jogada2) return 'jogador1 ganhou';
    return 'jogador2 ganhou';
}

app.listen(3000, () => {
    console.log('Servidor rodando na porta 3000');
});
