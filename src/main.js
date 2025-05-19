require('dotenv').config();
const express = require('express');
const http = require('http');
const fs = require('fs');
const cors = require("cors");
const qrcode = require('qrcode-terminal');
const { Client, MessageMedia } = require('whatsapp-web.js');
const Groq = require('groq-sdk');

const PORT = process.env.PORT || 3000;
const DB_PATH = './db.json';
const treinamento = require('./treinamento');
const treinamentoRemarketing = require('./treinamentoRemarketing');

const app = express();
app.use(cors());
const server = http.createServer(app);

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const whatsapp = new Client({
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

let currentQR = null;
let isReady = false;

// Funções Utilitárias
const getPersonalizedGreeting = (userName) => {
  const currentHour = new Date().getHours();
  console.log(`🕒 Horário atual: ${currentHour}`);
  if (currentHour < 12) return `Bom dia, ${userName}! ☀️ Seja bem-vindo à Clínica Saúde e Bem-Estar 🌿`;
  if (currentHour < 18) return `Boa tarde, ${userName}! 🌤️ Seja bem-vindo à Clínica Saúde e Bem-Estar 🌿`;
  return `Boa noite, ${userName}! 🌙 Seja bem-vindo à Clínica Saúde e Bem-Estar 🌿`;
};

const hasReceivedWelcomeMessage = (userHistory) => {
  const received = userHistory.some(msg => msg.message.includes("Seja bem-vindo"));
  console.log(`✅ Verificando mensagem de boas-vindas: ${received ? 'Sim' : 'Não'}`);
  return received;
};

// Carrega o histórico do JSON
const loadDB = () => {
  console.log('🔄 Carregando banco de dados...');
  if (!fs.existsSync(DB_PATH)) {
    console.log('📁 Banco de dados não encontrado. Criando novo...');
    return {};
  }
  const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  console.log('✅ Banco de dados carregado com sucesso.');
  return data;
};

// Salva o histórico no JSON
const saveDB = (db) => {
  console.log('💾 Salvando banco de dados...');
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  console.log('✅ Banco de dados salvo com sucesso.');
};

// Cria a resposta da IA com base no histórico
const getGroqChatCompletion = async (userHistory, userName, isRemarketing = false) => {
  const trainingContent = isRemarketing ? treinamentoRemarketing : treinamento;
  console.log(`🧠 Enviando histórico para IA (${isRemarketing ? 'Remarketing' : 'Normal'})...`);

  const messages = [
    {
      role: "system",
      content: `${trainingContent}\n\nO nome do usuário é: ${userName}. Sempre chame o usuário pelo nome nas respostas para personalizar o atendimento.`
    },
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

    const response = chatCompletion.choices[0]?.message?.content || `Entendi que você deseja continuar a conversa, ${userName}. Em que posso ajudar hoje?`;
    console.log(`✅ Resposta da IA recebida: ${response}`);

    if (response.includes("Desculpe, não consegui entender")) {
      console.log('⚠️ Resposta genérica detectada. Ajustando...');
      return `Desculpe se não ficou claro. Estou aqui para ajudar você com qualquer dúvida. Pode me contar mais sobre o que precisa?`;
    }

    return response;

  } catch (error) {
    console.error('❌ Erro ao obter resposta da IA:', error);
    return "Desculpe, ocorreu um erro ao tentar responder. Por favor, tente novamente.";
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
  currentQR = null;
  console.log('🤖 Bot de atendimento da Clínica está online!');
});

// Mensagens recebidas
whatsapp.on('message_create', async msg => {
  if (msg.fromMe) return;

  const userId = msg.from;
  console.log(`📩 Mensagem recebida de ${userId}: ${msg.body}`);

  const db = loadDB();
  const userName = msg._data?.notifyName || 'cliente';

  // Cria novo usuário se não existir
  if (!db[userId]) {
    console.log(`👤 Novo usuário detectado: ${userId}`);
    db[userId] = { name: userName, messages: [] };
  }

  // Verifica se o cliente já recebeu a mensagem de boas-vindas
  if (!hasReceivedWelcomeMessage(db[userId].messages)) {
    console.log(`🎉 Enviando mensagem de boas-vindas para ${userId}`);
    const welcomeMessage = getPersonalizedGreeting(userName);
    await whatsapp.sendMessage(userId, welcomeMessage);

    const imageUrl = 'https://s3-sa-east-1.amazonaws.com/heroku-exercicioemcasa/wp-content/uploads/2023/07/04141336/ANTES_E_DEPOIS_DE_EMAGRECER_GABI_TIOSSI_1.jpg';
    const media = await MessageMedia.fromUrl(imageUrl);
    await whatsapp.sendMessage(userId, media);

    db[userId].messages.push({ from: 'bot', message: welcomeMessage });
    saveDB(db);
  }

  db[userId].messages.push({ from: 'user', message: msg.body });

  console.log('🧠 Gerando resposta da IA...');
  const aiResponse = await getGroqChatCompletion(db[userId].messages, userName);
  await whatsapp.sendMessage(userId, aiResponse);
  console.log(`📤 Resposta enviada para ${userId}: ${aiResponse}`);

  db[userId].messages.push({ from: 'bot', message: aiResponse });
  saveDB(db);

  // Ativa o remarketing após 30 segundos para teste
  setTimeout(async () => {
    console.log(`🔔 Enviando mensagem de remarketing para ${userId}`);
    const remarketingMessage = await getGroqChatCompletion(db[userId].messages, userName, true);
    await whatsapp.sendMessage(userId, remarketingMessage);
    console.log(`📤 Mensagem de remarketing enviada para ${userId}: ${remarketingMessage}`);

    db[userId].messages.push({ from: 'bot', message: remarketingMessage });
    saveDB(db);
  }, 4 * 60 * 60 * 1000);  // 30 segundos para teste

});

whatsapp.initialize();

// Rota de status
app.get('/status', (req, res) => {
  res.json({
    status: isReady ? 'conectado' : 'aguardando_qr',
    qr: currentQR || null
  });
});

// Rota do banco de dados
app.get('/', (req, res) => {
  if (fs.existsSync(DB_PATH)) {
    res.json(JSON.parse(fs.readFileSync(DB_PATH, 'utf8')));
  } else {
    res.status(404).json({ erro: 'Banco de dados não encontrado.' });
  }
});

// Inicia o servidor
server.listen(PORT, () => {
  console.log(`🌐 Servidor HTTP iniciado na porta ${PORT}`);
});
