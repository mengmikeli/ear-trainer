import type { ThemeMode } from './types';

export function applyTheme(mode: ThemeMode): void {
	const resolved =
		mode === 'system'
			? window.matchMedia('(prefers-color-scheme: light)').matches
				? 'light'
				: 'dark'
			: mode;
	document.documentElement.setAttribute('data-theme', resolved);
}

export function initTheme(mode?: ThemeMode): void {
	applyTheme(mode || 'dark');
}

export function watchSystemTheme(mode: ThemeMode, cb: () => void): (() => void) | undefined {
	if (mode !== 'system') return;
	const mq = window.matchMedia('(prefers-color-scheme: light)');
	const handler = () => cb();
	mq.addEventListener('change', handler);
	return () => mq.removeEventListener('change', handler);
}
