// ==========================================
// 냉털셰프 (Fridge Chef) - Front-End Logic
// ==========================================

const state = {
  ingredients: [],
  recipes: [],
};

// DOM 요소 캐싱
const ingredientInput = document.getElementById('ingredientInput');
const btnAddIngredient = document.getElementById('btnAddIngredient');
const btnFillSample = document.getElementById('btnFillSample');
const btnClearIngredients = document.getElementById('btnClearIngredients');
const ingredientChips = document.getElementById('ingredientChips');
const emptyIngredientHint = document.getElementById('emptyIngredientHint');

const servingsSelect = document.getElementById('servingsSelect');
const timeLimitSelect = document.getElementById('timeLimitSelect');
const excludedInput = document.getElementById('excludedInput');
const preferenceInput = document.getElementById('preferenceInput');

const btnGetRecipes = document.getElementById('btnGetRecipes');
const recipeSection = document.getElementById('recipeSection');
const recipeCardsContainer = document.getElementById('recipeCardsContainer');
const btnRefreshRecipes = document.getElementById('btnRefreshRecipes');

const feedbackForm = document.getElementById('feedbackForm');
const feedbackType = document.getElementById('feedbackType');
const feedbackRating = document.getElementById('feedbackRating');
const feedbackContent = document.getElementById('feedbackContent');
const feedbackCharCount = document.getElementById('feedbackCharCount');
const btnSubmitFeedback = document.getElementById('btnSubmitFeedback');
const feedbackList = document.getElementById('feedbackList');
const btnReloadFeedback = document.getElementById('btnReloadFeedback');

const statusMessage = document.getElementById('statusMessage');

// 1. 공통 상태 메시지 표출
function showMessage(type, message, duration = 4000) {
  statusMessage.className = `status-banner ${type}`;
  statusMessage.textContent = message;
  statusMessage.classList.remove('hidden');

  if (window.statusTimer) clearTimeout(window.statusTimer);
  if (duration > 0) {
    window.statusTimer = setTimeout(() => {
      statusMessage.classList.add('hidden');
    }, duration);
  }
}

// 2. 식재료 관리
function addIngredient(name) {
  const clean = (name || '').trim();
  if (!clean) {
    showMessage('error', '추가할 식재료 이름을 입력해 주세요.');
    return;
  }
  if (clean.length > 30) {
    showMessage('error', '식재료 이름은 30자 이내여야 합니다.');
    return;
  }
  // 중복 확인
  const isDuplicate = state.ingredients.some(
    (item) => item.toLowerCase() === clean.toLowerCase()
  );
  if (isDuplicate) {
    showMessage('info', `'${clean}' 재료는 이미 목록에 있습니다.`);
    return;
  }
  if (state.ingredients.length >= 20) {
    showMessage('error', '식재료는 최대 20개까지만 등록할 수 있습니다.');
    return;
  }

  state.ingredients.push(clean);
  renderIngredients();
  ingredientInput.value = '';
  ingredientInput.focus();
}

function removeIngredient(index) {
  state.ingredients.splice(index, 1);
  renderIngredients();
}

function renderIngredients() {
  ingredientChips.innerHTML = '';

  if (state.ingredients.length === 0) {
    ingredientChips.appendChild(emptyIngredientHint);
    emptyIngredientHint.classList.remove('hidden');
    btnClearIngredients.classList.add('hidden');
    return;
  }

  emptyIngredientHint.classList.add('hidden');
  btnClearIngredients.classList.remove('hidden');

  state.ingredients.forEach((name, idx) => {
    const chip = document.createElement('span');
    chip.className = 'chip';

    const textNode = document.createElement('span');
    textNode.textContent = name;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'chip-remove-btn';
    removeBtn.setAttribute('aria-label', `${name} 삭제`);
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => removeIngredient(idx));

    chip.appendChild(textNode);
    chip.appendChild(removeBtn);
    ingredientChips.appendChild(chip);
  });
}

// 3. 예시 재료 채우기
btnFillSample.addEventListener('click', () => {
  const sampleIngredients = ['양파', '달걀', '두부', '대파', '참치캔'];
  let addedCount = 0;
  sampleIngredients.forEach((item) => {
    if (!state.ingredients.includes(item) && state.ingredients.length < 20) {
      state.ingredients.push(item);
      addedCount++;
    }
  });
  renderIngredients();
  if (addedCount > 0) {
    showMessage('success', `${addedCount}개의 예시 재료가 추가되었습니다.`);
  } else {
    showMessage('info', '이미 예시 재료가 모두 추가되어 있습니다.');
  }
});

// 전체 비우기
btnClearIngredients.addEventListener('click', () => {
  if (confirm('등록된 모든 식재료를 비우시겠습니까?')) {
    state.ingredients = [];
    renderIngredients();
  }
});

// 식재료 입력 이벤트
btnAddIngredient.addEventListener('click', () => {
  addIngredient(ingredientInput.value);
});

ingredientInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addIngredient(ingredientInput.value);
  }
});

// 4. AI 레시피 추천 요청
async function fetchRecipes() {
  if (state.ingredients.length === 0) {
    showMessage('error', '식재료를 최소 1개 이상 입력해 주세요.');
    ingredientInput.focus();
    return;
  }

  const servings = Number(servingsSelect.value) || 2;
  const timeLimit = timeLimitSelect.value ? Number(timeLimitSelect.value) : null;
  const excludedIngredients = excludedInput.value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const preference = preferenceInput.value.trim();

  // 버튼 로딩 상태
  setLoadingState(btnGetRecipes, true, '🍳 AI가 레시피를 만드는 중...');
  setLoadingState(btnRefreshRecipes, true, '레시피 생성 중...');

  try {
    const res = await fetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ingredients: state.ingredients,
        servings,
        timeLimit,
        excludedIngredients,
        preference,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.recipes) {
      const errMsg = data.error?.message || '레시피를 추천받지 못했습니다.';
      showMessage('error', errMsg);
      return;
    }

    state.recipes = data.recipes;
    renderRecipes(state.recipes);
    recipeSection.classList.remove('hidden');
    recipeSection.scrollIntoView({ behavior: 'smooth' });
    showMessage('success', `${state.recipes.length}개의 맞춤 레시피가 준비되었습니다!`);
  } catch (err) {
    console.error(err);
    showMessage('error', '서버 통신 중 오류가 발생했습니다. 네트워크 상태를 확인해 주세요.');
  } finally {
    setLoadingState(btnGetRecipes, false, '🍳 맞춤 요리 추천받기');
    setLoadingState(btnRefreshRecipes, false, '🔄 다른 레시피 다시 받기');
  }
}

btnGetRecipes.addEventListener('click', fetchRecipes);
btnRefreshRecipes.addEventListener('click', fetchRecipes);

// 5. 레시피 결과 카드 렌더링
function renderRecipes(recipes) {
  recipeCardsContainer.innerHTML = '';

  recipes.forEach((recipe, idx) => {
    const card = document.createElement('article');
    card.className = 'recipe-card';

    // 카드 헤더
    const header = document.createElement('div');
    header.className = 'recipe-card-header';

    const titleGroup = document.createElement('div');
    const title = document.createElement('h3');
    title.className = 'recipe-card-title';
    title.textContent = `${idx + 1}. ${recipe.name}`;

    const metaBadges = document.createElement('div');
    metaBadges.className = 'recipe-meta-badges';

    const timeBadge = document.createElement('span');
    timeBadge.className = 'meta-badge';
    timeBadge.textContent = `⏱️ 약 ${recipe.cookingTime}분`;

    const diffBadge = document.createElement('span');
    diffBadge.className = 'meta-badge';
    diffBadge.textContent = `🔥 난이도: ${recipe.difficulty}`;

    metaBadges.appendChild(timeBadge);
    metaBadges.appendChild(diffBadge);
    titleGroup.appendChild(title);
    titleGroup.appendChild(metaBadges);

    header.appendChild(titleGroup);

    // 설명
    const desc = document.createElement('p');
    desc.className = 'recipe-desc';
    desc.textContent = recipe.description;

    // 재료 구성
    const detailsGrid = document.createElement('div');
    detailsGrid.className = 'recipe-details-grid';

    // 1) 보유 재료 박스
    const usedBox = document.createElement('div');
    usedBox.className = 'ingredient-box';
    const usedTitle = document.createElement('h4');
    usedTitle.textContent = '✅ 활용하는 보유 재료';
    const usedList = document.createElement('ul');
    usedList.className = 'ingredient-list';
    (recipe.usedIngredients || []).forEach((item) => {
      const li = document.createElement('li');
      const nameSpan = document.createElement('span');
      nameSpan.textContent = item.name;
      const amountSpan = document.createElement('span');
      amountSpan.textContent = item.amount;
      li.appendChild(nameSpan);
      li.appendChild(amountSpan);
      usedList.appendChild(li);
    });
    usedBox.appendChild(usedTitle);
    usedBox.appendChild(usedList);

    // 2) 추가 필요 재료 박스
    const extraBox = document.createElement('div');
    extraBox.className = 'ingredient-box';
    const extraTitle = document.createElement('h4');
    extraTitle.textContent = '🛒 추가 필요 재료/양념';
    const extraList = document.createElement('ul');
    extraList.className = 'ingredient-list';
    if (!recipe.extraIngredients || recipe.extraIngredients.length === 0) {
      const li = document.createElement('li');
      li.textContent = '추가 재료 없음 (기본 양념만 필요)';
      extraList.appendChild(li);
    } else {
      recipe.extraIngredients.forEach((item) => {
        const li = document.createElement('li');
        const nameSpan = document.createElement('span');
        nameSpan.textContent = item.name;
        const amountSpan = document.createElement('span');
        amountSpan.textContent = item.amount;
        li.appendChild(nameSpan);
        li.appendChild(amountSpan);
        extraList.appendChild(li);
      });
    }
    extraBox.appendChild(extraTitle);
    extraBox.appendChild(extraList);

    detailsGrid.appendChild(usedBox);
    detailsGrid.appendChild(extraBox);

    // 조리 순서
    const stepsContainer = document.createElement('div');
    stepsContainer.className = 'steps-container';
    const stepsTitle = document.createElement('h4');
    stepsTitle.textContent = '👩‍🍳 조리 순서';
    const stepsList = document.createElement('ol');
    stepsList.className = 'steps-list';
    (recipe.steps || []).forEach((step) => {
      const li = document.createElement('li');
      li.textContent = step;
      stepsList.appendChild(li);
    });
    stepsContainer.appendChild(stepsTitle);
    stepsContainer.appendChild(stepsList);

    // 주의사항
    const cautionBox = document.createElement('div');
    cautionBox.className = 'recipe-cautions';
    const cautionText = (recipe.cautions || []).join(' | ');
    cautionBox.textContent = `💡 팁/주의: ${cautionText}`;

    // 카드 푸터 (레시피 복사 버튼)
    const cardFooter = document.createElement('div');
    cardFooter.className = 'recipe-card-footer';
    const btnCopy = document.createElement('button');
    btnCopy.type = 'button';
    btnCopy.className = 'btn btn-secondary';
    btnCopy.textContent = '📋 레시피 복사';
    btnCopy.addEventListener('click', () => copyRecipe(recipe));
    cardFooter.appendChild(btnCopy);

    // 카드 조립
    card.appendChild(header);
    card.appendChild(desc);
    card.appendChild(detailsGrid);
    card.appendChild(stepsContainer);
    card.appendChild(cautionBox);
    card.appendChild(cardFooter);

    recipeCardsContainer.appendChild(card);
  });
}

// 6. 레시피 복사 기능
function copyRecipe(recipe) {
  let text = `[냉털셰프] ${recipe.name}\n`;
  text += `${recipe.description}\n`;
  text += `소요시간: 약 ${recipe.cookingTime}분 | 난이도: ${recipe.difficulty}\n\n`;

  text += `[보유 재료]\n`;
  (recipe.usedIngredients || []).forEach((i) => {
    text += `- ${i.name}: ${i.amount}\n`;
  });

  text += `\n[추가 재료]\n`;
  (recipe.extraIngredients || []).forEach((i) => {
    text += `- ${i.name}: ${i.amount}\n`;
  });

  text += `\n[조리 순서]\n`;
  (recipe.steps || []).forEach((s, idx) => {
    text += `${idx + 1}. ${s}\n`;
  });

  text += `\n[주의사항]\n${(recipe.cautions || []).join('\n')}`;

  navigator.clipboard.writeText(text).then(
    () => showMessage('success', `'${recipe.name}' 레시피가 클립보드에 복사되었습니다!`),
    () => showMessage('error', '클립보드 복사에 실패했습니다.')
  );
}

// 7. 피드백 입력 및 글자수 카운트
feedbackContent.addEventListener('input', () => {
  feedbackCharCount.textContent = feedbackContent.value.length;
});

async function submitFeedback() {
  const type = feedbackType.value;
  const rating = feedbackRating.value ? Number(feedbackRating.value) : null;
  const content = feedbackContent.value.trim();

  if (content.length < 5 || content.length > 500) {
    showMessage('error', '피드백 내용은 5자 이상 500자 이하로 작성해 주세요.');
    feedbackContent.focus();
    return;
  }

  setLoadingState(btnSubmitFeedback, true, '전송 중...');

  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, rating, content }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      showMessage('error', data.error?.message || '피드백 저장에 실패했습니다.');
      return;
    }

    showMessage('success', '소중한 피드백이 등록되었습니다. 감사합니다!');
    feedbackContent.value = '';
    feedbackCharCount.textContent = '0';
    loadFeedback();
  } catch (err) {
    console.error(err);
    showMessage('error', '피드백 전송 중 오류가 발생했습니다.');
  } finally {
    setLoadingState(btnSubmitFeedback, false, '피드백 남기기');
  }
}

btnSubmitFeedback.addEventListener('click', submitFeedback);

// 8. 피드백 목록 로드
async function loadFeedback() {
  try {
    const res = await fetch('/api/feedback');
    const data = await res.json();

    if (!res.ok || !data.ok) {
      feedbackList.innerHTML = '<p class="empty-feedback">피드백 목록을 가져오지 못했습니다.</p>';
      return;
    }

    renderFeedbackList(data.items || []);
  } catch (err) {
    console.error(err);
    feedbackList.innerHTML = '<p class="empty-feedback">피드백 목록을 불러올 수 없습니다.</p>';
  }
}

function renderFeedbackList(items) {
  feedbackList.innerHTML = '';

  if (items.length === 0) {
    feedbackList.innerHTML = '<p class="empty-feedback">아직 등록된 피드백이 없습니다. 첫 의견을 남겨주세요!</p>';
    return;
  }

  items.forEach((item) => {
    const el = document.createElement('div');
    el.className = 'feedback-item';

    const header = document.createElement('div');
    header.className = 'feedback-item-header';

    const left = document.createElement('div');
    const typeSpan = document.createElement('span');
    typeSpan.className = 'feedback-item-type';
    typeSpan.textContent = `[${item.type}]`;
    left.appendChild(typeSpan);

    if (item.rating) {
      const ratingSpan = document.createElement('span');
      ratingSpan.textContent = ` ${'⭐'.repeat(item.rating)}`;
      left.appendChild(ratingSpan);
    }

    const timeSpan = document.createElement('span');
    timeSpan.textContent = formatDate(item.created_at);

    header.appendChild(left);
    header.appendChild(timeSpan);

    const body = document.createElement('div');
    body.className = 'feedback-item-content';
    body.textContent = item.content; // XSS 방지

    el.appendChild(header);
    el.appendChild(body);
    feedbackList.appendChild(el);
  });
}

btnReloadFeedback.addEventListener('click', () => {
  loadFeedback();
});

function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// 9. 로딩 상태 헬퍼
function setLoadingState(button, isLoading, text) {
  button.disabled = isLoading;
  const textSpan = button.querySelector('.btn-text-content');
  const spinner = button.querySelector('.spinner');

  if (textSpan) textSpan.textContent = text;
  if (spinner) {
    if (isLoading) spinner.classList.remove('hidden');
    else spinner.classList.add('hidden');
  }
}

// 초기 로드
loadFeedback();

