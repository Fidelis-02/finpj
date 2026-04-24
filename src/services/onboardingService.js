const ONBOARDING_STEPS = [
    'verify-email',
    'profile',
    'plan',
    'template',
    'checklist',
    'first-value'
];

function normalizeStep(step) {
    const value = String(step || '').trim().toLowerCase();
    return ONBOARDING_STEPS.includes(value) ? value : '';
}

function sortCompletedSteps(steps = []) {
    const unique = Array.from(new Set(
        steps
            .map(normalizeStep)
            .filter(Boolean)
    ));
    return ONBOARDING_STEPS.filter((step) => unique.includes(step));
}

function getNextStep(completedSteps = []) {
    const completed = new Set(sortCompletedSteps(completedSteps));
    return ONBOARDING_STEPS.find((step) => !completed.has(step)) || 'dashboard';
}

function createInitialOnboardingState(user = {}) {
    const completedSteps = user.emailVerifiedAt ? ['verify-email'] : [];
    const currentStep = getNextStep(completedSteps);
    const now = new Date().toISOString();
    return {
        userId: user.id,
        email: user.email,
        currentStep,
        completedSteps,
        data: {},
        completedAt: currentStep === 'dashboard' ? now : null,
        createdAt: now,
        updatedAt: now,
        lastActiveAt: now
    };
}

function mergeOnboardingState(current = {}, input = {}) {
    const completedSteps = input.completed === true
        ? sortCompletedSteps([...(current.completedSteps || []), input.step])
        : sortCompletedSteps(current.completedSteps || []);
    const nextStep = getNextStep(completedSteps);
    const mergedData = {
        ...(current.data || {})
    };

    if (normalizeStep(input.step) && input.data && typeof input.data === 'object') {
        mergedData[input.step] = {
            ...(mergedData[input.step] || {}),
            ...input.data
        };
    }

    const now = new Date().toISOString();
    return {
        ...current,
        currentStep: nextStep,
        completedSteps,
        data: mergedData,
        updatedAt: now,
        lastActiveAt: now,
        completedAt: nextStep === 'dashboard' ? (current.completedAt || now) : null
    };
}

module.exports = {
    ONBOARDING_STEPS,
    normalizeStep,
    sortCompletedSteps,
    getNextStep,
    createInitialOnboardingState,
    mergeOnboardingState
};
