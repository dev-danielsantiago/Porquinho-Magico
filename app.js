const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.static('public'));
app.use('/data', express.static(path.join(__dirname, 'data')));

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
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Rota para login
app.post('/login', (req, res) => {
    const { username, senha } = req.body;

    fs.readFile(path.join(__dirname, 'data', 'players.json'), 'utf8', (err, data) => {
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

    fs.readFile(path.join(__dirname, 'data', 'players.json'), 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ message: 'Erro ao ler os dados.' });
        }

        const players = JSON.parse(data).jogadores;
        const player = players.find(p => p.username === username);
        const recipient = players.find(p => p.username === destinatario);

        if (player && recipient) {
            if (player.saldo >= valor) {
                player.saldo -= valor;
                recipient.saldo += valor;

                fs.writeFile(path.join(__dirname, 'data', 'players.json'), JSON.stringify({ jogadores: players }, null, 2), (err) => {
                    if (err) {
                        return res.status(500).json({ message: 'Erro ao salvar os dados.' });
                    }
                    return res.status(200).json({ message: 'Transferência realizada com sucesso.' });
                });
            } else {
                return res.status(400).json({ message: 'Saldo insuficiente.' });
            }
        } else {
            return res.status(404).json({ message: 'Jogador não encontrado.' });
        }
    });
});

// Rota para obter o saldo do jogador
app.get('/saldo/:username', (req, res) => {
    const username = req.params.username;

    fs.readFile(path.join(__dirname, 'data', 'players.json'), 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Erro ao ler os dados dos jogadores.' });
        }

        const players = JSON.parse(data).jogadores;
        const player = players.find(p => p.username === username);

        if (player) {
            return res.status(200).json({ success: true, saldo: player.saldo });
        } else {
            return res.status(404).json({ success: false, message: 'Jogador não encontrado.' });
        }
    });
});

// Rota para o dashboard do mestre
app.get('/dashboard-mestre', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'mestre.html'));
});

// Rota para obter a lista de jogadores e seus saldos (para o painel mestre)
app.get('/saldo-jogadores', (req, res) => {
    fs.readFile(path.join(__dirname, 'data', 'players.json'), 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Erro ao ler os dados dos jogadores.' });
        }

        const players = JSON.parse(data).jogadores;
        return res.status(200).json({ success: true, jogadores: players });
    });
});

// Rota para o jogo de Jokenpo (Aposta)
app.post('/apostar', (req, res) => {
    const { jogador, valorApostado, escolhaJogador } = req.body;

    const opcoes = ['pedra', 'papel', 'tesoura'];
    const escolhaServidor = opcoes[Math.floor(Math.random() * opcoes.length)];

    const determinarVencedor = (jogadorEscolha, servidorEscolha) => {
        if (jogadorEscolha === servidorEscolha) return 'empate';
        if (
            (jogadorEscolha === 'pedra' && servidorEscolha === 'tesoura') ||
            (jogadorEscolha === 'papel' && servidorEscolha === 'pedra') ||
            (jogadorEscolha === 'tesoura' && servidorEscolha === 'papel')
        ) {
            return 'jogador';
        }
        return 'servidor';
    };

    const resultado = determinarVencedor(escolhaJogador, escolhaServidor);

    fs.readFile(path.join(__dirname, 'data', 'players.json'), 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ message: 'Erro ao ler os dados dos jogadores.' });
        }

        const players = JSON.parse(data).jogadores;
        const player = players.find(p => p.username === jogador);

        if (!player) {
            return res.status(404).json({ message: 'Jogador não encontrado.' });
        }

        let mensagem;
        let ganho = 0;

        if (resultado === 'jogador') {
            ganho = valorApostado * 7;
            player.saldo += ganho;
            mensagem = `Parabéns, você ganhou ${ganho}! Sua escolha: ${escolhaJogador}, Escolha do servidor: ${escolhaServidor}`;
        } else if (resultado === 'servidor') {
            ganho = -valorApostado * 2;
            player.saldo += ganho;
            mensagem = `Você perdeu ${-ganho}! Sua escolha: ${escolhaJogador}, Escolha do servidor: ${escolhaServidor}`;
        } else {
            mensagem = `Empate! Ambos escolheram: ${escolhaJogador}`;
        }

        fs.writeFile(path.join(__dirname, 'data', 'players.json'), JSON.stringify({ jogadores: players }, null, 2), (err) => {
            if (err) {
                return res.status(500).json({ message: 'Erro ao salvar os dados.' });
            }

            return res.status(200).json({
                mensagem,
                escolhaServidor,
                escolhaJogador,
                resultado,
                novoSaldo: player.saldo
            });
        });
    });
});

// Rota para modificar o saldo de um jogador (usada pelo mestre)
app.post('/modificar-saldo', (req, res) => {
    const { jogador, valor, acao } = req.body;

    fs.readFile(path.join(__dirname, 'data', 'players.json'), 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ message: 'Erro ao ler os dados dos jogadores.' });
        }

        const players = JSON.parse(data).jogadores;
        const player = players.find(p => p.username === jogador);

        if (!player) {
            return res.status(404).json({ message: 'Jogador não encontrado.' });
        }

        if (acao === 'aumentar') {
            player.saldo += parseFloat(valor);
        } else if (acao === 'diminuir') {
            player.saldo -= parseFloat(valor);
        } else {
            return res.status(400).json({ message: 'Ação inválida.' });
        }

        fs.writeFile(path.join(__dirname, 'data', 'players.json'), JSON.stringify({ jogadores: players }, null, 2), (err) => {
            if (err) {
                return res.status(500).json({ message: 'Erro ao salvar os dados.' });
            }

            return res.status(200).json({ message: 'Saldo modificado com sucesso!', saldoAtual: player.saldo });
        });
    });
});

// Rota para enviar presente de um jogador para outro
app.post('/presentear', (req, res) => {
    const { remetente, destinatario, tipoCaixa, valor } = req.body;

    fs.readFile(path.join(__dirname, 'data', 'players.json'), 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ message: 'Erro ao ler os dados dos jogadores.' });
        }

        const players = JSON.parse(data).jogadores;
        const playerRemetente = players.find(p => p.username === remetente);
        const playerDestinatario = players.find(p => p.username === destinatario);

        if (!playerRemetente || !playerDestinatario) {
            return res.status(404).json({ message: 'Jogador não encontrado.' });
        }

        if (playerRemetente.saldo < valor) {
            return res.status(400).json({ message: 'Saldo insuficiente para enviar o presente.' });
        }

        playerRemetente.saldo -= valor;

        // Aqui você deve ler os itens disponíveis e selecionar um aleatório.
        fs.readFile(path.join(__dirname, 'data', 'itens.json'), 'utf8', (err, itensData) => {
            if (err) {
                return res.status(500).json({ message: 'Erro ao ler os itens.' });
            }

            const caixas = JSON.parse(itensData).caixas;
            const caixaSelecionada = caixas.find(caixa => caixa.tipoCaixa === tipoCaixa);

            if (!caixaSelecionada) {
                return res.status(404).json({ message: 'Tipo de caixa não encontrado.' });
            }

            const itemAleatorio = caixaSelecionada.itens[Math.floor(Math.random() * caixaSelecionada.itens.length)];

            if (!playerDestinatario.presentes) {
                playerDestinatario.presentes = [];
            }
            playerDestinatario.presentes.push({
                tipo: tipoCaixa,
                item: itemAleatorio.nome,
                tipoItem: itemAleatorio.tipo,
                descricao: itemAleatorio.descricao,
                imagem: itemAleatorio.imagem,
                valor,
                data: new Date()
            });

            fs.writeFile(path.join(__dirname, 'data', 'players.json'), JSON.stringify({ jogadores: players }, null, 2), (err) => {
                if (err) {
                    return res.status(500).json({ message: 'Erro ao salvar os dados.' });
                }

                return res.status(200).json({
                    message: `Presente do tipo ${tipoCaixa} enviado com sucesso!`,
                    itemNome: itemAleatorio.nome,
                    tipoItem: itemAleatorio.tipo,
                    descricao: itemAleatorio.descricao,
                    imagem: itemAleatorio.imagem,
                    tipoCaixa,
                    valor,
                    data: new Date()
                });
            });
        });
    });
});

// Rota para obter os presentes recebidos de um jogador específico
app.get('/presentes-recebidos/:username', (req, res) => {
    const { username } = req.params; // Pega o nome de usuário dos parâmetros da URL

    fs.readFile(path.join(__dirname, 'data', 'players.json'), 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ message: 'Erro ao ler os dados dos jogadores.' });
        }

        const players = JSON.parse(data).jogadores;
        const player = players.find(p => p.username === username); // Encontra o jogador específico

        if (!player) {
            return res.status(404).json({ message: 'Jogador não encontrado.' });
        }

        const presentesRecebidos = player.presentes || []; // Pega os presentes recebidos do jogador

        return res.status(200).json({ presentes: presentesRecebidos });
    });
});
;

// Rota para comprar itens
app.post('/comprar', (req, res) => {
    const { username, item, preco } = req.body;

    fs.readFile(path.join(__dirname, 'data', 'players.json'), 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ message: 'Erro ao ler os dados dos jogadores.' });
        }

        const players = JSON.parse(data).jogadores;
        const player = players.find(p => p.username === username);

        if (!player) {
            return res.status(404).json({ message: 'Jogador não encontrado.' });
        }

        if (player.saldo < preco) {
            return res.status(400).json({ message: 'Saldo insuficiente para comprar o item.' });
        }

        player.saldo -= preco; // Deduz o preço do item do saldo

        fs.writeFile(path.join(__dirname, 'data', 'players.json'), JSON.stringify({ jogadores: players }, null, 2), (err) => {
            if (err) {
                return res.status(500).json({ message: 'Erro ao salvar os dados.' });
            }

            return res.status(200).json({ message: `Você comprou ${item} por ${preco} Dracmas com sucesso!` });
        });
    });
});
