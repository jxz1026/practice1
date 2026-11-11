import { openai, defaultModel } from '../lib/openai.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: '허용되지 않는 HTTP 메서드입니다.',
      },
    });
  }

  if (!openai) {
    return res.status(500).json({
      ok: false,
      error: {
        code: 'CONFIG_ERROR',
        message: 'OpenAI API 키가 설정되지 않았습니다.',
      },
    });
  }

  try {
    const {
      ingredients,
      servings = 2,
      timeLimit = 30,
      excludedIngredients = [],
      preference = '',
    } = req.body || {};

    // 1. 재료 검증: 문자열 배열, 1~20개, 각 1~30자
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '식재료를 최소 1개 이상 입력해 주세요.',
        },
      });
    }

    if (ingredients.length > 20) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '식재료는 최대 20개까지 입력할 수 있습니다.',
        },
      });
    }

    const cleanIngredients = [];
    for (const item of ingredients) {
      if (typeof item !== 'string' || item.trim().length === 0 || item.trim().length > 30) {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '각 식재료 이름은 1자 이상 30자 이하여야 합니다.',
          },
        });
      }
      cleanIngredients.push(item.trim());
    }

    // 2. 인원수 검증: 정수 1~8
    const numServings = Number(servings);
    if (!Number.isInteger(numServings) || numServings < 1 || numServings > 8) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '인원수는 1명에서 8명 사이의 정수여야 합니다.',
        },
      });
    }

    // 3. 조리 시간 검증: 15, 30, 45, 또는 null (제한 없음)
    let parsedTimeLimit = timeLimit;
    if (parsedTimeLimit !== null && parsedTimeLimit !== 'null' && parsedTimeLimit !== '') {
      parsedTimeLimit = Number(parsedTimeLimit);
      if (![15, 30, 45].includes(parsedTimeLimit)) {
        parsedTimeLimit = null; // 허용 값 외에는 제한 없음으로 처리
      }
    } else {
      parsedTimeLimit = null;
    }

    // 4. 제외 재료 검증: 배열 최대 10개, 각 1~30자
    const cleanExcluded = [];
    if (Array.isArray(excludedIngredients)) {
      if (excludedIngredients.length > 10) {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '제외 재료는 최대 10개까지 입력할 수 있습니다.',
          },
        });
      }
      for (const item of excludedIngredients) {
        if (typeof item === 'string' && item.trim().length > 0 && item.trim().length <= 30) {
          cleanExcluded.push(item.trim());
        }
      }
    }

    // 5. 선호 조건 검증: 문자열 최대 100자
    const cleanPreference = typeof preference === 'string' ? preference.trim().slice(0, 100) : '';

    // 시스템 프롬프트 및 JSON 스키마 정의
    const systemPrompt = `너는 냉장고 속 식재료를 활용하는 한국어 요리 도우미다.
사용자가 보유한 재료를 최대한 활용해 현실적으로 만들 수 있는 요리를 최대 3개 추천한다.

규칙:
1. 보유 재료 목록에 있는 재료를 우선 사용한다.
2. 보유 재료와 추가 구매가 필요한 재료를 명확히 분리한다.
3. 제외 재료는 어떤 형태로도 레시피나 추가 재료에 넣지 않는다. 만약 보유 재료에 제외 재료가 포함되어 있다면 제외 재료를 우선하여 절대 사용하지 않는다.
4. 입력에 없는 재료를 보유 재료라고 표현하지 않는다.
5. 각 레시피는 3~8개의 구체적인 조리 단계(steps)로 작성한다.
6. 조리 시간은 준비와 가열을 포함한 대략적인 분(1~240 사이의 정수) 단위로 작성한다.
7. 난이도는 '쉬움', '보통', '어려움' 중 하나로 작성한다.
8. 한국어로 간결하고 초보자도 이해하기 쉽게 작성한다.
9. 알레르기 및 식품 안전을 보증하지 않는다. 주의사항(cautions)에 재료 신선도 확인, 충분한 가열, 교차오염 방지 등을 반드시 포함한다.
10. 출력은 반드시 다음 JSON 스키마 규격을 엄격히 지킨 JSON 포맷이어야 한다. JSON 외에 어떠한 인사말이나 부연 설명 문장도 출력하지 않는다.

JSON 스키마:
{
  "recipes": [
    {
      "name": "요리명",
      "description": "한 줄 설명",
      "cookingTime": 20,
      "difficulty": "쉬움",
      "usedIngredients": [{"name": "재료명", "amount": "양"}],
      "extraIngredients": [{"name": "추가재료명", "amount": "양"}],
      "steps": ["조리 1단계", "조리 2단계", "조리 3단계"],
      "cautions": ["주의사항 안내문"]
    }
  ]
}`;

    const userPrompt = `
- 보유 식재료: ${cleanIngredients.join(', ')}
- 인원수: ${numServings}인분
- 희망 조리 시간: ${parsedTimeLimit ? `${parsedTimeLimit}분 이내` : '제한 없음'}
- 제외/주의 재료: ${cleanExcluded.length > 0 ? cleanExcluded.join(', ') : '없음'}
- 선호 조건: ${cleanPreference || '없음'}
`;

    const completion = await openai.chat.completions.create({
      model: defaultModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const rawContent = completion.choices?.[0]?.message?.content;
    if (!rawContent) {
      throw new Error('AI 모델 응답이 비어 있습니다.');
    }

    let parsedResult;
    try {
      parsedResult = JSON.parse(rawContent);
    } catch {
      return res.status(502).json({
        ok: false,
        error: {
          code: 'AI_PARSE_ERROR',
          message: 'AI 응답 형식이 올바르지 않습니다. 다시 시도해 주세요.',
        },
      });
    }

    // 서버 스키마 검증
    if (!parsedResult || !Array.isArray(parsedResult.recipes) || parsedResult.recipes.length === 0) {
      return res.status(502).json({
        ok: false,
        error: {
          code: 'AI_EMPTY_RECIPES',
          message: '추천 가능한 레시피를 찾지 못했습니다. 재료나 조건을 변경해 보세요.',
        },
      });
    }

    const validatedRecipes = [];
    for (const r of parsedResult.recipes.slice(0, 3)) {
      if (
        typeof r.name !== 'string' ||
        !r.name.trim() ||
        typeof r.description !== 'string' ||
        !Array.isArray(r.usedIngredients) ||
        !Array.isArray(r.steps) ||
        r.steps.length < 2
      ) {
        continue;
      }

      validatedRecipes.push({
        name: String(r.name).trim(),
        description: String(r.description).trim(),
        cookingTime: Number(r.cookingTime) || 20,
        difficulty: ['쉬움', '보통', '어려움'].includes(r.difficulty) ? r.difficulty : '보통',
        usedIngredients: (r.usedIngredients || []).map((i) => ({
          name: String(i.name || ''),
          amount: String(i.amount || ''),
        })),
        extraIngredients: (r.extraIngredients || []).map((i) => ({
          name: String(i.name || ''),
          amount: String(i.amount || ''),
        })),
        steps: (r.steps || []).map((s) => String(s).trim()),
        cautions: Array.isArray(r.cautions) ? r.cautions.map((c) => String(c).trim()) : ['식재료 신선도와 충분한 가열 여부를 확인하세요.'],
      });
    }

    if (validatedRecipes.length === 0) {
      return res.status(502).json({
        ok: false,
        error: {
          code: 'AI_VALIDATION_ERROR',
          message: '유효한 레시피 생성에 실패했습니다. 다시 시도해 주세요.',
        },
      });
    }

    return res.status(200).json({
      recipes: validatedRecipes,
    });
  } catch (err) {
    console.error('API /recipes error:', err);
    return res.status(500).json({
      ok: false,
      error: {
        code: 'AI_SERVICE_ERROR',
        message: '레시피 추천 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      },
    });
  }
}

