require('dotenv').config();
const express = require('express');
const http = require('http');
const fs = require('fs');
const cors = require("cors")
const qrcode = require('qrcode-terminal');
const { Client, MessageMedia } = require('whatsapp-web.js');
const Groq = require('groq-sdk');

const PORT = process.env.PORT || 3000;
const DB_PATH = './db.json';
const treinamento = require('./treinamento');

const app = express();
app.use(cors())
const server = http.createServer(app);

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const whatsapp = new Client();

let currentQR = null;
let isReady = false;

// Carrega o histórico do JSON
const loadDB = () => {
  console.log('🔄 Carregando histórico do banco de dados...');
  if (!fs.existsSync(DB_PATH)) {
    console.log('📁 Banco de dados não encontrado. Criando novo...');
    return {};
  }
  const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  console.log('✅ Histórico carregado com sucesso.');
  return data;
};

// Salva o histórico no JSON
const saveDB = (db) => {
  console.log('💾 Salvando histórico no banco de dados...');
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  console.log('✅ Histórico salvo.');
};

// Cria a resposta da IA com base no histórico
const getGroqChatCompletion = async (userHistory) => {
  console.log('🧠 Enviando histórico para a IA...');
  const messages = [
    { role: "system", content: treinamento },
    ...userHistory.map(msg => ({
      role: msg.from === 'user' ? 'user' : 'assistant',
      content: msg.message
    }))
  ];

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages,
      model: "llama3-70b-8192"
    });
    const response = chatCompletion.choices[0]?.message?.content || "Desculpe, não consegui entender.";
    console.log('✅ Resposta da IA recebida:', response);
    return response;
  } catch (error) {
    console.error('❌ Erro ao obter resposta da IA:', error);
    return "Desculpe, ocorreu um erro ao tentar responder.";
  }
};

// Inicializa o QR code do WhatsApp
whatsapp.on('qr', qr => {
  currentQR = qr;
  isReady = false;
  console.log('📱 QR Code atualizado. Aguardando conexão...');
  qrcode.generate(qr, { small: true });
});

// Pronto para uso
whatsapp.on('ready', () => {
  isReady = true;
  currentQR = null;  // Limpa o QR code após a conexão
  console.log('🤖 Bot de atendimento da Clínica está online!');
});


// Mensagens recebidas
whatsapp.on('message_create', async msg => {
  if (msg.fromMe) return;

  const userId = msg.from;
  console.log(`📩 Mensagem recebida de ${userId}:`, msg.body);

  const db = loadDB();

  if (!db[userId]) {
    console.log(`👤 Novo usuário detectado: ${userId}`);
    db[userId] = [];

    const welcomeMessage = "Olá! Seja bem-vindo à Clínica Saúde e Bem-Estar 🌿";
    console.log(`📤 Enviando mensagem de boas-vindas para ${userId}`);
    await whatsapp.sendMessage(userId, welcomeMessage);
    const imageUrl = 'https://s3-sa-east-1.amazonaws.com/heroku-exercicioemcasa/wp-content/uploads/2023/07/04141336/ANTES_E_DEPOIS_DE_EMAGRECER_GABI_TIOSSI_1.jpg';
    const media = await MessageMedia.fromUrl(imageUrl);
    await whatsapp.sendMessage(userId, media);

    db[userId].push({ from: 'bot', message: welcomeMessage });
  }

  db[userId].push({ from: 'user', message: msg.body });

  console.log('🧠 Gerando resposta da IA...');
  const aiResponse = await getGroqChatCompletion(db[userId]);

  console.log(`📤 Enviando resposta para ${userId}:`, aiResponse);
  await whatsapp.sendMessage(userId, aiResponse);

  db[userId].push({ from: 'bot', message: aiResponse });

  saveDB(db);
});

whatsapp.initialize();

// Rota de status
app.get('/status', (req, res) => {
  const statusData = {
    status: isReady ? 'conectado' : 'aguardando_qr',
    qr: currentQR || null
  };
  res.json(statusData);
});


// Rota do banco de dados
app.get('/', (req, res) => {
  if (fs.existsSync(DB_PATH)) {
    const dbData = fs.readFileSync(DB_PATH, 'utf8');
    res.json(JSON.parse(dbData));
  } else {
    res.status(404).json({ erro: 'Banco de dados não encontrado.' });
  }
});

// Inicia o servidor
server.listen(PORT, () => {
  console.log(`🌐 Servidor HTTP iniciado na porta ${PORT}`);
});
