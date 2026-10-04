import { Category } from '../types/finance';

export interface CategoryAlternative {
  category_id: string;
  category_name: string;
  reasoning?: string;
}

export interface CategorySuggestionResponse {
  category_id: string;
  category_name: string;
  suggested_type: 'expense' | 'income';
  confidence: number;
  confidence_percent: number;
  reasoning: string;
  alternatives?: CategoryAlternative[];
  source?: string;
}

// In-memory cache to prevent duplicate network calls for the same description
const suggestionCache = new Map<string, CategorySuggestionResponse>();

/**
 * Request smart category suggestion from backend Gemini LLM engine
 */
export async function requestCategorySuggestion(
  description: string,
  categories: Category[],
  currentType?: string
): Promise<CategorySuggestionResponse> {
  const trimmed = description.trim();
  if (!trimmed || trimmed.length < 2) {
    throw new Error('Descrição muito curta para inferência.');
  }

  const cacheKey = `${trimmed.toLowerCase()}_${currentType || 'any'}`;
  if (suggestionCache.has(cacheKey)) {
    return suggestionCache.get(cacheKey)!;
  }

  const payload = {
    description: trimmed,
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      color: c.color,
    })),
    currentType,
  };

  const response = await fetch('/api/suggest-category', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Erro no servidor ao solicitar categorização (${response.status})`);
  }

  const result = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Não foi possível sugerir categoria');
  }

  const data: CategorySuggestionResponse = {
    ...result.data,
    source: result.source,
  };

  suggestionCache.set(cacheKey, data);
  return data;
}
