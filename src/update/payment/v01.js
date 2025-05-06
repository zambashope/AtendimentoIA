const Groq = require('groq-sdk');
const fs = require('fs');

// Inicialização do Groq com a chave da API
const groq = new Groq({
  apiKey: "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"
});

// Função para carregar pagamentos do arquivo JSON
function carregarPagamentos() {
  if (fs.existsSync('payment.json')) {
    const data = fs.readFileSync('payment.json');
    return JSON.parse(data);
  }
  return [];
}

// Função para salvar pagamentos no arquivo JSON
function salvarPagamentos(pagamentos) {
  fs.writeFileSync('payment.json', JSON.stringify(pagamentos, null, 2));
}

// Função para verificar o pagamento
async function verificarPagamento(imageUrl) {
  const chatCompletion = await groq.chat.completions.create({
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "Em poucas palavras, o pagamento foi feito para que conta, e quanto? Sem enrolar."
          },
          {
            "type": "image_url",
            "image_url": {
              "url": imageUrl
            }
          }
        ]
      }
    ],
    "model": "meta-llama/llama-4-scout-17b-16e-instruct",
    "temperature": 1,
    "max_completion_tokens": 1024,
    "top_p": 1,
    "stream": false,
    "stop": null
  });

  const resposta = chatCompletion.choices[0].message.content;
  console.log(resposta);

  const conta = "872930720"; // Conta a ser verificada
  const valor = "100MT"; // Valor a ser verificado (ajuste conforme necessário)

  // Verifica se o pagamento já foi validado
  const pagamentos = carregarPagamentos();
  const pagamentoExistente = pagamentos.find(p => p.conta === conta && p.valor === valor);

  if (pagamentoExistente) {
    console.log("Pagamento já validado.");
  } else {
    // Adiciona novo pagamento ao registro
    const novoPagamento = { conta, valor, data: new Date().toISOString() };
    pagamentos.push(novoPagamento);
    salvarPagamentos(pagamentos);
    console.log("Pagamento confirmado e registrado.");
  }
}

async function main() {
  const imageUrl = "https://4gu5gqsmxa.ufs.sh/f/cw2a7brXOR5uSFjlDitA1cJ5qQMa0fXDpK8v6kLSPzisnT7y"; // URL da imagem
  await verificarPagamento(imageUrl);
}

main();