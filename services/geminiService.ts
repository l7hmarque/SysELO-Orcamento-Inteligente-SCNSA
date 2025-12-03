import { GoogleGenAI, Type } from "@google/genai";
import { BudgetItem, Rubric, ReductionSuggestion, PARANA_RUBRICS, ImportResult, ExpenseType } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const suggestRubric = async (itemName: string): Promise<Rubric | null> => {
  try {
    const prompt = `
      Context: A user is filling a public budget for the State of Paraná (SCFV).
      User Input Item: "${itemName}".
      
      Task: Suggest the best category/rubric from this list: ${JSON.stringify(PARANA_RUBRICS.map(r => ({ code: r.code, desc: r.description })))}.
      
      Return JSON only.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedRubricCode: { type: Type.STRING },
            reason: { type: Type.STRING }
          }
        }
      }
    });

    if (response.text) {
      const result = JSON.parse(response.text);
      if (result.suggestedRubricCode) {
        return PARANA_RUBRICS.find(r => r.code === result.suggestedRubricCode) || null;
      }
    }
    return null;
  } catch (error) {
    console.error("Error suggesting rubric:", error);
    return null;
  }
};

export const suggestPrice = async (itemName: string): Promise<{ price: number, confidence: string } | null> => {
    try {
      const prompt = `
        Context: Market price estimation for a public budget in Medianeira, Paraná, Brazil.
        Item: "${itemName}".
        
        Task: Estimate the average unit retail price (R$) for this item in this region.
        Be conservative.
        
        Return JSON only: { "price": number, "confidence": "high" | "medium" | "low" }
      `;
  
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              price: { type: Type.NUMBER },
              confidence: { type: Type.STRING }
            }
          }
        }
      });
  
      if (response.text) {
        return JSON.parse(response.text);
      }
      return null;
    } catch (error) {
      console.error("Error suggesting price:", error);
      return null;
    }
  };

export const validateRubricContext = async (itemName: string, currentRubric: Rubric): Promise<{ isValid: boolean; suggestedRubric?: Rubric; reason?: string }> => {
  try {
    const prompt = `
      Context: A user is filling a public budget for the State of Paraná (SCFV).
      Current Category/Rubric: "${currentRubric.code} - ${currentRubric.description}".
      User Input Item: "${itemName}".
      
      Task: Determine if this item belongs in this category. 
      If YES, return isValid: true.
      If NO, suggest the correct rubric from this list: ${JSON.stringify(PARANA_RUBRICS.map(r => ({ code: r.code, desc: r.description })))}.
      
      Return JSON only.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValid: { type: Type.BOOLEAN },
            suggestedRubricCode: { type: Type.STRING },
            reason: { type: Type.STRING }
          }
        }
      }
    });

    if (response.text) {
      const result = JSON.parse(response.text);
      let suggestedRubric = undefined;
      if (result.suggestedRubricCode) {
        suggestedRubric = PARANA_RUBRICS.find(r => r.code === result.suggestedRubricCode);
      }
      return {
        isValid: result.isValid,
        suggestedRubric,
        reason: result.reason
      };
    }
    return { isValid: true };
  } catch (error) {
    return { isValid: true };
  }
};

export const analyzeBudgetReduction = async (items: BudgetItem[], targetReductionPercent: number): Promise<ReductionSuggestion[]> => {
  try {
    const budgetSummary = items.map(item => ({
      id: item.id,
      name: item.name,
      rubric: item.rubricDesc,
      priority: item.priority,
      annualTotal: item.unitValue * item.quantity * item.frequency
    }));

    const prompt = `
      You are a rigorous financial controller for a social assistance program (SCFV).
      We need to reduce the total budget by approximately ${targetReductionPercent}%.
      Analyze the following items. Prioritize cutting "Baixa" priority items or non-essential "Material de Consumo".
      Protect "Alta" priority items unless necessary.
      
      Items: ${JSON.stringify(budgetSummary)}

      Return a list of ONLY the items that should be modified/reduced.
      Suggest a new TOTAL annual value.
      The output must be a JSON array of suggestions.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              itemId: { type: Type.STRING },
              originalValue: { type: Type.NUMBER },
              suggestedValue: { type: Type.NUMBER, description: "The new suggested annual total for this item" },
              reason: { type: Type.STRING, description: "Short explanation for the cut in Portuguese" }
            }
          }
        }
      }
    });

    if (response.text) {
      const raw = JSON.parse(response.text);
      return raw.map((r: any) => ({ ...r, section: 'GOODS' }));
    }
    return [];

  } catch (error) {
    console.error("Error analyzing budget:", error);
    return [];
  }
};

export const auditImportedData = async (rawData: any[]): Promise<ImportResult> => {
    try {
        const prompt = `
        You are an Auditor for Public Spending. Audit this raw data imported from an Excel spreadsheet.
        
        Raw Data (first 30 rows max): ${JSON.stringify(rawData.slice(0, 30))}
        
        Tasks:
        1. FILTER GARBAGE: Ignore rows that are likely Headers, Page numbers, Empty lines, or Grand Totals. Only extract actual line items.
        2. STRUCTURE: Map valid rows to: name, unitValue (parse currency), quantity.
        3. CLASSIFY: Assign a Rubric Code from the provided list if missing.
        4. WARNINGS: Create a list of specific warnings in Portuguese (e.g., "Linha 5 ignorada (lixo)", "Valor do Arroz muito alto", "Descrição vaga").
        
        Return JSON.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        items: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    name: { type: Type.STRING },
                                    unitValue: { type: Type.NUMBER },
                                    quantity: { type: Type.NUMBER },
                                    rubricCode: { type: Type.STRING }
                                }
                            }
                        },
                        warnings: { type: Type.ARRAY, items: { type: Type.STRING } }
                    }
                }
            }
        });

        if (response.text) {
            const result = JSON.parse(response.text);
            const mappedItems: BudgetItem[] = result.items.map((i: any) => {
                const rubric = PARANA_RUBRICS.find(r => r.code === i.rubricCode) || PARANA_RUBRICS[0];
                return {
                    id: crypto.randomUUID(),
                    name: i.name || 'Item Importado',
                    unitValue: i.unitValue || 0,
                    quantity: i.quantity || 1,
                    frequency: 12,
                    type: ExpenseType.RECURRING,
                    priority: 'Média',
                    rubricCode: rubric.code,
                    rubricDesc: rubric.description
                };
            });
            return { items: mappedItems, warnings: result.warnings };
        }
        return { items: [], warnings: ['Falha na análise da IA.'] };

    } catch (e) {
        return { items: [], warnings: ['Erro ao processar arquivo. Verifique o formato.'] };
    }
};