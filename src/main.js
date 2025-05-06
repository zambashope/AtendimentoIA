require('dotenv').config();

const http = require('http');
const PORT = process.env.PORT || 3000;

let currentQR = null;
let isReady = false;

const fs = require('fs');
const qrcode = require('qrcode-terminal');
const { Client } = require('whatsapp-web.js');
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const whatsapp = new Client();
const DB_PATH = './db.json';
const treinamento = require('./treinamento');



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
    {
      role: "system",
      content: treinamento
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
});


// Pronto para uso
whatsapp.on('ready', () => {
  isReady = true;
  console.log('🤖 Bot de atendimento da Clínica está online!');
});

// Mensagens recebidas
whatsapp.on('message_create', async msg => {
  if (msg.fromMe) return;

  const userId = msg.from;
  console.log(`📩 Mensagem recebida de ${userId}:`, msg.body);

  const db = loadDB();

  const { MessageMedia } = require('whatsapp-web.js'); // Ensure you have this import

  if (!db[userId]) {
      console.log(`👤 Novo usuário detectado: ${userId}`);
      db[userId] = [];
  
      const welcomeMessage = "Olá! Seja bem-vindo à Clínica Saúde e Bem-Estar 🌿. Como posso te ajudar hoje?";
      console.log(`📤 Enviando mensagem de boas-vindas para ${userId}`);
      await whatsapp.sendMessage(userId, welcomeMessage);
  
      // Create MessageMedia from the URL
      const imageUrl = "https://static.itdg.com.br/images/640-auto/f08b02ed1af94d2b9e7eade3ba5a36f2/chas-atuam-na-perda-de-peso-shutterstock.jpg";
  
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


http.createServer((req, res) => {
  if (req.url === '/status') {
    const statusData = {
      status: isReady ? 'conectado' : 'aguardando_qr',
      qr: currentQR
    };
  
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(statusData));
    return;
  }

  
  if (req.url === '/') {
    // Retorna o conteúdo do banco de dados como JSON
    if (fs.existsSync(DB_PATH)) {
      const dbData = fs.readFileSync(DB_PATH, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(dbData);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ erro: 'Banco de dados não encontrado.' }));
    }
  } else {
    // Página padrão (evita erro no Render)
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot WhatsApp está rodando.\n');
  }
}).listen(PORT, () => {
  console.log(`🌐 Servidor HTTP iniciado na porta ${PORT}`);
});