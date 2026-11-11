import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  // CORS & Header 설정
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET') {
    if (!supabase) {
      return res.status(500).json({
        ok: false,
        error: {
          code: 'CONFIG_ERROR',
          message: 'Supabase 서버 환경 변수가 설정되지 않았습니다.',
        },
      });
    }

    try {
      const { data, error } = await supabase
        .from('feedback')
        .select('id, type, rating, content, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Supabase fetch error:', error);
        return res.status(500).json({
          ok: false,
          error: {
            code: 'DB_ERROR',
            message: '피드백 목록을 불러오지 못했습니다.',
          },
        });
      }

      return res.status(200).json({
        ok: true,
        items: data || [],
      });
    } catch (err) {
      console.error('Feedback GET error:', err);
      return res.status(500).json({
        ok: false,
        error: {
          code: 'SERVER_ERROR',
          message: '서버 내부 오류가 발생했습니다.',
        },
      });
    }
  }

  if (req.method === 'POST') {
    if (!supabase) {
      return res.status(500).json({
        ok: false,
        error: {
          code: 'CONFIG_ERROR',
          message: 'Supabase 서버 환경 변수가 설정되지 않았습니다.',
        },
      });
    }

    try {
      const { type, rating, content } = req.body || {};

      // 1. type 검증: 칭찬, 개선 의견, 오류 신고
      const validTypes = ['칭찬', '개선 의견', '오류 신고'];
      if (!type || !validTypes.includes(type)) {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '피드백 유형은 칭찬, 개선 의견, 오류 신고 중 하나여야 합니다.',
          },
        });
      }

      // 2. content 검증: 5~500자
      if (!content || typeof content !== 'string' || content.trim().length < 5 || content.trim().length > 500) {
        return res.status(400).json({
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '피드백 내용은 5자 이상 500자 이하로 입력해 주세요.',
          },
        });
      }

      // 3. rating 검증 (선택 사항, 1~5 정수)
      let parsedRating = null;
      if (rating !== undefined && rating !== null && rating !== '') {
        parsedRating = Number(rating);
        if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
          return res.status(400).json({
            ok: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: '별점은 1점부터 5점까지의 정수여야 합니다.',
            },
          });
        }
      }

      const { data, error } = await supabase
        .from('feedback')
        .insert([
          {
            type,
            rating: parsedRating,
            content: content.trim(),
          },
        ])
        .select('id')
        .single();

      if (error) {
        console.error('Supabase insert error:', error);
        return res.status(500).json({
          ok: false,
          error: {
            code: 'DB_ERROR',
            message: '피드백을 저장하지 못했습니다.',
          },
        });
      }

      return res.status(201).json({
        ok: true,
        feedback: {
          id: data.id,
        },
      });
    } catch (err) {
      console.error('Feedback POST error:', err);
      return res.status(500).json({
        ok: false,
        error: {
          code: 'SERVER_ERROR',
          message: '서버 내부 오류가 발생했습니다.',
        },
      });
    }
  }

  // 허용되지 않은 메서드
  return res.status(405).json({
    ok: false,
    error: {
      code: 'METHOD_NOT_ALLOWED',
      message: '허용되지 않는 HTTP 메서드입니다.',
    },
  });
}

