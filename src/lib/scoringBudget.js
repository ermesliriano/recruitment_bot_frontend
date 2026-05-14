export function sumQuestionMaxPoints(questions = []) {
  return questions.reduce(
    (sum, question) => sum + (Number(question.max_points) || 0),
    0
  );
}

export function getVacancyBudget({ vacancy, questions = [], cvMaxScore }) {
  const normalizedCvMaxScore =
    cvMaxScore !== undefined && cvMaxScore !== null
      ? Number(cvMaxScore)
      : Number(vacancy?.cv_max_score) || 0;

  const questionsTotal = sumQuestionMaxPoints(questions);
  const total = normalizedCvMaxScore + questionsTotal;

  return {
    cvMaxScore: normalizedCvMaxScore,
    questionsTotal,
    total,
    isValid: total === 100,
  };
}

export function isActiveVacancy(vacancy) {
  return String(vacancy?.status || "").toLowerCase() === "active";
}
