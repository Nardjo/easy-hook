// https://nuxt.com/docs/api/configuration/nuxt-config

export default defineNuxtConfig({
	compatibilityDate: "2025-05-15",
	devtools: { enabled: true },

	future: {
		compatibilityVersion: 4,
	},

	css: ["~/assets/css/main.css"],

	modules: ["@nuxt/ui-pro"],

	// Optimisations pour les performances
	nitro: {
		compressPublicAssets: true,
		routeRules: {
			'/**': {
				headers: {
					'Cross-Origin-Opener-Policy': 'same-origin',
					'Cross-Origin-Embedder-Policy': 'require-corp'
				}
			}
		}
	},

	app: {
		head: {
			charset: 'utf-8',
			viewport: 'width=device-width, initial-scale=1',
			meta: [
				{ name: 'description', content: 'Application de traitement vidéo optimisée' }
			],
			htmlAttrs: {
				lang: 'fr'
			}
		},
		// Optimisation du chargement
		pageTransition: { name: 'page', mode: 'out-in' }
	},

	vite: {
		// Optimisations pour les performances
		optimizeDeps: {
			esbuildOptions: {
				target: 'esnext'
			}
		},
		// Optimisations Vite pour les performances
		build: {
			target: 'esnext',
			minify: 'terser',
			terserOptions: {
				compress: {
					drop_console: false, // Garder les logs pour le débogage
					pure_funcs: ['console.debug']
				}
			}
		}
	},

	// Configuration pour le développement
	typescript: {
		strict: true,
		typeCheck: true
	}
});
