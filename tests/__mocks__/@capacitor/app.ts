// Mock @capacitor/app for Node test environment (no `document` available)
export const App = {
	addListener: () => Promise.resolve({ remove: () => {} }),
	getState: () => Promise.resolve({ isActive: true }),
	exitApp: () => Promise.resolve(),
	getInfo: () => Promise.resolve({ name: '', id: '', build: '', version: '' }),
	getLaunchUrl: () => Promise.resolve({ url: '' }),
	minimizeApp: () => Promise.resolve()
};
