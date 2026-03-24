export type GradientPeriod = 'morning' | 'afternoon' | 'evening' | 'night';

export const GRADIENT_COLORS: Record<GradientPeriod, string[]> = {
  morning: [
    'rgb(0,3,14)',
    'rgb(8,49,136)',
    'rgb(45,120,230)',
    'rgb(148,205,255)',
    'rgb(249,253,255)',
  ],
  afternoon: [
    'rgb(14,8,0)',
    'rgb(136,80,8)',
    'rgb(230,160,45)',
    'rgb(255,220,148)',
    'rgb(255,253,249)',
  ],
  evening: [
    'rgb(3,0,14)',
    'rgb(49,8,100)',
    'rgb(100,45,180)',
    'rgb(180,148,255)',
    'rgb(253,249,255)',
  ],
  night: [
    'rgb(0,0,8)',
    'rgb(5,5,30)',
    'rgb(10,10,40)',
  ],
};

export const GRADIENT_LOCATIONS: Record<GradientPeriod, number[]> = {
  morning:   [0, 0.18, 0.40, 0.57, 1.0],
  afternoon: [0, 0.18, 0.40, 0.57, 1.0],
  evening:   [0, 0.18, 0.40, 0.57, 1.0],
  night:     [0, 0.40, 1.0],
};
