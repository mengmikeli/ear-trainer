// src/lib/learning/index.ts — Re-export learning modules

export {
	pickItem,
	generateDistractors,
	intervalSimilarity,
	chordSimilarity,
	scaleSimilarity,
	modeSimilarity,
} from './engine';

export {
	responseQuality,
	calculateSm2,
	type ResponseInput,
	type Sm2Result,
} from './sm2';

export {
	getConnectionBoost,
	populateRelatedItems,
	getConnectionDescription,
	CURATED_CONNECTIONS,
	type Connection,
} from './connections';
