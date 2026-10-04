import express, { Request, Response } from 'express';
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());

// Endpoint: AI Transaction Free Text Parser
app.post('/api/parse-transaction', async (req: Request, res: Response) => {
  const { text, categories = [], accounts = [], creditCards = [], currentDate } = req.body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Texto da transação não fornecido.',
    });
  }

  const promptText = text.trim();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    // Fallback heuristic parser if API key is temporarily absent
    const fallback = parseTransactionHeuristic(promptText, categories, accounts, creditCards, currentDate);
    return res.json({
      success: true,
      data: fallback,
      source: 'heuristic',
      warning: 'Chave GEMINI_API_KEY não encontrada no ambiente; utilizado parser heurístico local.',
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const categoryListStr = categories
      .map((c: any) => `ID: "${c.id}", Nome: "${c.name}", Tipo: "${c.type}"`)
      .join('\n');
    const accountListStr = accounts
      .map((a: any) => `ID: "${a.id}", Nome: "${a.name}"`)
      .join('\n');
    const cardListStr = creditCards
      .map((c: any) => `ID: "${c.id}", Nome: "${c.name}"`)
      .join('\n');

    const systemInstruction = `Você é um assistente financeiro inteligente e analista contábil para o aplicativo Aura Finance.
Sua função é analisar a descrição em texto livre escrita pelo usuário (em português) e extrair os dados da transação com precisão.

Data de referência do sistema hoje: ${currentDate || new Date().toISOString().slice(0, 10)}.

Lista de Categorias Disponíveis:
${categoryListStr || 'Nenhuma categoria específica pré-carregada'}

Lista de Contas Bancárias Disponíveis:
${accountListStr || 'Nenhuma conta específica pré-carregada'}

Lista de Cartões de Crédito Disponíveis:
${cardListStr || 'Nenhum cartão específico pré-carregado'}

Regras de Extração:
1. "amount": Valor numérico positivo (ex: se "85 reais" ou "85,50" -> 85.5; se "3x de 100" -> valor total 300 ou 100 se especificado como parcela).
2. "type": Deve ser "income" (receita/ganho/salário/pix recebido), "expense" (despesa/gasto/compra/pagamento) ou "transfer" (transferência entre contas).
3. "description": Descrição limpa, concisa e com inicial maiúscula (ex: "Almoço Restaurante", "Uber corrida", "Supermercado Semanal").
4. "category_id": Escolha o melhor ID da lista de categorias fornecida compatível com o tipo de lançamento.
5. "payment_method": "account" (débito, pix, dinheiro, conta corrente) ou "card" (cartão de crédito) ou "transfer".
6. "account_id": ID da conta de débito ou de recebimento se mencionada ou deduzida, ou null.
7. "credit_card_id": ID do cartão de crédito se o usuário mencionou cartão ou o nome do cartão (ex: Nubank, XP, Inter), ou null.
8. "destination_account_id": Se for transferência, o ID da conta de destino.
9. "date": Data no formato YYYY-MM-DD. Se o usuário disser "ontem", calcule a data de ontem com base na data de hoje. Se não mencionar, use a data de hoje.
10. "installments": Número inteiro de parcelas (ex: "em 3 vezes" -> 3. Padrão: 1).
11. "explanation": Breve explicação de 1 frase justificando o que foi identificado.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Analise a transação descrita a seguir e extraia os campos:\n"${promptText}"`,
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: {
              type: Type.NUMBER,
              description: 'Valor numérico decimal positivo da transação.',
            },
            type: {
              type: Type.STRING,
              description: 'income, expense ou transfer',
            },
            description: {
              type: Type.STRING,
              description: 'Descrição limpa da transação',
            },
            category_id: {
              type: Type.STRING,
              description: 'ID da categoria mais adequada',
            },
            category_name: {
              type: Type.STRING,
              description: 'Nome legível da categoria escolhida',
            },
            payment_method: {
              type: Type.STRING,
              description: 'account, card ou transfer',
            },
            account_id: {
              type: Type.STRING,
              description: 'ID da conta bancária de origem/recebimento se identificada',
            },
            credit_card_id: {
              type: Type.STRING,
              description: 'ID do cartão de crédito se identificado',
            },
            destination_account_id: {
              type: Type.STRING,
              description: 'ID da conta de destino em transferências',
            },
            date: {
              type: Type.STRING,
              description: 'Data no formato YYYY-MM-DD',
            },
            installments: {
              type: Type.INTEGER,
              description: 'Número de parcelas, default 1',
            },
            explanation: {
              type: Type.STRING,
              description: 'Resumo explicativo da extração para feedback ao usuário',
            },
          },
          required: ['amount', 'type', 'description', 'payment_method', 'date'],
        },
      },
    });

    const parsedJson = JSON.parse(response.text?.trim() || '{}');
    return res.json({
      success: true,
      data: parsedJson,
      source: 'gemini-3.8-flash',
    });
  } catch (error: any) {
    console.error('Erro ao chamar Gemini API:', error);
    // Graceful fallback to heuristic extraction
    const fallback = parseTransactionHeuristic(promptText, categories, accounts, creditCards, currentDate);
    return res.json({
      success: true,
      data: fallback,
      source: 'heuristic_fallback',
      warning: `A IA encontrou uma instabilidade (${error?.message || 'erro'}). Utilizamos o motor de regras estruturadas como alternativa.`,
    });
  }
});

// Heuristic fallback parser
function parseTransactionHeuristic(
  text: string,
  categories: any[],
  accounts: any[],
  creditCards: any[],
  currentDate?: string
) {
  const lower = text.toLowerCase();
  const today = currentDate || new Date().toISOString().slice(0, 10);

  // 1. Detect Amount
  // Matches "R$ 150,00", "150.00", "150 reais", "R$150", "150"
  let amount = 0;
  const amountMatch = text.match(/(?:R\$\s*)?(\d+(?:[.,]\d{1,2})?)(?:\s*(?:reais|real))?/i);
  if (amountMatch) {
    const clean = amountMatch[1].replace(',', '.');
    amount = parseFloat(clean) || 0;
  }

  // 2. Detect Type
  let type: 'income' | 'expense' | 'transfer' = 'expense';
  if (/recebi|ganhei|sal[aá]rio|rendimento|dividendo|estorno|reembolso|vendi|pix recebido/i.test(lower)) {
    type = 'income';
  } else if (/transferi|transfer[eê]ncia|mandei para|guardei na reserva/i.test(lower)) {
    type = 'transfer';
  }

  // 3. Detect Installments
  let installments = 1;
  const instMatch = text.match(/(\d+)\s*(?:x|vezes|parcelas)/i);
  if (instMatch) {
    installments = parseInt(instMatch[1], 10) || 1;
  }

  // 4. Detect Card or Account
  let paymentMethod: 'card' | 'account' | 'transfer' = 'account';
  let creditCardId: string | null = null;
  let accountId: string | null = null;

  if (type === 'transfer') {
    paymentMethod = 'transfer';
    if (accounts.length > 0) accountId = accounts[0].id;
  } else if (/cart[aã]o|cr[eé]dito|fatura/i.test(lower)) {
    paymentMethod = 'card';
    const foundCard = creditCards.find((c: any) => lower.includes(c.name.toLowerCase()));
    creditCardId = foundCard ? foundCard.id : creditCards[0]?.id || null;
  } else {
    paymentMethod = 'account';
    const foundAcc = accounts.find((a: any) => lower.includes(a.name.toLowerCase()));
    accountId = foundAcc ? foundAcc.id : accounts[0]?.id || null;
  }

  // 5. Detect Date
  let date = today;
  if (/ontem/i.test(lower)) {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    date = d.toISOString().slice(0, 10);
  }

  // 6. Match Category
  const matchedCat = categories
    .filter((c: any) => c.type === (type === 'income' ? 'income' : 'expense'))
    .find((c: any) => lower.includes(c.name.toLowerCase()));
  const categoryId = matchedCat
    ? matchedCat.id
    : categories.find((c: any) => c.type === (type === 'income' ? 'income' : 'expense'))?.id || 'cat_exp_01';

  // 7. Clean Description
  const description = text.slice(0, 50).trim();

  return {
    amount,
    type,
    description: description.charAt(0).toUpperCase() + description.slice(1),
    category_id: categoryId,
    category_name: matchedCat?.name || 'Geral',
    payment_method: paymentMethod,
    account_id: accountId,
    credit_card_id: creditCardId,
    destination_account_id: null,
    date,
    installments,
    explanation: `Identificado valor de R$ ${amount.toFixed(2)} como ${type === 'income' ? 'receita' : 'despesa'}.`,
  };
}

// Endpoint: AI Smart Category Suggester based on Description only
app.post('/api/suggest-category', async (req: Request, res: Response) => {
  const { description, categories = [], currentType } = req.body;

  if (!description || typeof description !== 'string' || !description.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Descrição da transação não fornecida para categorização.',
    });
  }

  const cleanDescription = description.trim();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    const fallback = suggestCategoryHeuristic(cleanDescription, categories, currentType);
    return res.json({
      success: true,
      data: fallback,
      source: 'heuristic',
      warning: 'GEMINI_API_KEY não configurada no ambiente; utilizada categorização heurística.',
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const categoryListStr = categories
      .map((c: any) => `ID: "${c.id}" | Nome: "${c.name}" | Tipo: "${c.type}"`)
      .join('\n');

    const systemInstruction = `Você é o especialista em Categorização Financeira Inteligente do Aura Finance.
Sua missão é deduzir a melhor categoria contábil com base unicamente na descrição fornecida pelo usuário (em português do Brasil).
Exemplos comuns:
- "Almoço Outback", "Restaurante", "iFood", "Padaria", "Café" -> Alimentação
- "Supermercado Pão de Açúcar", "Carrefour", "Feira" -> Supermercado ou Alimentação
- "Uber", "99", "Posto Ipiranga", "Gasolina", "Estacionamento", "Pedágio" -> Transporte
- "Netflix", "Spotify", "Amazon Prime", "Cinema", "Steam" -> Assinaturas / Lazer
- "Farmácia Droga Raia", "Consulta Médica", "Dentista", "Exames" -> Saúde
- "Aluguel", "Condomínio", "Conta de Luz", "Internet Fibra" -> Moradia
- "Salário Mensal", "Pró-labore", "Pix recebido João", "Dividendos", "Restituição IR" -> Salário / Receitas

Categorias disponíveis cadastradas pelo usuário:
${categoryListStr}

Regras:
1. "category_id": Deve ser rigorosamente um dos IDs existentes na lista acima.
2. "suggested_type": "income" se indicar claramente entrada/receita financeira; ou "expense" se for um gasto ou consumo.
3. "confidence": Número decimal entre 0.50 e 0.99 representando o grau de certeza semântica.
4. "confidence_percent": Inteiro equivalente (ex: 95).
5. "reasoning": Frase curta e clara em português explicando a dedução (máximo 15 palavras).
6. "alternatives": Até 2 opções plausíveis alternativas com ID e nome da lista.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Identifique a categoria ideal para esta transação:\n"${cleanDescription}"`,
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category_id: {
              type: Type.STRING,
              description: 'ID da categoria cadastrada mais adequada',
            },
            category_name: {
              type: Type.STRING,
              description: 'Nome legível da categoria escolhida',
            },
            suggested_type: {
              type: Type.STRING,
              description: 'expense ou income',
            },
            confidence: {
              type: Type.NUMBER,
              description: 'Confiança de 0.0 a 1.0',
            },
            confidence_percent: {
              type: Type.INTEGER,
              description: 'Porcentagem de 50 a 99',
            },
            reasoning: {
              type: Type.STRING,
              description: 'Justificativa concisa em português',
            },
            alternatives: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category_id: { type: Type.STRING },
                  category_name: { type: Type.STRING },
                  reasoning: { type: Type.STRING },
                },
                required: ['category_id', 'category_name'],
              },
              description: 'Até 2 categorias alternativas secundárias',
            },
          },
          required: [
            'category_id',
            'category_name',
            'suggested_type',
            'confidence',
            'confidence_percent',
            'reasoning',
          ],
        },
      },
    });

    const parsedJson = JSON.parse(response.text?.trim() || '{}');

    // Verify category_id exists in user's categories; if not, fallback to first matching by name
    const exists = categories.some((c: any) => c.id === parsedJson.category_id);
    if (!exists && categories.length > 0) {
      const matchByName = categories.find((c: any) =>
        c.name.toLowerCase().includes((parsedJson.category_name || '').toLowerCase())
      );
      if (matchByName) {
        parsedJson.category_id = matchByName.id;
        parsedJson.category_name = matchByName.name;
      } else {
        parsedJson.category_id = categories[0].id;
        parsedJson.category_name = categories[0].name;
      }
    }

    return res.json({
      success: true,
      data: parsedJson,
      source: 'gemini-3.8-flash',
    });
  } catch (error: any) {
    console.error('Erro na categorização inteligente Gemini:', error);
    const fallback = suggestCategoryHeuristic(cleanDescription, categories, currentType);
    return res.json({
      success: true,
      data: fallback,
      source: 'heuristic_fallback',
      warning: `Gemini indisponível temporariamente. Categorizado via motor semântico local.`,
    });
  }
});

// Heuristic fallback for category suggestion
function suggestCategoryHeuristic(
  description: string,
  categories: any[],
  currentType?: string
) {
  const lower = description.toLowerCase();

  // Pattern keywords dictionary
  const patterns: { keywords: string[]; categoryType: 'income' | 'expense'; hint: string }[] = [
    {
      keywords: ['salario', 'salário', 'aditivo', 'pro-labore', 'pró-labore', 'folha', 'pagamento empresa'],
      categoryType: 'income',
      hint: 'Identificado como remuneração ou salário.',
    },
    {
      keywords: ['freelance', 'freela', 'consultoria', 'projeto', 'servico prestado', 'cliente'],
      categoryType: 'income',
      hint: 'Identificado como receita profissional independente.',
    },
    {
      keywords: ['dividendo', 'rendimento', 'cdi', 'selic', 'juros', 'tesouro', 'acoes', 'ações', 'fii'],
      categoryType: 'income',
      hint: 'Identificado como rendimento financeiro de investimentos.',
    },
    {
      keywords: ['almoço', 'almoco', 'jantar', 'restaurante', 'ifood', 'lanche', 'pizza', 'hamburguer', 'padaria', 'cafe', 'café', 'mcdonald', 'burger king', 'subway', 'outback', 'bar', 'chopp'],
      categoryType: 'expense',
      hint: 'Identificado como despesa de refeições e alimentação fora de casa.',
    },
    {
      keywords: ['mercado', 'supermercado', 'hortifruti', 'feira', 'carrefour', 'pao de acucar', 'pão de açúcar', 'assai', 'atacadão', 'atacadao'],
      categoryType: 'expense',
      hint: 'Identificado como compras de supermercado e abastecimento.',
    },
    {
      keywords: ['uber', '99', 'taxi', 'táxi', 'gasolina', 'combustivel', 'combustível', 'posto', 'etanol', 'ipiranga', 'shell', 'pedagio', 'pedágio', 'estacionamento', 'estapar', 'mecanico', 'oficina', 'ipva'],
      categoryType: 'expense',
      hint: 'Identificado como deslocamento, combustível ou transporte.',
    },
    {
      keywords: ['aluguel', 'condominio', 'condomínio', 'iptu', 'luz', 'enel', 'cpfl', 'agua', 'água', 'sabesp', 'gas', 'gás', 'internet', 'fibra', 'claro', 'vivo', 'tim'],
      categoryType: 'expense',
      hint: 'Identificado como despesas fixas essenciais de moradia.',
    },
    {
      keywords: ['farmacia', 'farmácia', 'drogaria', 'droga raia', 'drogasil', 'pacheco', 'medico', 'médico', 'consulta', 'dentista', 'remedio', 'remédio', 'hospital', 'laboratorio', 'exame', 'terapia', 'psicologo'],
      categoryType: 'expense',
      hint: 'Identificado como despesa com cuidados de saúde e medicamentos.',
    },
    {
      keywords: ['netflix', 'spotify', 'amazon', 'prime video', 'disney', 'hbo', 'max', 'youtube', 'apple', 'icloud', 'cinema', 'ingresso', 'steam', 'playstation', 'game', 'show', 'teatro', 'viagem', 'hotel', 'airbnb'],
      categoryType: 'expense',
      hint: 'Identificado como lazer, entretenimento ou serviços por assinatura.',
    },
    {
      keywords: ['curso', 'livro', 'escola', 'faculdade', 'pos-graduacao', 'idiomas', 'ingles', 'inglês', 'udemy', 'alura', 'treinamento'],
      categoryType: 'expense',
      hint: 'Identificado como investimento em educação e qualificação.',
    },
  ];

  let matchedHint = 'Classificado com base em correspondência textual.';
  let detectedType: 'income' | 'expense' = (currentType as any) || 'expense';
  let targetCategory: any = null;

  for (const p of patterns) {
    if (p.keywords.some((k) => lower.includes(k))) {
      detectedType = p.categoryType;
      matchedHint = p.hint;
      // Find category in user's categories matching this type
      const possibleCats = categories.filter((c: any) => c.type === detectedType);
      // Try to find category whose name matches keyword theme
      if (detectedType === 'income') {
        targetCategory = possibleCats.find((c) => /sal[aá]rio|rendimento|freelance|geral/i.test(c.name)) || possibleCats[0];
      } else {
        if (/almo[cç]o|restaurante|ifood|lanche|pizza|padaria/i.test(lower)) {
          targetCategory = possibleCats.find((c) => /alimenta[cç][aã]o|refei[cç]/i.test(c.name));
        } else if (/mercado|supermercado|hortifruti/i.test(lower)) {
          targetCategory = possibleCats.find((c) => /mercado|alimenta[cç][aã]o/i.test(c.name));
        } else if (/uber|99|gasolina|posto|combust[ií]vel/i.test(lower)) {
          targetCategory = possibleCats.find((c) => /transporte|ve[ií]culo/i.test(c.name));
        } else if (/netflix|spotify|cinema|steam|lazer/i.test(lower)) {
          targetCategory = possibleCats.find((c) => /assinatura|servi[cç]o|lazer/i.test(c.name));
        } else if (/farm[aá]cia|droga|m[eé]dico|dentista/i.test(lower)) {
          targetCategory = possibleCats.find((c) => /sa[uú]de/i.test(c.name));
        } else if (/aluguel|condom[ií]nio|luz|[aá]gua|internet/i.test(lower)) {
          targetCategory = possibleCats.find((c) => /moradia|habita[cç][aã]o/i.test(c.name));
        }
      }
      break;
    }
  }

  // If no specific category was found, pick first compatible
  if (!targetCategory) {
    targetCategory =
      categories.find((c: any) => c.type === detectedType) ||
      categories[0] || { id: 'cat_exp_01', name: 'Alimentação' };
  }

  // Select alternative categories
  const alternatives = categories
    .filter((c: any) => c.id !== targetCategory.id && c.type === detectedType)
    .slice(0, 2)
    .map((c: any) => ({
      category_id: c.id,
      category_name: c.name,
      reasoning: `Possível opção alternativa para "${description}".`,
    }));

  return {
    category_id: targetCategory.id,
    category_name: targetCategory.name,
    suggested_type: detectedType,
    confidence: 0.88,
    confidence_percent: 88,
    reasoning: matchedHint,
    alternatives,
  };
}

// Development with Vite middleware or Production static serving
async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Servidor Aura Finance operando em http://0.0.0.0:${PORT}`);
  });
}

startServer();
